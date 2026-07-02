import React from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

export default function ConnectingScreen() {
  return (
    <motion.div
      key="connecting"
      className="server-connecting-fullscreen"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="bg-objects">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
      </div>
      <motion.div
        className="connecting-card glass-panel"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 15 }}
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
  );
}
