"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { Experience } from "@/domain/experience/types";
import type { SavedForAdventure, SavedPick } from "@/domain/occasion/saved";
import { weekdayLabel } from "@/lib/adventures/present";
import { placeLabel } from "@/domain/discovery/compose";
import { Picture } from "../Picture";
import { SectionHeading } from "../kit";

/**
 * **"You saved the Rail Trail. Want it on Saturday?"** (ADR 012 §1; the
 * brief's _connect Saved directly to Adventures_).
 *
 * Places on the person's own Saved that this adventure doesn't hold yet,
 * offered inside an adventure they opened — one tap onto a day, or into the
 * ideas. Nothing is duplicated: anything the adventure already points at is
 * not offered.
 *
 * **The ones that fit come first, and say why** (`savedForAdventure`): on
 * during the dates, close to where it is, suited to the occasion its days
 * were asked for. An event that is over or something far away waits behind
 * "Show everything you saved" — never deleted, never pretended to fit.
 */
export function SavedSuggestions({
  saved,
  days,
  isOwner,
  busy,
  act,
  call,
}: {
  readonly saved: SavedForAdventure;
  readonly days: readonly string[];
  readonly isOwner: boolean;
  readonly busy: boolean;
  readonly act: (
    work: () => Promise<unknown>,
    done?: string,
  ) => Promise<boolean>;
  readonly call: <T = unknown>(
    path: string,
    method: string,
    body?: unknown,
  ) => Promise<T>;
}) {
  const [all, setAll] = useState(false);
  const total = saved.fits.length + saved.elsewhere.length;
  if (total === 0) return null;
  const shown: readonly SavedPick[] = all
    ? [...saved.fits, ...saved.elsewhere]
    : saved.fits.slice(0, 4);
  const add = (experience: Experience, onDay: string | null) =>
    act(
      () =>
        call("/items", "POST", {
          atlasRef: experience.id,
          onDay,
          ...(isOwner && onDay ? { status: "confirmed" } : {}),
        }),
      onDay
        ? `${experience.title} is on ${weekdayLabel(onDay)}.`
        : `${experience.title} is in the ideas.`,
    );

  return (
    <section
      aria-labelledby="from-saved-heading"
      data-testid="saved-suggestions"
    >
      <SectionHeading
        id="from-saved-heading"
        eyebrow="From your saved places"
        title="You've already found these"
      >
        {saved.fits.length > 0
          ? "The things you saved that suit this one, first. One tap puts one on a day."
          : "Nothing you saved fits these dates or this area — but it's all still yours."}
      </SectionHeading>
      <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {shown.map(({ experience, why }) => (
          <li
            key={experience.id}
            data-testid="saved-suggestion"
            className="flex gap-3 rounded-3xl border border-[var(--gh-line)] bg-white p-3"
          >
            <Picture
              experience={experience}
              showLabel={false}
              className="aspect-square w-20 shrink-0 rounded-2xl"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[var(--gh-ink-soft)]">
                {why ?? "You saved"}
              </p>
              <p className="ghad-display text-lg leading-tight font-extrabold">
                {experience.title}
              </p>
              {placeLabel(experience) && (
                <p className="text-sm text-[var(--gh-ink-soft)]">
                  {placeLabel(experience)}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {days.slice(0, 3).map((d) => (
                  <button
                    key={d}
                    type="button"
                    disabled={busy}
                    onClick={() => void add(experience, d)}
                    aria-label={`Add ${experience.title} to ${weekdayLabel(d)}`}
                    className="inline-flex min-h-11 items-center gap-1 rounded-full bg-[var(--gh-forest)] px-4 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    {days.length === 1 ? "Add to the day" : weekdayLabel(d)}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void add(experience, null)}
                  className="inline-flex min-h-11 items-center rounded-full border-2 border-[var(--gh-line)] px-4 text-sm font-semibold hover:border-[var(--gh-ink)]/40 disabled:opacity-50"
                >
                  {days.length === 0 ? "Add as an idea" : "Idea"}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {total > shown.length && (
        <button
          type="button"
          onClick={() => setAll(true)}
          data-testid="saved-show-all"
          className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold underline"
        >
          Show everything you saved ({total})
          {saved.elsewhere.length > 0 &&
            ` — ${saved.elsewhere.length} ${saved.elsewhere.length === 1 ? "is" : "are"} over or far from here`}
        </button>
      )}
    </section>
  );
}
