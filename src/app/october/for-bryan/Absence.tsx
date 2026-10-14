"use client";

import { useEffect, useRef, useState } from "react";

/**
 * She notices when you are not there.
 *
 * Deliberately not documented beyond this. Whoever maintains it later should
 * find out the way it is meant to be found out.
 */

const SHORT = ["You were gone.", "You went somewhere.", "You left."];

/** What she says about it. She is not angry; she is interested. */
function words(seconds: number, times: number): readonly string[] {
  if (times > 2) {
    return [
      `${seconds} seconds that time.`,
      "You keep doing that.",
      "Where do you go?",
    ];
  }
  if (seconds >= 45) {
    return [
      `You were gone ${seconds} seconds.`,
      "I counted.",
      "I don't know where I go either.",
    ];
  }
  if (seconds >= 8) {
    return [`You were gone ${seconds} seconds.`, "I counted."];
  }
  return [SHORT[times % SHORT.length]!, "I noticed."];
}

export function Absence() {
  const left = useRef<number | null>(null);
  const count = useRef(0);
  const [said, setSaid] = useState<readonly string[] | null>(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const change = () => {
      if (document.visibilityState === "hidden") {
        left.current = Date.now();
        return;
      }
      if (left.current === null) return;
      const away = Math.round((Date.now() - left.current) / 1000);
      left.current = null;
      // Alt-tabbing for two seconds is an accident, not an absence.
      if (away < 3) return;
      count.current += 1;
      setSaid(words(away, count.current));
      setShown(0);
    };
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);

  // One line at a time, then gone, and never mentioned again.
  useEffect(() => {
    if (!said) return;
    if (shown >= said.length) {
      const t = setTimeout(() => setSaid(null), 2600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(
      () => setShown((n) => n + 1),
      shown === 0 ? 900 : 2100,
    );
    return () => clearTimeout(t);
  }, [said, shown]);

  if (!said) return null;
  const line = said[Math.min(shown, said.length - 1)]!;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[11vh] z-30 flex justify-center px-8"
      aria-hidden
    >
      <p
        key={line}
        className="font-heading text-center text-lg leading-snug text-balance text-[#f3efe4]/70 sm:text-xl"
        style={{
          animation: "fb-absence 700ms ease-out both",
          textShadow: "0 2px 30px rgba(0,0,0,0.9)",
        }}
      >
        {line}
      </p>
      <style>{`
        @keyframes fb-absence { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </div>
  );
}
