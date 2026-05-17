import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader2, BookOpen, ChevronRight, ChevronLeft, Play, Pause, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';

const InteractiveAudioText = ({ text, audioUrl, onEnded, isActive }) => {
  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    if (isActive && audioRef.current) {
      audioRef.current.play().catch(e => {
        console.log("Autoplay prevented:", e);
        setPlaying(false);
      });
    } else if (!isActive && audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
    }
  }, [isActive, audioUrl]);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (playing) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current && audioRef.current.duration) {
      setProgress(audioRef.current.currentTime / audioRef.current.duration);
    }
  };

  const toggleSpeed = () => {
    const rates = [1, 1.25, 1.5, 2];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const seekTo = (percentage) => {
    if (audioRef.current && audioRef.current.duration) {
      audioRef.current.currentTime = percentage * audioRef.current.duration;
      setProgress(percentage);
      if (!playing) {
        audioRef.current.play().catch(e => console.log(e));
      }
    }
  };

  const words = text.split(" ");
  const currentWordIndex = Math.floor(progress * words.length);

  return (
    <div className="interactive-audio-module">
      <p className="scene-text-overlay interactive-text">
        {words.map((word, i) => (
          <span 
            key={i} 
            onClick={() => seekTo(i / words.length)}
            className={`word ${i <= currentWordIndex ? 'spoken' : ''}`}
          >
            {word}{' '}
          </span>
        ))}
      </p>

      <div className="audio-player-container glass-panel">
        <audio
          ref={audioRef}
          src={audioUrl}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onEnded={onEnded}
          className="hidden-audio"
        />
        <div className="audio-controls">
          <button className="icon-btn play-btn" onClick={handlePlayPause}>
            {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          </button>
          
          <div className="audio-progress-bar" onClick={(e) => {
             const rect = e.currentTarget.getBoundingClientRect();
             seekTo((e.clientX - rect.left) / rect.width);
          }}>
             <div className="audio-progress-fill" style={{ width: `${progress * 100}%` }}></div>
             <div className="audio-progress-thumb" style={{ left: `${progress * 100}%` }}></div>
          </div>

          <button className="speed-btn glass-panel" onClick={toggleSpeed}>
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
};

const StoryViewer = ({ storyData, onReset }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    let timer;
    if (isFinished && countdown > 0) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    } else if (isFinished && countdown === 0) {
      onReset();
    }
    return () => clearTimeout(timer);
  }, [isFinished, countdown, onReset]);

  const nextSlide = () => {
    if (currentSlide < storyData.scenes.length - 1) {
      setCurrentSlide(prev => prev + 1);
    } else {
      setIsFinished(true);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  };

  return (
    <motion.div 
      className="story-viewer-fullscreen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
       <AnimatePresence mode="wait">
          <motion.div 
            key={currentSlide}
            initial={{ opacity: 0, x: 100, scale: 1.05 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -100, filter: 'blur(10px)' }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="scene-slide"
          >
             <img 
               src={storyData.scenes[currentSlide].cachedImageUrl} 
               alt="Scene Background"
               className="scene-bg-image"
             />
             <div className="scene-overlay"></div>
             
             <div className="scene-content">
               <motion.h2 
                 initial={{ y: 20, opacity: 0 }}
                 animate={{ y: 0, opacity: 1 }}
                 transition={{ delay: 0.4 }}
                 className="story-title-overlay"
               >
                 {storyData.title}
               </motion.h2>
               
               <motion.div 
                 initial={{ y: 20, opacity: 0 }}
                 animate={{ y: 0, opacity: 1 }}
                 transition={{ delay: 0.6 }}
                 className="scene-text-container glass-panel"
               >
                 <InteractiveAudioText 
                    text={storyData.scenes[currentSlide].text}
                    audioUrl={storyData.scenes[currentSlide].cachedAudioUrl}
                    isActive={true}
                    onEnded={nextSlide}
                 />
               </motion.div>
             </div>
          </motion.div>
       </AnimatePresence>
       
       <div className="story-nav">
          <button className="nav-btn glass-panel" onClick={prevSlide} disabled={currentSlide === 0}>
             <ChevronLeft size={32} />
          </button>
          <div className="nav-indicators glass-panel">
             {storyData.scenes.map((_, i) => (
                <div key={i} className={`indicator ${i === currentSlide ? 'active' : ''}`} />
             ))}
          </div>
          <button className="nav-btn glass-panel" onClick={nextSlide} disabled={currentSlide === storyData.scenes.length - 1}>
             <ChevronRight size={32} />
          </button>
       </div>

       <button className="close-story-btn glass-panel" onClick={onReset}>
         <X size={24} />
       </button>

       <AnimatePresence>
         {isFinished && (
           <motion.div 
             className="story-finished-overlay"
             initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
             animate={{ opacity: 1, backdropFilter: 'blur(10px)' }}
             exit={{ opacity: 0 }}
           >
             <div className="glass-panel finished-modal">
               <h2 className="gradient-text">The End</h2>
               <p>I hope you enjoyed this cinematic journey.</p>
               <div className="countdown-ring">
                 Closing in {countdown}s
               </div>
               <button className="submit-btn" onClick={onReset} style={{ marginTop: '20px', width: 'auto' }}>
                 Finish Now
               </button>
             </div>
           </motion.div>
         )}
       </AnimatePresence>
    </motion.div>
  );
};

function App() {
  const [prompt, setPrompt] = useState('');
  const [storyData, setStoryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preloading, setPreloading] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [error, setError] = useState('');

  const generateStory = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError('');
    
    try {
      // 1. Generate text first
      const response = await fetch('http://localhost:8000/api/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to generate story');
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

      const promises = data.scenes.map(async (scene) => {
         // Preload Image
         const imgPrompt = encodeURIComponent(scene.image_prompt.replace(/[^a-zA-Z0-9 ,]/g, '').replace(/\s+/g, ' ').trim().slice(0, 150));
         const imgUrl = `http://localhost:8000/api/image?prompt=${imgPrompt}`;
         try {
           const imgRes = await fetch(imgUrl);
           const imgBlob = await imgRes.blob();
           scene.cachedImageUrl = URL.createObjectURL(imgBlob);
         } catch(e) {
           scene.cachedImageUrl = imgUrl; // fallback
         }
         updateProgress();

         // Preload Audio
         const audioUrl = `http://localhost:8000/api/audio?text=${encodeURIComponent(scene.text)}`;
         try {
           const audioRes = await fetch(audioUrl);
           const audioBlob = await audioRes.blob();
           scene.cachedAudioUrl = URL.createObjectURL(audioBlob);
         } catch(e) {
           scene.cachedAudioUrl = audioUrl; // fallback
         }
         updateProgress();
      });
      
      await Promise.all(promises);
      
      setStoryData(data);
      setPreloading(false);
      setPreloadProgress(0);
      setPrompt('');
    } catch (err) {
      setError(err.message || 'An error occurred while generating your story. Please try again.');
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
      <AnimatePresence>
        {!storyData ? (
          <motion.div 
            className="home-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <header className="header">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="phase-badge glass-panel">
                  <Sparkles className="icon" size={24} color="#ec4848ff" />
                  <span style={{color: "#cf7171ff"}}>Powered by AI</span>
                </div>
                <h1 className="title gradient-text">
                  MythWeaver
                </h1>
                <p className="subtitle">
                  Enter a prompt and watch as AI crafts a cinematic narrative just for you.
                </p>
              </motion.div>
            </header>

            <main className="main-content">
              <motion.form
                onSubmit={generateStory}
                className="prompt-form glass-panel"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="A dragon protecting a futuristic city..."
                  className="prompt-input"
                  disabled={loading || preloading}
                />
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
              
              {preloading && (
                <div className="preload-bar-container glass-panel">
                   <div className="preload-bar-fill" style={{ width: `${preloadProgress}%` }}></div>
                   <div className="preload-text">Generating images & voice narration... {preloadProgress}%</div>
                </div>
              )}

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="error-message"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>
            </main>
            
            <footer className="footer">
              <motion.a 
                href="https://github.com/Tharunkunamalla" 
                target="_blank" 
                rel="noreferrer"
                className="developed-by glass-panel"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                whileHover={{ scale: 1.05 }}
              >
                <span>Developed by Tharunkunamalla</span>
                <img src="https://github.com/Tharunkunamalla.png" alt="Tharunkunamalla" className="avatar" />
              </motion.a>
            </footer>
          </motion.div>
        ) : (
          <StoryViewer storyData={storyData} onReset={() => setStoryData(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
