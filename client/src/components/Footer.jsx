import React from "react";
import { motion } from "framer-motion";

export default function Footer() {
  return (
    <footer className="footer">
      <motion.a
        href="https://github.com/Tharunkunamalla"
        target="_blank"
        rel="noreferrer"
        className="developed-by"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        whileHover={{ scale: 1.05 }}
      >
        <span>Developed by Tharunkunamalla</span>
        <img
          src="https://github.com/Tharunkunamalla.png"
          alt="Tharunkunamalla"
          className="avatar"
        />
      </motion.a>
    </footer>
  );
}
