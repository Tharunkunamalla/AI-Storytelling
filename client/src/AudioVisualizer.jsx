import React, { useEffect, useRef } from "react";

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

export default AudioVisualizer;
