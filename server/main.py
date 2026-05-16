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
            last_error = None
            for attempt in range(3):
                seed = random.randint(1, 100000)
                url = f"https://image.pollinations.ai/prompt/{safe_prompt}?nologo=true&seed={seed}"
                try:
                    resp = await client.get(url, timeout=20.0, follow_redirects=True)
                    if resp.status_code == 200:
                        return Response(content=resp.content, media_type="image/jpeg")
                    if resp.status_code == 402:
                        # 402 means free quota exhausted, break to fallback
                        print("Pollinations API 402 Payment Required - Quota Exhausted")
                        break
                    last_error = f"HTTP {resp.status_code}"
                except Exception as e:
                    last_error = str(e)
                
                print(f"Attempt {attempt + 1} failed for {safe_prompt[:20]}... Error: {last_error}")
                await asyncio.sleep(2)
                
            # If Pollinations completely fails or hits 402 quota limit, fallback to stock photos based on prompt keywords
            try:
                words = [w for w in prompt.split() if len(w) > 4]
                keyword = urllib.parse.quote(words[0]) if words else "scifi"
                fallback_url = f"https://loremflickr.com/800/450/{keyword}?lock={random.randint(1,10000)}"
                fallback_resp = await client.get(fallback_url, timeout=15.0, follow_redirects=True)
                if fallback_resp.status_code == 200:
                    return Response(content=fallback_resp.content, media_type="image/jpeg")
            except Exception as e:
                print(f"Fallback also failed: {e}")
                
            raise HTTPException(status_code=500, detail=f"Image fetch failed entirely. Pollinations error: {last_error}")

@app.get("/api/health")
def health_check():
    return {"status": "ok"}
