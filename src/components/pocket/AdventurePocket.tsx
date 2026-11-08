"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Backpack,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Experience } from "@/domain/experience/types";
import { destinationFor } from "@/domain/experience/destination";
import { formatEventWhen } from "@/domain/experience/eventTime";
import { sizedImage } from "@/lib/media/sizedImage";
import { DAY_SEEDS, dayFrom, moved, weekendFrom } from "@/lib/pocket/ideas";
import type { Ideas } from "@/lib/pocket/useIdeas";
import { REMOVED, RESTORED, ideasCount, pocketLine } from "@/lib/voice";

/**
 * **The Adventure Pocket** — the owner's brief, 2026-11-08 (P2):
 *
 * > A lightweight Adventure Pocket … No permanent sidebar. The Pocket is a
 * > convenient way to work with saved ideas. My Stuff is their permanent
 * > home. Do not create competing sources of truth.
 *
 * It replaces the board that sat beside Discovery and took 320px from every
 * result. Closed, it is one small button — _"3 ideas saved · Make a day"_ —
 * at the bottom corner of the screen; open, a compact panel on a wide screen
 * and a bottom sheet on a phone. What is in it is `useIdeas`: the same Atlas
 * boards My Stuff lists. The order a person puts things in is the order the
 * day is asked to go in.
 *
 * Choosing: everything is in the day unless it is unticked, so the common
 * case (save a few, make a day) is two presses.
 */
export function AdventurePocket({
  ideas,
  find,
  carry,
}: {
  readonly ideas: Ideas;
  /** What Passport knows about a saved id, from the page already loaded. */
  readonly find: (id: string) => Experience | undefined;
  /** The exploration, carried into a thing's own page and back. */
  readonly carry?: string;
}) {
  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  // **A picture that fails is no picture** — the card's own rule: the
  // letter tile, never a broken-image icon.
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set());
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  const shown = ideas.pocket.flatMap((idea) => {
    const experience = find(idea.experienceId);
    return experience ? [{ idea, experience }] : [];
  });
  const unknown = ideas.pocket.length - shown.length;
  const ids = shown.map((s) => s.experience.id);
  const chosen = ids.filter((id) => !left.has(id));
  const count = ideas.ideas.length;

  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        opener.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!ideas.ready || count === 0) return null;

  async function remove(experience: Experience) {
    if (busy) return;
    setBusy(experience.id);
    try {
      const from = await ideas.remove(experience.id);
      toast(REMOVED, {
        description: experience.title,
        action: {
          label: "Undo",
          onClick: () => {
            void ideas
              .restore(experience.id, from)
              .then(() => toast.success(RESTORED))
              .catch(() =>
                toast.error(
                  `Couldn't put ${experience.title} back. It's still in Discovery to save again.`,
                ),
              );
          },
        },
      });
    } catch {
      toast.error("Couldn't take that out. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const move = (id: string, by: -1 | 1) => ideas.setOrder(moved(ids, id, by));
  const toggle = (id: string) =>
    setLeft((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const small =
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--gh-ink-soft)] transition-colors hover:bg-[var(--gh-cream)] hover:text-[var(--gh-ink)] disabled:opacity-30";

  return (
    <>
      {/* **Closed, it is one small thing.** Two targets: the count opens the
          Pocket, *Make a day* goes straight to the Day Builder with all of
          it — the brief's own line. */}
      {!open && (
        <div
          data-testid="pocket-button"
          className="fixed right-3 bottom-3 z-40 flex items-stretch overflow-hidden rounded-full bg-[var(--gh-ink,#111)] text-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.55)] sm:right-6 sm:bottom-6"
        >
          <button
            ref={opener}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={false}
            onClick={() => setOpen(true)}
            className="inline-flex min-h-12 items-center gap-2 pr-3 pl-4 text-sm font-semibold hover:bg-white/10"
          >
            <Backpack className="h-4 w-4" aria-hidden />
            <span data-testid="pocket-count">{ideasCount(count)}</span>
          </button>
          <span aria-hidden className="my-3 w-px bg-white/25" />
          <Link
            href={dayFrom(ids.length > 0 ? ids : [])}
            data-testid="pocket-quick-day"
            className="inline-flex min-h-12 items-center gap-1 pr-4 pl-3 text-sm font-semibold text-[var(--gh-sun,#ffd166)] hover:bg-white/10"
          >
            Make a day
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      )}

      {open && (
        <>
          {/* A scrim on a phone, where the sheet covers most of the page; on
              a wide screen the panel is small enough to sit over it. */}
          <button
            type="button"
            aria-label="Close the Pocket"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/30 sm:bg-transparent"
          />
          <div
            ref={panel}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            tabIndex={-1}
            data-testid="pocket"
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-3xl bg-white shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.45)] outline-none sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-h-[min(640px,80vh)] sm:w-[420px] sm:rounded-3xl sm:border sm:border-black/10"
          >
            <div className="flex items-start gap-3 px-5 pt-4 pb-3">
              <span
                aria-hidden
                className="mx-auto mb-1 block h-1 w-10 rounded-full bg-black/15 sm:hidden"
              />
            </div>
            <div className="-mt-3 flex items-start gap-3 px-5 pb-3">
              <div className="min-w-0 flex-1">
                <h2
                  id={titleId}
                  className="ghad-display text-xl font-extrabold tracking-[-0.02em] text-[var(--gh-ink,#111)]"
                >
                  Adventure Pocket
                </h2>
                <p className="text-sm text-[var(--gh-ink-soft,#555)]">
                  {ideasCount(count)} · {pocketLine(count)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  opener.current?.focus();
                }}
                aria-label="Close the Pocket"
                className={small}
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <ol
              aria-label="In your Pocket"
              className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3"
            >
              {shown.map(({ experience }, index) => {
                const inDay = !left.has(experience.id);
                const picture =
                  experience.heroMedia?.src ??
                  experience.presentationImage?.url ??
                  experience.contextualMedia?.heroUrl;
                // Only what Atlas stated: the venue and town, else the
                // location's own name. Nothing is guessed from a coordinate.
                const named = experience.location?.name;
                const where =
                  experience.venue?.locality ??
                  (named && named !== experience.title ? named : undefined) ??
                  experience.location?.region;
                const when = experience.startTime
                  ? formatEventWhen(
                      experience.startTime,
                      experience.endTime,
                      experience.timePrecision,
                    )
                  : undefined;
                const href = destinationFor(experience);
                return (
                  <li
                    key={experience.id}
                    data-testid="pocket-item"
                    className={`flex items-center gap-2 rounded-2xl border p-2 ${inDay ? "border-black/10" : "border-dashed border-black/15 opacity-60"}`}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={inDay}
                      aria-label={`Use ${experience.title} in the day`}
                      onClick={() => toggle(experience.id)}
                      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${inDay ? "border-[var(--gh-forest,#1f4d3a)] bg-[var(--gh-forest,#1f4d3a)] text-white" : "border-black/25 bg-white"}`}
                    >
                      {inDay && <Check className="h-4 w-4" aria-hidden />}
                    </button>
                    {picture && !broken.has(picture) ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted, sized by sizedImage like every card
                      <img
                        {...sizedImage(picture)}
                        sizes="64px"
                        alt=""
                        onError={() =>
                          setBroken((prev) => new Set(prev).add(picture))
                        }
                        className="h-16 w-16 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="ghad-display flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[var(--gh-cream,#f6efe4)] text-xl font-extrabold text-[var(--gh-ink-soft,#555)]"
                      >
                        {experience.title.slice(0, 1)}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] leading-tight font-semibold text-[var(--gh-ink,#111)]">
                        {experience.title}
                      </p>
                      {(where || when) && (
                        <p className="truncate text-xs text-[var(--gh-ink-soft,#555)]">
                          {[when, where].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {href && (
                        <Link
                          href={carry ? `${href}?${carry}` : href}
                          aria-label={`Details of ${experience.title}`}
                          className="text-xs font-semibold text-[var(--gh-ink,#111)] underline underline-offset-2"
                        >
                          Details
                        </Link>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col">
                      <button
                        type="button"
                        onClick={() => move(experience.id, -1)}
                        disabled={index === 0}
                        aria-label={`Move ${experience.title} up`}
                        className={`${small} h-8 w-8`}
                      >
                        <ArrowUp className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(experience.id, 1)}
                        disabled={index === shown.length - 1}
                        aria-label={`Move ${experience.title} down`}
                        className={`${small} h-8 w-8`}
                      >
                        <ArrowDown className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                    <button
                      type="button"
                      data-testid="pocket-remove"
                      onClick={() => void remove(experience)}
                      disabled={busy === experience.id}
                      aria-label={`Remove ${experience.title}`}
                      className={small}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </li>
                );
              })}
              {unknown > 0 && (
                <li className="px-2 py-1 text-xs text-[var(--gh-ink-soft,#555)]">
                  {unknown} more saved that this page can&apos;t show — they are
                  all in{" "}
                  <Link href="/saved" className="font-semibold underline">
                    My Stuff
                  </Link>
                  .
                </li>
              )}
            </ol>

            <div className="border-t border-black/10 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href={dayFrom(chosen)}
                  data-testid="pocket-make-day"
                  aria-disabled={chosen.length === 0}
                  className={`col-span-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--gh-ink,#111)] px-5 text-base font-semibold text-white hover:bg-black ${chosen.length === 0 ? "pointer-events-none opacity-40" : ""}`}
                >
                  Make a day
                  {chosen.length > 0 && (
                    <span className="font-normal text-white/75">
                      {" "}
                      with{" "}
                      {chosen.length > DAY_SEEDS
                        ? `the first ${DAY_SEEDS}`
                        : chosen.length === 1
                          ? "this one"
                          : `these ${chosen.length}`}
                    </span>
                  )}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href={weekendFrom(chosen)}
                  data-testid="pocket-make-weekend"
                  aria-disabled={chosen.length === 0}
                  className={`inline-flex min-h-12 items-center justify-center rounded-full border-2 border-black/15 px-4 text-sm font-semibold text-[var(--gh-ink,#111)] hover:border-black/40 ${chosen.length === 0 ? "pointer-events-none opacity-40" : ""}`}
                >
                  Make a weekend
                </Link>
                <button
                  type="button"
                  data-testid="pocket-keep-collecting"
                  onClick={() => {
                    setOpen(false);
                    opener.current?.focus();
                  }}
                  className="inline-flex min-h-12 items-center justify-center rounded-full px-4 text-sm font-semibold text-[var(--gh-ink,#111)] hover:bg-[var(--gh-cream,#f6efe4)]"
                >
                  Keep collecting
                </button>
              </div>
              <Link
                href="/saved"
                data-testid="pocket-my-stuff"
                className="mt-2 block text-center text-xs font-semibold text-[var(--gh-ink-soft,#555)] underline underline-offset-2"
              >
                Everything you&apos;ve saved lives in My Stuff
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}
