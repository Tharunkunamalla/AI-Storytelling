import React from "react";
import { motion } from "framer-motion";
import { Info, HelpCircle } from "lucide-react";

export default function BottomControls({ onOpenAbout, onOpenHelp }) {
  return (
    <div className="bottom-left-controls">
      <motion.button
        className="bottom-control-btn-link glass-panel"
        onClick={onOpenAbout}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Info size={16} />
        <span>About</span>
      </motion.button>
      <motion.button
        className="bottom-control-btn-link glass-panel"
        onClick={onOpenHelp}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <HelpCircle size={16} />
        <span>Help & Suggestions</span>
      </motion.button>
    </div>
  );
}
