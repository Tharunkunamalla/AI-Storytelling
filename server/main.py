from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
# pyrefly: ignore [missing-import]
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="AI Storytelling App API")

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

# Setup the AI Client
# We check for GROQ_API_KEY first as a free alternative, then fallback to OpenAI
groq_api_key = os.getenv("GROQ_API_KEY")
if groq_api_key:
    llm_client = AsyncOpenAI(
        api_key=groq_api_key,
        base_url="https://api.groq.com/openai/v1"
    )
    model_name = "llama-3.1-8b-instant"
else:
    llm_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))
    model_name = "gpt-3.5-turbo"

import json
from typing import List

class Scene(BaseModel):
    text: str
    image_prompt: str

class StoryRequest(BaseModel):
    prompt: str

class StoryResponse(BaseModel):
    title: str
    scenes: List[Scene]

@app.post("/api/generate-story", response_model=StoryResponse)
async def generate_story(req: StoryRequest):
    if not llm_client.api_key:
        raise HTTPException(status_code=500, detail="API key not configured. Please add GROQ_API_KEY to .env")
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
        return StoryResponse(**data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

import httpx
from fastapi.responses import Response
import urllib.parse
import random
import asyncio

# Prevent concurrent requests to the free API to avoid rate limits
image_semaphore = None

@app.get("/api/image")
async def get_image(prompt: str):
    global image_semaphore
    if image_semaphore is None:
        image_semaphore = asyncio.Semaphore(1)
        
    safe_prompt = urllib.parse.quote(prompt.strip()[:150])
    
    async with image_semaphore:
        # 1. Try Hugging Face API via synchronous InferenceClient in a thread
        # This completely fixes the Python 3.12 AsyncInferenceClient StopIteration bug and 404 proxy errors
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
                    return Response(content=buf.getvalue(), media_type="image/jpeg")
                except Exception as e:
                    err_str = str(e)
                    if "402" in err_str:
                        print(f"Hugging Face ({model}) error: Monthly quota depleted! Please update HUGGINGFACE_API_KEY in .env with a new account key.")
                    else:
                        print(f"Hugging Face ({model}) exception: {err_str}")

        # Add a 5-second delay to prevent burst rate-limiting (HTTP 402) on free public APIs between scenes
        await asyncio.sleep(5)

        async with httpx.AsyncClient() as client:
            # 2. Fallback to Pollinations with multiple host mirrors and models to bypass IP rate limits
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
                        return Response(content=resp.content, media_type="image/jpeg")
                    last_error = f"HTTP {resp.status_code} (Content-Type: {resp.headers.get('content-type')})"
                except Exception as e:
                    last_error = str(e)
                
                print(f"Pollinations ({model_opt}) failed... Error: {last_error}")
                await asyncio.sleep(3)

            # 3. Fallback to Free AI Image Proxy (api.airforce) with strict content-type validation
            try:
                airforce_url = f"https://api.airforce/v1/imagine2?prompt={safe_prompt}&size=16:9"
                air_resp = await client.get(airforce_url, timeout=20.0, follow_redirects=True)
                if air_resp.status_code == 200 and "image" in air_resp.headers.get("content-type", "").lower():
                    print("Airforce API generation successful!")
                    return Response(content=air_resp.content, media_type="image/jpeg")
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
                    return Response(content=fallback_resp.content, media_type="image/png")
            except Exception as e:
                print(f"Dicebear fallback failed: {e}")
                
            # 5. Absolute Final DummyImage Fallback (Guaranteed 200 OK)
            try:
                dummy_text = urllib.parse.quote("MythWeaver Scene")
                dummy_url = f"https://dummyimage.com/800x450/14050a/e11d48.png&text={dummy_text}"
                dummy_resp = await client.get(dummy_url, timeout=10.0, follow_redirects=True)
                if dummy_resp.status_code == 200:
                    return Response(content=dummy_resp.content, media_type="image/png")
            except Exception as e:
                print(f"DummyImage fallback failed: {e}")
                
            raise HTTPException(status_code=500, detail="All image generation methods failed.")

@app.get("/api/audio")
async def get_audio(text: str):
    text = text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")
        
    elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
    
    if elevenlabs_api_key:
        # Some Great ElevenLabs Voice IDs:
        # "pNInz6obpgDQGcFmaJgB" - Adam (Clear, fast-paced, American)
        # "21m00Tcm4TlvDq8ikWAM" - Rachel (Calm, narration, American)
        # "TxGEqnHWrfWFTfGW9XjX" - Josh (Deep, narration, American)
        # "EXAVITQu4vr4xnSDxMaL" - Bella (Soft, fast, American)
        
        voice_id = "pNInz6obpgDQGcFmaJgB" # Currently set to Adam for faster pacing
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": elevenlabs_api_key
        }
        data = {
            "text": text,
            "model_id": "eleven_turbo_v2_5", # Turbo model generates audio much faster
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75
            }
        }
        
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(url, json=data, headers=headers, timeout=30.0)
                if resp.status_code == 200:
                    return Response(content=resp.content, media_type="audio/mpeg")
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
        return Response(content=buf.getvalue(), media_type="audio/mpeg")
    except Exception as e:
        print(f"gTTS exception: {e}")
        raise HTTPException(status_code=500, detail="Audio generation failed")

@app.get("/api/music")
async def get_music(prompt: str):
    safe_prompt = urllib.parse.quote(prompt.strip()[:100])
    suno_api_key = os.getenv("SUNO_API_KEY")
    
    async with httpx.AsyncClient() as client:
        if suno_api_key:
            print("Attempting Suno API music generation...")
            try:
                # Example Suno API call (using common unofficial/official wrapper format)
                suno_url = "https://api.sunoaiapi.com/api/v1/generate"
                headers = {"Authorization": f"Bearer {suno_api_key}"}
                payload = {"prompt": f"cinematic background music for story: {prompt}", "make_instrumental": True}
                resp = await client.post(suno_url, json=payload, headers=headers, timeout=35.0)
                if resp.status_code == 200:
                    data = resp.json()
                    # Extract audio url from response
                    audio_url = data.get("audio_url") or (data.get("data", {}).get("audio_url"))
                    if audio_url:
                        mp3_resp = await client.get(audio_url, timeout=20.0)
                        if mp3_resp.status_code == 200:
                            print("Suno API music generation successful!")
                            return Response(content=mp3_resp.content, media_type="audio/mpeg")
            except Exception as e:
                print(f"Suno API exception: {e}")
                
        # Fallback to Curated Royalty-Free Cinematic BGM Tracks based on prompt keyword matching
        print("Falling back to curated cinematic BGM tracks...")
        prompt_lower = prompt.lower()
        if any(w in prompt_lower for w in ["cyberpunk", "future", "sci-fi", "robot", "space", "city"]):
            bgm_url = "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Volatile%20Reaction.mp3"
        elif any(w in prompt_lower for w in ["dark", "sorcerer", "magic", "demon", "horror", "mystery"]):
            bgm_url = "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Sinister%20Dark.mp3"
        elif any(w in prompt_lower for w in ["peaceful", "calm", "cloud", "dream", "forest", "wise", "love"]):
            bgm_url = "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Enchanted%20Valley.mp3"
        else: # Default Epic Fantasy / Medieval / Adventure
            bgm_url = "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Lord%20of%20the%20Land.mp3"
            
        try:
            bgm_resp = await client.get(bgm_url, timeout=20.0, follow_redirects=True)
            if bgm_resp.status_code == 200:
                return Response(content=bgm_resp.content, media_type="audio/mpeg")
        except Exception as e:
            print(f"Curated BGM fallback failed: {e}")
            
        raise HTTPException(status_code=500, detail="Music generation failed")

@app.get("/api/health")
def health_check():
    return {"status": "ok"}
