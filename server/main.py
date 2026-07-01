from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
import os
import uuid
import json
from datetime import datetime
from typing import List
from dotenv import load_dotenv
import uvicorn
from gcp_manager import GCPManager

# Import modular configs and services
from config import GENRE_PROMPTS
from services import (
    get_llm_client,
    generate_image_bytes_internal,
    generate_audio_bytes_internal,
    get_bgm_url
)

load_dotenv()

app = FastAPI(title="AI Storytelling App API")

gcp_mgr = GCPManager()
in_memory_stories = {}
LOCAL_STORIES_FILE = "stories_local.json"

def load_local_stories():
    global in_memory_stories
    if os.path.exists(LOCAL_STORIES_FILE):
        try:
            with open(LOCAL_STORIES_FILE, "r", encoding="utf-8") as f:
                in_memory_stories = json.load(f)
                print(f"Loaded {len(in_memory_stories)} stories from local storage file '{LOCAL_STORIES_FILE}'.")
        except Exception as e:
            print(f"Error loading local stories file: {e}")
            in_memory_stories = {}
    else:
        in_memory_stories = {}

def save_local_stories():
    try:
        with open(LOCAL_STORIES_FILE, "w", encoding="utf-8") as f:
            json.dump(in_memory_stories, f, indent=2)
            print(f"Saved stories to local storage file '{LOCAL_STORIES_FILE}'.")
    except Exception as e:
        print(f"Error saving local stories file: {e}")

# Load stories on startup
load_local_stories()

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

    # 3. Write/Update story.json in GCS
    if gcp_mgr.storage_enabled and story_id in in_memory_stories:
        try:
            story_data = in_memory_stories[story_id]
            all_done = True
            for s in story_data["scenes"]:
                if not s.get("image_url") or not s.get("audio_url"):
                    all_done = False
            if not story_data.get("bgMusicUrl"):
                all_done = False
            
            if all_done:
                story_data["status"] = "completed"
                
            json_bytes = json.dumps(story_data, indent=2).encode("utf-8")
            gcp_mgr.upload_media(json_bytes, f"stories/{story_id}/story.json", "application/json")
            print(f"Updated story.json in GCS for story {story_id}")
        except Exception as e:
            print(f"Error saving story.json to GCS: {e}")

    # 4. Save to local stories file
    save_local_stories()

# CORS Middlewares
frontend_origins_str = os.getenv("FRONTEND_ORIGINS")
if frontend_origins_str:
    frontend_origins = [orig.strip() for orig in frontend_origins_str.split(",") if orig.strip()]
    frontend_origins = [orig.rstrip("/") for orig in frontend_origins]
else:
    frontend_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True if frontend_origins != ["*"] else False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Scene(BaseModel):
    text: str
    image_prompt: str

class StoryRequest(BaseModel):
    prompt: str
    genre: str = "adventure"
    mood: str = "orchestral"

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
        genre_instruction = GENRE_PROMPTS.get(req.genre.lower(), GENRE_PROMPTS["adventure"])

        response = await llm_client.chat.completions.create(
            model=model_name,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system", 
                    "content": f"You are a cinematic story writer. {genre_instruction} You MUST output your response as a valid JSON object. The JSON object must contain exactly two keys: 'title' (a string) and 'scenes' (a list of objects). Each object in the 'scenes' list must have two keys: 'text' (the narrative paragraph, around 3-4 sentences) and 'image_prompt' (a highly detailed, comma-separated descriptive prompt for an AI image generator to visualize the paragraph, e.g., 'cyberpunk city, neon lights, flying cars, 8k resolution, cinematic lighting, masterpiece'). Generate a story with exactly 3 to 4 scenes."
                },
                {"role": "user", "content": f"Write a story about: {req.prompt}"}
            ],
            temperature=0.7,
            max_tokens=2000
        )
        content = response.choices[0].message.content
        data = json.loads(content)
        
        story_id = str(uuid.uuid4())
        
        story_doc = {
            "story_id": story_id,
            "title": data["title"],
            "prompt": req.prompt,
            "genre": req.genre,
            "mood": req.mood,
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
        save_local_stories()
        if gcp_mgr.firestore_enabled:
            gcp_mgr.save_story(story_id, story_doc)
            
        return StoryResponse(
            story_id=story_id,
            title=data["title"],
            scenes=[Scene(**s) for s in data["scenes"]]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
            
    image_bytes, media_type = await generate_image_bytes_internal(prompt)
    
    if gcp_mgr.storage_enabled and story_id and scene_index is not None:
        blob_path = f"stories/{story_id}/scene_{scene_index}.jpg"
        public_url = gcp_mgr.upload_media(image_bytes, blob_path, media_type)
        if public_url:
            update_story_asset(story_id, "image", scene_index, public_url)
            
    return Response(content=image_bytes, media_type=media_type)

@app.get("/api/audio")
async def get_audio(text: str, voice: str = "adam", story_id: str = None, scene_index: int = None):
    if gcp_mgr.storage_enabled and story_id and scene_index is not None:
        blob_path = f"stories/{story_id}/scene_{scene_index}_{voice}.mp3"
        try:
            blob = gcp_mgr.bucket.blob(blob_path)
            if blob.exists():
                print(f"Serving audio from GCS cache for story {story_id} scene {scene_index} voice {voice}")
                return RedirectResponse(url=blob.public_url)
        except Exception as e:
            print(f"Error checking GCS audio cache: {e}")
            
    audio_bytes, media_type = await generate_audio_bytes_internal(text, voice)
    
    if gcp_mgr.storage_enabled and story_id and scene_index is not None:
        blob_path = f"stories/{story_id}/scene_{scene_index}_{voice}.mp3"
        public_url = gcp_mgr.upload_media(audio_bytes, blob_path, media_type)
        if public_url:
            update_story_asset(story_id, "audio", scene_index, public_url)
            
    return Response(content=audio_bytes, media_type=media_type)

@app.get("/api/music")
async def get_music(prompt: str, mood: str = "orchestral", story_id: str = None):
    bgm_url = await get_bgm_url(prompt, mood)
    
    if story_id:
        update_story_asset(story_id, "music", url=bgm_url)
        
    return RedirectResponse(url=bgm_url)

@app.get("/api/stories")
def get_stories(limit: int = 12):
    if gcp_mgr.firestore_enabled:
        return gcp_mgr.get_recent_stories(limit=limit)
    else:
        return list(in_memory_stories.values())[::-1][:limit]

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

class FeedbackRequest(BaseModel):
    email: str
    category: str
    message: str

@app.post("/api/feedback")
async def receive_feedback(req: FeedbackRequest):
    feedback_item = {
        "id": str(uuid.uuid4()),
        "email": req.email,
        "category": req.category,
        "message": req.message,
        "created_at": datetime.utcnow().isoformat()
    }
    
    try:
        feedback_list = []
        if os.path.exists("feedback.json"):
            with open("feedback.json", "r", encoding="utf-8") as f:
                try:
                    feedback_list = json.load(f)
                    if not isinstance(feedback_list, list):
                        feedback_list = []
                except Exception:
                    feedback_list = []
        feedback_list.append(feedback_item)
        with open("feedback.json", "w", encoding="utf-8") as f:
            json.dump(feedback_list, f, indent=2)
        print(f"Saved feedback {feedback_item['id']} locally.")
    except Exception as e:
        print(f"Error saving feedback locally: {e}")

    if gcp_mgr.firestore_enabled:
        try:
            doc_ref = gcp_mgr.firestore_client.collection("feedback").document(feedback_item["id"])
            doc_ref.set(feedback_item)
            print(f"Saved feedback {feedback_item['id']} to Firestore.")
        except Exception as e:
            print(f"Error saving feedback to Firestore: {e}")

    return {"status": "ok", "message": "Feedback received successfully"}

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
    )
