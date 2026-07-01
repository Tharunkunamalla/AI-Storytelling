import React, {useState, useRef, useEffect} from "react";
import {
  Sparkles,
  Loader2,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Play,
  Pause,
  X,
  Download,
  Volume2,
  VolumeX,
  Info,
  HelpCircle,
  Sliders,
} from "lucide-react";
import {motion, AnimatePresence} from "framer-motion";
import "./App.css";
import AboutOverlay from "./AboutOverlay";
import HelpOverlay from "./HelpOverlay";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
).replace(/\/$/, "");

const AudioVisualizer = ({ audioRef, isPlaying }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    if (isPlaying && audioRef.current) {
      if (!audioContextRef.current) {
        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          const audioCtx = new AudioContextClass();
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;

          let source = audioRef.current.__sourceNode;
          if (!source) {
            source = audioCtx.createMediaElementSource(audioRef.current);
            audioRef.current.__sourceNode = source;
          }

          source.connect(analyser);
          analyser.connect(audioCtx.destination);

          audioContextRef.current = audioCtx;
          analyserRef.current = analyser;
        } catch (e) {
          console.warn("AudioContext setup failed:", e);
        }
      }

      if (audioContextRef.current && audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume();
      }
    }

    const bufferLength = analyserRef.current ? analyserRef.current.frequencyBinCount : 8;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      if (isPlaying && analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray);
      } else {
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = isPlaying ? Math.sin(Date.now() * 0.01 + i) * 20 + 30 : 5;
        }
      }

      const barWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const val = dataArray[i];
        const barHeight = (val / 255) * height * 0.75 + 2;

        const gradient = ctx.createLinearGradient(0, height / 2 - barHeight / 2, 0, height / 2 + barHeight / 2);
        gradient.addColorStop(0, "rgba(244, 63, 94, 0.4)");
        gradient.addColorStop(0.5, "rgba(225, 29, 72, 1)");
        gradient.addColorStop(1, "rgba(244, 63, 94, 0.4)");

        ctx.fillStyle = gradient;
        ctx.shadowBlur = 8;
        ctx.shadowColor = "rgba(244, 63, 94, 0.8)";
        
        const y = height / 2 - barHeight / 2;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x + 1, y, barWidth - 2, barHeight, 2);
        } else {
          ctx.rect(x + 1, y, barWidth - 2, barHeight);
        }
        ctx.fill();

        x += barWidth;
      }
      
      ctx.shadowBlur = 0;
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, audioRef]);

  return (
    <div className="visualizer-hud-container">
      <div className="visualizer-glow-underlay"></div>
      <canvas ref={canvasRef} width={90} height={24} className="audio-wave-canvas" />
    </div>
  );
};

const InteractiveAudioText = ({text, audioUrl, onEnded, isActive}) => {
  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    if (isActive && audioRef.current) {
      audioRef.current.play().catch((e) => {
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
        audioRef.current.play().catch((e) => console.log(e));
      }
    }
  };

  const words = text.split(" ");
  
  // Character-weighted word highlight sync
  const wordLengths = words.map(w => w.length + 1);
  const totalChars = wordLengths.reduce((a, b) => a + b, 0);
  const currentSpeechChar = progress * totalChars;
  
  let cumulativeChars = 0;
  let currentWordIndex = -1;
  for (let i = 0; i < wordLengths.length; i++) {
    cumulativeChars += wordLengths[i];
    if (currentSpeechChar <= cumulativeChars) {
      currentWordIndex = i;
      break;
    }
  }
  if (progress >= 0.99) {
    currentWordIndex = words.length - 1;
  }

  const getSeekPercentage = (index) => {
    let charsBefore = 0;
    for (let i = 0; i < index; i++) {
      charsBefore += wordLengths[i];
    }
    return totalChars > 0 ? charsBefore / totalChars : 0;
  };

  return (
    <div className="interactive-audio-module">
      <p className="scene-text-overlay interactive-text">
        {words.map((word, i) => (
          <span
            key={i}
            onClick={() => seekTo(getSeekPercentage(i))}
            className={`word ${i <= currentWordIndex ? "spoken" : ""}`}
          >
            {word}{" "}
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
            {playing ? (
              <Pause size={20} fill="currentColor" />
            ) : (
              <Play size={20} fill="currentColor" />
            )}
          </button>

          <AudioVisualizer audioRef={audioRef} isPlaying={playing} />

          <div
            className="audio-progress-bar"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              seekTo((e.clientX - rect.left) / rect.width);
            }}
          >
            <div
              className="audio-progress-fill"
              style={{width: `${progress * 100}%`}}
            ></div>
            <div
              className="audio-progress-thumb"
              style={{left: `${progress * 100}%`}}
            ></div>
          </div>

          <button className="speed-btn glass-panel" onClick={toggleSpeed}>
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
};

const StoryViewer = ({storyData, onReset}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [timerPaused, setTimerPaused] = useState(false);
  const [direction, setDirection] = useState(1);
  const [bgMusicMuted, setBgMusicMuted] = useState(false);
  const [bgVolume, setBgVolume] = useState(1.0);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const bgMusicRef = useRef(null);
  const volumePillRef = useRef(null);

  useEffect(() => {
    if (bgMusicRef.current) {
      bgMusicRef.current.volume = bgVolume;
    }
  }, [bgVolume, storyData]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        volumePillRef.current &&
        !volumePillRef.current.contains(event.target)
      ) {
        setShowVolumeSlider(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    let timer;
    if (isFinished && countdown > 0 && !timerPaused) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    } else if (isFinished && countdown === 0 && !timerPaused) {
      onReset();
    }
    return () => clearTimeout(timer);
  }, [isFinished, countdown, timerPaused, onReset]);

  useEffect(() => {
    if (isFinished) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          const ctx = new AudioContext();
          const now = ctx.currentTime;
          
          // Primary Chime Tone
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = "sine";
          osc1.frequency.setValueAtTime(587.33, now); // D5
          osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.15); // A5
          gain1.gain.setValueAtTime(0.12, now);
          gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          
          // Harmonizing Warm Tone
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = "triangle";
          osc2.frequency.setValueAtTime(349.23, now); // F4
          osc2.frequency.exponentialRampToValueAtTime(523.25, now + 0.2); // C5
          gain2.gain.setValueAtTime(0.08, now);
          gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          
          osc1.start(now);
          osc1.stop(now + 1.2);
          osc2.start(now);
          osc2.stop(now + 0.9);
        }
      } catch (e) {
        console.error("Failed to play finish sound:", e);
      }
    }
  }, [isFinished]);

  const nextSlide = () => {
    if (currentSlide < storyData.scenes.length - 1) {
      setDirection(1);
      setCurrentSlide((prev) => prev + 1);
    } else {
      setIsFinished(true);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setDirection(-1);
      setCurrentSlide((prev) => prev - 1);
    }
  };

  const downloadStory = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const {jsPDF} = await import("jspdf");
      const doc = new jsPDF();

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Load Logo for Watermark
      let logoDataUrl = null;
      try {
        const img = new Image();
        img.src = "/logo.png";
        await new Promise((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        logoDataUrl = canvas.toDataURL("image/png");
      } catch (e) {}

      const addWatermark = (pdfDoc) => {
        pdfDoc.setGState(new pdfDoc.GState({opacity: 0.1}));

        if (logoDataUrl) {
          pdfDoc.addImage(
            logoDataUrl,
            "PNG",
            pageWidth / 2 - 40,
            pageHeight / 2 - 60,
            80,
            80,
          );
        }

        pdfDoc.setFont("helvetica", "bold");
        pdfDoc.setFontSize(40);
        pdfDoc.setTextColor(150, 150, 150);
        pdfDoc.text("MythWeaver", pageWidth / 2, pageHeight / 2 + 40, {
          align: "center",
        });
        pdfDoc.setGState(new pdfDoc.GState({opacity: 1.0}));
        pdfDoc.setTextColor(0, 0, 0); // reset to black
      };

      doc.setFont("helvetica", "bold");
      doc.setFontSize(24);
      doc.text(storyData.title, 20, 30);

      doc.setLineWidth(0.5);
      doc.line(20, 35, pageWidth - 20, 35);

      addWatermark(doc);

      let yPos = 50;

      storyData.scenes.forEach((scene, index) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text(`Part ${index + 1}`, 20, yPos);
        yPos += 10;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);

        const splitText = doc.splitTextToSize(scene.text, pageWidth - 40);

        splitText.forEach((line) => {
          if (yPos > pageHeight - 20) {
            doc.addPage();
            addWatermark(doc);
            yPos = 30;
          }
          doc.text(line, 20, yPos);
          yPos += 7;
        });
        yPos += 10;

        if (yPos > pageHeight - 30 && index < storyData.scenes.length - 1) {
          doc.addPage();
          addWatermark(doc);
          yPos = 30;
        }
      });

      doc.save(`${storyData.title.replace(/\s+/g, "_")}.pdf`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <motion.div
      className="story-viewer-fullscreen"
      initial={{opacity: 0}}
      animate={{opacity: 1}}
      exit={{opacity: 0}}
    >

      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          initial={{ 
            opacity: 0, 
            x: direction * 120, 
            skewX: direction * 4,
            filter: "hue-rotate(45deg) brightness(1.3)" 
          }}
          animate={{ 
            opacity: 1, 
            x: 0, 
            skewX: 0,
            filter: "hue-rotate(0deg) brightness(1)" 
          }}
          exit={{ 
            opacity: 0, 
            x: direction * -120, 
            skewX: direction * -4,
            filter: "hue-rotate(-45deg) brightness(1.3)" 
          }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="scene-slide"
        >
          {/* Dynamic Ambient Color Backlight */}
          <div 
            className="ambient-glow"
            style={{ backgroundImage: `url(${storyData.scenes[currentSlide].cachedImageUrl})` }}
          />

          <motion.img
            src={storyData.scenes[currentSlide].cachedImageUrl}
            alt="Scene Background"
            className="scene-bg-image"
            initial={{ scale: 1.0, x: 0, y: 0 }}
            animate={{ 
              scale: 1.08, 
              x: direction * -10, 
              y: direction * -5 
            }}
            transition={{ 
              duration: 25, 
              ease: "easeOut" 
            }}
          />
          <div className="scene-overlay"></div>



          <div className="scene-content">
            <motion.h2
              initial={{y: 20, opacity: 0}}
              animate={{y: 0, opacity: 1}}
              transition={{delay: 0.4}}
              className="story-title-overlay"
            >
              {storyData.title}
            </motion.h2>

            <motion.div
              initial={{y: 20, opacity: 0}}
              animate={{y: 0, opacity: 1}}
              transition={{delay: 0.6}}
              className="scene-text-container"
            >
              <InteractiveAudioText
                text={storyData.scenes[currentSlide].text}
                audioUrl={storyData.scenes[currentSlide].cachedAudioUrl}
                isActive={true}
                onEnded={nextSlide}
              />
            </motion.div>
          </div>

          <div
            className="top-right-controls"
            style={{display: "flex", alignItems: "center", gap: "16px"}}
          >
            <motion.div
              ref={volumePillRef}
              className="top-control-pill glass-panel"
              animate={{width: showVolumeSlider ? 180 : 48}}
              transition={{duration: 0.35, ease: [0.16, 1, 0.3, 1]}}
              style={{
                display: "flex",
                alignItems: "center",
                background: "rgba(0, 0, 0, 0.4)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                borderRadius: "24px",
                height: "48px",
                overflow: "hidden",
                boxSizing: "border-box",
                padding: showVolumeSlider ? "0 16px 0 4px" : "0 4px",
              }}
            >
              <motion.button
                className="icon-btn tooltip-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!showVolumeSlider) {
                    setShowVolumeSlider(true);
                  } else {
                    setBgMusicMuted(!bgMusicMuted);
                  }
                }}
                title={
                  showVolumeSlider
                    ? bgMusicMuted
                      ? "Unmute BGM"
                      : "Mute BGM"
                    : "Adjust Background Music"
                }
                whileHover={{scale: 1.1}}
                whileTap={{scale: 0.9}}
                style={{
                  width: "40px",
                  height: "40px",
                  minWidth: "40px",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                }}
              >
                {bgMusicMuted || bgVolume === 0 ? (
                  <VolumeX size={22} color="#cbd5e1" />
                ) : (
                  <Volume2 size={22} color="#e11d48" />
                )}
              </motion.button>
              <AnimatePresence>
                {showVolumeSlider && (
                  <motion.div
                    className="volume-slider-container"
                    initial={{opacity: 0, x: -10}}
                    animate={{opacity: 1, x: 0}}
                    exit={{opacity: 0, x: -10}}
                    transition={{
                      duration: 0.2,
                      delay: showVolumeSlider ? 0.15 : 0,
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      width: "100%",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={bgVolume}
                      onChange={(e) => {
                        setBgVolume(parseFloat(e.target.value));
                        if (bgMusicMuted && parseFloat(e.target.value) > 0)
                          setBgMusicMuted(false);
                      }}
                      className="volume-slider"
                      title="Adjust Volume"
                      style={{width: "75px", margin: 0}}
                    />
                    <span
                      className="volume-label"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowVolumeSlider(false);
                      }}
                      style={{
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: "bold",
                        color: "#cbd5e1",
                      }}
                      title="Click to close"
                    >
                      {bgMusicMuted ? "0%" : `${Math.round(bgVolume * 100)}%`}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <motion.button
              className="top-control-btn glass-panel"
              onClick={downloadStory}
              disabled={isDownloading}
              title={isDownloading ? "Generating PDF..." : "Download Story"}
              whileHover={{
                scale: isDownloading ? 1 : 1.1,
                backgroundColor: "rgba(239, 68, 68, 0.4)",
              }}
              whileTap={{scale: isDownloading ? 1 : 0.95}}
            >
              {isDownloading ? (
                <Loader2
                  size={24}
                  className="spinner"
                  style={{animation: "spin 1s linear infinite"}}
                />
              ) : (
                <Download size={24} />
              )}
            </motion.button>
            <motion.button
              className="top-control-btn close-btn glass-panel"
              onClick={onReset}
              title="Close Story"
              whileHover={{
                scale: 1.1,
                rotate: 90,
                backgroundColor: "rgba(239, 68, 68, 0.4)",
              }}
              whileTap={{scale: 0.95}}
            >
              <X size={24} />
            </motion.button>
          </div>

          <div className="story-nav">
            <motion.button
              className="nav-btn glass-panel"
              whileHover={{scale: 1.1}}
              whileTap={{scale: 0.95}}
              onClick={prevSlide}
              disabled={currentSlide === 0}
            >
              <ChevronLeft size={32} />
            </motion.button>
            <div className="nav-indicators glass-panel">
              {storyData.scenes.map((_, i) => (
                <div
                  key={i}
                  className={`indicator ${i === currentSlide ? "active" : ""}`}
                />
              ))}
            </div>
            <motion.button
              className="nav-btn glass-panel"
              whileHover={{scale: 1.1}}
              whileTap={{scale: 0.95}}
              onClick={nextSlide}
              disabled={currentSlide === storyData.scenes.length - 1}
            >
              <ChevronRight size={32} />
            </motion.button>
          </div>
        </motion.div>
      </AnimatePresence>

      <audio
        ref={bgMusicRef}
        src={storyData.bgMusicUrl}
        autoPlay
        loop
        muted={bgMusicMuted}
        className="hidden-audio"
      />

      <AnimatePresence>
        {isFinished && !timerPaused && (
          <motion.div
            className="story-finished-overlay"
            initial={{opacity: 0, backdropFilter: "blur(0px)"}}
            animate={{opacity: 1, backdropFilter: "blur(10px)"}}
            exit={{opacity: 0}}
          >
            <div className="glass-panel finished-modal">
              <h2 className="gradient-text">The End</h2>
              <p>I hope you enjoyed this cinematic journey.</p>
              <div className="countdown-ring">Closing in {countdown}s</div>
              <div style={{display: "flex", gap: "12px", marginTop: "20px"}}>
                <button
                  className="speed-btn glass-panel"
                  onClick={() => setTimerPaused(true)}
                >
                  Stay & Read
                </button>
                <button
                  className="submit-btn"
                  onClick={onReset}
                  style={{margin: 0, width: "auto"}}
                >
                  Finish Now
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

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

              {/* Advanced Settings Toggle Button */}
              <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
                <motion.button 
                  type="button" 
                  className="settings-toggle-btn glass-panel"
                  onClick={() => setShowSettings(!showSettings)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Sliders size={16} color="#e11d48" style={{ marginRight: "8px" }} />
                  <span>{showSettings ? "Hide Cinematic Options" : "Configure Voice & Style Options"}</span>
                </motion.button>
              </div>

              {/* MythWeaver Cinematic Controls Panel */}
              <AnimatePresence>
                {showSettings && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0, marginTop: 0, marginBottom: 0 }}
                    animate={{ height: "auto", opacity: 1, marginTop: 16, marginBottom: 16 }}
                    exit={{ height: 0, opacity: 0, marginTop: 0, marginBottom: 0 }}
                    transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                    style={{ overflow: "hidden", width: "100%" }}
                  >
                    <div className="cinematic-controls-panel glass-panel" style={{ marginBottom: 0 }}>
                      {/* Narrator Voice Selector */}
                      <div className="control-group">
                        <label className="control-group-title">🎙️ Narrator Profile</label>
                        <div className="selector-options-row">
                          {[
                            { id: "adam", label: "Adam", desc: "Cinematic" },
                            { id: "rachel", label: "Rachel", desc: "Sci-Fi AI" },
                            { id: "antoni", label: "Antoni", desc: "Mystic" },
                            { id: "bella", label: "Bella", desc: "Cozy" }
                          ].map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              className={`selector-option-btn ${selectedVoice === v.id ? "active" : ""}`}
                              onClick={() => setSelectedVoice(v.id)}
                              disabled={loading || preloading}
                            >
                              <span className="btn-main-label">{v.label}</span>
                              <span className="btn-sub-label">{v.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Genre Selector */}
                      <div className="control-group">
                        <label className="control-group-title">🎭 Narrative Genre</label>
                        <div className="selector-options-row">
                          {[
                            { id: "adventure", label: "Adventure", icon: "🗺️" },
                            { id: "cyberpunk", label: "Cyberpunk", icon: "🚀" },
                            { id: "fantasy", label: "Fantasy", icon: "🧙" },
                            { id: "noir", label: "Noir", icon: "🕵️" },
                            { id: "horror", label: "Gothic Horror", icon: "💀" }
                          ].map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              className={`selector-option-btn ${selectedGenre === g.id ? "active" : ""}`}
                              onClick={() => setSelectedGenre(g.id)}
                              disabled={loading || preloading}
                            >
                              <span className="btn-icon">{g.icon}</span>
                              <span className="btn-main-label">{g.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Music Selector */}
                      <div className="control-group">
                        <label className="control-group-title">🎵 Music Soundtrack</label>
                        <div className="selector-options-row">
                          {[
                            { id: "orchestral", label: "Orchestral", icon: "🎻" },
                            { id: "synthwave", label: "Synthwave", icon: "🎸" },
                            { id: "dark_ambient", label: "Dark Ambient", icon: "🌌" },
                            { id: "lofi", label: "Cozy Lo-Fi", icon: "☕" },
                            { id: "noir", label: "Noir Jazz", icon: "🎷" }
                          ].map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              className={`selector-option-btn ${selectedMood === m.id ? "active" : ""}`}
                              onClick={() => setSelectedMood(m.id)}
                              disabled={loading || preloading}
                            >
                              <span className="btn-icon">{m.icon}</span>
                              <span className="btn-main-label">{m.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

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
