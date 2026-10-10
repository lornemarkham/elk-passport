"use client";

import { useState } from "react";
import type { Experience } from "@/domain/experience/types";
import type { DiscoverySection } from "@/domain/discovery/compose";
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
  savedIds,
  savingId,
  onSave,
  wantedIds,
  onWant,
}: {
  readonly sections: readonly DiscoverySection[];
  readonly savedIds: ReadonlySet<string>;
  readonly savingId: string | null;
  readonly onSave: (experience: Experience) => void;
  readonly wantedIds?: ReadonlySet<string>;
  readonly onWant?: (experience: Experience) => void;
}) {
  return (
    <div className="flex flex-col gap-10">
      {sections.map((section) => (
        <Section
          key={section.id}
          section={section}
          savedIds={savedIds}
          savingId={savingId}
          onSave={onSave}
          wantedIds={wantedIds}
          onWant={onWant}
        />
      ))}
    </div>
  );
}

function Section({
  section,
  savedIds,
  savingId,
  onSave,
  wantedIds,
  onWant,
}: {
  readonly section: DiscoverySection;
  readonly savedIds: ReadonlySet<string>;
  readonly savingId: string | null;
  readonly onSave: (experience: Experience) => void;
  readonly wantedIds?: ReadonlySet<string>;
  readonly onWant?: (experience: Experience) => void;
}) {
  // How many extra pages of this section the person has asked for. Local to
  // the section, so opening one up leaves the others as they were.
  const [more, setMore] = useState(0);
  const shown = section.items.slice(0, section.size * (more + 1));
  const canReveal = shown.length < section.items.length;

  return (
    <section data-testid="discovery-section" data-section={section.id}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-heading text-xl text-[#2b2015] sm:text-2xl">
          {section.title}
        </h2>
        {/* The count is said once, quietly, and only because "216 of these"
            is genuinely useful when deciding whether to open a section. It is
            never the headline — "2248 to explore" was. */}
        <p className="text-xs text-[#2b2015]/45 tabular-nums">
          {section.total}{" "}
          {section.total === 1 ? "possibility" : "possibilities"}
        </p>
      </div>
      <p className="mt-0.5 text-sm text-[#2b2015]/55">{section.note}</p>

      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((experience) => (
          <PossibilityCard
            key={experience.id}
            experience={experience}
            saved={savedIds.has(experience.id)}
            saving={savingId === experience.id}
            onSave={() => onSave(experience)}
            wanted={wantedIds?.has(experience.id)}
            {...(onWant ? { onWant: () => onWant(experience) } : {})}
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
          className="mt-4 inline-flex min-h-11 items-center rounded-full border border-[#8a5a24]/30 px-4 text-sm font-medium text-[#8a5a24] transition-colors hover:bg-[#8a5a24]/10"
        >
          More {section.title.toLowerCase()}
        </button>
      )}
    </section>
  );
}
