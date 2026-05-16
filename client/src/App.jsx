import React, { useState } from 'react';
import { Sparkles, Loader2, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';

function App() {
  const [prompt, setPrompt] = useState('');
  const [story, setStory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateStory = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError('');
    setStory('');

    try {
      const response = await fetch('http://localhost:8000/api/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to generate story');
      }

      const data = await response.json();
      setStory(data.story);
    } catch (err) {
      setError(err.message || 'An error occurred while generating your story. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="phase-badge glass-panel">
            <Sparkles className="icon" size={24} />
            <span>Phase 1: AI Story Generator</span>
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

          {story && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="story-container glass-panel"
            >
              <div className="story-gradient-bar" />
              <div className="story-content">
                {story.split('\n').filter(p => p.trim()).map((paragraph, i) => (
                  <p key={i} className="story-paragraph">
                    {paragraph}
                  </p>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
