"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  ANTHEM_LYRICS,
  ANTHEM_TITLE,
  TRACKS,
  defaultAudioPath,
  trackById,
  type TrackId,
} from "@/lib/fairview3/show";
import type { ShowState } from "@/lib/fairview3/store";
import { FinaleHeader, Frame, type Mode } from "./Sections";

const fmt = (s: number) => {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

/** The song the finale plays: the presenter's pick, else the announced winner. */
export const finaleTrackId = (state: ShowState): TrackId | null =>
  state.finale.track ?? state.showdown.winner;

export const audioSrc = (state: ShowState, id: TrackId): string =>
  state.finale.tracks[id].audioUrl ?? defaultAudioPath(id);

/**
 * **The finale.** The stage plays the winning song from the audio slot the
 * presenter configured (or `/fairview3/audio/fairview3-<style>.mp3`); phones
 * get the words. The presenter starts it; nothing plays on its own. A missing
 * file is a calm message and the lyrics, never a fake track.
 */
export function Finale({ mode, state }: { mode: Mode; state: ShowState }) {
  const id = finaleTrackId(state);
  const track = id ? trackById(id) : null;
  const lyrics = (id && state.finale.tracks[id].lyrics) || ANTHEM_LYRICS;
  const stage = mode === "stage";
  const started = state.finale.started;
  const body = (
    <div className={stage ? "grid grid-cols-[1.1fr_1fr] gap-[5vw]" : ""}>
      <div>
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 120, damping: 12 }}
          className={`${started ? "fv3-headbang" : "fv3-float"} ${stage ? "mb-3 text-[5vw] leading-none" : "text-[26vw]"}`}
          aria-hidden
        >
          {track?.emoji ?? "🎵"}
        </motion.div>
        <FinaleHeader mode={mode} trackId={id} />
        {stage ? (
          <Player state={state} id={id} />
        ) : (
          <p className="mt-6 text-lg text-white/80">
            {id
              ? started
                ? "Raise your phone. Sing along."
                : "The band is warming up."
              : "The room is about to choose."}
          </p>
        )}
      </div>
      <Lyrics text={lyrics} mode={mode} />
    </div>
  );
  return (
    <Frame mode={mode} className={stage ? "" : "items-start"}>
      {body}
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

/**
 * All three slots are mounted (`preload="auto"`) so the winner starts at
 * once, but only the chosen one is ever played. The presenter's Start is the
 * trigger; if this browser refuses to play without a click on this very
 * screen, the button below is that click.
 */
function Player({ state, id }: { state: ShowState; id: TrackId | null }) {
  const els = useRef<Partial<Record<TrackId, HTMLAudioElement | null>>>({});
  const box = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [d, setD] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [broken, setBroken] = useState<Partial<Record<TrackId, boolean>>>({});
  // `null` follows the presenter's volume; a local nudge wins until it changes.
  const [local, setLocal] = useState<{ of: number; v: number } | null>(null);
  const started = state.finale.started;
  const volume =
    local && local.of === state.finale.volume ? local.v : state.finale.volume;

  const current = id ? els.current[id] : null;
  const src = id ? audioSrc(state, id) : null;
  const missing = id ? !!broken[id] : false;

  // Presenter pressed Start / Stop: play or pause the chosen slot only.
  useEffect(() => {
    for (const k of TRACKS) {
      const el = els.current[k.id];
      if (!el) continue;
      if (k.id !== id && !el.paused) el.pause();
    }
    const el = id ? els.current[id] : null;
    if (!el || !id) return;
    if (started && el.paused) {
      el.play()
        .then(() => setBlocked(false))
        .catch(() => setBlocked(true));
    } else if (!started && !el.paused) {
      el.pause();
    }
  }, [started, id, src]);

  useEffect(() => {
    for (const k of TRACKS) {
      const el = els.current[k.id];
      if (el) el.volume = volume;
    }
  }, [volume]);

  const toggle = () => {
    const el = current;
    if (!el) return;
    if (el.paused)
      el.play()
        .then(() => setBlocked(false))
        .catch(() => setBlocked(true));
    else el.pause();
  };

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void box.current?.requestFullscreen?.().catch(() => {});
  };

  const label = id ? trackById(id).label : null;
  return (
    <div
      ref={box}
      className="fv3-card mt-6 px-8 py-5 [&:fullscreen]:flex [&:fullscreen]:flex-col [&:fullscreen]:justify-center [&:fullscreen]:bg-[#06041a]"
      data-testid="finale-player"
      data-track={id ?? ""}
      data-state={
        !id ? "waiting" : missing ? "missing" : started ? "playing" : "ready"
      }
    >
      {TRACKS.map((k) => (
        <audio
          key={k.id}
          ref={(el) => {
            els.current[k.id] = el;
          }}
          src={audioSrc(state, k.id)}
          preload="auto"
          onPlay={() => k.id === id && setPlaying(true)}
          onPause={() => k.id === id && setPlaying(false)}
          onTimeUpdate={(e) => k.id === id && setT(e.currentTarget.currentTime)}
          onDurationChange={(e) =>
            k.id === id && setD(e.currentTarget.duration)
          }
          onLoadedMetadata={(e) =>
            k.id === id && setD(e.currentTarget.duration)
          }
          onCanPlay={() =>
            setBroken((b) => (b[k.id] ? { ...b, [k.id]: false } : b))
          }
          onError={() => setBroken((b) => ({ ...b, [k.id]: true }))}
        />
      ))}
      {!id ? (
        <p className="fv3-display-tight text-[1.8vw] text-white">
          Waiting for the room to choose.
        </p>
      ) : missing ? (
        <div data-testid="finale-missing">
          <p className="fv3-display-tight text-[1.8vw] text-white">
            {label} isn&apos;t loaded yet.
          </p>
          <p className="mt-1 text-[1.2vw] text-white/60">
            The words are on screen. Set this track&apos;s audio in the
            presenter console, or drop {trackById(id).slot}.mp3 in
            public/fairview3/audio.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={toggle}
              className="fv3-shimmer flex h-[6vw] w-[6vw] shrink-0 items-center justify-center rounded-full text-[2.6vw] text-black shadow-[0_0_40px_rgba(255,43,214,0.6)]"
              aria-label={playing ? "Pause" : "Play"}
              data-testid="finale-play"
            >
              {playing ? "❚❚" : "▶"}
            </button>
            <div className="flex-1">
              <p className="fv3-display-tight text-[2.2vw]">
                {ANTHEM_TITLE} · {label}
              </p>
              <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-white/15">
                <div
                  className="fv3-shimmer h-full"
                  style={{ width: `${d ? (t / d) * 100 : 0}%` }}
                />
              </div>
              <p
                className="mt-1 text-[1.3vw] text-white/60 tabular-nums"
                data-testid="finale-time"
              >
                {fmt(t)} / {fmt(d)}
                {blocked && " · press play (the browser wants a click first)"}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4 text-[1.3vw] text-white/70">
            <label className="flex items-center gap-3" htmlFor="fv3-volume">
              🔊
              <input
                id="fv3-volume"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) =>
                  setLocal({
                    of: state.finale.volume,
                    v: Number(e.target.value),
                  })
                }
                className="w-[14vw]"
                aria-label="Volume"
                data-testid="finale-volume"
              />
            </label>
            <button
              type="button"
              onClick={fullscreen}
              className="ml-auto rounded-full bg-white/10 px-4 py-1 font-bold text-white ring-1 ring-white/20"
              data-testid="finale-fullscreen"
            >
              ⛶ Fullscreen
            </button>
          </div>
        </>
      )}
    </div>
  );
}
