"use client";

import { useRef, useState } from "react";
import { Camera, Heart, PencilLine } from "lucide-react";
import type { Memory } from "@/lib/adventures/companion";
import { NOTE_LIMIT } from "@/lib/adventures/companion";
import { cn } from "@/lib/utils";
import { pillClass } from "../kit";
import { shrinkForDevice } from "./shrinkForDevice";

/**
 * **Three ways to keep the moment, none of which needs a screen for long**:
 * a photo, a few words, a favourite. Kept on this phone (ADR 014: personal
 * memories stay private); the recap offers sharing, one memory at a time.
 */
export function Capture({
  itemId,
  isFavourite,
  remember,
  saved,
}: {
  readonly itemId: string | null;
  readonly isFavourite: boolean;
  readonly remember: (m: Omit<Memory, "id" | "at">) => void;
  readonly saved: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setProblem(null);
    try {
      const photo = await shrinkForDevice(file);
      remember({ kind: "photo", itemId, text: null, photo });
    } catch {
      setProblem("That photo wouldn't open. Try another.");
    }
  }

  return (
    <div data-testid="capture" className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="capture-photo"
          onClick={() => input.current?.click()}
          className={pillClass("quiet")}
        >
          <Camera className="h-4 w-4" aria-hidden />
          Photo
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          data-testid="capture-photo-input"
          onChange={(e) => {
            void onPhoto(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          data-testid="capture-note"
          aria-expanded={writing}
          onClick={() => setWriting((w) => !w)}
          className={pillClass("quiet")}
        >
          <PencilLine className="h-4 w-4" aria-hidden />
          Note
        </button>
        <button
          type="button"
          data-testid="capture-favourite"
          aria-pressed={isFavourite}
          onClick={() =>
            remember({ kind: "favourite", itemId, text: null, photo: null })
          }
          className={pillClass(
            "quiet",
            isFavourite
              ? "border-[var(--gh-berry)] text-[var(--gh-berry)]"
              : undefined,
          )}
        >
          <Heart
            className={cn("h-4 w-4", isFavourite && "fill-current")}
            aria-hidden
          />
          {isFavourite ? "Favourite" : "Favourite this"}
        </button>
      </div>
      {writing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            remember({
              kind: "note",
              itemId,
              text: text.trim(),
              photo: null,
            });
            setText("");
            setWriting(false);
          }}
          className="space-y-2"
        >
          <label className="sr-only" htmlFor={`note-${itemId ?? "day"}`}>
            What just happened?
          </label>
          <textarea
            id={`note-${itemId ?? "day"}`}
            data-testid="capture-note-text"
            value={text}
            maxLength={NOTE_LIMIT}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="What just happened? (one line is plenty)"
            className="w-full rounded-2xl border-2 border-[var(--gh-ink)]/15 bg-white p-3 text-base"
          />
          <button
            type="submit"
            data-testid="capture-note-save"
            className={pillClass("forest")}
          >
            Keep it
          </button>
        </form>
      )}
      {problem && (
        <p role="status" className="text-sm font-semibold">
          {problem}
        </p>
      )}
      {!saved && (
        <p
          role="status"
          data-testid="capture-full"
          className="text-sm font-semibold"
        >
          This phone has no room to keep that. Delete a photo from the recap and
          try again.
        </p>
      )}
    </div>
  );
}
