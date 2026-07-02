import React from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export default function CommunityCreations({ recentStories, onPlayStory }) {
  const validStories = recentStories.filter(
    (s) =>
      s.scenes &&
      s.scenes.length > 0 &&
      (s.scenes[0].image_url || s.scenes[0].cachedImageUrl)
  );

  if (validStories.length === 0) return null;

  return (
    <div className="recent-stories-section">
      <h3 className="section-title">
        <Sparkles className="icon-pink" size={20} />
        <span>Community Creations</span>
      </h3>
      <div className="stories-grid">
        {validStories.map((story) => (
          <motion.div
            key={story.story_id}
            className="story-card glass-panel"
            whileHover={{ scale: 1.03, y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onPlayStory(story)}
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
  );
}
