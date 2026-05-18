# 🌌 MythWeaver: Full Project Architecture & Technical Specification

MythWeaver is a premium, cinematic AI storytelling platform built with a **React (Vite) + Framer Motion** frontend and a **FastAPI (Python)** backend. It transforms simple user prompts into rich, multi-part audio-visual narratives complete with AI-generated background art, synchronized voice narration, dynamic background music, and exportable PDF manuscripts.

---

## 🏗️ System Architecture Overview

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

---

## 🛠️ Core Subsystem Mechanics

### 1. Dynamic PDF Generation & Watermarking (`jsPDF`)
Users can download their generated stories as beautifully formatted, professional PDF manuscripts directly from the browser.
* **Client-Side Generation**: When the user clicks the Download button, the app dynamically imports `jspdf`. This ensures heavy PDF libraries don't slow down the initial website load time.
* **Canvas Watermarking**: The app loads the `logo.png` onto a hidden HTML5 `<canvas>` to extract its base64 data. It then applies a semi-transparent graphics state (`opacity: 0.1`) to imprint a professional background watermark and "MythWeaver" seal onto the center of every page.
* **Smart Pagination**: Using `doc.splitTextToSize()`, the app calculates the exact word wrapping for the user's screen width and automatically generates new watermarked pages whenever the story text exceeds the vertical page boundary.

### 2. Interactive Audio Syncing & Narration (`InteractiveAudioText`)
The narration system doesn't just play audio—it actively synchronizes the spoken voice with the text on screen.
* **Dual TTS Engine**: The backend attempts to generate studio-quality narration using **ElevenLabs** (Adam voice, Turbo model). If ElevenLabs runs out of character quota, the backend instantly falls back to **Google TTS (`gTTS`)** so the story never stays silent.
* **Real-Time Word Highlighting**: As the `<audio>` element plays, the `onTimeUpdate` event listener tracks the exact playback progress (`currentTime / duration`). The component splits the scene paragraph into an array of words and calculates the `currentWordIndex`. Words up to this index dynamically receive the `.spoken` CSS class, illuminating them in real-time.
* **Interactive Seeking**: Clicking on any word calculates its percentage position within the paragraph (`index / totalWords`) and updates `audioRef.current.currentTime`, allowing users to jump directly to specific parts of the narration.

### 3. AI Background Music & Curated BGM Fallbacks (`/api/music`)
To enhance the cinematic immersion, every story is accompanied by dynamic, genre-appropriate background music.
* **Suno API Integration**: If `SUNO_API_KEY` is configured in `.env`, the backend calls Suno AI endpoints to generate a bespoke instrumental background track matching the user's story prompt.
* **Curated Royalty-Free Fallback Chain**: To guarantee 100% reliability, if Suno API is unconfigured or rate-limited, the backend scans the prompt for genre keywords (`cyberpunk`, `dark`, `peaceful`, `magic`, `city`, etc.) and serves a perfectly matched high-quality cinematic BGM track from a reliable CDN.
* **Right-Side Expanding Volume Pill**: The frontend features a beautiful glassmorphism popover pill at the top right. Clicking the speaker icon smoothly expands the pill via Framer Motion spring animation (maintaining a perfect `borderRadius: 24px` without oval distortion) to reveal a volume slider and percentage label.
* **Soft Audio Mixing**: Background music defaults to a soft `15%` volume (`0.15`), ensuring it perfectly complements the spoken voice narration without overpowering it.

### 4. AI Image Generation & The 5-Tier Redundancy Chain
To ensure users are always greeted with stunning visual backdrops, the backend features a highly advanced, rate-limit-resistant image generation pipeline:
1. **Hugging Face Inference (Tier 1)**: Uses official synchronous `InferenceClient` calls inside `asyncio.to_thread` to fetch premium Stable Diffusion XL art without blocking the server loop.
2. **Pollinations CDN Mirrors (Tier 2)**: Cycles through multiple hostnames (`image.pollinations.ai`, `pollinations.ai/p`) and diverse model clusters (`flux`, `turbo`, `flux-realism`, `any-dark`) with a built-in 5-second buffer delay to bypass strict IP rate limits.
3. **Airforce AI Proxy (Tier 3)**: Acts as a free backup proxy for high-quality 16:9 AI imagery.
4. **Dicebear Bottts (Tier 4)**: Fallback avatar generator if public AI models are overloaded.
5. **DummyImage CDN (Tier 5)**: Absolute final fallback ensuring a guaranteed `200 OK` image placeholder to prevent frontend rendering crashes.
* **Strict Content-Type Validation**: Every API response is strictly filtered (`"image" in resp.headers['content-type']`). If a service returns an HTML Cloudflare challenge or a JSON error string, the backend instantly rejects it and moves to the next working tier.

### 5. Cinematic Animations & Transitions (`Framer Motion`)
The entire user interface is designed to feel alive, premium, and deeply immersive.
* **Unified DOM Choreography**: The top controls (Music pill, Download, Close) and bottom story navigation bar (`story-nav`) are placed directly inside the animated `scene-slide` container within `AnimatePresence`. This ensures that whenever the user switches slides, all buttons and controls exit and enter in perfect, pixel-locked synchronization with the scene image transitions.
* **Slide Transitions**: Switching between story scenes triggers complex Framer Motion choreography (`x: direction * 100`, `scale: 1.05`, `filter: blur(10px)`), creating an elegant, dramatic cross-fade effect.
* **Glassmorphism & Micro-Animations**: Buttons and panels utilize translucent backgrounds (`rgba(255,255,255,0.03)`), backdrop blurs, glowing hover states, and smooth scaling effects (`whileHover={{ scale: 1.1 }}`).

---

## 🏆 Summary of Engineering Solutions Implemented

1. **Global Uvicorn Execution Fix (`server/main.py`)**: Injected dynamic `sys.path` resolution at the very top of the backend entry point. This allows Uvicorn to automatically discover and load virtual environment dependencies (`openai`, `fastapi`, etc.) even if executed globally without activating `venv`.
2. **Eliminated Python 3.12 Async Generator Crashes**: Replaced the buggy `AsyncInferenceClient` (which threw `StopIteration` coroutine errors) with the highly stable, synchronous `InferenceClient` running inside `asyncio.to_thread`.
3. **Bypassed CDN Rate Limits & Broken Images**: Instituted strict `Content-Type` header verification to prevent Cloudflare HTML challenge pages from rendering as black/broken boxes on the frontend. Added a 5-second semaphore delay and multi-mirror CDN cycling to prevent Pollinations from rejecting back-to-back scene requests.
4. **Flawless BGM & UI Synchronization**: Integrated Suno API music generation with curated BGM fallbacks, designed a distortion-free expanding volume popover pill, and unified all navigation controls inside `AnimatePresence` for 100% perfect slide transition synchronization.
