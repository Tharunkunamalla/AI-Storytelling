import React, { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";
import AudioVisualizer from "./AudioVisualizer";

const InteractiveAudioText = ({ text, audioUrl, onEnded, isActive }) => {
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
              style={{ width: `${progress * 100}%` }}
            ></div>
            <div
              className="audio-progress-thumb"
              style={{ left: `${progress * 100}%` }}
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

export default InteractiveAudioText;
