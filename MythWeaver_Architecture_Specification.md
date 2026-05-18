# 🌌 MythWeaver: Full Project Architecture & Technical Specification

MythWeaver is a premium, cinematic AI storytelling platform built with a **React (Vite) + Framer Motion** frontend and a **FastAPI (Python)** backend. It transforms simple user prompts into rich, multi-part audio-visual narratives complete with AI-generated background art, synchronized voice narration, and exportable PDF manuscripts.

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
            │ POST /generate   │ GET /audio & /image
            ▼                  ▼
┌────────────────────────────────────────────────────────┐
│                 FastAPI Backend Server                 │
│                                                        │
│  ┌─────────────────┐ ┌───────────────┐ ┌────────────┐  │
│  │   LLM Router    │ │ Image Engine  │ │ TTS Engine │  │
│  └────────┬────────┘ └───────┬───────┘ └─────┬──────┘  │
└───────────┼──────────────────┼───────────────┼─────────┘
            │                  │               │
            ▼                  ▼               ▼
     ┌─────────────┐    ┌─────────────┐ ┌──────────────┐
     │ OpenAI/Groq │    │ HuggingFace │ │ ElevenLabs / │
     │ LLM API     │    │ SDXL/Mirrors│ │ Google TTS   │
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

### 3. AI Image Generation & The 5-Tier Redundancy Chain
To ensure users are always greeted with stunning visual backdrops, the backend features a highly advanced, rate-limit-resistant image generation pipeline:
1. **Hugging Face Inference (Tier 1)**: Uses official synchronous `InferenceClient` calls inside `asyncio.to_thread` to fetch premium Stable Diffusion XL art without blocking the server loop.
2. **Pollinations CDN Mirrors (Tier 2)**: Cycles through multiple hostnames (`image.pollinations.ai`, `pollinations.ai/p`) and diverse model clusters (`flux`, `turbo`, `flux-realism`, `any-dark`) with a built-in 5-second buffer delay to bypass strict IP rate limits.
3. **Airforce AI Proxy (Tier 3)**: Acts as a free backup proxy for high-quality 16:9 AI imagery.
4. **Dicebear Bottts (Tier 4)**: Fallback avatar generator if public AI models are overloaded.
5. **DummyImage CDN (Tier 5)**: Absolute final fallback ensuring a guaranteed `200 OK` image placeholder to prevent frontend rendering crashes.
* **Strict Content-Type Validation**: Every API response is strictly filtered (`"image" in resp.headers['content-type']`). If a service returns an HTML Cloudflare challenge or a JSON error string, the backend instantly rejects it and moves to the next working tier.

### 4. Cinematic Animations & Transitions (`Framer Motion`)
The entire user interface is designed to feel alive, premium, and deeply immersive.
* **AnimatePresence**: Handles smooth mounting and unmounting of screens. When a story generates, the home screen gracefully fades out while the cinematic story viewer slides in.
* **Slide Transitions**: Switching between story scenes triggers complex Framer Motion choreography (`x: direction * 100`, `scale: 1.05`, `filter: blur(10px)`), creating an elegant, dramatic cross-fade effect.
* **Glassmorphism & Micro-Animations**: Buttons and panels utilize translucent backgrounds (`rgba(255,255,255,0.03)`), backdrop blurs, glowing hover states, and smooth scaling effects.

---

## 🏆 Summary of Engineering Solutions Implemented

1. **Global Uvicorn Execution Fix (`server/main.py`)**: Injected dynamic `sys.path` resolution at the very top of the backend entry point. This allows Uvicorn to automatically discover and load virtual environment dependencies (`openai`, `fastapi`, etc.) even if executed globally without activating `venv`.
2. **Eliminated Python 3.12 Async Generator Crashes**: Replaced the buggy `AsyncInferenceClient` (which threw `StopIteration` coroutine errors) with the highly stable, synchronous `InferenceClient` running inside `asyncio.to_thread`.
3. **Bypassed CDN Rate Limits & Broken Images**: Instituted strict `Content-Type` header verification to prevent Cloudflare HTML challenge pages from rendering as black/broken boxes on the frontend. Added a 5-second semaphore delay and multi-mirror CDN cycling to prevent Pollinations from rejecting back-to-back scene requests.
4. **Perfected UI Geometry (`client/src/App.css`)**: Resolved a Flexbox centering conflict on the home screen by replacing `margin-top` with `transform: translateY(-35px)` on the Phase Badge, achieving the exact visual lift and premium spacing required.
