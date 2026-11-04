"use client";

import { useState } from "react";
import { ExternalLink, Music2, Play, Send, X } from "lucide-react";
import {
  KIND_WORD,
  parseSpotify,
  whyNot,
  type SpotifyLink,
} from "@/domain/soundtrack/spotify";
import { songsFor, type MoodPick } from "@/domain/soundtrack/moods";
import { cn } from "@/lib/utils";

/** What's playing: a saved link, and who may change it. */
export interface SoundtrackNow {
  readonly url: string;
  readonly title?: string;
  readonly link: SpotifyLink;
  /** "You", "Jess": who put it on. */
  readonly by?: string;
  readonly canChange: boolean;
}

export interface SoundtrackProps {
  heading?: string;
  /** Who it's shared with, for "Send to …". */
  partner?: string;
  current: SoundtrackNow | null;
  /** Saves a Spotify link; resolves false when it didn't save. */
  onSave: (url: string, title?: string) => Promise<boolean>;
  onClear?: () => Promise<void>;
  /** Hands the words and the link to the person's own messages. */
  onShare?: (words: string, url: string) => Promise<void>;
  /** From `recommend()`: the moods this experience suits. */
  moods: readonly MoodPick[];
  /** Minutes in the car, for "about 11 songs". */
  driveMinutes?: number | null;
  busy?: boolean;
  className?: string;
}

const accent = "bg-[var(--st-accent,#1f3b2d)] text-[var(--st-on-accent,#fff)]";

/**
 * **Passport Soundtrack.** Paste a Spotify link, keep it on the adventure,
 * open it in Spotify, send it to the other person, and (if you like) play a
 * preview here. No Spotify sign-in: Passport only stores the link. Below it,
 * real Spotify playlists for the moods the experience suits.
 *
 * Experience-neutral: the caller decides where it's stored (`onSave`), what
 * the moods are, and the colours (`--st-accent`, `--st-on-accent`).
 */
export function Soundtrack({
  heading = "Soundtrack",
  partner,
  current,
  onSave,
  onClear,
  onShare,
  moods,
  driveMinutes,
  busy = false,
  className,
}: SoundtrackProps) {
  const [editing, setEditing] = useState(false);
  const [paste, setPaste] = useState("");
  const [title, setTitle] = useState("");
  const [tried, setTried] = useState(false);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allMoods, setAllMoods] = useState(false);

  const songs = songsFor(driveMinutes);
  const problem = whyNot(paste);
  const showForm = editing || !current;
  const disabled = busy || saving;

  async function save(url: string, name?: string) {
    setSaving(true);
    try {
      if (await onSave(url, name?.trim() || undefined)) {
        setEditing(false);
        setPaste("");
        setTitle("");
        setTried(false);
        setPreview(false);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      aria-labelledby="soundtrack-heading"
      data-testid="soundtrack"
      className={cn(
        "rounded-[24px] bg-white p-4 ring-1 ring-black/5 sm:p-5",
        className,
      )}
    >
      <p className="flex items-center gap-2 text-xs font-extrabold tracking-[0.22em] text-[var(--st-accent,#1f3b2d)] uppercase">
        <Music2 className="h-3.5 w-3.5" aria-hidden /> Music
      </p>
      <h2
        id="soundtrack-heading"
        className="mt-1 text-[24px] leading-tight font-extrabold tracking-tight"
      >
        {heading}
      </h2>
      {songs !== null && (
        <p
          className="mt-1 text-[13.5px] text-black/60"
          data-testid="soundtrack-drive"
        >
          About {Math.round(driveMinutes!)} minutes in the car: roughly {songs}{" "}
          songs.
        </p>
      )}

      {current && !editing && (
        <div
          className="mt-3 rounded-2xl bg-black/[0.035] p-4"
          data-testid="soundtrack-now"
        >
          <p className="text-[11px] font-bold tracking-[0.12em] text-black/50 uppercase">
            {KIND_WORD[current.link.kind]}
            {current.by ? ` · from ${current.by}` : ""}
          </p>
          <p
            className="mt-0.5 text-[17px] font-extrabold"
            data-testid="soundtrack-title"
          >
            {current.title ?? "Our soundtrack"}
          </p>
          <p className="truncate text-[12.5px] text-black/50">{current.url}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={current.link.url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="soundtrack-open"
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[14px] font-bold",
                accent,
              )}
            >
              <ExternalLink className="h-4 w-4" aria-hidden /> Open in Spotify
            </a>
            {onShare && partner && (
              <button
                type="button"
                data-testid="soundtrack-share"
                onClick={() =>
                  void onShare(
                    `Our soundtrack for tonight 🎶 ${current.title ?? ""}`.trim(),
                    current.link.url,
                  )
                }
                className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[14px] font-bold ring-1 ring-black/15"
              >
                <Send className="h-4 w-4" aria-hidden /> Send to {partner}
              </button>
            )}
            {current.link.embed && (
              <button
                type="button"
                aria-expanded={preview}
                aria-controls="soundtrack-player"
                data-testid="soundtrack-preview"
                onClick={() => setPreview(!preview)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[14px] font-bold ring-1 ring-black/15"
              >
                <Play className="h-4 w-4" aria-hidden />
                {preview ? "Hide the player" : "Preview here"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditing(true)}
              data-testid="soundtrack-change"
              className="min-h-11 rounded-full px-4 text-[14px] font-bold text-black/60 hover:bg-black/5"
            >
              Change
            </button>
            {onClear && current.canChange && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => void onClear()}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[14px] font-bold text-black/50 hover:bg-black/5 disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden /> Remove
              </button>
            )}
          </div>
          {preview && current.link.embed && (
            <iframe
              id="soundtrack-player"
              title={`Spotify: ${current.title ?? "our soundtrack"}`}
              src={`${current.link.embed}?utm_source=generator`}
              width="100%"
              height={current.link.kind === "track" ? 80 : 152}
              loading="lazy"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              className="mt-3 rounded-xl border-0"
              data-testid="soundtrack-player"
            />
          )}
          {preview && (
            <p className="mt-1 text-[12px] text-black/45">
              Spotify&apos;s own player. Signed out, it plays short previews;
              Open in Spotify for the whole thing.
            </p>
          )}
        </div>
      )}

      {showForm && (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            setTried(true);
            if (!problem && !disabled) void save(paste, title);
          }}
          noValidate
        >
          <label className="block text-[13px] font-semibold text-black/65">
            Paste a Spotify playlist link
            <input
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              inputMode="url"
              autoComplete="off"
              placeholder="https://open.spotify.com/playlist/…"
              aria-invalid={tried && problem !== null}
              aria-describedby="soundtrack-why"
              data-testid="soundtrack-input"
              className="mt-1 block min-h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-base"
            />
          </label>
          {parseSpotify(paste) && (
            <label className="block text-[13px] font-semibold text-black/65">
              Call it something (optional)
              <input
                value={title}
                maxLength={80}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Backroads and bad singing"
                data-testid="soundtrack-name"
                className="mt-1 block min-h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-base"
              />
            </label>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={disabled || problem !== null}
              data-testid="soundtrack-save"
              className={cn(
                "min-h-12 rounded-full px-6 font-extrabold disabled:cursor-not-allowed disabled:opacity-50",
                accent,
              )}
            >
              {saving ? "Saving…" : "Save to our adventure"}
            </button>
            {current && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="min-h-12 rounded-full px-4 font-bold text-black/60"
              >
                Keep the one we have
              </button>
            )}
          </div>
          <p
            id="soundtrack-why"
            className="text-[12.5px] text-black/55"
            data-testid="soundtrack-why"
          >
            {paste.trim() && problem
              ? problem
              : "No Spotify sign-in needed. Passport keeps the link; Spotify plays it."}
          </p>
        </form>
      )}

      {moods.length > 0 && (
        <details
          className="group mt-4"
          data-testid="soundtrack-moods"
          open={current ? undefined : true}
        >
          <summary className="min-h-10 cursor-pointer list-none py-2 text-[13px] font-extrabold [&::-webkit-details-marker]:hidden">
            {current
              ? "Other playlists for tonight ▾"
              : "No playlist yet? Start with one of these"}
          </summary>
          <ul className="mt-1 space-y-2">
            {(allMoods ? moods : moods.slice(0, 3)).map((m) => (
              <li
                key={m.mood}
                className="rounded-2xl bg-black/[0.035] p-3"
                data-testid="soundtrack-mood"
                data-mood={m.mood}
              >
                <p className="text-[14.5px] font-extrabold">{m.title}</p>
                <p className="text-[12.5px] text-black/55">{m.line}</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {m.playlists.map((pl) => (
                    <li key={pl.id} className="flex items-center gap-1">
                      <a
                        href={pl.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white px-3 text-[13px] font-bold ring-1 ring-black/10"
                      >
                        {pl.title}
                        <ExternalLink
                          className="h-3.5 w-3.5 opacity-50"
                          aria-hidden
                        />
                        <span className="sr-only">(opens Spotify)</span>
                      </a>
                      {current?.url !== pl.url && (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => void save(pl.url, pl.title)}
                          aria-label={`Use ${pl.title} for ${heading.toLowerCase()}`}
                          data-testid="soundtrack-use"
                          className="min-h-10 rounded-full px-2.5 text-[12.5px] font-bold text-[var(--st-accent,#1f3b2d)] hover:bg-black/5 disabled:opacity-50"
                        >
                          Use
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          {moods.length > 3 && !allMoods && (
            <button
              type="button"
              onClick={() => setAllMoods(true)}
              className="mt-2 min-h-10 rounded-full px-3 text-[13px] font-bold ring-1 ring-black/10"
            >
              More moods · {moods.length - 3}
            </button>
          )}
          <p className="mt-2 text-[11.5px] text-black/45">
            Spotify&apos;s own public playlists, checked 2 November 2026.
          </p>
        </details>
      )}
    </section>
  );
}
