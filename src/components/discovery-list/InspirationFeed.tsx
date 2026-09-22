"use client";

import Link from "next/link";
import { Bookmark, Check } from "lucide-react";
import type { Experience } from "@/domain/experience/types";
import { destinationFor } from "@/domain/experience/destination";
import {
  inspirationShelves,
  type Shelf,
} from "@/domain/discovery/inspirationShelves";
import { formatEventWhen } from "@/domain/experience/eventTime";

/**
 * **The scrolling half of Discovery.**
 *
 * List answers *"find the thing I already have in mind"*. This answers *"what
 * could make today better?"*, and the only difference is framing: both render
 * the same `Experience[]` the same page already loaded, through the same
 * `destinationFor` and the same save handler.
 *
 * Image-first because Atlas earned it — 89% of in-region candidates now carry a
 * hero, where a year of this product had thumbnails or nothing. A card without
 * one still appears; it just leads with its words instead of hiding.
 *
 * Horizontal shelves inside a vertical scroll: the shelf is browsable without
 * commitment, and the page keeps moving. Each shelf scrolls on its own so a
 * long one never pushes the next off the screen.
 */

interface InspirationFeedProps {
  readonly experiences: readonly Experience[];
  readonly savedIds: ReadonlySet<string>;
  readonly onSave: (experience: Experience) => void;
  /** Injected so the feed is deterministic in a test. */
  readonly now?: Date;
  /**
   * Shelves composed elsewhere. When given, `experiences` is not re-shelved
   * here — the October entry composes its own lanes by subtype and date and
   * borrows only this rendering.
   */
  readonly shelves?: readonly (Shelf & { lastYear?: boolean })[];
  /** "Want to do." Present only where the page has an October to keep it in. */
  readonly wantedIds?: ReadonlySet<string>;
  readonly onWant?: (experience: Experience) => void;
  /** What to say when there is nothing. */
  readonly emptyLine?: string;
}

export function InspirationFeed({
  experiences,
  savedIds,
  onSave,
  now,
  shelves: given,
  wantedIds,
  onWant,
  emptyLine = "Atlas has not placed anything in this area yet.",
}: InspirationFeedProps) {
  const shelves = given ?? inspirationShelves(experiences, now);

  if (shelves.length === 0) {
    return (
      <div className="rounded-xl border border-[#8a5a24]/20 bg-white/50 p-10 text-center">
        <p className="font-medium text-[#3b2a17]">Nothing to show yet</p>
        <p className="mt-1 text-sm text-[#6b5637]">{emptyLine}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {shelves.map((shelf) => (
        <section key={shelf.id} aria-labelledby={`shelf-${shelf.id}`}>
          <div className="mb-3 px-1">
            <h2
              id={`shelf-${shelf.id}`}
              className="font-serif text-2xl text-[#2c1f10]"
            >
              {shelf.title}
            </h2>
            <p className="mt-0.5 text-sm text-[#6b5637]">
              {shelf.blurb}
              {"lastYear" in shelf && shelf.lastYear && (
                <span className="ml-2 rounded-full border border-[#8a5a24]/30 px-2 py-0.5 text-[10px] font-medium tracking-wide text-[#8a5a24] uppercase">
                  2025
                </span>
              )}
            </p>
          </div>

          {/* One shelf, scrolling on its own. `snap` makes a flick land on a
              card rather than between two. */}
          <ul
            className="flex snap-x snap-mandatory [scrollbar-width:thin] gap-4 overflow-x-auto pb-3"
            data-testid={`shelf-${shelf.id}`}
          >
            {shelf.experiences.map((experience) => (
              <InspirationCard
                key={experience.id}
                experience={experience}
                saved={savedIds.has(experience.id)}
                onSave={() => onSave(experience)}
                wanted={wantedIds?.has(experience.id) ?? false}
                onWant={onWant ? () => onWant(experience) : undefined}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function InspirationCard({
  experience,
  saved,
  onSave,
  wanted,
  onWant,
}: {
  experience: Experience;
  saved: boolean;
  onSave: () => void;
  wanted?: boolean;
  onWant?: () => void;
}) {
  const destination = destinationFor(experience);
  const when =
    experience.kind === "Event"
      ? formatEventWhen(experience.startTime, experience.endTime)
      : undefined;

  return (
    <li
      className="relative flex w-64 shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-[#8a5a24]/20 bg-white shadow-sm transition-shadow hover:shadow-md"
      data-navigates={destination ? "true" : "false"}
    >
      {/* The whole card is the link, as an overlay — a <button> inside an
          anchor is invalid HTML and ambiguous to click. Same pattern
          ExperienceListRow already uses. */}
      {destination && (
        <Link
          href={destination}
          className="absolute inset-0 z-10"
          aria-label={`Open ${experience.title}`}
        />
      )}

      <div className="relative h-40 w-full bg-[#efe7d8]">
        {experience.heroMedia ? (
          // URLs are arbitrary remote hosts; next/image would need every one
          // allow-listed in next.config, which is a separate decision.
          <img
            src={experience.heroMedia.src}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center">
            <span className="font-serif text-lg leading-tight text-[#8a5a24]">
              {experience.title}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={onSave}
          aria-label={
            saved ? `${experience.title} saved` : `Save ${experience.title}`
          }
          className="absolute top-2 right-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#3b2a17] shadow-sm transition-colors hover:bg-white"
        >
          {saved ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <Bookmark className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="leading-snug font-medium text-[#2c1f10]">
            {experience.title}
          </h3>
        </div>

        {when && <p className="text-xs font-medium text-[#8a5a24]">{when}</p>}

        {experience.subtype && !when && (
          <p className="text-[11px] tracking-wide text-[#8a5a24] uppercase">
            {experience.subtype}
          </p>
        )}

        <p className="line-clamp-3 text-sm text-[#6b5637]">
          {experience.shortDescription}
        </p>

        {/* Said plainly rather than hidden. A card Atlas cannot yet give its
            own page is still worth seeing, and silently making it unclickable
            is what made the last dogfood pass feel broken. */}
        {!destination && (
          <p className="mt-auto pt-1 text-[11px] text-[#9a8a70]">
            No page yet — Atlas is still reading about this one.
          </p>
        )}

        {/* The same intention Discovery's list offers. Above the covering link
            (z-20) so it is a button and not a navigation. */}
        {onWant &&
          (wanted ? (
            <span
              className="relative z-20 mt-auto pt-1 text-xs font-medium text-[#8a5a24]"
              data-testid="wanted"
            >
              In my October
            </span>
          ) : (
            <button
              type="button"
              onClick={onWant}
              className="relative z-20 mt-auto -ml-1.5 flex min-h-9 items-center self-start rounded-full px-2 text-xs font-medium text-[#8a5a24] hover:bg-[#8a5a24]/10"
              data-testid="want-to-do"
            >
              Want to do
            </button>
          ))}
      </div>
    </li>
  );
}
