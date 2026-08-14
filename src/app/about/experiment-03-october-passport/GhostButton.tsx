"use client";

import { useState } from "react";
import { motion } from "framer-motion";

/**
 * "The ghost stole the button" — a real, self-contained, deliberately
 * rare mini-interaction, not applied broadly (the brief's own "do not
 * overuse" rule). On most hovers, nothing happens; roughly a third of
 * the time, the button darts a short, random distance before you can
 * click it. Always eventually catchable — the offset resets after each
 * dodge, so this is delight, not a dark pattern.
 */
export function GhostButton() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [caught, setCaught] = useState(false);
  const [dodges, setDodges] = useState(0);

  function handleHoverStart() {
    if (caught) return;
    if (Math.random() < 0.35) {
      const dx = (Math.random() - 0.5) * 180;
      const dy = (Math.random() - 0.5) * 50;
      setOffset({ x: dx, y: dy });
      setDodges((d) => d + 1);
    }
  }

  function handleClick() {
    setCaught(true);
    setOffset({ x: 0, y: 0 });
  }

  function reset() {
    setCaught(false);
    setDodges(0);
  }

  return (
    <div className="relative flex h-28 items-center justify-center">
      <motion.button
        type="button"
        onHoverStart={handleHoverStart}
        onClick={caught ? reset : handleClick}
        animate={{ x: offset.x, y: offset.y }}
        transition={{ type: "spring", stiffness: 300, damping: 15 }}
        className={`rounded-full px-5 py-2.5 text-sm font-bold transition-colors ${
          caught
            ? "border border-current/20 opacity-70"
            : "bg-[#ff5a1f] text-[#171208]"
        }`}
      >
        {caught
          ? `Caught it. ${dodges > 0 ? `(${dodges} dodges first) — again?` : "Again?"}`
          : "👻 Catch me"}
      </motion.button>
    </div>
  );
}
