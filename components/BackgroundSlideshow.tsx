"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const IMAGES = [
  "/images/regular_Fade.jpeg",
  "/images/cut_and_blonde.jpeg",
  "/images/cut_and_fibre.jpeg",
  "/images/cut_and_tint.jpeg",
  "/images/line_designs.jpeg",
  "/images/line_designs1.jpeg"
];

export default function BackgroundSlideshow() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % IMAGES.length);
    }, 6000); // Change image every 6 seconds
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0 bg-black">
      <AnimatePresence mode="wait">
        <motion.img
          key={IMAGES[index]}
          src={IMAGES[index]}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 0.39, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 2.0, ease: "easeInOut" }}
          className="absolute inset-0 w-full h-full object-cover filter blur-[2px]"
        />
      </AnimatePresence>
    </div>
  );
}
