"use client";

import { useState } from "react";
import { Camera, Download, RotateCcw } from "lucide-react";
import { useCamera, applyGhostPortraitFilter } from "./useCamera";
import { GHOST_PORTRAIT_MODES, type GhostPortraitMode } from "./content";

/**
 * "Ghost Portrait" — real camera capture, three real canvas-based
 * processing modes (`applyGhostPortraitFilter`), nothing fake about the
 * mechanism. Entirely opt-in: the camera is never requested until the
 * visitor clicks "Turn On Camera," and the stream stops the instant a
 * portrait is captured. Nothing captured here ever leaves the browser;
 * "Save" downloads a PNG straight from the canvas, no upload code exists
 * in this file.
 */
export function GhostPortrait() {
  const { videoRef, status, start, stop, captureFrame } = useCamera();
  const [mode, setMode] = useState<GhostPortraitMode["id"]>("victorian");
  const [portrait, setPortrait] = useState<string | null>(null);

  function capture() {
    const raw = captureFrame();
    if (!raw) return;
    const processed = applyGhostPortraitFilter(raw, mode);
    setPortrait(processed.toDataURL("image/png"));
    stop();
  }

  function reset() {
    setPortrait(null);
  }

  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-current/15 p-8 text-center">
      <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.15em] uppercase opacity-50">
        <Camera className="h-3.5 w-3.5" /> Ghost Portrait
      </p>
      <p className="max-w-xs text-sm opacity-60">
        Nothing leaves your browser — a real camera capture, processed entirely
        on your device.
      </p>

      {!portrait && (
        <div className="flex flex-wrap justify-center gap-2">
          {GHOST_PORTRAIT_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              title={m.description}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === m.id
                  ? "border-[#ff5a1f] bg-[#ff5a1f]/15"
                  : "border-current/20 opacity-60 hover:opacity-100"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {portrait ? (
        <div className="flex flex-col items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL from an in-browser canvas capture, not a next/image-eligible remote source */}
          <img
            src={portrait}
            alt="Your ghost portrait"
            className="w-48 rounded-lg border border-current/20 shadow-xl"
          />
          <div className="flex gap-3">
            <a
              href={portrait}
              download="ghost-portrait.png"
              className="flex items-center gap-1.5 rounded-full bg-[#ff5a1f] px-4 py-2 text-sm font-bold text-[#171208]"
            >
              <Download className="h-3.5 w-3.5" /> Save
            </a>
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1.5 rounded-full border border-current/20 px-4 py-2 text-sm font-medium opacity-70 hover:opacity-100"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Again
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative aspect-[3/4] w-48 overflow-hidden rounded-lg border border-current/20 bg-black/30">
            <video
              ref={videoRef}
              muted
              playsInline
              className="h-full w-full scale-x-[-1] object-cover"
            />
            {status !== "live" && (
              <div className="absolute inset-0 flex items-center justify-center text-3xl opacity-40">
                👻
              </div>
            )}
          </div>

          {status === "idle" && (
            <button
              type="button"
              onClick={start}
              className="rounded-full bg-[#ff5a1f] px-5 py-2.5 text-sm font-bold text-[#171208]"
            >
              Turn On Camera
            </button>
          )}
          {status === "requesting" && (
            <p className="text-sm opacity-50">Waiting on your permission...</p>
          )}
          {status === "live" && (
            <button
              type="button"
              onClick={capture}
              className="rounded-full bg-[#ff5a1f] px-5 py-2.5 text-sm font-bold text-[#171208]"
            >
              Capture
            </button>
          )}
          {status === "denied" && (
            <p className="max-w-xs text-sm opacity-50">
              No camera access — entirely your call. Nothing else on this page
              needs it.
            </p>
          )}
          {status === "unavailable" && (
            <p className="max-w-xs text-sm opacity-50">
              No camera found on this device.
            </p>
          )}
        </>
      )}
    </div>
  );
}
