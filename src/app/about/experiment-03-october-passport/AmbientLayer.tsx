"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  COZY_SURPRISES,
  CREEPY_SURPRISES,
  CROW_CROSSES_SCREEN_LINE,
  FOG_HIDES_INTERFACE_LINE,
  HEARTBEAT_LINE,
  NIGHTMARE_SURPRISES,
  SPOOKY_SURPRISES,
  type Intensity,
} from "./content";

const LEAVES = ["🍂", "🍁", "🍂", "🍁", "🍂"];
const MOON_PHASES = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];

/** A real, standard synodic-month approximation — not decoration picked at random. Reference new moon: 2000-01-06 18:14 UTC. */
function moonPhaseIndex(date: Date): number {
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
  const synodicMonth = 29.53058867;
  const diffDays = (date.getTime() - knownNewMoon) / 86_400_000;
  const phase = ((diffDays % synodicMonth) + synodicMonth) % synodicMonth;
  return (
    Math.floor((phase / synodicMonth) * MOON_PHASES.length) % MOON_PHASES.length
  );
}

function seed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return h;
}

/**
 * The permanent, always-on background — fog drift, falling leaves, a
 * candle, a real moon phase, and rare, unannounced surprises. Deepened
 * for the "actually unsettling" pass: surprises now scale with
 * `intensity` (Family draws from one gentle pool; Classic and After Dark
 * add moodier pools on top, never replacing the gentle ones), and a
 * genuinely rare full-screen fog event can now briefly obscure the page
 * itself — the one surprise big enough to need its own visual, not just
 * a corner caption.
 *
 * Core tension principle, applied directly: intervals are long (18–45s),
 * the trigger chance is low (12%), and nothing repeats in a way a
 * visitor could predict. Silence is the default state, not a gap between
 * effects.
 */
export function AmbientLayer({
  intensity,
  onSurprise,
}: {
  intensity: Intensity;
  /** Called with whichever line was chosen, whenever a surprise fires — lets the parent react to a specific one (see `SOUNDTRACK_DUCKS_LINE`, which triggers a real audio dip via `useSoundscape.duck()`) without this component needing to know anything about sound. */
  onSurprise?: (line: string) => void;
}) {
  const [moonIndex, setMoonIndex] = useState<number | null>(null);
  const [surprise, setSurprise] = useState<string | null>(null);
  const [fogFlash, setFogFlash] = useState(false);
  const [crowFlying, setCrowFlying] = useState(false);
  const [heartbeatPulse, setHeartbeatPulse] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading today's real date after mount is the sync itself, the same legitimate case TrackRating.tsx and DiscoverySwipeExperiment.tsx both already document
    setMoonIndex(moonPhaseIndex(new Date()));
  }, []);

  useEffect(() => {
    const pool =
      intensity === "nightmare"
        ? [
            ...COZY_SURPRISES,
            ...SPOOKY_SURPRISES,
            ...CREEPY_SURPRISES,
            ...NIGHTMARE_SURPRISES,
          ]
        : intensity === "creepy"
          ? [...COZY_SURPRISES, ...SPOOKY_SURPRISES, ...CREEPY_SURPRISES]
          : intensity === "spooky"
            ? [...COZY_SURPRISES, ...SPOOKY_SURPRISES]
            : COZY_SURPRISES;

    const interval = window.setInterval(
      () => {
        if (Math.random() < 0.12) {
          const line = pool[Math.floor(Math.random() * pool.length)]!;
          onSurprise?.(line);
          if (line === FOG_HIDES_INTERFACE_LINE) {
            setFogFlash(true);
            window.setTimeout(() => setFogFlash(false), 2200);
            return;
          }
          if (line === CROW_CROSSES_SCREEN_LINE) {
            setCrowFlying(true);
            window.setTimeout(() => setCrowFlying(false), 2600);
            return;
          }
          if (line === HEARTBEAT_LINE) {
            setHeartbeatPulse(true);
            window.setTimeout(() => setHeartbeatPulse(false), 3200);
            setSurprise(line);
            window.setTimeout(() => setSurprise(null), 4800);
            return;
          }
          setSurprise(line);
          window.setTimeout(() => setSurprise(null), 4800);
        }
      },
      20000 + Math.random() * 25000,
    );
    return () => window.clearInterval(interval);
  }, [intensity, onSurprise]);

  const leaves = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        emoji: LEAVES[i % LEAVES.length]!,
        left: seed(`leaf-${i}`) % 100,
        duration: 14 + (seed(`dur-${i}`) % 10),
        delay: seed(`delay-${i}`) % 12,
        drift: (seed(`drift-${i}`) % 40) - 20,
      })),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      <style>{`
        @keyframes leaf-fall {
          0% { transform: translateY(-8vh) translateX(0) rotate(0deg); opacity: 0; }
          10% { opacity: 0.85; }
          90% { opacity: 0.7; }
          100% { transform: translateY(108vh) translateX(var(--drift, 0px)) rotate(340deg); opacity: 0; }
        }
        @keyframes fog-drift {
          0% { transform: translateX(-10%); }
          50% { transform: translateX(6%); }
          100% { transform: translateX(-10%); }
        }
        @keyframes candle-flicker {
          0%, 100% { opacity: 0.85; transform: scale(1); }
          25% { opacity: 0.6; transform: scale(0.94); }
          50% { opacity: 1; transform: scale(1.05); }
          75% { opacity: 0.7; transform: scale(0.97); }
        }
        @keyframes crow-fly {
          0% { transform: translateX(-10vw) translateY(0); opacity: 0; }
          15% { opacity: 0.8; }
          85% { opacity: 0.8; }
          100% { transform: translateX(110vw) translateY(-6vh); opacity: 0; }
        }
        @keyframes heartbeat-pulse {
          0%, 100% { opacity: 0; }
          10% { opacity: 0.12; }
          20% { opacity: 0; }
          30% { opacity: 0.12; }
          45% { opacity: 0; }
        }
      `}</style>

      {/* Fog */}
      <div
        className="absolute -inset-x-1/4 top-1/3 h-1/2 bg-gradient-to-r from-transparent via-[#f3ead9]/[0.06] to-transparent blur-3xl"
        style={{ animation: "fog-drift 40s ease-in-out infinite" }}
      />

      {/* Rare event: fog briefly hides the whole interface — the one surprise that gets a full-screen visual */}
      <AnimatePresence>
        {fogFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.85 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1 }}
            className="absolute inset-0 bg-[#100c06] backdrop-blur-md"
          />
        )}
      </AnimatePresence>

      {/* Rare event: a crow crosses the screen, once — a real visual, not just a caption */}
      <AnimatePresence>
        {crowFlying && (
          <span
            className="absolute top-1/3 left-0 text-2xl"
            style={{ animation: "crow-fly 2.4s linear forwards" }}
          >
            🐦‍⬛
          </span>
        )}
      </AnimatePresence>

      {/* Rare event: a heartbeat — a faint, real full-screen pulse, not just text */}
      {heartbeatPulse && (
        <div
          className="absolute inset-0 bg-[#7a1a10]"
          style={{ animation: "heartbeat-pulse 1.6s ease-in-out 2" }}
        />
      )}

      {/* Falling leaves */}
      {leaves.map((leaf, i) => (
        <span
          key={i}
          className="absolute top-0 text-2xl opacity-0"
          style={
            {
              left: `${leaf.left}%`,
              "--drift": `${leaf.drift}px`,
              animation: `leaf-fall ${leaf.duration}s linear ${leaf.delay}s infinite`,
            } as React.CSSProperties
          }
        >
          {leaf.emoji}
        </span>
      ))}

      {/* Candle */}
      <span
        className="absolute bottom-8 left-6 text-2xl"
        style={{ animation: "candle-flicker 2.4s ease-in-out infinite" }}
      >
        🕯️
      </span>

      {/* Real moon phase */}
      {moonIndex !== null && (
        <span className="absolute top-6 right-6 text-3xl opacity-80">
          {MOON_PHASES[moonIndex]}
        </span>
      )}

      {/* A rare, unannounced surprise */}
      <AnimatePresence>
        {surprise && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.55 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            className="absolute right-8 bottom-10 max-w-[220px] text-right text-xs text-[#f3ead9] italic"
          >
            {surprise}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
