"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TRACKS } from "@/domain/october/notebook";

/**
 * **The five pieces, on a bench, none of them chosen.**
 *
 * ## One element, not five
 *
 * A single `<audio>` that the rows take turns owning. Five separate players
 * means two of these can be playing at once, and two of these playing at once
 * is not a mix, it is a mistake — they are all low-frequency pressure and they
 * turn to mud instantly. Taking a track means giving up the last one.
 *
 * ## Why not the browser's own controls
 *
 * Because a default `<audio controls>` bar is the one piece of grey operating
 * system in a room that has spent months getting dark. The parts that matter
 * are the same — play, scrub, where am I — drawn in October's own seam of warm
 * light.
 */

const fmt = (s: number) => {
  if (!Number.isFinite(s)) return "—";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

export function SoundBench() {
  const audio = useRef<HTMLAudioElement | null>(null);
  /** The file currently loaded, playing or paused. */
  const [current, setCurrent] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [length, setLength] = useState(0);
  /** Autoplay refusals and missing files both end up here, said plainly. */
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    const el = new Audio();
    el.preload = "none";
    audio.current = el;
    const time = () => setAt(el.currentTime);
    const meta = () => setLength(el.duration);
    const ended = () => {
      setPlaying(false);
      setAt(0);
    };
    el.addEventListener("timeupdate", time);
    el.addEventListener("loadedmetadata", meta);
    el.addEventListener("ended", ended);
    el.addEventListener("play", () => setPlaying(true));
    el.addEventListener("pause", () => setPlaying(false));
    return () => {
      el.pause();
      el.src = "";
      el.removeEventListener("timeupdate", time);
      el.removeEventListener("loadedmetadata", meta);
      el.removeEventListener("ended", ended);
    };
  }, []);

  const toggle = useCallback(
    (file: string) => {
      const el = audio.current;
      if (!el) return;
      setFailed(null);
      if (current === file) {
        if (el.paused) void el.play().catch(() => setFailed(file));
        else el.pause();
        return;
      }
      el.pause();
      // Spaces and brackets survive the round trip only if they are encoded;
      // `Subterranean Pressure (1).m4a` is the one that proves it.
      el.src = `/sounds/${encodeURIComponent(file)}`;
      setCurrent(file);
      setAt(0);
      setLength(0);
      void el.play().catch(() => setFailed(file));
    },
    [current],
  );

  const seek = useCallback(
    (file: string, fraction: number) => {
      const el = audio.current;
      if (!el || current !== file || !Number.isFinite(el.duration)) return;
      el.currentTime = Math.max(0, Math.min(1, fraction)) * el.duration;
      setAt(el.currentTime);
    },
    [current],
  );

  return (
    <ul className="flex flex-col gap-1">
      {TRACKS.map((track) => {
        const live = current === track.file;
        const total = live && length ? length : track.seconds;
        const through = live && total ? Math.min(1, at / total) : 0;

        return (
          <li
            key={track.file}
            data-testid="sound-track"
            className={`rounded-lg border px-4 py-4 transition-colors sm:px-5 ${
              live
                ? "border-[#d09a4e]/35 bg-[#e9e6da]/[0.045]"
                : "border-[#e9e6da]/[0.08] bg-[#e9e6da]/[0.015] hover:border-[#e9e6da]/20"
            }`}
          >
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => toggle(track.file)}
                aria-label={`${live && playing ? "Pause" : "Play"} ${track.title}`}
                className="group flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#d09a4e]/30 text-[#d09a4e] transition-colors hover:border-[#d09a4e]/70 hover:bg-[#d09a4e]/10 focus-visible:ring-1 focus-visible:ring-[#d09a4e] focus-visible:outline-none"
              >
                {live && playing ? (
                  <span className="flex gap-[3px]">
                    <span className="block h-3.5 w-[3px] bg-current" />
                    <span className="block h-3.5 w-[3px] bg-current" />
                  </span>
                ) : (
                  // A triangle, nudged right so it sits optically centred.
                  <span className="ml-[3px] block size-0 border-y-[7px] border-l-[11px] border-y-transparent border-l-current" />
                )}
              </button>

              <div className="min-w-0 flex-1">
                <p className="font-heading truncate text-lg text-[#f3efe4]">
                  {track.title}
                </p>
                {track.variantOf ? (
                  <p className="mt-0.5 text-[11px] tracking-wide text-[#e9e6da]/30">
                    another take on {track.variantOf}
                  </p>
                ) : null}
              </div>

              <span className="shrink-0 font-mono text-xs text-[#e9e6da]/35 tabular-nums">
                {live ? `${fmt(at)} / ${fmt(total)}` : fmt(track.seconds)}
              </span>
            </div>

            {/* The seam again, this time as a scrubber. */}
            <button
              type="button"
              aria-label={`Scrub ${track.title}`}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                seek(track.file, (e.clientX - r.left) / r.width);
              }}
              className={`relative mt-3 block h-6 w-full cursor-pointer ${live ? "" : "pointer-events-none"}`}
            >
              <span className="absolute inset-x-0 top-1/2 block h-px -translate-y-1/2 bg-[#e9e6da]/10" />
              <span
                className="absolute top-1/2 left-0 block h-px -translate-y-1/2 bg-[#ffcf8a]"
                style={{
                  width: `${through * 100}%`,
                  boxShadow:
                    through > 0
                      ? "0 0 14px 2px rgba(255,190,110,0.45)"
                      : undefined,
                }}
              />
            </button>

            {/* Left blank on purpose. Nobody has written these yet, and a
                made-up description of a piece of music is worse than a gap. */}
            {track.note ? (
              <p className="mt-1 text-sm text-[#e9e6da]/50">{track.note}</p>
            ) : (
              <p className="mt-1 text-sm text-[#e9e6da]/20 italic">
                what were we trying here?
              </p>
            )}

            {failed === track.file ? (
              <p className="mt-2 text-xs text-[#d09a4e]/80">
                Your browser would not start it. Tap again.
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
