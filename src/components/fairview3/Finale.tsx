"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ANTHEM_LYRICS, ANTHEM_TITLE } from "@/lib/fairview3/show";
import type { ShowState } from "@/lib/fairview3/store";
import { FinaleHeader, Frame, type Mode } from "./Sections";

const fmt = (s: number) => {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

/**
 * **The metal finale.** The stage plays the file the presenter pasted into
 * the console (a URL, so no rebuild); phones get the words and the horns.
 * No file yet means a polished ready state, never a fake track.
 */
export function Finale({
  mode,
  finale,
}: {
  mode: Mode;
  finale: ShowState["finale"];
}) {
  const lyrics = finale.lyrics ?? ANTHEM_LYRICS;
  const stage = mode === "stage";
  return (
    <Frame mode={mode} className={stage ? "" : "items-start"}>
      <div className={stage ? "grid grid-cols-[1.1fr_1fr] gap-[5vw]" : ""}>
        <div>
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 120, damping: 12 }}
            className={`${finale.started ? "fv3-headbang" : "fv3-float"} ${stage ? "mb-3 text-[5vw] leading-none" : "text-[26vw]"}`}
            aria-hidden
          >
            🤘
          </motion.div>
          <FinaleHeader mode={mode} />
          {stage ? (
            <Player audioUrl={finale.audioUrl} started={finale.started} />
          ) : (
            <p className="mt-6 text-lg text-white/80">
              {finale.started
                ? "Raise your phone. Sing along."
                : "The amps are warming up."}
            </p>
          )}
        </div>
        <Lyrics text={lyrics} mode={mode} />
      </div>
    </Frame>
  );
}

function Lyrics({ text, mode }: { text: string; mode: Mode }) {
  const blocks = text.split(/\n\s*\n/);
  return (
    <div
      className={`fv3-card mt-8 overflow-y-auto px-5 py-5 ${mode === "stage" ? "mt-0 max-h-[88vh] px-8" : "max-h-none"}`}
      data-testid="lyrics"
    >
      {blocks.map((b, i) => {
        const [first, ...rest] = b.split("\n");
        const isTag = /^\[.*\]$/.test(first ?? "");
        const lines = isTag ? rest : b.split("\n");
        return (
          <div key={i} className="mb-5">
            {isTag && (
              <p className="fv3-display-tight mb-1 text-xs tracking-[0.25em] text-fuchsia-300 uppercase">
                {first!.slice(1, -1)}
              </p>
            )}
            {lines.map((l, j) => (
              <p
                key={j}
                className={`${/^[A-Z !,'.?]+$/.test(l) && l.length > 6 ? "fv3-display text-white" : "text-white/85"} ${
                  mode === "stage" ? "text-[1.5vw]" : "text-lg"
                } leading-snug`}
              >
                {l}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function Player({
  audioUrl,
  started,
}: {
  audioUrl: string | null;
  started: boolean;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [d, setD] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [broken, setBroken] = useState(false);

  // The presenter's "start the finale" presses play here; a browser may
  // refuse autoplay without a gesture, and then the button is the gesture.
  useEffect(() => {
    const el = ref.current;
    if (!el || !audioUrl) return;
    if (started && el.paused) {
      el.play()
        .then(() => setBlocked(false))
        .catch(() => setBlocked(true));
    } else if (!started && !el.paused) {
      el.pause();
    }
  }, [started, audioUrl]);

  if (!audioUrl)
    return (
      <div className="fv3-card mt-6 px-8 py-5" data-testid="anthem-ready">
        <p className="fv3-display-tight text-[1.8vw] text-white">
          The anthem is being forged.
        </p>
        <p className="mt-1 text-[1.2vw] text-white/60">
          Paste the song URL in the presenter console and it plays here. No
          rebuild.
        </p>
      </div>
    );

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused)
      el.play()
        .then(() => setBlocked(false))
        .catch(() => setBlocked(true));
    else el.pause();
  };

  return (
    <div className="fv3-card mt-6 px-8 py-5" data-testid="anthem-player">
      <audio
        ref={ref}
        src={audioUrl}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
        onDurationChange={(e) => setD(e.currentTarget.duration)}
        onError={() => setBroken(true)}
      />
      <div className="flex items-center gap-6">
        <button
          type="button"
          onClick={toggle}
          className="fv3-shimmer flex h-[6vw] w-[6vw] items-center justify-center rounded-full text-[2.6vw] text-black shadow-[0_0_40px_rgba(255,43,214,0.6)]"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <div className="flex-1">
          <p className="fv3-display-tight text-[2.2vw]">{ANTHEM_TITLE}</p>
          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-white/15">
            <div
              className="fv3-shimmer h-full"
              style={{ width: `${d ? (t / d) * 100 : 0}%` }}
            />
          </div>
          <p className="mt-1 text-[1.3vw] text-white/60 tabular-nums">
            {fmt(t)} / {fmt(d)}
            {blocked && " · press play (the browser wants a click first)"}
            {broken && " · that file would not load"}
          </p>
        </div>
      </div>
    </div>
  );
}
