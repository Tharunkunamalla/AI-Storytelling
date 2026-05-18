# 🌌 MythWeaver: Cinematic AI Storytelling Platform

MythWeaver is a premium, full-stack AI storytelling application built with **React (Vite) + Framer Motion** on the frontend and **FastAPI (Python)** on the backend. It transforms simple user prompts into rich, multi-part audio-visual narratives complete with AI-generated background art, synchronized voice narration, dynamic background music, and exportable PDF manuscripts.

---

## 🌟 Key Features

* **📖 AI Story Generation**: Uses OpenAI / Groq LLMs to craft structured, multi-scene narratives with tailored visual and audio prompts.
* **🎨 AI Image Generation (5-Tier Redundancy)**: Generates stunning 16:9 cinematic backdrops utilizing Hugging Face Stable Diffusion XL (`asyncio.to_thread`), multi-mirror Pollinations CDN rotation, Airforce AI proxy, Dicebear, and DummyImage fallbacks.
* **🎧 Synchronized Voice Narration**: Features premium ElevenLabs TTS (Turbo model, Adam voice) with real-time word highlighting (`InteractiveAudioText`) and seamless fallback to Google TTS (`gTTS`).
* **🎼 AI Background Music (Suno API & Curated CDNs)**: Generates dynamic AI background music via Suno API (`SUNO_API_KEY`) or serves curated, high-quality royalty-free cinematic BGM tracks matching the prompt's genre keywords (`cyberpunk`, `dark`, `peaceful`, `magic`, etc.).
* **🎛️ Right-Side Expanding Volume Pill**: A premium glassmorphism popover pill at the top right that expands smoothly on click to reveal a volume slider (`min="0" max="1" step="0.01"`) and percentage label, defaulting to a perfectly mixed `15%` background volume.
* **📥 Dynamic PDF Export (`jsPDF`)**: Client-side generated PDF manuscripts complete with custom canvas watermarking and smart pagination.
* **✨ Flawless Cinematic Animations**: Built with Framer Motion `AnimatePresence`. The top controls, bottom navigation bar, and scene images are fully unified in the DOM lifecycle, ensuring pixel-perfect transition synchronization across all story slides.

---

## tech Stack

* **Frontend**: React (Vite), Framer Motion (Choreography & Layout), Lucide React (Icons), Vanilla CSS (Glassmorphism & Rich Aesthetics).
* **Backend**: FastAPI (Python), Uvicorn, HTTPX (Async API Client), Pillow, gTTS.
* **AI APIs**: OpenAI / Groq (Text), Hugging Face / Pollinations (Images), ElevenLabs (Voice), Suno API (Music).

---

## 🚀 Getting Started

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
4. Set up your Environment Variables:
   Open `server/.env` and configure your API keys:
   ```env
   OPENAI_API_KEY=sk-your-openai-key
   HUGGINGFACE_API_KEY=hf_your_huggingface_token
   ELEVENLABS_API_KEY=xi-api-key-here
   SUNO_API_KEY=your_suno_api_key_optional
   ```
5. Run the server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   *(Note: `main.py` includes automatic `sys.path` injection, allowing seamless execution even if run globally outside the venv).*

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
4. Open `http://localhost:5173` in your browser to experience MythWeaver!

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────┐
│                 Client Browser (React)                 │
│                                                        │
│  ┌─────────────────┐ ┌───────────────┐ ┌────────────┐  │
│  │ Cinematic View  │ │  Audio Sync   │ │ jsPDF Gen  │  │
│  └────────┬────────┘ └───────┬───────┘ └────────────┘  │
└───────────┼──────────────────┼─────────────────────────┘
            │ POST /generate   │ GET /audio, /image, /music
            ▼                  ▼
┌────────────────────────────────────────────────────────┐
│                 FastAPI Backend Server                 │
│                                                        │
│  ┌─────────────────┐ ┌───────────────┐ ┌────────────┐  │
│  │   LLM Router    │ │ Image Engine  │ │ Audio/BGM  │  │
│  └────────┬────────┘ └───────┬───────┘ └─────┬──────┘  │
└───────────┼──────────────────┼───────────────┼─────────┘
            │                  │               │
            ▼                  ▼               ▼
     ┌─────────────┐    ┌─────────────┐ ┌──────────────┐
     │ OpenAI/Groq │    │ HuggingFace │ │ ElevenLabs / │
     │ LLM API     │    │ SDXL/Mirrors│ │ Suno / gTTS  │
     └─────────────┘    └─────────────┘ └──────────────┘
```
