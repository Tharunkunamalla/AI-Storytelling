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

class StoryRequest(BaseModel):
    prompt: str

class StoryResponse(BaseModel):
    story: str

@app.post("/api/generate-story", response_model=StoryResponse)
async def generate_story(req: StoryRequest):
    if not llm_client.api_key:
        raise HTTPException(status_code=500, detail="API key not configured. Please add GROQ_API_KEY to .env")
    try:
        response = await llm_client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "You are a creative and visionary story writer. Generate a short, engaging, cinematic story based on the user's prompt. The story should be around 3 to 4 paragraphs, suitable for a dynamic visual and audio narrative. Use vivid descriptions and powerful vocabulary."},
                {"role": "user", "content": req.prompt}
            ],
            temperature=0.7,
            max_tokens=800
        )
        story = response.choices[0].message.content
        return StoryResponse(story=story)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
def health_check():
    return {"status": "ok"}
