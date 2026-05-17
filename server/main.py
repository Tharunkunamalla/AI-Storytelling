from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
# pyrefly: ignore [missing-import]
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="AI Storytelling App API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
        async with httpx.AsyncClient() as client:
            
            # 1. Try Hugging Face Stable Diffusion XL if API key is provided (Best Quality)
            hf_api_key = os.getenv("HUGGINGFACE_API_KEY")
            if hf_api_key:
                print("Attempting Hugging Face API generation...")
                try:
                    from huggingface_hub import AsyncInferenceClient
                    import io
                    # Use a fast and reliable model like FLUX.1-schnell
                    hf_client = AsyncInferenceClient(token=hf_api_key)
                    image = await hf_client.text_to_image(prompt, model="black-forest-labs/FLUX.1-schnell")
                    buf = io.BytesIO()
                    image.save(buf, format="JPEG")
                    return Response(content=buf.getvalue(), media_type="image/jpeg")
                except Exception as e:
                    print(f"Hugging Face API exception: {e}")

            # 2. Fallback to Pollinations (Free public AI)
            last_error = None
            for attempt in range(3):
                seed = random.randint(1, 100000)
                # Removed &model=flux as it is currently broken and causes extreme rate limiting
                url = f"https://image.pollinations.ai/prompt/{safe_prompt}?nologo=true&seed={seed}"
                try:
                    resp = await client.get(url, timeout=30.0, follow_redirects=True)
                    if resp.status_code == 200:
                        return Response(content=resp.content, media_type="image/jpeg")
                    if resp.status_code == 402:
                        print("Pollinations API 402 Payment Required - Quota Exhausted for this model")
                    last_error = f"HTTP {resp.status_code}"
                except Exception as e:
                    last_error = str(e)
                
                print(f"Pollinations Attempt {attempt + 1} failed... Error: {last_error}")
                await asyncio.sleep(2)
                
            # 3. Final Fallback to Stock Photos (To prevent app crash)
            try:
                words = [w for w in prompt.split() if len(w) > 4]
                keyword = urllib.parse.quote(words[0]) if words else "scifi"
                fallback_url = f"https://loremflickr.com/800/450/{keyword}?lock={random.randint(1,10000)}"
                fallback_resp = await client.get(fallback_url, timeout=15.0, follow_redirects=True)
                if fallback_resp.status_code == 200:
                    return Response(content=fallback_resp.content, media_type="image/jpeg")
            except Exception as e:
                print(f"Fallback also failed: {e}")
                
            raise HTTPException(status_code=500, detail="All image generation methods failed.")

@app.get("/api/audio")
async def get_audio(text: str):
    text = text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")
        
    elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
    
    if elevenlabs_api_key:
        # Use ElevenLabs with a standard voice id (Rachel)
        voice_id = "21m00Tcm4TlvDq8ikWAM"
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": elevenlabs_api_key
        }
        data = {
            "text": text,
            "model_id": "eleven_monolingual_v1",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.5
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

@app.get("/api/health")
def health_check():
    return {"status": "ok"}
