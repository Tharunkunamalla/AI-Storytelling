# AI Storytelling App

A full-stack application that generates cinematic stories using AI. This represents **Phase 1** of the AI Storyteller project.

## Tech Stack
- **Frontend**: React (Vite) + Framer Motion (Animations) + Lucide (Icons) + Vanilla CSS
- **Backend**: FastAPI (Python)
- **AI**: OpenAI API

## Getting Started

### 1. Server Setup (Backend)

1. Navigate to the `server` directory:
   ```bash
   cd server
   ```
2. Create a virtual environment and activate it:
   ```bash
   python -m venv venv
   # Windows
   .\venv\Scripts\activate
   # macOS/Linux
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up your OpenAI API Key:
   Open `server/.env` and add your actual API key:
   ```
   OPENAI_API_KEY=sk-your-key-here
   ```
5. Run the server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   The backend will be available at `http://localhost:8000`.

### 2. Client Setup (Frontend)

1. Open a new terminal and navigate to the `client` directory:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open the provided local URL (usually `http://localhost:5173`) in your browser to start generating stories!

<!--## Future Phases
- **Phase 2**: Add Image Generation (Stable Diffusion API)
- **Phase 3**: Add Voice Narration (ElevenLabs / Google TTS)
- **Phase 4**: Convert into Video Reels
-->
