"use client";

import { useState } from "react";
import { Camera, Download, RotateCcw, Zap } from "lucide-react";
import { useCamera } from "./useCamera";
import {
  GROUP_SCARE_CAM_CONCEPT,
  SCARE_CAM_CAPTIONS,
  SCARE_CAM_SHARE_LABEL,
} from "./content";

type Phase = "idle" | "countdown" | "flash" | "result";

/**
 * "Scare Cam," rebuilt for the tension pass. Old version: fire after a
 * random delay, no build-up. New version: a real 3-2-1 countdown (driven
 * entirely by a `setTimeout` chain inside the click handler, not a
 * `useEffect` — sidesteps the `set-state-in-effect` pattern this project
 * has hit and documented three times already, rather than reaching for a
 * fourth disable comment), then a captured frame with a real, honest
 * procedural effect applied: a faint, blurred, ambiguous shape drawn into
 * the background of the photo with `ctx` — not an AI-generated ghost
 * (none was available this session), a real canvas composite, subtle
 * enough that the question is genuine: was that actually there?
 *
 * Same privacy discipline as before: opt-in only, stops the instant a
 * photo exists, nothing ever leaves the browser. The "share" button is
 * simulated — it doesn't post anywhere, it just shows the caption
 * treatment a real share card would use, disclosed as such.
 */
export function ScareCam() {
  const { videoRef, status, start, stop, captureFrame } = useCamera();
  const [phase, setPhase] = useState<Phase>("idle");
  const [count, setCount] = useState(3);
  const [result, setResult] = useState<string | null>(null);
  const [caption, setCaption] = useState<string>(SCARE_CAM_CAPTIONS[0]!);
  const [shared, setShared] = useState(false);

  function runCapture() {
    setPhase("flash");
    const raw = captureFrame();
    if (raw) {
      setResult(applyGhostOverlay(raw).toDataURL("image/png"));
    }
    setCaption(
      SCARE_CAM_CAPTIONS[
        Math.floor(Math.random() * SCARE_CAM_CAPTIONS.length)
      ]!,
    );
    window.setTimeout(() => {
      setPhase("result");
      stop();
    }, 220);
  }

  function beginCountdown() {
    setPhase("countdown");
    let remaining = 3;
    setCount(remaining);
    const tick = () => {
      remaining -= 1;
      if (remaining <= 0) {
        runCapture();
      } else {
        setCount(remaining);
        window.setTimeout(tick, 800);
      }
    };
    window.setTimeout(tick, 800);
  }

  function reset() {
    setResult(null);
    setShared(false);
    setPhase("idle");
  }

  return (
    <div className="relative flex flex-col items-center gap-5 rounded-2xl border border-current/15 p-8 text-center">
      {phase === "flash" && (
        <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl bg-white" />
      )}

      <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.15em] uppercase opacity-50">
        <Zap className="h-3.5 w-3.5" /> Scare Cam
      </p>
      <p className="max-w-xs text-sm opacity-60">
        Entirely playful. Entirely optional. A real 3-2-1 countdown, then a
        photo you&apos;ll want to zoom in on.
      </p>

      {result ? (
        <div className="flex flex-col items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL from an in-browser canvas capture */}
          <img
            src={result}
            alt="Your capture"
            className="w-48 rounded-lg border border-current/20 shadow-xl"
          />
          <p className="font-heading text-lg">{caption}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href={result}
              download="scare-cam.png"
              className="flex items-center gap-1.5 rounded-full bg-[#ff5a1f] px-4 py-2 text-sm font-bold text-[#171208]"
            >
              <Download className="h-3.5 w-3.5" /> Save
            </a>
            <button
              type="button"
              onClick={() => setShared(true)}
              className="flex items-center gap-1.5 rounded-full border border-current/20 px-4 py-2 text-sm font-medium opacity-70 hover:opacity-100"
            >
              {shared ? "Shared (simulated)" : SCARE_CAM_SHARE_LABEL}
            </button>
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1.5 rounded-full border border-current/20 px-4 py-2 text-sm font-medium opacity-70 hover:opacity-100"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Again
            </button>
          </div>
          <p className="max-w-xs text-xs italic opacity-30">
            The sharing button doesn&apos;t post anywhere — simulated for this
            prototype, on purpose.
          </p>
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
                <Camera className="h-8 w-8" />
              </div>
            )}
            {phase === "countdown" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <span className="font-heading text-6xl text-white">
                  {count}
                </span>
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
          {status === "live" && phase === "idle" && (
            <button
              type="button"
              onClick={beginCountdown}
              className="rounded-full bg-[#ff5a1f] px-5 py-2.5 text-sm font-bold text-[#171208]"
            >
              Start Countdown
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

          <p className="max-w-xs text-xs italic opacity-30">
            Future idea, not built here: {GROUP_SCARE_CAM_CONCEPT}
          </p>
        </>
      )}
    </div>
  );
}

/**
 * A real canvas composite, not an AI-generated image — no such tool was
 * available this session. A single faint, blurred, ambiguous dark shape,
 * placed randomly in the lower/background portion of the frame at low
 * opacity, so it reads as "maybe" rather than obviously photoshopped.
 * Never centered on a face, never sharp, never grotesque.
 */
function applyGhostOverlay(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext("2d");
  if (!ctx) return source;

  ctx.drawImage(source, 0, 0);

  const x = out.width * (0.15 + Math.random() * 0.6);
  const y = out.height * (0.55 + Math.random() * 0.3);
  const radius = out.width * 0.14;

  ctx.save();
  ctx.filter = "blur(7px)";
  ctx.globalAlpha = 0.16 + Math.random() * 0.08;
  const gradient = ctx.createRadialGradient(x, y, 2, x, y, radius);
  gradient.addColorStop(0, "rgba(15,12,8,0.9)");
  gradient.addColorStop(1, "rgba(15,12,8,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(x, y, radius * 0.6, radius, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.globalAlpha = 0.04;
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "#000" : "#fff";
    ctx.fillRect(Math.random() * out.width, Math.random() * out.height, 1, 1);
  }
  ctx.globalAlpha = 1;

  return out;
}
