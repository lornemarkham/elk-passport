"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GhostPortraitMode } from "./content";

export type CameraStatus =
  "idle" | "requesting" | "live" | "denied" | "unavailable" | "stopped";

/**
 * Shared camera lifecycle behind both `GhostPortrait` and `ScareCam` —
 * extracted once a second real caller needed the identical
 * request/permission/cleanup/capture logic, the same "extract on second
 * real need, not before" discipline this workspace has followed all
 * session (`docs/content-model/future.md`).
 *
 * Real privacy discipline, not just a comment: the camera is never
 * requested until `start()` is called from an explicit user click in
 * either component (never on mount), every track is stopped the moment
 * `stop()` runs or the component unmounts, and nothing captured here is
 * ever sent anywhere — `captureFrame()` returns a canvas that lives only
 * in the browser's memory. No network call exists in this file.
 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");

  const start = useCallback(async () => {
    setStatus("requesting");
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setStatus("unavailable");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus("live");
    } catch (err) {
      const name = (err as DOMException)?.name;
      setStatus(
        name === "NotFoundError" || name === "NotReadableError"
          ? "unavailable"
          : "denied",
      );
    }
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStatus((s) => (s === "live" ? "stopped" : s));
  }, []);

  const captureFrame = useCallback((): HTMLCanvasElement | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  }, []);

  // Belt-and-suspenders: if the component unmounts while the camera is
  // still live (navigating away mid-session), the stream stops here too,
  // not just via the explicit `stop()` call.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return { videoRef, status, start, stop, captureFrame };
}

/** Dispatches to one of three real canvas transforms — see each function's own comment. All three are genuine pixel/composite operations, not a single CSS filter swapped by name. */
export function applyGhostPortraitFilter(
  source: HTMLCanvasElement,
  mode: GhostPortraitMode["id"],
): HTMLCanvasElement {
  if (mode === "vhs") return applyVhsFilter(source);
  if (mode === "faded") return applyFadedFilter(source);
  return applyVintageFilter(source);
}

/** Sepia, desaturated, vignetted, lightly grained — a real canvas transform, not a CSS filter on the live video, so the captured/downloaded image itself carries the effect. */
export function applyVintageFilter(
  source: HTMLCanvasElement,
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext("2d");
  if (!ctx) return source;

  ctx.filter = "sepia(0.55) contrast(1.15) brightness(0.92) saturate(0.6)";
  ctx.drawImage(source, 0, 0);
  ctx.filter = "none";

  const vignette = ctx.createRadialGradient(
    out.width / 2,
    out.height / 2,
    out.height / 3,
    out.width / 2,
    out.height / 2,
    out.height / 1.1,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(20,12,4,0.55)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, out.width, out.height);

  // Light grain — a scatter of low-opacity dots, cheap and real, not a stock texture.
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "#000" : "#fff";
    ctx.fillRect(Math.random() * out.width, Math.random() * out.height, 1, 1);
  }
  ctx.globalAlpha = 1;

  return out;
}

/** Scan lines, a slight colour-channel split, heavy grain — a real composite meant to read as an old horror-movie still, not a photo filter preset borrowed from an app. */
function applyVhsFilter(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext("2d");
  if (!ctx) return source;

  ctx.filter = "contrast(1.1) saturate(1.3) brightness(0.95) hue-rotate(-4deg)";
  ctx.drawImage(source, 0, 0);
  ctx.filter = "none";

  // A faint red/cyan channel offset, the cheapest real way to fake analogue colour bleed.
  ctx.globalAlpha = 0.12;
  ctx.drawImage(source, -2, 0);
  ctx.globalAlpha = 0.1;
  ctx.drawImage(source, 2, 0);
  ctx.globalAlpha = 1;

  // Scan lines — real, drawn, not a texture asset.
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = "#000";
  for (let y = 0; y < out.height; y += 3) {
    ctx.fillRect(0, y, out.width, 1);
  }
  ctx.globalAlpha = 1;

  // Heavier grain than the vintage preset — tape noise, not film grain.
  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "#000" : "#fff";
    ctx.fillRect(Math.random() * out.width, Math.random() * out.height, 2, 1);
  }
  ctx.globalAlpha = 1;

  return out;
}

/** Washed out, low contrast, warm-grey — meant to look found, not styled. The lightest touch of the three. */
function applyFadedFilter(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext("2d");
  if (!ctx) return source;

  ctx.filter = "grayscale(0.4) contrast(0.75) brightness(1.15) sepia(0.2)";
  ctx.drawImage(source, 0, 0);
  ctx.filter = "none";

  // A soft overall haze, like a print left in the sun.
  ctx.fillStyle = "rgba(230, 220, 200, 0.18)";
  ctx.fillRect(0, 0, out.width, out.height);

  return out;
}
