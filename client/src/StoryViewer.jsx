import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Download, 
  Volume2, 
  VolumeX, 
  ChevronLeft, 
  ChevronRight, 
  Loader2 
} from "lucide-react";
import InteractiveAudioText from "./InteractiveAudioText";

const StoryViewer = ({ storyData, onReset }) => {
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

export default StoryViewer;
