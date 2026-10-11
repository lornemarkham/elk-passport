"use client";

import { useState } from "react";
import type { Experience } from "@/domain/experience/types";
import type { DiscoverySection } from "@/domain/discovery/compose";
import type { Point } from "@/domain/discovery/situation";
import { PossibilityCard } from "./PossibilityCard";

/**
 * **The composed page: several reasons to look, instead of one long list.**
 *
 * Each section was claimed by `composeDiscovery` for a reason a person would
 * recognise — what is on today, what is coming up, what you might feel like
 * doing — and shows eight. *Show more* grows the one section you asked about
 * rather than loading the other two thousand rows, which is what the previous
 * version did on every page view whether anybody scrolled or not.
 *
 * Presentation only. Nothing here decides membership or order; it renders what
 * the domain composed.
 */
export function DiscoverySections({
  sections,
  today,
  home,
  origin,
  carry,
  savedIds,
  savingId,
  onSave,
}: {
  readonly sections: readonly DiscoverySection[];
  /** Today where the subjects are, so a card can say "Last day". */
  readonly today?: string;
  /** The area this page is mostly about, so a card elsewhere can say so. */
  readonly home?: string;
  /** Where the reader is, once they have said, so a placed card can say how far. */
  readonly origin?: Point;
  /** What the exploration carries into a card's destination; see `PossibilityCard`. */
  readonly carry?: string;
  readonly savedIds: ReadonlySet<string>;
  readonly savingId: string | null;
  readonly onSave: (experience: Experience) => void;
}) {
  return (
    <div className="flex flex-col gap-10">
      {sections.map((section) => (
        <Section
          key={section.id}
          section={section}
          {...(today ? { today } : {})}
          {...(home ? { home } : {})}
          {...(origin ? { origin } : {})}
          {...(carry ? { carry } : {})}
          savedIds={savedIds}
          savingId={savingId}
          onSave={onSave}
        />
      ))}
    </div>
  );
}

function Section({
  section,
  today,
  home,
  origin,
  carry,
  savedIds,
  savingId,
  onSave,
}: {
  readonly section: DiscoverySection;
  readonly today?: string;
  readonly home?: string;
  readonly origin?: Point;
  readonly carry?: string;
  readonly savedIds: ReadonlySet<string>;
  readonly savingId: string | null;
  readonly onSave: (experience: Experience) => void;
}) {
  // How many extra pages of this section the person has asked for. Local to
  // the section, so opening one up leaves the others as they were.
  const [more, setMore] = useState(0);
  const shown = section.items.slice(0, section.size * (more + 1));
  const canReveal = shown.length < section.items.length;

  return (
    <section data-testid="discovery-section" data-section={section.id}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="ghad-display text-[24px] leading-[0.98] font-extrabold tracking-[-0.04em] text-[#111] uppercase sm:text-[40px]">
          {section.title}
        </h2>
        {/* The count is said once, quietly, and only because "216 of these"
            is genuinely useful when deciding whether to open a section. It is
            never the headline — "2248 to explore" was. */}
        <p className="text-xs text-black/40 tabular-nums">
          {section.total}{" "}
          {section.total === 1 ? "possibility" : "possibilities"}
        </p>
      </div>
      <p className="mt-1 max-w-[76ch] text-[13px] text-black/45">
        {section.note}
      </p>

      {/* **A shelf, not a grid.** Cards nearly fill a phone with the next one
          visibly peeking, snap points so a thumb lands square, and the same
          row scrolls with a trackpad on a desktop. `overscroll-x-contain`
          keeps a swipe inside the shelf rather than triggering the browser's
          back gesture. */}
      <ul className="-mx-4 mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-4 pb-2 sm:-mx-6 sm:gap-6 sm:px-6">
        {shown.map((experience) => (
          <PossibilityCard
            className="w-[78vw] shrink-0 snap-start sm:w-[360px] lg:w-[400px]"
            key={experience.id}
            experience={experience}
            {...(today ? { today } : {})}
            {...(home ? { home } : {})}
            {...(origin ? { origin } : {})}
            {...(carry ? { carry } : {})}
            saved={savedIds.has(experience.id)}
            saving={savingId === experience.id}
            onSave={() => onSave(experience)}
          />
        ))}
      </ul>

      {/* Only where there is genuinely more, and only as far as the section
          was given. Past that the search box is the honest answer — a feed
          that keeps growing until the browser gives up is the thing this
          replaced. */}
      {canReveal && (
        <button
          type="button"
          data-testid="show-more"
          onClick={() => setMore((n) => n + 1)}
          style={{ color: "var(--ghad-accent)" }}
          className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
        >
          {/* Not `More {title}` — the remainder section is already called
              "More to explore", which produced "More more to explore". */}
          Show more
        </button>
      )}
    </section>
  );
}
