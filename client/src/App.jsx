import React, {useState, useRef, useEffect} from "react";
import {
  Sparkles,
  Loader2,
  BookOpen,
  Info,
  HelpCircle,
  Mic,
} from "lucide-react";
import {motion, AnimatePresence} from "framer-motion";
import "./App.css";
import AboutOverlay from "./AboutOverlay";
import HelpOverlay from "./HelpOverlay";
import StoryViewer from "./StoryViewer";
import CinematicControls from "./CinematicControls";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
).replace(/\/$/, "");



function App() {
  const [prompt, setPrompt] = useState("");
  const [storyData, setStoryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preloading, setPreloading] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [error, setError] = useState("");
  const [serverConnected, setServerConnected] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [recentStories, setRecentStories] = useState([]);
  const [loadingStories, setLoadingStories] = useState(false);

  const [selectedVoice, setSelectedVoice] = useState("adam");
  const [selectedGenre, setSelectedGenre] = useState("adventure");
  const [selectedMood, setSelectedMood] = useState("orchestral");
  const [showSettings, setShowSettings] = useState(false);

  const [activeOverlay, setActiveOverlay] = useState(null); // 'about' | 'help' | null
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };

      rec.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please use Chrome or Safari.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  // Poll server connection on mount
  useEffect(() => {
    let active = true;
    const checkConnection = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/health`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "ok" && active) {
            setServerConnected(true);
            setCheckingConnection(false);
            return;
          }
        }
      } catch (e) {
        console.log("Server not ready, retrying...", e);
      }
      if (active) {
        setTimeout(checkConnection, 2500);
      }
    };
    checkConnection();
    return () => {
      active = false;
    };
  }, []);

  const fetchRecentStories = async () => {
    setLoadingStories(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/stories`);
      if (res.ok) {
        const data = await res.json();
        setRecentStories(data);
      }
    } catch (e) {
      console.error("Error fetching recent stories:", e);
    } finally {
      setLoadingStories(false);
    }
  };

  useEffect(() => {
    if (serverConnected) {
      fetchRecentStories();
    }
  }, [serverConnected]);

  const playSavedStory = (story) => {
    const playData = {
      title: story.title,
      bgMusicUrl: story.bgMusicUrl || `${API_BASE_URL}/api/music?prompt=${encodeURIComponent(story.prompt.slice(0, 100))}&mood=${story.mood || "orchestral"}&story_id=${story.story_id}`,
      scenes: story.scenes.map((s, index) => ({
        text: s.text,
        image_prompt: s.image_prompt,
        cachedImageUrl: s.image_url || s.cachedImageUrl,
        cachedAudioUrl: s.audio_url || s.cachedAudioUrl || `${API_BASE_URL}/api/audio?text=${encodeURIComponent(s.text)}&voice=${story.voice || "adam"}&story_id=${story.story_id}&scene_index=${index}`,
      })),
    };
    setStoryData(playData);
  };

  const generateStory = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError("");

    try {
      // 1. Generate text first
      const response = await fetch(`${API_BASE_URL}/api/generate-story`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          prompt,
          genre: selectedGenre,
          mood: selectedMood
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to generate story");
      }

      const data = await response.json();

      // 2. Preload all assets (images + audio) before showing
      setLoading(false);
      setPreloading(true);

      const totalAssets = data.scenes.length * 2;
      let loaded = 0;

      const updateProgress = () => {
        loaded++;
        setPreloadProgress(Math.round((loaded / totalAssets) * 100));
      };

      const promises = data.scenes.map(async (scene, index) => {
        // Preload Image
        const imgPrompt = encodeURIComponent(
          scene.image_prompt
            .replace(/[^a-zA-Z0-9 ,]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 150),
        );
        const imgUrl = `${API_BASE_URL}/api/image?prompt=${imgPrompt}&story_id=${data.story_id}&scene_index=${index}`;
        try {
          const imgRes = await fetch(imgUrl);
          const imgBlob = await imgRes.blob();
          scene.cachedImageUrl = URL.createObjectURL(imgBlob);
        } catch (e) {
          scene.cachedImageUrl = imgUrl; // fallback
        }
        updateProgress();

        // Preload Audio
        const audioUrl = `${API_BASE_URL}/api/audio?text=${encodeURIComponent(scene.text)}&voice=${selectedVoice}&story_id=${data.story_id}&scene_index=${index}`;
        try {
          const audioRes = await fetch(audioUrl);
          const audioBlob = await audioRes.blob();
          scene.cachedAudioUrl = URL.createObjectURL(audioBlob);
        } catch (e) {
          scene.cachedAudioUrl = audioUrl; // fallback
        }
        updateProgress();
      });

      await Promise.all(promises);

      // Background Music BGM (bypass pre-fetch to avoid CORS redirect issues)
      const bgmUrl = `${API_BASE_URL}/api/music?prompt=${encodeURIComponent(prompt.trim().slice(0, 100))}&mood=${selectedMood}&story_id=${data.story_id}`;
      data.bgMusicUrl = bgmUrl;
      setStoryData(data);
      setPreloading(false);
      setPreloadProgress(0);
      setPrompt("");
      fetchRecentStories(); // Refresh feed
    } catch (err) {
      setError(
        err.message ||
          "An error occurred while generating your story. Please try again.",
      );
      console.error(err);
      setLoading(false);
      setPreloading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="bg-objects">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>
      <AnimatePresence mode="wait">
        {!serverConnected ? (
          <motion.div
            key="connecting"
            className="server-connecting-fullscreen"
            initial={{opacity: 1}}
            exit={{opacity: 0}}
            transition={{duration: 0.5}}
          >
            <div className="bg-objects">
              <div className="orb orb-1"></div>
              <div className="orb orb-2"></div>
            </div>
            <motion.div
              className="connecting-card glass-panel"
              initial={{opacity: 0, scale: 0.9}}
              animate={{opacity: 1, scale: 1}}
              transition={{type: "spring", stiffness: 100, damping: 15}}
            >
              <div className="connecting-loader-wrapper">
                <Loader2 className="spinner-large" size={48} color="#e11d48" />
                <div className="loader-ring-glow"></div>
              </div>
              <h2 className="gradient-text connecting-title">Connecting to Server</h2>
              <p className="connecting-desc">
                Waking up the backend. Since the server is hosted on a free Render instance, it automatically spins down after inactivity. This cold-start can take up to a minute.
              </p>
              <div className="pulse-container">
                <div className="pulse-circle"></div>
                <span className="pulse-text">Establishing secure connection...</span>
              </div>
            </motion.div>
          </motion.div>
        ) : !storyData ? (
          <motion.div
            key="home"
            className="home-view"
            initial={{opacity: 0, y: 10}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, scale: 0.95}}
            transition={{duration: 0.5}}
          >
            <header className="header">
              <motion.div
                initial={{opacity: 0, y: -20}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.5}}
              >
                <div className="phase-badge glass-panel">
                  <Sparkles className="icon" size={24} color="#ec4848ff" />
                  <span style={{color: "#cf7171ff"}}>Powered by AI</span>
                </div>
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    marginBottom: "40px",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: "40%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      fontSize: "clamp(80px, 15vw, 180px)",
                      fontWeight: 900,
                      color: "transparent",
                      WebkitTextStroke: "1px rgba(225, 29, 72, 0.15)",
                      whiteSpace: "nowrap",
                      zIndex: 0,
                      pointerEvents: "none",
                      userSelect: "none",
                      letterSpacing: "8px",
                    }}
                  >
                    MYTHWEAVER
                  </div>

                  <h1
                    className="title gradient-text"
                    style={{position: "relative", zIndex: 1, margin: 0}}
                  >
                    MythWeaver
                  </h1>
                </div>
                <p className="subtitle">
                  Enter a prompt and watch as AI crafts a cinematic narrative
                  just for you.
                </p>
              </motion.div>
            </header>

            <main className="main-content">
              <motion.form
                onSubmit={generateStory}
                className="prompt-form glass-panel"
                initial={{opacity: 0, scale: 0.95}}
                animate={{opacity: 1, scale: 1}}
                transition={{duration: 0.5, delay: 0.2}}
              >
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="A dragon protecting a futuristic city..."
                  className="prompt-input"
                  disabled={loading || preloading}
                />
                
                {/* Voice Dictation Mic Button */}
                <button
                  type="button"
                  className={`voice-mic-btn ${isListening ? "listening" : ""}`}
                  onClick={toggleListening}
                  disabled={loading || preloading}
                  title={isListening ? "Listening... Click to stop" : "Talk instead of typing"}
                >
                  <Mic size={20} color={isListening ? "#f43f5e" : "#cbd5e1"} />
                  {isListening && <span className="mic-pulse-ring"></span>}
                </button>
                <button
                  type="submit"
                  disabled={loading || preloading || !prompt.trim()}
                  className="submit-btn"
                >
                  {loading ? (
                    <>
                      <Loader2 className="spinner" size={20} />
                      <span>Writing Story...</span>
                    </>
                  ) : preloading ? (
                    <>
                      <Loader2 className="spinner" size={20} />
                      <span>{preloadProgress}% Loaded</span>
                    </>
                  ) : (
                    <>
                      <BookOpen size={20} />
                      <span>Create Story</span>
                    </>
                  )}
                </button>
              </motion.form>

              {/* Cinematic Selection Controls */}
              <CinematicControls
                selectedVoice={selectedVoice}
                setSelectedVoice={setSelectedVoice}
                selectedGenre={selectedGenre}
                setSelectedGenre={setSelectedGenre}
                selectedMood={selectedMood}
                setSelectedMood={setSelectedMood}
                showSettings={showSettings}
                setShowSettings={setShowSettings}
                loading={loading}
                preloading={preloading}
              />

              {preloading && (
                <div className="preload-bar-container">
                  <div className="preload-text">
                    Generating images & voice narration... {preloadProgress}%
                  </div>
                  <div className="preload-bar-track">
                    <div
                      className="preload-bar-fill"
                      style={{width: `${preloadProgress}%`}}
                    ></div>
                  </div>
                </div>
              )}

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{opacity: 0, y: 10}}
                    animate={{opacity: 1, y: 0}}
                    exit={{opacity: 0, y: -10}}
                    className="error-message"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Recent Stories Gallery */}
              {recentStories.filter((s) => s.scenes && s.scenes.length > 0 && (s.scenes[0].image_url || s.scenes[0].cachedImageUrl)).length > 0 && (
                <div className="recent-stories-section">
                  <h3 className="section-title">
                    <Sparkles className="icon-pink" size={20} />
                    <span>Community Creations</span>
                  </h3>
                  <div className="stories-grid">
                    {recentStories
                      .filter((s) => s.scenes && s.scenes.length > 0 && (s.scenes[0].image_url || s.scenes[0].cachedImageUrl))
                      .map((story) => (
                        <motion.div
                          key={story.story_id}
                          className="story-card glass-panel"
                          whileHover={{scale: 1.03, y: -4}}
                          whileTap={{scale: 0.98}}
                          onClick={() => playSavedStory(story)}
                        >
                          <div className="card-bg-container">
                            <img
                              src={story.scenes[0].image_url || story.scenes[0].cachedImageUrl}
                              alt={story.title}
                              className="card-bg-image"
                              loading="lazy"
                            />
                            <div className="card-overlay"></div>
                          </div>
                          <div className="card-content">
                            <h4 className="card-title">{story.title}</h4>
                            <p className="card-prompt">"{story.prompt}"</p>
                          </div>
                        </motion.div>
                      ))}
                  </div>
                </div>
              )}
            </main>

            <footer className="footer">
              <motion.a
                href="https://github.com/Tharunkunamalla"
                target="_blank"
                rel="noreferrer"
                className="developed-by"
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                transition={{delay: 0.5}}
                whileHover={{scale: 1.05}}
              >
                <span>Developed by Tharunkunamalla</span>
                <img
                  src="https://github.com/Tharunkunamalla.png"
                  alt="Tharunkunamalla"
                  className="avatar"
                />
              </motion.a>
            </footer>

            <div className="bottom-left-controls">
              <motion.button
                className="bottom-control-btn-link glass-panel"
                onClick={() => setActiveOverlay("about")}
                whileHover={{scale: 1.05}}
                whileTap={{scale: 0.95}}
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                transition={{delay: 0.5}}
              >
                <Info size={16} />
                <span>About</span>
              </motion.button>
              <motion.button
                className="bottom-control-btn-link glass-panel"
                onClick={() => setActiveOverlay("help")}
                whileHover={{scale: 1.05}}
                whileTap={{scale: 0.95}}
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                transition={{delay: 0.6}}
              >
                <HelpCircle size={16} />
                <span>Help & Suggestions</span>
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <StoryViewer
            key="viewer"
            storyData={storyData}
            onReset={() => setStoryData(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeOverlay === "about" && (
          <AboutOverlay onClose={() => setActiveOverlay(null)} />
        )}
        {activeOverlay === "help" && (
          <HelpOverlay onClose={() => setActiveOverlay(null)} apiBaseUrl={API_BASE_URL} />
        )}
      </AnimatePresence>

    </div>
  );
}

export default App;
