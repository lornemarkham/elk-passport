"use client";

import { useState } from "react";
import type { DreamPhoto } from "@/domain/dream/compose";
import styles from "./dream.module.css";

/**
 * A real photograph that fades in when it has arrived and steps aside when
 * it cannot — a broken remote image becomes the text treatment, never a
 * broken-image icon and never a stand-in (doctrine §12, 2026-11-13).
 */
export function Photo({
  photo,
  alt,
  priority = false,
  className,
  sizes,
}: {
  photo?: DreamPhoto;
  alt: string;
  priority?: boolean;
  className?: string;
  sizes?: string;
}) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  if (!photo || state === "failed")
    return (
      <div className={`${styles.noPhoto} ${className ?? ""}`} aria-hidden />
    );
  return (
    <div className={`${styles.photo} ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Atlas's photos live on arbitrary hosts */}
      <img
        src={photo.src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        {...(priority ? { fetchPriority: "high" as const } : {})}
        {...(sizes ? { sizes } : {})}
        referrerPolicy="no-referrer"
        data-ready={state === "ready" ? "" : undefined}
        onLoad={() => setState("ready")}
        onError={() => setState("failed")}
        ref={(img) => {
          // Cached images can finish before React attaches onLoad.
          if (img?.complete && img.naturalWidth > 0 && state === "loading")
            setState("ready");
        }}
      />
      {photo.label ? (
        <span className={styles.photoLabel}>{photo.label}</span>
      ) : null}
    </div>
  );
}
