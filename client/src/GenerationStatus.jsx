import React from "react";
import { motion } from "framer-motion";

export default function GenerationStatus({
  loading,
  preloading,
  preloadProgress,
  onCancel,
}) {
  return (
    <>
      {preloading && (
        <div className="preload-bar-container">
          <div className="preload-text">
            Generating images & voice narration... {preloadProgress}%
          </div>
          <div className="preload-bar-track">
            <div
              className="preload-bar-fill"
              style={{ width: `${preloadProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Stop Story Creation Option (visible if loading or if preloading is below 10%) */}
      {(loading || (preloading && preloadProgress < 10)) && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: "12px",
            width: "100%",
          }}
        >
          <motion.button
            type="button"
            className="stop-creation-btn glass-panel"
            onClick={onCancel}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span>Stop Story Creation</span>
          </motion.button>
        </div>
      )}
    </>
  );
}
