"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useCursorPan } from "./useCursorPan";

export interface PassportVideoCardProps {
  title: string;
  videoSrc: string;
  posterSrc?: string;
  className?: string;
}

/**
 * A single "living photograph" Passport card: a looping, muted background
 * video that pans horizontally toward the cursor, via `useCursorPan`.
 */
export function PassportVideoCard({
  title,
  videoSrc,
  posterSrc,
  className,
}: PassportVideoCardProps) {
  const [videoFailed, setVideoFailed] = useState(false);
  const { videoRef, handleMouseMove, handleMouseLeave } = useCursorPan(true);

  return (
    <article
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      aria-label={title}
      className={cn(
        "relative isolate aspect-[4/5] overflow-hidden rounded-3xl bg-neutral-900",
        className,
      )}
    >
      {!videoFailed && (
        <video
          ref={videoRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover select-none"
          style={{ objectPosition: "50% center" }}
          src={videoSrc}
          poster={posterSrc}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onError={() => setVideoFailed(true)}
        />
      )}

      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.72)_0%,rgba(0,0,0,0.12)_55%,rgba(0,0,0,0.08)_100%)]"
      />

      <div className="absolute inset-x-0 bottom-0 p-6">
        <h3 className="font-heading text-lg font-medium tracking-[-0.01em] text-white/90">
          {title}
        </h3>
      </div>
    </article>
  );
}
