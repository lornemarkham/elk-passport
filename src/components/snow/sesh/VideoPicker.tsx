"use client";

import { useRef, useState } from "react";
import { cx, styles } from "./ctx";

export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

type Source = "record" | "upload";

/**
 * Step 3 of posting: RECORD (phone camera, where the browser supports
 * `capture`) or UPLOAD (library/files), then a preview with Replace/Remove.
 * Validation stays with the caller's `onPick`; this only chooses and shows.
 */
export function VideoPicker({
  file,
  preview,
  mode,
  onPick,
  onRemove,
}: {
  file: File | null;
  preview: string | null;
  mode: "demo" | "real";
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  const recordRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const last = useRef<Source>("upload");
  const [captureNote, setCaptureNote] = useState(false);

  function open(source: Source) {
    last.current = source;
    if (source === "record") {
      // Browsers without `capture` just show the file chooser; say so.
      const probe = document.createElement("input");
      setCaptureNote(!("capture" in probe));
    }
    (source === "record" ? recordRef : uploadRef).current?.click();
  }

  function chosen(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.files?.[0];
    e.target.value = ""; // picking the same clip again must still fire
    if (next) onPick(next);
  }

  const big = cx(
    styles.btn,
    "flex min-h-16 flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-base font-bold uppercase",
  );

  return (
    <div>
      <p className="text-sm" data-testid="video-destination" data-mode={mode}>
        {mode === "demo"
          ? "🔒 Demo: your clip stays on this phone. It is not uploaded and nobody else sees it. Skip it and we'll draw one."
          : "☁️ Real post: your clip is uploaded and shared with everyone on Sesh Wars. Under 50 MB."}
      </p>

      {!file && (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <button type="button" className={big} onClick={() => open("record")}>
            <span aria-hidden>🎥</span> Record video
          </button>
          <button type="button" className={big} onClick={() => open("upload")}>
            <span aria-hidden>📁</span> Upload video
          </button>
        </div>
      )}
      {!file && captureNote && (
        <p className="mt-2 text-xs" role="status">
          This browser can&apos;t open the camera from here. Pick a clip you
          already filmed instead.
        </p>
      )}

      <input
        ref={recordRef}
        type="file"
        accept="video/*"
        capture="environment"
        hidden
        data-testid="video-record-input"
        onChange={chosen}
      />
      <input
        ref={uploadRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/*"
        hidden
        data-testid="video-upload-input"
        onChange={chosen}
      />

      {file && preview && (
        <div className="mt-3" data-testid="video-preview">
          <video
            src={preview}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full rounded-lg bg-black"
          />
          <p className="mt-2 text-sm break-all">
            <b data-testid="video-name">{file.name}</b> ·{" "}
            <span data-testid="video-size">{formatSize(file.size)}</span>
          </p>
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              className={cx(styles.btn, "min-h-12 flex-1 rounded-xl px-4")}
              onClick={() => open(last.current)}
            >
              Replace
            </button>
            <button
              type="button"
              className={cx(styles.btn, "min-h-12 flex-1 rounded-xl px-4")}
              onClick={onRemove}
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
