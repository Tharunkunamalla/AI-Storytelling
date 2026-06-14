from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
import os
import uuid
# pyrefly: ignore [missing-import]
from openai import AsyncOpenAI
from dotenv import load_dotenv
import uvicorn
from gcp_manager import GCPManager

load_dotenv()

app = FastAPI(title="AI Storytelling App API")

gcp_mgr = GCPManager()
in_memory_stories = {}

def update_story_asset(story_id: str, asset_type: str, index: int = None, url: str = ""):
    # 1. Update in-memory storage
    if story_id in in_memory_stories:
        story = in_memory_stories[story_id]
        if asset_type == "image" and index is not None:
            if index < len(story["scenes"]):
                story["scenes"][index]["image_url"] = url
        elif asset_type == "audio" and index is not None:
            if index < len(story["scenes"]):
                story["scenes"][index]["audio_url"] = url
        elif asset_type == "music":
            story["bgMusicUrl"] = url
            
    # 2. Update Firestore
    if gcp_mgr.firestore_enabled:
        try:
            doc_ref = gcp_mgr.firestore_client.collection("stories").document(story_id)
            doc = doc_ref.get()
            if doc.exists:
                story_data = doc.to_dict()
                if asset_type == "image" and index is not None:
                    if index < len(story_data["scenes"]):
                        story_data["scenes"][index]["image_url"] = url
                elif asset_type == "audio" and index is not None:
                    if index < len(story_data["scenes"]):
                        story_data["scenes"][index]["audio_url"] = url
                elif asset_type == "music":
                    story_data["bgMusicUrl"] = url
                
                # Check if all media links are generated to set status to "completed"
                all_done = True
                for s in story_data["scenes"]:
                    if not s.get("image_url") or not s.get("audio_url"):
                        all_done = False
                if not story_data.get("bgMusicUrl"):
                    all_done = False
                
                if all_done:
                    story_data["status"] = "completed"
                    
                doc_ref.set(story_data)
        except Exception as e:
            print(f"Error updating story asset in Firestore: {e}")

frontend_origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://localhost:3000"
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup the AI Client lazily so the app can start without API credentials.
def get_llm_client():
    groq_api_key = os.getenv("GROQ_API_KEY")
    if groq_api_key:
        return AsyncOpenAI(
            api_key=groq_api_key,
            base_url="https://api.groq.com/openai/v1",
        ), "llama-3.1-8b-instant"

    openai_api_key = os.getenv("OPENAI_API_KEY")
    if openai_api_key:
        return AsyncOpenAI(api_key=openai_api_key), "gpt-3.5-turbo"

    return None, None

import json
from typing import List

class Scene(BaseModel):
    text: str
    image_prompt: str

class StoryRequest(BaseModel):
    prompt: str

class StoryResponse(BaseModel):
    story_id: str
    title: str
    scenes: List[Scene]

@app.post("/api/generate-story", response_model=StoryResponse)
async def generate_story(req: StoryRequest):
    llm_client, model_name = get_llm_client()
    if llm_client is None:
        raise HTTPException(
            status_code=500,
            detail="API key not configured. Please add GROQ_API_KEY or OPENAI_API_KEY to .env",
        )
    try:
        response = await llm_client.chat.completions.create(
            model=model_name,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system", 
                    "content": "You are a cinematic story writer. You MUST output your response as a valid JSON object. The JSON object must contain exactly two keys: 'title' (a string) and 'scenes' (a list of objects). Each object in the 'scenes' list must have two keys: 'text' (the narrative paragraph, around 3-4 sentences) and 'image_prompt' (a highly detailed, comma-separated descriptive prompt for an AI image generator to visualize the paragraph, e.g., 'cyberpunk city, neon lights, flying cars, 8k resolution, cinematic lighting, masterpiece'). Generate a story with exactly 3 to 4 scenes."
                },
                {"role": "user", "content": f"Write a story about: {req.prompt}"}
            ],
            temperature=0.7,
            max_tokens=2000
        )
        content = response.choices[0].message.content
        data = json.loads(content)
        
        story_id = str(uuid.uuid4())
        
        # Save to memory and database
        story_doc = {
            "story_id": story_id,
            "title": data["title"],
            "prompt": req.prompt,
            "scenes": [
                {
                    "text": s["text"],
                    "image_prompt": s["image_prompt"],
                    "image_url": "",
                    "audio_url": ""
                } for s in data["scenes"]
            ],
            "bgMusicUrl": "",
            "status": "generating"
        }
        in_memory_stories[story_id] = story_doc
        if gcp_mgr.firestore_enabled:
            gcp_mgr.save_story(story_id, story_doc)
            
        return StoryResponse(
            story_id=story_id,
            title=data["title"],
            scenes=[Scene(**s) for s in data["scenes"]]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

import httpx
from fastapi.responses import Response
import urllib.parse
import random
import asyncio

# Prevent concurrent requests to the free API to avoid rate limits
image_semaphore = None

async def _generate_image_bytes_internal(prompt: str) -> tuple[bytes, str]:
    global image_semaphore
    if image_semaphore is None:
        image_semaphore = asyncio.Semaphore(1)
        
    safe_prompt = urllib.parse.quote(prompt.strip()[:150])
    
    async with image_semaphore:
        # 1. Try Hugging Face API via synchronous InferenceClient in a thread
        hf_api_key = os.getenv("HUGGINGFACE_API_KEY")
        if hf_api_key:
            print("Attempting Hugging Face API generation via synchronous InferenceClient...")
            hf_models = [
                "stabilityai/stable-diffusion-xl-base-1.0",
                "prompthero/openjourney",
                "runwayml/stable-diffusion-v1-5"
            ]
            for model in hf_models:
                try:
                    from huggingface_hub import InferenceClient
                    import io
                    def fetch_hf():
                        client = InferenceClient(token=hf_api_key)
                        return client.text_to_image(prompt, model=model)
                    
                    image = await asyncio.to_thread(fetch_hf)
                    buf = io.BytesIO()
                    image.save(buf, format="JPEG")
                    print(f"Hugging Face ({model}) generation successful!")
                    return buf.getvalue(), "image/jpeg"
                except Exception as e:
                    err_str = str(e)
                    if "402" in err_str:
                        print(f"Hugging Face ({model}) error: Monthly quota depleted! Please update HUGGINGFACE_API_KEY in .env with a new account key.")
                    else:
                        print(f"Hugging Face ({model}) exception: {err_str}")

        # Add a 5-second delay to prevent burst rate-limiting (HTTP 402) on free public APIs between scenes
        await asyncio.sleep(5)

        async with httpx.AsyncClient() as client:
            # 2. Fallback to Pollinations
            last_error = None
            pollinations_configs = [
                ("https://image.pollinations.ai/prompt", "flux"),
                ("https://pollinations.ai/p", "turbo"),
                ("https://image.pollinations.ai/prompt", "flux-realism"),
                ("https://pollinations.ai/p", "any-dark"),
                ("https://image.pollinations.ai/prompt", "default")
            ]
            for base_url, model_opt in pollinations_configs:
                seed = random.randint(1, 100000)
                url = f"{base_url}/{safe_prompt}?width=800&height=450&model={model_opt}&seed={seed}&nologo=true"
                try:
                    resp = await client.get(url, timeout=30.0, follow_redirects=True)
                    if resp.status_code == 200 and "image" in resp.headers.get("content-type", "").lower():
                        print(f"Pollinations ({model_opt} via {base_url}) generation successful!")
                        return resp.content, "image/jpeg"
                    last_error = f"HTTP {resp.status_code} (Content-Type: {resp.headers.get('content-type')})"
                except Exception as e:
                    last_error = str(e)
                
                print(f"Pollinations ({model_opt}) failed... Error: {last_error}")
                await asyncio.sleep(3)

            # 3. Fallback to Free AI Image Proxy
            try:
                airforce_url = f"https://api.airforce/v1/imagine2?prompt={safe_prompt}&size=16:9"
                air_resp = await client.get(airforce_url, timeout=20.0, follow_redirects=True)
                if air_resp.status_code == 200 and "image" in air_resp.headers.get("content-type", "").lower():
                    print("Airforce API generation successful!")
                    return air_resp.content, "image/jpeg"
                else:
                    print(f"Airforce API skipped due to invalid content-type: {air_resp.headers.get('content-type')}")
            except Exception as e:
                print(f"Airforce API fallback failed: {e}")
                
            # 4. Final Fallback to Guaranteed CDN Placeholder (Dicebear Bottts)
            try:
                seed = urllib.parse.quote(prompt.strip()[:50])
                fallback_url = f"https://api.dicebear.com/8.x/bottts-neutral/png?seed={seed}&size=400"
                fallback_resp = await client.get(fallback_url, timeout=15.0, follow_redirects=True)
                if fallback_resp.status_code == 200 and "image" in fallback_resp.headers.get("content-type", "").lower():
                    return fallback_resp.content, "image/png"
            except Exception as e:
                print(f"Dicebear fallback failed: {e}")
                
            # 5. Absolute Final DummyImage Fallback (Guaranteed 200 OK)
            try:
                dummy_text = urllib.parse.quote("MythWeaver Scene")
                dummy_url = f"https://dummyimage.com/800x450/14050a/e11d48.png&text={dummy_text}"
                dummy_resp = await client.get(dummy_url, timeout=10.0, follow_redirects=True)
                if dummy_resp.status_code == 200:
                    return dummy_resp.content, "image/png"
            except Exception as e:
                print(f"DummyImage fallback failed: {e}")
                
            raise HTTPException(status_code=500, detail="All image generation methods failed.")

@app.get("/api/image")
async def get_image(prompt: str, story_id: str = None, scene_index: int = None):
    if gcp_mgr.storage_enabled and story_id and scene_index is not None:
        blob_path = f"stories/{story_id}/scene_{scene_index}.jpg"
        try:
            blob = gcp_mgr.bucket.blob(blob_path)
            if blob.exists():
                print(f"Serving image from GCS cache for story {story_id} scene {scene_index}")
                return RedirectResponse(url=blob.public_url)
        except Exception as e:
            print(f"Error checking GCS image cache: {e}")
            
    # Generate new image bytes
    image_bytes, media_type = await _generate_image_bytes_internal(prompt)
    
    # Upload to GCP if enabled
    if gcp_mgr.storage_enabled and story_id and scene_index is not None:
        blob_path = f"stories/{story_id}/scene_{scene_index}.jpg"
        public_url = gcp_mgr.upload_media(image_bytes, blob_path, media_type)
        if public_url:
            update_story_asset(story_id, "image", scene_index, public_url)
            
    return Response(content=image_bytes, media_type=media_type)

async def _generate_audio_bytes_internal(text: str) -> tuple[bytes, str]:
    text = text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")
        
    elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
    
    if elevenlabs_api_key:
        voice_id = "pNInz6obpgDQGcFmaJgB"
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": elevenlabs_api_key
        }
        data = {
            "text": text,
            "model_id": "eleven_turbo_v2_5",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75
            }
        }
        
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(url, json=data, headers=headers, timeout=30.0)
                if resp.status_code == 200:
                    return resp.content, "audio/mpeg"
                else:
                    print(f"ElevenLabs error {resp.status_code}: {resp.text}")
            except Exception as e:
                print(f"ElevenLabs exception: {e}")

    # Fallback to Google TTS
    try:
        from gtts import gTTS
        import io
        tts = gTTS(text=text, lang='en')
        buf = io.BytesIO()
        tts.write_to_fp(buf)
        return buf.getvalue(), "audio/mpeg"
    except Exception as e:
        print(f"gTTS exception: {e}")
        raise HTTPException(status_code=500, detail="Audio generation failed")

@app.get("/api/audio")
async def get_audio(text: str, story_id: str = None, scene_index: int = None):
    if gcp_mgr.storage_enabled and story_id and scene_index is not None:
        blob_path = f"stories/{story_id}/scene_{scene_index}.mp3"
        try:
            blob = gcp_mgr.bucket.blob(blob_path)
            if blob.exists():
                print(f"Serving audio from GCS cache for story {story_id} scene {scene_index}")
                return RedirectResponse(url=blob.public_url)
        except Exception as e:
            print(f"Error checking GCS audio cache: {e}")
            
    # Generate new audio bytes
    audio_bytes, media_type = await _generate_audio_bytes_internal(text)
    
    # Upload to GCP if enabled
    if gcp_mgr.storage_enabled and story_id and scene_index is not None:
        blob_path = f"stories/{story_id}/scene_{scene_index}.mp3"
        public_url = gcp_mgr.upload_media(audio_bytes, blob_path, media_type)
        if public_url:
            update_story_asset(story_id, "audio", scene_index, public_url)
            
    return Response(content=audio_bytes, media_type=media_type)

async def _generate_music_bytes_internal(prompt: str) -> tuple[bytes, str]:
    safe_prompt = urllib.parse.quote(prompt.strip()[:100])
    suno_api_key = os.getenv("SUNO_API_KEY")
    
    async with httpx.AsyncClient() as client:
        if suno_api_key:
            print("Attempting Suno API music generation...")
            try:
                suno_url = "https://api.sunoaiapi.com/api/v1/generate"
                headers = {"Authorization": f"Bearer {suno_api_key}"}
                payload = {"prompt": f"cinematic background music for story: {prompt}", "make_instrumental": True}
                resp = await client.post(suno_url, json=payload, headers=headers, timeout=35.0)
                if resp.status_code == 200:
                    data = resp.json()
                    audio_url = data.get("audio_url") or (data.get("data", {}).get("audio_url"))
                    if audio_url:
                        mp3_resp = await client.get(audio_url, timeout=20.0)
                        if mp3_resp.status_code == 200:
                            print("Suno API music generation successful!")
                            return mp3_resp.content, "audio/mpeg"
            except Exception as e:
                print(f"Suno API exception: {e}")
                
        # Fallback to Curated Cinematic BGM
        print("Falling back to curated cinematic BGM tracks...")
        prompt_lower = prompt.lower()
        if any(w in prompt_lower for w in ["cyberpunk", "future", "sci-fi", "robot", "space", "city"]):
            bgm_url = "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Volatile%20Reaction.mp3"
        elif any(w in prompt_lower for w in ["dark", "sorcerer", "magic", "demon", "horror", "mystery"]):
            bgm_url = "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Sinister%20Dark.mp3"
        elif any(w in prompt_lower for w in ["peaceful", "calm", "cloud", "dream", "forest", "wise", "love"]):
            bgm_url = "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Enchanted%20Valley.mp3"
        else:
            bgm_url = "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Lord%20of%20the%20Land.mp3"
            
        try:
            bgm_resp = await client.get(bgm_url, timeout=20.0, follow_redirects=True)
            if bgm_resp.status_code == 200:
                return bgm_resp.content, "audio/mpeg"
        except Exception as e:
            print(f"Curated BGM fallback failed: {e}")
            
        raise HTTPException(status_code=500, detail="Music generation failed")

@app.get("/api/music")
async def get_music(prompt: str, story_id: str = None):
    if gcp_mgr.storage_enabled and story_id:
        blob_path = f"stories/{story_id}/music.mp3"
        try:
            blob = gcp_mgr.bucket.blob(blob_path)
            if blob.exists():
                print(f"Serving music from GCS cache for story {story_id}")
                return RedirectResponse(url=blob.public_url)
        except Exception as e:
            print(f"Error checking GCS music cache: {e}")
            
    # Generate new music bytes
    music_bytes, media_type = await _generate_music_bytes_internal(prompt)
    
    # Upload to GCP if enabled
    if gcp_mgr.storage_enabled and story_id:
        blob_path = f"stories/{story_id}/music.mp3"
        public_url = gcp_mgr.upload_media(music_bytes, blob_path, media_type)
        if public_url:
            update_story_asset(story_id, "music", url=public_url)
            
    return Response(content=music_bytes, media_type=media_type)

@app.get("/api/stories")
def get_stories(limit: int = 12):
    if gcp_mgr.firestore_enabled:
        return gcp_mgr.get_recent_stories(limit=limit)
    else:
        # Fallback to local in-memory stories, sorted by creation (which is dict insertion order / reverse)
        return list(in_memory_stories.values())[::-1][:limit]

@app.get("/api/health")
def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
    )
