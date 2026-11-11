"use client";

import Link from "next/link";
import {
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  Check,
  MapPin,
  Plus,
  Sparkles,
  Tag,
  Users,
} from "lucide-react";
import { Picture } from "@/components/adventures/Picture";
import { subjectHref } from "@/domain/experience/destination";
import { whereLine } from "@/domain/discovery/compose";
import { distanceText } from "@/domain/discovery/proximity";
import { ageBecause, ageLine } from "@/domain/discovery/suitability";
import type { Find } from "@/domain/christmas/discover";
import { evidenceLine, themeById } from "@/domain/christmas/themes";
import { CONFIDENCE_LABEL, type Confidence } from "@/domain/christmas/when";
import { cn } from "@/lib/utils";
import { usePicks } from "./Picks";

const CONFIDENCE_STYLE: Readonly<Record<Confidence, string>> = {
  dated: "bg-[#0f3b2b] text-white",
  check: "bg-[#ffd98a] text-[#082319]",
  unconfirmed: "bg-white text-[#4a443b] ring-1 ring-black/10",
  past: "bg-[#ebe1cd] text-[#4a443b]",
};

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
}: {
  readonly find: Find;
  readonly origin?: { latitude: number; longitude: number };
  readonly youngest?: number;
  readonly compact?: boolean;
}) {
  const { picked, togglePick, saved, saving, toggleSave } = usePicks();
  const e = find.experience;
  const theme = find.reading.themes[0];
  const where = whereLine(e);
  const far = distanceText(e, origin);
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
      <Link href={href} className="relative block" tabIndex={-1} aria-hidden>
        <Picture
          experience={e}
          fallbackTitle={e.title}
          tone={find.reading.christmas ? "#b3242f" : "#245c78"}
          className="aspect-[4/3] w-full"
        />
        <span
          className={cn(
            "absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-bold",
            CONFIDENCE_STYLE[find.when.confidence],
          )}
        >
          {CONFIDENCE_LABEL[find.when.confidence]}
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-sm font-semibold text-[#b3242f]">
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
            <span>
              {[where, far].filter(Boolean).join(" · ") ||
                "Atlas hasn't said where"}
            </span>
          </li>
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
            {isPicked ? "In my Christmas day" : "Add to my Christmas day"}
          </button>
        </div>
      </div>
    </article>
  );
}
