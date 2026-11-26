"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { DreamCard } from "@/domain/dream/compose";
import { Photo } from "./Photo";
import styles from "./dream.module.css";

const FRAME_MS = 7000;

/** Whether the reel is behind the answer (paused) — set by `Dream`. */
export const ReelPaused = createContext(false);

/**
 * **The opening reel**: real places near you, one at a time, each slowly
 * moving (a Ken Burns drift, transform and opacity only, so it costs the
 * compositor and not the main thread). The place is named, with how far it
 * is, and opens on a tap. Reduced motion holds the first frame still.
 */
export function Reel({ frames }: { frames: readonly DreamCard[] }) {
  const paused = useContext(ReelPaused);
  const [at, setAt] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setStill(query.matches);
    read();
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, []);

  useEffect(() => {
    if (still || paused || frames.length < 2) return;
    const t = window.setInterval(
      () => setAt((n) => (n + 1) % frames.length),
      FRAME_MS,
    );
    return () => window.clearInterval(t);
  }, [still, paused, frames.length]);

  if (frames.length === 0)
    return <div className={styles.reelEmpty} aria-hidden />;
  const shown = frames[at % frames.length]!;
  return (
    <div className={styles.reel} data-still={still ? "" : undefined}>
      {frames.map((f, i) => (
        <div
          key={f.id}
          className={styles.frame}
          data-on={i === at % frames.length ? "" : undefined}
          aria-hidden={i !== at % frames.length}
        >
          {/* Only the first frame is fetched eagerly; the rest as they near. */}
          {i === 0 || Math.abs(i - (at % frames.length)) <= 1 ? (
            <Photo
              photo={f.photo}
              alt=""
              priority={i === 0}
              className={styles.framePhoto}
            />
          ) : null}
        </div>
      ))}
      <div className={styles.scrim} aria-hidden />
      {shown.href ? (
        <a className={styles.caption} href={shown.href}>
          <span>{shown.title}</span>
          {shown.km !== undefined ? (
            <span> · {shown.km < 1 ? "under 1" : Math.round(shown.km)} km</span>
          ) : null}
        </a>
      ) : null}
    </div>
  );
}
