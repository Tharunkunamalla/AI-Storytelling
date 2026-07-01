# services.py

import os
import io
import random
import asyncio
import urllib.parse
import httpx
from openai import AsyncOpenAI
from fastapi import HTTPException
from config import VOICE_MAP, FALLBACK_ACCENTS, POLLINATIONS_CONFIGS, CURATED_BGM

# Prevent concurrent requests to the free API to avoid rate limits
image_semaphore = None

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

async def generate_image_bytes_internal(prompt: str) -> tuple[bytes, str]:
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
            for base_url, model_opt in POLLINATIONS_CONFIGS:
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

async def generate_audio_bytes_internal(text: str, voice: str = "adam") -> tuple[bytes, str]:
    text = text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")
        
    elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
    voice_id = VOICE_MAP.get(voice.lower(), VOICE_MAP["adam"])
    
    if elevenlabs_api_key:
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

    # Fallback to Google TTS with regional accents
    try:
        from gtts import gTTS
        
        lang, tld = FALLBACK_ACCENTS.get(voice.lower(), ("en", "co.uk"))
        
        tts = gTTS(text=text, lang=lang, tld=tld)
        buf = io.BytesIO()
        tts.write_to_fp(buf)
        return buf.getvalue(), "audio/mpeg"
    except Exception as e:
        print(f"gTTS exception: {e}")
        raise HTTPException(status_code=500, detail="Audio generation failed")

async def get_bgm_url(prompt: str, mood: str = "orchestral") -> str:
    suno_api_key = os.getenv("SUNO_API_KEY")
    
    async with httpx.AsyncClient() as client:
        if suno_api_key:
            print("Attempting Suno API music generation...")
            try:
                suno_url = "https://api.sunoaiapi.com/api/v1/generate"
                headers = {"Authorization": f"Bearer {suno_api_key}"}
                suno_prompt = f"cinematic instrumental BGM, style: {prompt}, mood: {mood}"
                payload = {"prompt": suno_prompt[:150], "make_instrumental": True}
                resp = await client.post(suno_url, json=payload, headers=headers, timeout=35.0)
                if resp.status_code == 200:
                    data = resp.json()
                    audio_url = data.get("audio_url") or (data.get("data", {}).get("audio_url"))
                    if audio_url:
                        print("Suno API music generation successful!")
                        return audio_url
            except Exception as e:
                print(f"Suno API exception: {e}")
                
        # Fallback to Curated Cinematic BGM based on selected mood
        print(f"Falling back to curated BGM matching mood: {mood}...")
        return CURATED_BGM.get(mood.lower(), CURATED_BGM["orchestral"])
