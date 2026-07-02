import React from "react";
import { motion } from "framer-motion";
import { Mic, Loader2, BookOpen } from "lucide-react";

export default function PromptForm({
  prompt,
  setPrompt,
  isListening,
  toggleListening,
  loading,
  preloading,
  preloadProgress,
  onSubmit,
}) {
  return (
    <motion.form
      onSubmit={onSubmit}
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

      {/* Voice Dictation Mic Button */}
      <button
        type="button"
        className={`voice-mic-btn ${isListening ? "listening" : ""}`}
        onClick={toggleListening}
        disabled={loading || preloading}
        title={
          isListening ? "Listening... Click to stop" : "Talk instead of typing"
        }
      >
        <Mic size={20} color={isListening ? "#f43f5e" : "#cbd5e1"} />
        {isListening && <span className="mic-pulse-ring"></span>}
      </button>
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
  );
}
