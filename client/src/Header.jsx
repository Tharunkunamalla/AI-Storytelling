import React from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export default function Header() {
  return (
    <header className="header">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="phase-badge glass-panel">
          <Sparkles className="icon" size={24} color="#ec4848ff" />
          <span style={{ color: "#cf7171ff" }}>Powered by AI</span>
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
            style={{ position: "relative", zIndex: 1, margin: 0 }}
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
  );
}
