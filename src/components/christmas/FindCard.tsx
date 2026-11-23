"use client";

import Link from "next/link";
import {
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  Check,
  ExternalLink,
  MapPin,
  Navigation,
  Plus,
  Sparkles,
  Tag,
  Users,
} from "lucide-react";
import { CardPhoto } from "./CardPhoto";
import { subjectHref } from "@/domain/experience/destination";
import { whereLine } from "@/domain/discovery/compose";
import { distanceText } from "@/domain/discovery/proximity";
import { ageBecause, ageLine } from "@/domain/discovery/suitability";
import {
  directionsOf,
  statedPlace,
  type Find,
} from "@/domain/christmas/discover";
import { tidyWhere } from "@/domain/christmas/tidy";
import {
  evidenceLine,
  themeById,
  type ThemeId,
} from "@/domain/christmas/themes";
import {
  CONFIDENCE_LABEL,
  PHASE_LABEL,
  type Confidence,
  type WhenReading,
} from "@/domain/christmas/when";
import { cn } from "@/lib/utils";
import { usePicks } from "./Picks";

const CONFIDENCE_STYLE: Readonly<Record<Confidence, string>> = {
  dated: "bg-[#0f3b2b] text-white",
  check: "bg-[#ffd98a] text-[#082319]",
  unconfirmed: "bg-white text-[#4a443b] ring-1 ring-black/10",
  past: "bg-[#ebe1cd] text-[#4a443b]",
};

/**
 * What the badge says. A confirmed date says whether it is on now or still to
 * come; every other reading says how unsure it is — never "confirmed".
 */
function badge(when: WhenReading): string {
  return when.confidence === "dated" && when.phase
    ? `${PHASE_LABEL[when.phase]} · dates confirmed`
    : CONFIDENCE_LABEL[when.confidence];
}

/**
 * **A Christmas find, as a family would want to see it** — the picture
 * first, then when and how sure, where, why Passport thinks it is a
 * Christmas thing, and what the organiser says it costs. Every line is an
 * Atlas field or the organiser's words; a missing one is left out or said to
 * be missing, never filled in.
 */
export function FindCard({
  find,
  origin,
  youngest,
  compact = false,
  theme: browsing,
}: {
  readonly find: Find;
  readonly origin?: { latitude: number; longitude: number };
  readonly youngest?: number;
  readonly compact?: boolean;
  /** The category being browsed: the card says that one when it is one. */
  readonly theme?: ThemeId;
}) {
  const { picked, togglePick, saved, saving, toggleSave } = usePicks();
  const e = find.experience;
  const theme =
    browsing && find.reading.themes.includes(browsing)
      ? browsing
      : find.reading.themes[0];
  const where = tidyWhere(whereLine(e) ?? "");
  const far = distanceText(e, origin);
  const stated = where ? undefined : statedPlace(e);
  const directions = directionsOf(e);
  const age = ageLine(e, youngest);
  const ageWhy = ageBecause(e, youngest);
  const isPicked = picked.includes(e.id);
  const isSaved = saved.has(e.id);
  const href = subjectHref(e.kind, e.id);

  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-[26px] bg-white shadow-[0_8px_30px_rgba(8,35,25,0.08)] ring-1 ring-black/5",
        compact ? "w-[17.5rem] shrink-0 snap-start" : "",
      )}
      data-testid="find-card"
      data-find={e.id}
    >
      <CardPhoto experience={e} className="aspect-[16/9] w-full" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-[#b3242f]">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-bold",
              CONFIDENCE_STYLE[find.when.confidence],
            )}
            data-testid="find-confidence"
          >
            {badge(find.when)}
          </span>
          {theme ? (
            <>
              <span aria-hidden>{themeById(theme).emoji}</span>{" "}
              {themeById(theme).label}
            </>
          ) : (
            <>
              <span aria-hidden>🎄</span> Christmas
            </>
          )}
        </p>
        <h3 className="ghad-display text-xl leading-tight font-extrabold tracking-tight text-balance">
          <Link
            href={href}
            className="flex min-h-11 items-center hover:underline"
          >
            {e.title}
          </Link>
        </h3>
        {!compact && e.description && (
          <p
            className="line-clamp-2 text-[0.95rem] text-[var(--gh-ink-soft)]"
            data-testid="find-description"
          >
            {e.description}
          </p>
        )}
        <ul className="space-y-1.5 text-[0.95rem] text-[var(--gh-ink-soft)]">
          <li className="flex gap-2" title={find.when.because}>
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              {find.when.line ?? "No dates for this season yet"}
              {find.when.confidence !== "dated" && (
                <span className="block text-sm text-[var(--gh-ink-soft)]/80">
                  {find.when.because}
                </span>
              )}
            </span>
          </li>
          <li className="flex gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span data-testid="find-where">
              {[where, far].filter(Boolean).join(" · ") ||
                (stated
                  ? `The organiser says: ${stated}`
                  : "Location not confirmed")}
            </span>
          </li>
          {find.others ? (
            <li className="text-sm" data-testid="find-others">
              Listed {find.others + 1} times — shown once
              {e.kind === "Event" ? "; it may run on other dates too" : ""}.
            </li>
          ) : null}
          {!compact && find.price && (
            <li className="flex gap-2">
              <Tag className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span className="line-clamp-2">
                In the organiser&apos;s words — {find.price}
              </span>
            </li>
          )}
          {age && (
            <li className="flex gap-2" title={ageWhy}>
              <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{age}</span>
            </li>
          )}
          {!compact && find.reading.evidence[0] && (
            <li className="flex gap-2 text-sm">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span className="line-clamp-3">
                {evidenceLine(find.reading.evidence[0])}
              </span>
            </li>
          )}
        </ul>
        {!compact && (
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
            {directions && (
              <a
                href={directions}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 text-[#0f3b2b] underline-offset-4 hover:underline"
                data-testid="find-directions"
              >
                <Navigation className="h-4 w-4" aria-hidden />
                Directions
              </a>
            )}
            <Link
              href={href}
              className="inline-flex min-h-11 items-center gap-1.5 text-[#0f3b2b] underline-offset-4 hover:underline"
              data-testid="find-details"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Details &amp; source
            </Link>
          </p>
        )}
        <div className="mt-auto flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => void toggleSave(e.id)}
            disabled={saving.has(e.id)}
            aria-pressed={isSaved}
            className={cn(
              "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border-2 px-3 text-sm font-semibold transition-colors disabled:opacity-60",
              isSaved
                ? "border-[#0f3b2b] bg-[#0f3b2b] text-white"
                : "border-black/10 hover:border-black/30",
            )}
            data-testid="save-find"
          >
            {isSaved ? (
              <BookmarkCheck className="h-4 w-4" aria-hidden />
            ) : (
              <Bookmark className="h-4 w-4" aria-hidden />
            )}
            {isSaved ? "Saved" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => togglePick(e.id)}
            aria-pressed={isPicked}
            className={cn(
              "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors",
              isPicked
                ? "bg-[#b3242f] text-white"
                : "bg-[#f7e3e1] text-[#8e1d26] hover:bg-[#f2d2cf]",
            )}
            data-testid="pick-find"
          >
            {isPicked ? (
              <Check className="h-4 w-4" aria-hidden />
            ) : (
              <Plus className="h-4 w-4" aria-hidden />
            )}
            {isPicked ? "In My Christmas List" : "Add to My Christmas List"}
          </button>
        </div>
      </div>
    </article>
  );
}
