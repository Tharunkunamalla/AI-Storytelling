import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sliders, 
  User, 
  Compass, 
  Cpu, 
  Sparkles, 
  Glasses, 
  Skull, 
  Music, 
  Zap, 
  Moon, 
  Coffee, 
  Mic 
} from "lucide-react";

const CinematicControls = ({
  selectedVoice,
  setSelectedVoice,
  selectedGenre,
  setSelectedGenre,
  selectedMood,
  setSelectedMood,
  showSettings,
  setShowSettings,
  loading,
  preloading
}) => {
  return (
    <>
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
            transition={{ type: "spring", stiffness: 100, damping: 17 }}
            style={{ overflow: "hidden", width: "100%" }}
          >
            <div className="cinematic-controls-panel glass-panel" style={{ marginBottom: 0 }}>
              {/* Narrator Voice Selector */}
              <div className="control-group">
                <label className="control-group-title">🎙️ Narrator Profile</label>
                <div className="selector-options-row">
                  {[
                    { id: "adam", label: "Adam", desc: "Cinematic", icon: <User size={16} /> },
                    { id: "rachel", label: "Rachel", desc: "Sci-Fi AI", icon: <User size={16} /> },
                    { id: "antoni", label: "Antoni", desc: "Mystic", icon: <User size={16} /> },
                    { id: "bella", label: "Bella", desc: "Cozy", icon: <User size={16} /> }
                  ].map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className={`selector-option-btn ${selectedVoice === v.id ? "active" : ""}`}
                      onClick={() => setSelectedVoice(v.id)}
                      disabled={loading || preloading}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                        {v.icon}
                        <span className="btn-main-label">{v.label}</span>
                      </div>
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
                    { id: "adventure", label: "Adventure", icon: <Compass size={16} /> },
                    { id: "cyberpunk", label: "Cyberpunk", icon: <Cpu size={16} /> },
                    { id: "fantasy", label: "Fantasy", icon: <Sparkles size={16} /> },
                    { id: "noir", label: "Noir", icon: <Glasses size={16} /> },
                    { id: "horror", label: "Gothic Horror", icon: <Skull size={16} /> }
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
                    { id: "orchestral", label: "Orchestral", icon: <Music size={16} /> },
                    { id: "synthwave", label: "Synthwave", icon: <Zap size={16} /> },
                    { id: "dark_ambient", label: "Dark Ambient", icon: <Moon size={16} /> },
                    { id: "lofi", label: "Cozy Lo-Fi", icon: <Coffee size={16} /> },
                    { id: "noir", label: "Noir Jazz", icon: <Mic size={16} /> }
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
    </>
  );
};

export default CinematicControls;
