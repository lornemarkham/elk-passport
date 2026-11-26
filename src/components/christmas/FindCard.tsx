"use client";

import Link from "next/link";
import {
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  ArrowRight,
  MapPin,
  Navigation,
  Tag,
  Users,
} from "lucide-react";
import { CardPhoto } from "./CardPhoto";
import { eventHref } from "@/domain/christmas/eventPage";
import { whereLine } from "@/domain/discovery/compose";
import { distanceText } from "@/domain/discovery/proximity";
import { ageBecause, ageLine } from "@/domain/discovery/suitability";
import {
  directionsOf,
  statedPlace,
  type Find,
} from "@/domain/christmas/discover";
import { distinctWhere, tidyWhere } from "@/domain/christmas/tidy";
import { themeById, type ThemeId } from "@/domain/christmas/themes";
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
 * come — "On now", "Upcoming" — and only an unsure one says how unsure it is
 * (owner brief M1128: no verification terms on every card; the reading's
 * own sentence is the badge's title, for whoever asks).
 */
function badge(when: WhenReading): string {
  return when.confidence === "dated" && when.phase
    ? PHASE_LABEL[when.phase]
    : CONFIDENCE_LABEL[when.confidence];
}

/**
 * **A Christmas find, as a family would want to see it** — the picture
 * first, then the name, when and how sure, where, and what the organiser says
 * it costs. Every line is an Atlas field or the organiser's words; a missing
 * one is left out or said to be missing, never filled in.
 *
 * The whole card opens the event (picture, name and every bare patch — one
 * stretched link, so there is no link inside a link); the buttons sit above
 * it and never navigate. There is one **Save**: it is also how a find joins
 * My Christmas List, and tapping it again removes it.
 */
export function FindCard({
  find,
  origin,
  youngest,
  compact = false,
  feature = false,
  theme: browsing,
}: {
  readonly find: Find;
  readonly origin?: { latitude: number; longitude: number };
  readonly youngest?: number;
  readonly compact?: boolean;
  /** The one find a section leads with: a wide picture, the name large. */
  readonly feature?: boolean;
  /** The category being browsed: the card says that one when it is one. */
  readonly theme?: ThemeId;
}) {
  const { isKept, saving, toggleKeep } = usePicks();
  const e = find.experience;
  const theme =
    browsing && find.reading.themes.includes(browsing)
      ? browsing
      : find.reading.themes[0];
  const where = distinctWhere(tidyWhere(whereLine(e) ?? ""));
  const farText = distanceText(e, origin);
  // "In Vernon" beside "Vernon" says the town twice.
  const far =
    farText && /^In (.+)$/.test(farText) && where.includes(farText.slice(3))
      ? undefined
      : farText;
  const stated = where ? undefined : statedPlace(e);
  const directions = directionsOf(e);
  const age = ageLine(e, youngest);
  const ageWhy = ageBecause(e, youngest);
  const kept = isKept(e.id);
  const href = eventHref(e.id);
  const action =
    "relative z-10 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold whitespace-nowrap transition-colors";

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-[22px] bg-white shadow-[0_6px_22px_rgba(8,35,25,0.08)] ring-1 ring-black/5 transition-shadow hover:shadow-[0_10px_30px_rgba(8,35,25,0.14)]",
        compact ? "w-[17.5rem] shrink-0 snap-start" : "",
        feature &&
          "rounded-[28px] md:grid md:min-h-[24rem] md:has-[img]:grid-cols-[1.45fr_1fr]",
      )}
      data-testid={feature ? "find-feature" : "find-card"}
      data-find={e.id}
    >
      <CardPhoto
        experience={e}
        className={cn(
          "aspect-[16/9] w-full",
          feature && "aspect-[4/3] sm:aspect-[16/9] md:aspect-auto md:h-full",
        )}
        {...(feature ? { priority: true } : {})}
      />
      <div
        className={cn(
          "flex flex-1 flex-col gap-1.5 p-3.5",
          feature && "gap-2 p-5 sm:p-7 md:justify-center",
        )}
      >
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-[#b3242f]">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-bold",
              CONFIDENCE_STYLE[find.when.confidence],
            )}
            title={find.when.because}
            data-testid="find-confidence"
          >
            {badge(find.when)}
          </span>
          {theme ? (
            <span>
              <span aria-hidden>{themeById(theme).emoji}</span>{" "}
              {themeById(theme).label}
            </span>
          ) : (
            <span>
              <span aria-hidden>🎄</span> Christmas
            </span>
          )}
        </p>
        <h3
          className={cn(
            "ghad-display text-xl leading-tight font-extrabold tracking-tight text-balance",
            feature && "text-[1.75rem] leading-[1.02] sm:text-4xl",
          )}
        >
          <Link
            href={href}
            className="after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            data-testid="find-title"
          >
            {e.title}
          </Link>
        </h3>
        {!compact && e.description && (
          <p
            className={cn(
              "line-clamp-2 text-sm text-[var(--gh-ink-soft)]",
              feature && "line-clamp-3 text-base",
            )}
            data-testid="find-description"
          >
            {e.description}
          </p>
        )}
        <ul className="space-y-1 text-sm text-[var(--gh-ink-soft)]">
          <li className="flex gap-2" title={find.when.because}>
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              {find.when.line ?? "No dates for this season yet"}
              {find.when.confidence !== "dated" && (
                <span className="block text-xs text-[var(--gh-ink-soft)]/80">
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
            e.kind === "Event" ? (
              <li className="text-xs" data-testid="find-others">
                May run on other dates too
              </li>
            ) : null
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
        </ul>
        <div className="mt-auto flex flex-wrap items-center gap-x-1 gap-y-0 pt-1.5">
          <button
            type="button"
            onClick={() => void toggleKeep(e.id, { title: e.title, href })}
            disabled={saving.has(e.id)}
            aria-pressed={kept}
            aria-label={
              kept
                ? `Saved: ${e.title}. Tap to remove`
                : `Save ${e.title} to My Christmas List`
            }
            title={kept ? "Saved — tap to remove" : "Save to My Christmas List"}
            className={cn(
              action,
              "border-2 disabled:opacity-60",
              kept
                ? "border-[#0f3b2b] bg-[#0f3b2b] text-white"
                : "border-black/10 bg-white hover:border-black/30",
            )}
            data-testid="save-find"
          >
            {kept ? (
              <BookmarkCheck className="h-4 w-4" aria-hidden />
            ) : (
              <Bookmark className="h-4 w-4" aria-hidden />
            )}
            {kept ? "Saved" : "Save"}
          </button>
          {!compact && directions && (
            <a
              href={directions}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                action,
                "px-2 text-[#0f3b2b] underline-offset-4 hover:underline",
              )}
              data-testid="find-directions"
            >
              <Navigation className="h-4 w-4" aria-hidden />
              Directions
            </a>
          )}
          <Link
            href={href}
            className={cn(
              action,
              "ml-auto px-1 text-[#8e1d26] underline-offset-4 hover:underline",
            )}
            data-testid="find-details"
          >
            View event
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}
