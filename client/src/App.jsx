import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader2, BookOpen, Volume2, ChevronRight, ChevronLeft, Play, Pause, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';

const CustomAudioPlayer = ({ text, onEnded, isActive }) => {
  const [audioUrl, setAudioUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    const url = `http://localhost:8000/api/audio?text=${encodeURIComponent(text)}`;
    setAudioUrl(url);
  }, [text]);

  useEffect(() => {
    if (isActive && audioRef.current && !loading) {
      audioRef.current.play().catch(e => {
        console.log("Autoplay prevented:", e);
        setPlaying(false);
      });
    } else if (!isActive && audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
    }
  }, [isActive, loading]);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (playing) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  };

  return (
    <div className="audio-player-container glass-panel">
      {loading && (
        <div className="audio-loading">
          <Loader2 className="spinner" size={18} />
          <span>Synthesizing Voice...</span>
        </div>
      )}
      <audio
        ref={audioRef}
        src={audioUrl}
        onLoadedData={() => setLoading(false)}
        onCanPlayThrough={() => setLoading(false)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={onEnded}
        className="hidden-audio"
      />
      {!loading && (
        <div className="audio-controls">
          <button className="icon-btn" onClick={handlePlayPause}>
            {playing ? <Pause size={24} /> : <Play size={24} />}
          </button>
          <div className={`audio-visualizer ${playing ? 'playing' : ''}`}>
             <div className="bar"></div>
             <div className="bar"></div>
             <div className="bar"></div>
             <div className="bar"></div>
             <div className="bar"></div>
          </div>
          <span className="audio-status">{playing ? 'Playing narration...' : 'Paused'}</span>
        </div>
      )}
    </div>
  );
};

const StoryViewer = ({ storyData, onReset }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [imgLoading, setImgLoading] = useState(true);

  // Reset image loading state when slide changes
  useEffect(() => {
    setImgLoading(true);
  }, [currentSlide]);

  const nextSlide = () => {
    if (currentSlide < storyData.scenes.length - 1) {
      setCurrentSlide(prev => prev + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  };

  const getImageUrl = (prompt) => {
    return `http://localhost:8000/api/image?prompt=${encodeURIComponent(prompt.replace(/[^a-zA-Z0-9 ,]/g, '').replace(/\s+/g, ' ').trim().slice(0, 150))}`;
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
             {imgLoading && (
               <div className="fullscreen-loader">
                 <Loader2 className="spinner" size={48} />
                 <span>Envisioning scene...</span>
               </div>
             )}
             <img 
               src={getImageUrl(storyData.scenes[currentSlide].image_prompt)} 
               alt="Scene Background"
               className={`scene-bg-image ${imgLoading ? 'hidden' : ''}`}
               onLoad={() => setImgLoading(false)}
               onError={(e) => {
                  if (!e.target.dataset.retried) {
                    e.target.dataset.retried = true;
                    e.target.src = 'http://localhost:8000/api/image?prompt=cinematic+scene+masterpiece';
                  } else {
                    setImgLoading(false);
                  }
               }}
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
                 <p className="scene-text-overlay">
                   {storyData.scenes[currentSlide].text}
                 </p>
                 <CustomAudioPlayer 
                    text={storyData.scenes[currentSlide].text}
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
    </motion.div>
  );
};

function App() {
  const [prompt, setPrompt] = useState('');
  const [storyData, setStoryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateStory = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError('');
    
    try {
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
      setStoryData(data);
    } catch (err) {
      setError(err.message || 'An error occurred while generating your story. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
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
                  <Sparkles className="icon" size={24} />
                  <span>Phase 3: Story, Image & Voice Generator</span>
                </div>
                <h1 className="title gradient-text">
                  Weave Worlds with Words
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
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !prompt.trim()}
                  className="submit-btn"
                >
                  {loading ? (
                    <>
                      <Loader2 className="spinner" size={20} />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <BookOpen size={20} />
                      <span>Create Story</span>
                    </>
                  )}
                </button>
              </motion.form>

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
