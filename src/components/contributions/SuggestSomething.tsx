"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, Crosshair, PartyPopper, Plus, X } from "lucide-react";
import {
  CATEGORIES,
  experienceLabel,
  type CategoryId,
} from "@/domain/contributions/model";
import { MILESTONES, type Progress } from "@/domain/contributions/milestones";
import { townById } from "@/domain/discovery/towns";
import { shortName } from "@/domain/location/prefs";
import { useLocation } from "@/lib/location/useLocation";
import { shrinkPhoto } from "@/lib/media/shrinkPhoto";
import { deviceToken } from "./device";

/**
 * **+ Suggest something** — the one way, on every Passport experience, to say
 * "you're missing this" (owner brief "UNIVERSAL COMMUNITY CONTRIBUTIONS",
 * 2026-11-23). A button that opens a bottom sheet; a name, a kind and a
 * place are all it needs; a description, a date, a website and a photo are
 * there for whoever has them. No account. Under a minute on a phone.
 *
 * The experience it was opened from is captured by the mount, not asked.
 * After sending it says thanks, says plainly that the suggestion is pending,
 * shows the person's progress toward the shared milestones, and offers
 * **Suggest another** with the kind and place kept.
 */

export interface SuggestProps {
  /** The experience this button sits in: `christmas`, `hockey`, `snow`, `datenight`, `gohaveaday`… */
  readonly experience: string;
  /** The button's words; Christmas says "+ Suggest a Stop". */
  readonly label?: string;
  readonly defaultCategory?: CategoryId;
  /** A town the page already knows; otherwise the shared remembered place (ADR 020) is read. */
  readonly town?: string;
  /** A fuller form for people with a poster or a lot of detail (the Local Insider Network's). */
  readonly moreHref?: string;
  readonly className?: string;
  /** Icon only on narrow screens, words always on wide ones. */
  readonly compact?: boolean;
  /** The button's `data-testid`; Discovery keeps the one its tests know. */
  readonly testId?: string;
}

interface Done {
  readonly name: string;
  readonly thanks: string;
  readonly progress: Progress;
  readonly repeat: boolean;
  readonly lookalike: boolean;
  readonly recognisedBy: "account" | "device" | "address";
}

const input =
  "w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-base text-[#111] placeholder:text-black/40 focus:border-black/40 focus:outline-none";

export function SuggestSomething({
  experience,
  label = "+ Suggest something",
  className = "",
  compact = false,
  testId = "suggest-open",
  ...rest
}: SuggestProps) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const words = label.replace(/^\+\s*/, "");
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid={testId}
        data-experience={experience}
        aria-label={label}
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-bold whitespace-nowrap ring-1 ring-current/30 active:scale-[0.98] ${className}`}
      >
        <Plus className="h-4 w-4 shrink-0" aria-hidden />
        <span className={compact ? "hidden sm:inline" : ""}>{words}</span>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 sm:items-center"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={words}
            data-testid="suggest-sheet"
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] bg-[#fbf8f2] p-5 text-[#111] shadow-2xl sm:max-w-lg sm:rounded-[28px]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold tracking-[0.16em] text-black/55 uppercase">
                  {experienceLabel(experience)} · Community
                </p>
                <h2 className="ghad-display mt-0.5 text-2xl leading-tight font-extrabold tracking-[-0.02em]">
                  {words}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                data-testid="suggest-close"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full ring-1 ring-black/15"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <SuggestForm
              experience={experience}
              onClose={() => setOpen(false)}
              {...rest}
            />
          </div>
        </div>
      )}
    </>
  );
}

/** The form itself: in the sheet, and on `/contribute` as a page. */
export function SuggestForm({
  experience,
  defaultCategory,
  town,
  moreHref,
  onClose,
}: Pick<
  SuggestProps,
  "experience" | "defaultCategory" | "town" | "moreHref"
> & {
  readonly onClose?: () => void;
}) {
  const shared = useLocation(experience);
  const knownTown =
    town ??
    (() => {
      const t = townById(shared.townId);
      return t ? shortName(t) : undefined;
    })();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<CategoryId | "">(
    defaultCategory ?? "",
  );
  const [where, setWhere] = useState("");
  const [at, setAt] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [more, setMore] = useState(false);
  const [description, setDescription] = useState("");
  const [when, setWhen] = useState("");
  const [website, setWebsite] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoSay, setPhotoSay] = useState<string | null>(null);
  const [trap, setTrap] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const opened = useRef(0);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    opened.current = Date.now();
    nameRef.current?.focus();
  }, []);

  function locate() {
    if (!navigator.geolocation) {
      setError(
        "This browser can't share a location — type where it is instead.",
      );
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        setAt({ lat: p.coords.latitude, lng: p.coords.longitude });
        setError(null);
      },
      () => {
        setLocating(false);
        setError("Couldn't find you — type where it is instead.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoSay("Shrinking it…");
    try {
      setPhoto(await shrinkPhoto(file));
      setPhotoSay("Photo added.");
    } catch {
      setPhoto(null);
      setPhotoSay("That photo didn't work — try another.");
    }
  }

  async function send() {
    setError(null);
    if (name.trim().length < 2) return setError("Give it a name first.");
    if (!category) return setError("Pick what kind of thing it is.");
    if (!where.trim() && !at)
      return setError("Say where it is, or use your location.");
    setBusy(true);
    try {
      const r = await fetch("/api/contributions/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experience,
          category,
          name,
          location: where,
          town: knownTown,
          ...(at ? { lat: at.lat, lng: at.lng } : {}),
          description,
          when,
          website,
          photo: photo ?? undefined,
          company: trap,
          device: deviceToken(),
          openedFor: Date.now() - opened.current,
        }),
      });
      const data = (await r.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!r.ok) {
        const retry = Number(data.retryAfterSeconds);
        setError(
          r.status === 429 && data.error === "rate-limited"
            ? "Whoa — that's a lot at once. Give it a minute and keep going."
            : `${String(data.error ?? "That didn't send — try again.")}${
                Number.isFinite(retry) && retry > 0 && retry <= 120
                  ? ` (about ${retry} s)`
                  : ""
              }`,
        );
        return;
      }
      setDone({
        name: name.trim(),
        thanks: String(data.thanks ?? "Thanks! That's in for review."),
        progress: (data.progress as Progress) ?? {
          approved: 0,
          pending: 1,
          earned: [],
        },
        repeat: data.repeat === true,
        lookalike: data.lookalike === true,
        recognisedBy:
          (data.recognisedBy as Done["recognisedBy"] | undefined) ?? "device",
      });
    } catch {
      setError("No connection — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  function another() {
    // Keep the kind and the place; clear what was about the last thing.
    setName("");
    setDescription("");
    setWhen("");
    setWebsite("");
    setPhoto(null);
    setPhotoSay(null);
    setDone(null);
    setError(null);
    opened.current = Date.now();
    setTimeout(() => nameRef.current?.focus(), 0);
  }

  if (done)
    return (
      <section
        className="mt-5 space-y-4 text-center"
        data-testid="suggest-done"
        role="status"
      >
        <PartyPopper className="mx-auto h-12 w-12 text-[#b3242f]" aria-hidden />
        <h3 className="ghad-display text-2xl font-extrabold">
          {done.repeat ? "Already got it!" : "Thanks — it's in!"}
        </h3>
        <p className="text-base" data-testid="suggest-thanks">
          {done.repeat
            ? `${done.name} is already waiting for review — no need to send it twice.`
            : done.thanks}
        </p>
        <p
          className="inline-flex rounded-full bg-[#f7e3e1] px-4 py-2 text-sm font-bold text-[#b3242f]"
          data-testid="suggest-status"
        >
          Pending review — not public yet
        </p>
        {done.lookalike && !done.repeat && (
          <p className="text-sm text-black/70">
            We may already have something like this — we&apos;ll check and join
            them up if they&apos;re the same.
          </p>
        )}
        <Milestones progress={done.progress} recognisedBy={done.recognisedBy} />
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={another}
            data-testid="suggest-another"
            className="inline-flex min-h-12 items-center rounded-full bg-[#111] px-6 font-extrabold text-white"
          >
            + Suggest another
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-12 items-center rounded-full px-6 font-bold ring-1 ring-black/20"
            >
              Done
            </button>
          )}
        </div>
      </section>
    );

  return (
    <form
      className="mt-4 flex flex-col gap-4"
      data-testid="suggest-form"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <label className="block">
        <span className="text-sm font-bold">What is it?</span>
        <input
          ref={nameRef}
          className={`${input} mt-1`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Long John's Pub, Lumby Christmas Market…"
          maxLength={120}
          data-testid="suggest-name"
          autoComplete="off"
          required
        />
      </label>
      <fieldset>
        <legend className="text-sm font-bold">What kind of thing?</legend>
        <div className="mt-1 flex flex-wrap gap-2" role="radiogroup">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={category === c.id}
              onClick={() => setCategory(c.id)}
              data-testid={`suggest-cat-${c.id}`}
              className={`inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-sm font-semibold ring-1 ${
                category === c.id
                  ? "bg-[#111] text-white ring-[#111]"
                  : "bg-white text-[#111] ring-black/15"
              }`}
            >
              <span aria-hidden>{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="block">
          <span className="text-sm font-bold">
            Where is it?{knownTown ? ` · ${knownTown}` : ""}
          </span>
          <input
            className={`${input} mt-1`}
            value={where}
            onChange={(e) => setWhere(e.target.value)}
            placeholder="Address, venue, or 'across from the arena'"
            maxLength={200}
            data-testid="suggest-location"
            autoComplete="off"
          />
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={locate}
            disabled={locating}
            data-testid="suggest-locate"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ring-1 ring-black/15"
          >
            <Crosshair className="h-4 w-4" aria-hidden />
            {locating
              ? "Finding you…"
              : at
                ? "Location added"
                : "Use my location"}
          </button>
          {at && (
            <span className="text-sm text-black/60" data-testid="suggest-at">
              📍 I&apos;m standing right here
            </span>
          )}
        </div>
      </div>

      {!more ? (
        <button
          type="button"
          onClick={() => setMore(true)}
          data-testid="suggest-more"
          className="self-start text-sm font-bold underline underline-offset-4"
        >
          Add a description, date, website or photo
        </button>
      ) : (
        <div className="flex flex-col gap-3" data-testid="suggest-more-fields">
          <label className="block">
            <span className="text-sm font-bold">Tell us about it</span>
            <textarea
              className={`${input} mt-1 min-h-20`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              placeholder="Why it's worth knowing about"
              data-testid="suggest-description"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold">When (for an event)</span>
            <input
              className={`${input} mt-1`}
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              maxLength={160}
              placeholder="Dec 12, 6–9 pm · Fridays in December"
              data-testid="suggest-when"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold">Website or social link</span>
            <input
              className={`${input} mt-1`}
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              inputMode="url"
              maxLength={300}
              placeholder="example.com/events"
              data-testid="suggest-website"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-bold ring-1 ring-black/15">
              <Camera className="h-4 w-4" aria-hidden />
              {photo ? "Change photo" : "Add a photo"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                data-testid="suggest-photo"
                onChange={(e) => void pickPhoto(e.target.files?.[0])}
              />
            </label>
            {photoSay && (
              <span className="text-sm text-black/60">{photoSay}</span>
            )}
          </div>
        </div>
      )}

      {/* A trap for form-filling robots: a person never sees it. */}
      <div
        aria-hidden="true"
        className="absolute top-0 -left-[9999px] h-0 w-0 overflow-hidden"
      >
        <label>
          Company
          <input
            tabIndex={-1}
            autoComplete="off"
            value={trap}
            onChange={(e) => setTrap(e.target.value)}
            name="company"
          />
        </label>
      </div>

      {error && (
        <p
          className="rounded-2xl bg-[#fff1ef] px-4 py-2 text-sm font-bold text-[#b3242f]"
          role="alert"
          data-testid="suggest-error"
        >
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        data-testid="suggest-send"
        className="inline-flex min-h-13 w-full items-center justify-center rounded-full bg-[#111] px-6 text-base font-extrabold text-white disabled:opacity-60"
      >
        {busy ? "Sending…" : "Send it in"}
      </button>
      <p className="text-xs text-black/55">
        We check every suggestion before anything is published. Your name
        isn&apos;t shown anywhere.
        {moreHref && (
          <>
            {" "}
            Got a poster or a lot of detail?{" "}
            <Link href={moreHref} className="font-bold underline">
              Use the full form
            </Link>
            .
          </>
        )}
      </p>
    </form>
  );
}

/** The five shared milestones, with where this person stands. Counted on approved contributions only. */
export function Milestones({
  progress,
  recognisedBy,
}: {
  readonly progress: Progress;
  readonly recognisedBy: "account" | "device" | "address";
}) {
  const next = progress.next;
  return (
    <div
      className="rounded-2xl bg-white p-4 text-left ring-1 ring-black/10"
      data-testid="milestones"
    >
      <p className="text-sm">
        <strong>{progress.approved}</strong> approved
        {progress.pending > 0 && (
          <>
            {" "}
            · <strong>{progress.pending}</strong> waiting for review
          </>
        )}
        {progress.current && (
          <>
            {" "}
            · {progress.current.emoji} {progress.current.title}
          </>
        )}
      </p>
      <ol className="mt-2 flex flex-wrap gap-1.5" aria-label="Milestones">
        {MILESTONES.map((m) => {
          const earned = progress.approved >= m.at;
          return (
            <li
              key={m.at}
              title={`${m.title} — ${m.at} approved`}
              data-testid={`milestone-${m.at}`}
              data-earned={earned}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${
                earned
                  ? "bg-[#fff3c4] text-[#5a4300] ring-[#e7c15a]"
                  : "bg-black/5 text-black/45 ring-black/10"
              }`}
            >
              <span aria-hidden>{m.emoji}</span> {m.title}
            </li>
          );
        })}
      </ol>
      {next && (
        <p className="mt-2 text-xs text-black/60">
          {next.remaining} more approved to {next.milestone.emoji}{" "}
          {next.milestone.title}.
        </p>
      )}
      <p className="mt-1 text-xs text-black/50">
        {recognisedBy === "account"
          ? "Counted on your account, on any device."
          : "Counted on this phone — sign in to carry it with you."}
      </p>
    </div>
  );
}
