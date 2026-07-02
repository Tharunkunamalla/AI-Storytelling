import React, {useState, useRef, useEffect} from "react";
import {motion, AnimatePresence} from "framer-motion";
import "./App.css";
import AboutOverlay from "./AboutOverlay";
import HelpOverlay from "./HelpOverlay";
import StoryViewer from "./StoryViewer";
import CinematicControls from "./CinematicControls";

// Extracted sub-components and hooks
import useSpeechRecognition from "./useSpeechRecognition";
import ConnectingScreen from "./ConnectingScreen";
import Header from "./Header";
import PromptForm from "./PromptForm";
import GenerationStatus from "./GenerationStatus";
import CommunityCreations from "./CommunityCreations";
import Footer from "./Footer";
import BottomControls from "./BottomControls";

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
  const [recentStories, setRecentStories] = useState([]);
  const [loadingStories, setLoadingStories] = useState(false);
  const abortControllerRef = useRef(null);

  const [selectedVoice, setSelectedVoice] = useState("adam");
  const [selectedGenre, setSelectedGenre] = useState("adventure");
  const [selectedMood, setSelectedMood] = useState("orchestral");
  const [showSettings, setShowSettings] = useState(false);

  const [activeOverlay, setActiveOverlay] = useState(null); // 'about' | 'help' | null

  // Speech Recognition hook
  const { isListening, toggleListening, recognitionRef } = useSpeechRecognition(
    (transcript) => {
      setPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript));
    }
  );

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

  const cancelStoryGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setLoading(false);
    setPreloading(false);
    setPreloadProgress(0);
    setError("Story generation was cancelled.");
  };

  const generateStory = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
    }

    setLoading(true);
    setError("");

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const response = await fetch(`${API_BASE_URL}/api/generate-story`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          prompt,
          genre: selectedGenre,
          mood: selectedMood
        }),
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to generate story");
      }

      const data = await response.json();
      if (signal.aborted) return;

      setLoading(false);
      setPreloading(true);

      const totalAssets = data.scenes.length * 2;
      let loaded = 0;

      const updateProgress = () => {
        if (signal.aborted) return;
        loaded++;
        setPreloadProgress(Math.round((loaded / totalAssets) * 100));
      };

      const promises = data.scenes.map(async (scene, index) => {
        if (signal.aborted) return;
        const imgPrompt = encodeURIComponent(
          scene.image_prompt.replace(/[^a-zA-Z0-9 ,]/g, "").replace(/\s+/g, " ").trim().slice(0, 150)
        );
        const imgUrl = `${API_BASE_URL}/api/image?prompt=${imgPrompt}&story_id=${data.story_id}&scene_index=${index}`;
        try {
          const imgRes = await fetch(imgUrl, { signal });
          const imgBlob = await imgRes.blob();
          scene.cachedImageUrl = URL.createObjectURL(imgBlob);
        } catch (e) {
          if (e.name !== "AbortError") scene.cachedImageUrl = imgUrl;
        }
        updateProgress();

        if (signal.aborted) return;

        const audioUrl = `${API_BASE_URL}/api/audio?text=${encodeURIComponent(scene.text)}&voice=${selectedVoice}&story_id=${data.story_id}&scene_index=${index}`;
        try {
          const audioRes = await fetch(audioUrl, { signal });
          const audioBlob = await audioRes.blob();
          scene.cachedAudioUrl = URL.createObjectURL(audioBlob);
        } catch (e) {
          if (e.name !== "AbortError") scene.cachedAudioUrl = audioUrl;
        }
        updateProgress();
      });

      await Promise.all(promises);
      if (signal.aborted) return;

      data.bgMusicUrl = `${API_BASE_URL}/api/music?prompt=${encodeURIComponent(prompt.trim().slice(0, 100))}&mood=${selectedMood}&story_id=${data.story_id}`;
      setStoryData(data);
      setPreloading(false);
      setPreloadProgress(0);
      setPrompt("");
      fetchRecentStories();
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(err.message || "An error occurred while generating your story.");
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
          <ConnectingScreen />
        ) : !storyData ? (
          <motion.div
            key="home"
            className="home-view"
            initial={{opacity: 0, y: 10}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, scale: 0.95}}
            transition={{duration: 0.5}}
          >
            <Header />

            <main className="main-content">
              <PromptForm
                prompt={prompt}
                setPrompt={setPrompt}
                isListening={isListening}
                toggleListening={toggleListening}
                loading={loading}
                preloading={preloading}
                preloadProgress={preloadProgress}
                onSubmit={generateStory}
              />
              
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

              <GenerationStatus
                loading={loading}
                preloading={preloading}
                preloadProgress={preloadProgress}
                onCancel={cancelStoryGeneration}
              />

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

              <CommunityCreations
                recentStories={recentStories}
                onPlayStory={playSavedStory}
              />
            </main>

            <Footer />

            <BottomControls
              onOpenAbout={() => setActiveOverlay("about")}
              onOpenHelp={() => setActiveOverlay("help")}
            />
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
