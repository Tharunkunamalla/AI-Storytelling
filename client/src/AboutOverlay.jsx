import React from "react";
import {motion} from "framer-motion";
import {X, Sparkles, BookOpen, Volume2, Download} from "lucide-react";

const AboutOverlay = ({onClose}) => {
  return (
    <motion.div
      className="page-overlay-fullscreen"
      initial={{opacity: 0}}
      animate={{opacity: 1}}
      exit={{opacity: 0}}
      onClick={onClose}
    >
      <motion.div
        className="overlay-content-card glass-panel"
        initial={{scale: 0.95, y: 20, opacity: 0}}
        animate={{scale: 1, y: 0, opacity: 1}}
        exit={{scale: 0.95, y: 20, opacity: 0}}
        transition={{type: "spring", duration: 0.5}}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="overlay-close-btn" onClick={onClose}>
          <X size={20} />
        </button>
        <h2 className="gradient-text overlay-title">About MythWeaver</h2>
        <div className="overlay-body scrollable-content">
          <p className="about-intro">
            MythWeaver is an AI-powered cinematic storytelling platform that transforms your creative prompts into structured, multi-scene audio-visual adventures. By blending advanced text, image, and voice models, MythWeaver creates high-fidelity narratives designed to be read, heard, and experienced.
          </p>
          <div className="features-grid">
            <div className="feature-item">
              <Sparkles className="feature-icon" size={24} />
              <div>
                <h4>AI Story Generation</h4>
                <p>Advanced LLMs outline a complete narrative structure containing 3 to 4 chronological scenes based on your prompts.</p>
              </div>
            </div>
            <div className="feature-item">
              <BookOpen className="feature-icon" size={24} />
              <div>
                <h4>Cinematic Visual Art</h4>
                <p>Every scene features custom AI-generated artwork (16:9) designed to bring your story's characters and environments to life.</p>
              </div>
            </div>
            <div className="feature-item">
              <Volume2 className="feature-icon" size={24} />
              <div>
                <h4>Narration & Sync</h4>
                <p>High-quality synthetic voice narration reads the text, dynamically highlighting words in real-time with click-to-seek support.</p>
              </div>
            </div>
            <div className="feature-item">
              <Download className="feature-icon" size={24} />
              <div>
                <h4>Manuscript Export</h4>
                <p>Download your story as a professionally paginated PDF document complete with scene headings and custom brand watermark.</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AboutOverlay;
