"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TRACK } from "./script";

/**
 * **The track, offered rather than played.**
 *
 * Nothing starts on its own. It is five and a quarter minutes of low-frequency
 * pressure that ends in howling, and firing that at somebody who has not
 * decided to hear it would be the single rudest thing on the site.
 *
 * So it is an invitation with a warning about headphones, and once it is
 * running the page gives it room: a ring that fills, the time, and nothing
 * else moving. The escalation is the content — anything competing with it is
 * noise.
 */
const fmt = (s: number) =>
  Number.isFinite(s)
    ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`
    : "—";

export function Listen() {
  const el = useRef<HTMLAudioElement | null>(null);
  const [on, setOn] = useState(false);
  const [at, setAt] = useState(0);
  const [len, setLen] = useState(TRACK.seconds);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const a = new Audio();
    a.preload = "none";
    el.current = a;
    const time = () => setAt(a.currentTime);
    const meta = () => setLen(a.duration);
    const stop = () => setOn(false);
    a.addEventListener("timeupdate", time);
    a.addEventListener("loadedmetadata", meta);
    a.addEventListener("ended", stop);
    a.addEventListener("pause", stop);
    a.addEventListener("play", () => setOn(true));
    return () => {
      a.pause();
      a.src = "";
      a.removeEventListener("timeupdate", time);
      a.removeEventListener("loadedmetadata", meta);
      a.removeEventListener("ended", stop);
    };
  }, []);

  const toggle = useCallback(() => {
    const a = el.current;
    if (!a) return;
    setFailed(false);
    if (!a.src) a.src = `/sounds/${encodeURIComponent(TRACK.file)}`;
    if (a.paused) void a.play().catch(() => setFailed(true));
    else a.pause();
  }, []);

  const through = len ? Math.min(1, at / len) : 0;
  const C = 2 * Math.PI * 52;

  return (
    <div className="flex min-h-[46vh] flex-col items-center justify-center">
      <p className="text-[11px] tracking-[0.3em] text-[#d09a4e]/70 uppercase">
        {on ? "she is getting louder" : "the one we keep going back to"}
      </p>

      <button
        type="button"
        onClick={toggle}
        aria-label={on ? `Stop ${TRACK.title}` : `Play ${TRACK.title}`}
        className="group relative mt-10 flex size-32 cursor-pointer items-center justify-center rounded-full"
      >
        <svg
          className="absolute inset-0 -rotate-90"
          viewBox="0 0 120 120"
          aria-hidden
        >
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="rgba(233,230,218,0.12)"
            strokeWidth="1"
          />
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="#ffcf8a"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - through)}
            style={{
              transition: "stroke-dashoffset 400ms linear",
              filter:
                through > 0
                  ? "drop-shadow(0 0 8px rgba(255,190,110,0.5))"
                  : undefined,
            }}
          />
        </svg>
        {on ? (
          <span className="flex gap-1.5">
            <span className="block h-5 w-1 bg-[#d09a4e]" />
            <span className="block h-5 w-1 bg-[#d09a4e]" />
          </span>
        ) : (
          <span className="ml-1.5 block size-0 border-y-[10px] border-l-[16px] border-y-transparent border-l-[#d09a4e]" />
        )}
      </button>

      <p className="mt-8 font-mono text-xs text-[#e9e6da]/35 tabular-nums">
        {fmt(at)} / {fmt(len)}
      </p>
      <p className="font-heading mt-3 text-xl text-[#f3efe4]/85">
        {TRACK.title}
      </p>
      <p className="mt-2 max-w-sm text-center text-sm leading-relaxed text-[#e9e6da]/40">
        Quiet for a long time. Headphones, and don&apos;t reach for the volume
        at four minutes.
      </p>
      {failed ? (
        <p className="mt-4 text-xs text-[#d09a4e]/80">
          Your browser would not start it. Tap again.
        </p>
      ) : null}
    </div>
  );
}
