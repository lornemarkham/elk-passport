"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Avatar } from "@/experience-lab/ui/atoms";
import {
  PHOTO_EDGE_PX,
  photoPrompts,
  type MemoriesView,
  type Memory,
} from "@/domain/hockey/memories";
import { matchupOf } from "@/domain/hockey/teams";
import type { SharedNight } from "./useSharedNight";
import styles from "./hockey.module.css";

const REFRESH_MS = 15_000;

/**
 * **Memories: the night's photographs, in one place, kept by the group.**
 *
 * Anyone on the night can add a picture (a caption is optional; the night's
 * own photo challenges are offered as ideas). The phone shrinks it to a
 * 1280px JPEG before it leaves, so a stadium's patchy signal can carry it.
 * Everyone on the night sees everything, refreshed while the page is
 * looked at; the person who took a photo, or the host, can take it down.
 * Before the photos migration is applied the whole section is absent: the
 * rest of the night is unaffected.
 */
export function Memories({ night }: { night: SharedNight }) {
  const slug = night.state.slug;
  const [view, setView] = useState<MemoriesView | null>(null);
  const [draft, setDraft] = useState<{ data: string; preview: string } | null>(
    null,
  );
  const [caption, setCaption] = useState("");
  const [open, setOpen] = useState<Memory | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const { away } = matchupOf(night.definition.subtitle);

  // Bumped to ask again (after my own add or removal, and on a timer).
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let stopped = false;
    (async () => {
      try {
        const res = await fetch(`/hockey/api/occasions/${slug}/photos`, {
          cache: "no-store",
        });
        if (res.ok && !stopped) setView((await res.json()) as MemoriesView);
      } catch {
        // Offline for a moment; the next refresh will try again.
      }
    })();
    return () => {
      stopped = true;
    };
  }, [slug, version]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  if (!view?.available || !night.live.me) return null;

  async function choose(file: File | undefined) {
    if (!file) return;
    setProblem(null);
    try {
      const data = await shrink(file);
      setDraft({ data, preview: `data:image/jpeg;base64,${data}` });
      setCaption("");
    } catch {
      setProblem("That file wouldn't open as a photo.");
    }
    if (input.current) input.current.value = "";
  }

  async function share() {
    if (!draft) return;
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch(`/hockey/api/occasions/${slug}/photos`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: draft.data, caption }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setProblem(body.error ?? "That didn't go through. Try again.");
      } else {
        setDraft(null);
        refresh();
      }
    } catch {
      setProblem("No signal? Your photo is still here — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(photo: Memory) {
    const res = await fetch(
      `/hockey/api/occasions/${slug}/photos/${photo.id}`,
      {
        method: "DELETE",
      },
    );
    if (res.ok) {
      setOpen(null);
      refresh();
    } else setProblem("That isn't yours to take down.");
  }

  const photos = view.photos;
  return (
    <section aria-labelledby="memories-title" id="memories">
      <h2
        id="memories-title"
        className={`${styles.wide} text-[28px] leading-none text-white`}
      >
        Memories
      </h2>
      <p className="mt-2 text-[15px] text-white/70">
        {photos.length === 0
          ? "Nothing yet. The first one sets the tone."
          : `${photos.length} ${photos.length === 1 ? "photo" : "photos"} from the night. Everyone here can see them; nobody else can.`}
      </p>

      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label="Choose a photo"
        onChange={(e) => void choose(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-white/25 px-5 text-[16px] font-bold text-white transition hover:border-white/50"
      >
        <Camera className="h-5 w-5 text-[#ffd84d]" />
        Add a photo
      </button>

      {problem && !draft && (
        <p role="alert" className="mt-2 text-[14px] text-[#ffb4b4]">
          {problem}
        </p>
      )}

      {draft && (
        <div className="mt-4 rounded-[22px] bg-white/[0.07] p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={draft.preview}
            alt="Your photo, before it is shared"
            className="max-h-72 w-full rounded-xl object-contain"
          />
          <label
            className="mt-3 block text-[13px] text-white/70"
            htmlFor="photo-caption"
          >
            Caption (optional)
          </label>
          <input
            id="photo-caption"
            value={caption}
            maxLength={140}
            onChange={(e) => setCaption(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2.5 text-[15px] text-white"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {photoPrompts(away).map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => setCaption(idea)}
                className="min-h-8 rounded-full border border-white/20 px-3 text-[12.5px] text-white/80 hover:border-white/60"
              >
                {idea}
              </button>
            ))}
          </div>
          {problem && (
            <p role="alert" className="mt-2 text-[14px] text-[#ffb4b4]">
              {problem}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void share()}
              className="min-h-11 flex-1 rounded-full bg-[#ffd84d] px-4 text-[15px] font-semibold text-[#0b1220] disabled:opacity-60"
            >
              {busy ? "Sharing…" : "Share with the group"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setDraft(null);
                setProblem(null);
              }}
              className="min-h-11 rounded-full border border-white/25 px-4 text-[15px] text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {photos.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-2.5">
          {photos.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setOpen(p)}
                className="relative block aspect-square w-full overflow-hidden rounded-2xl bg-white/[0.06]"
                aria-label={`Photo by ${p.byName}${p.caption ? `: ${p.caption}` : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/hockey/api/occasions/${slug}/photos/${p.id}`}
                  alt={p.caption || `Photo by ${p.byName}`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2.5 pt-6 pb-2 text-left text-[12.5px] leading-tight text-white">
                  {p.byEmoji} {p.byName}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo"
          className="fixed inset-0 z-50 flex flex-col bg-black/92 p-4"
        >
          <button
            type="button"
            onClick={() => setOpen(null)}
            aria-label="Close photo"
            className="ml-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/hockey/api/occasions/${slug}/photos/${open.id}`}
              alt={open.caption || `Photo by ${open.byName}`}
              className="max-h-full max-w-full rounded-xl object-contain"
            />
          </div>
          <div className="mx-auto mt-3 flex w-full max-w-2xl items-center gap-3 text-white">
            {night.live.participants.find((x) => x.id === open.by) && (
              <Avatar
                person={night.live.participants.find((x) => x.id === open.by)!}
                size={32}
              />
            )}
            <p className="min-w-0 flex-1 text-[14.5px] leading-snug">
              <strong>{open.byName}</strong>
              {open.caption ? ` — ${open.caption}` : ""}
            </p>
            {open.canRemove && (
              <button
                type="button"
                onClick={() => void remove(open)}
                className="min-h-11 rounded-full border border-white/30 px-4 text-[14px]"
              >
                Take it down
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** A picked file → base64 of a JPEG no longer than 1280px on its long edge. */
async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const scale = Math.min(
    1,
    PHOTO_EDGE_PX / Math.max(bitmap.width, bitmap.height),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.82, 0.7, 0.55]) {
    const url = canvas.toDataURL("image/jpeg", quality);
    const data = url.slice(url.indexOf(",") + 1);
    if (data.length <= 700_000) return data;
  }
  throw new Error("too big");
}
