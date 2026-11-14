"use client";

import { Fragment, useState } from "react";
import type { Experience } from "@/domain/experience/types";
import type { DiscoverySection } from "@/domain/discovery/compose";
import type { Point } from "@/domain/discovery/situation";
import { withoutRepeatedIllustrations } from "@/domain/discovery/illustrations";
import { hasOwnPicture, pictureFirst } from "@/domain/discovery/compose";
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
  dayHrefFor,
  interlude,
}: {
  /**
   * **Something that is not a shelf**, placed after the second one (or the
   * last, on a short page) — the featured hosts. Not between the first two,
   * so the page always opens on possibilities.
   */
  readonly interlude?: React.ReactNode;
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
  /** The way into *Go have a day* with one card in it; see `PossibilityCard`. */
  readonly dayHrefFor?: (experience: Experience) => string;
}) {
  return (
    <div className="flex flex-col gap-10">
      {sections.map((section, index) => (
        <Fragment key={section.id}>
          <Section
            key={section.id}
            section={section}
            // Only the section that opens the page, and only its first cards —
            // see `PossibilityCard`'s `priority`. Everything else stays lazy.
            leading={index === 0}
            {...(today ? { today } : {})}
            {...(home ? { home } : {})}
            {...(origin ? { origin } : {})}
            {...(carry ? { carry } : {})}
            savedIds={savedIds}
            savingId={savingId}
            onSave={onSave}
            {...(dayHrefFor ? { dayHrefFor } : {})}
          />
          {interlude && index === Math.min(1, sections.length - 1) && interlude}
        </Fragment>
      ))}
      {interlude && sections.length === 0 && interlude}
    </div>
  );
}

function Section({
  section,
  leading = false,
  today,
  home,
  origin,
  carry,
  savedIds,
  savingId,
  onSave,
  dayHrefFor,
}: {
  readonly section: DiscoverySection;
  /** Whether this is the section a reader lands on. Decides image priority. */
  readonly leading?: boolean;
  readonly today?: string;
  readonly home?: string;
  readonly origin?: Point;
  readonly carry?: string;
  readonly savedIds: ReadonlySet<string>;
  readonly savingId: string | null;
  readonly onSave: (experience: Experience) => void;
  readonly dayHrefFor?: (experience: Experience) => string;
}) {
  // How many extra pages of this section the person has asked for. Local to
  // the section, so opening one up leaves the others as they were.
  const [more, setMore] = useState(0);
  if (section.pending) return <PendingSection section={section} />;
  const shown = withoutRepeatedIllustrations(
    picturesLeadEachPage(
      section.items.slice(0, section.size * (more + 1)),
      section.size,
    ),
  );
  const canReveal = shown.length < section.items.length;
  // **A spotlight needs a photograph.** A section that opens the page on
  // words alone ("Write to Santa") is laid out like every other section
  // rather than blowing a text card up to fill a picture's room.
  const spotlight =
    leading && shown[0] !== undefined && hasOwnPicture(shown[0]);
  // **What the layout folds away, not the data.** A row of four (five in the
  // spotlight, three on a phone's spotlight) hides the rest of the first page
  // with CSS; when there is no further page, *Show more* still has to open it,
  // but only on the screens where something is actually folded.
  const folded = more === 0 && !canReveal;
  const foldedOn = spotlight
    ? shown.length > 5
      ? "inline-flex"
      : shown.length > 3
        ? "inline-flex lg:hidden"
        : "hidden"
    : shown.length > 4
      ? "hidden lg:inline-flex"
      : "hidden";

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

      {/* **The page opens on a spotlight, not another shelf** (owner brief
          M817: "too many repetitive horizontal carousels", "make the best
          nearby activities prominent"). The section a reader lands on leads
          with one large card — the composer already put its best-pictured
          possibility first — and two (phone) or four (desktop) beside it.

          **Every other section is a shelf on a phone and a grid on a
          desktop.** Cards nearly fill a phone with the next one peeking, snap
          points so a thumb lands square, `overscroll-x-contain` so a swipe
          stays in the shelf. On a wide screen ten sideways rows were the
          repetition the owner named: a row of four reads at a glance and
          *Show more* opens the rest. */}
      <ul
        data-layout={spotlight ? "spotlight" : "shelf"}
        className={
          spotlight
            ? `mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-6 lg:grid-cols-4 ${
                more === 0
                  ? "[&>li:nth-child(n+4)]:hidden sm:[&>li:nth-child(n+4)]:flex lg:[&>li:nth-child(n+6)]:hidden"
                  : ""
              }`
            : `-mx-4 mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-4 pb-2 sm:-mx-6 sm:gap-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 ${
                more === 0 ? "lg:[&>li:nth-child(n+5)]:hidden" : ""
              }`
        }
      >
        {shown.map((experience, index) => (
          <PossibilityCard
            className={
              spotlight
                ? index === 0
                  ? "col-span-2 lg:row-span-2"
                  : "min-w-0"
                : "w-[78vw] shrink-0 snap-start sm:w-[360px] lg:w-auto lg:min-w-0"
            }
            featured={spotlight && index === 0}
            key={experience.id}
            experience={experience}
            // What is in view when the page opens: the spotlight and the
            // cards beside it. Everything else stays lazy.
            priority={leading && index < 5}
            {...(today ? { today } : {})}
            {...(home ? { home } : {})}
            {...(origin ? { origin } : {})}
            {...(carry ? { carry } : {})}
            saved={savedIds.has(experience.id)}
            saving={savingId === experience.id}
            onSave={() => onSave(experience)}
            {...(dayHrefFor ? { dayHref: dayHrefFor(experience) } : {})}
          />
        ))}
      </ul>

      {/* Only where there is genuinely more, and only as far as the section
          was given. Past that the search box is the honest answer — a feed
          that keeps growing until the browser gives up is the thing this
          replaced. */}
      {(canReveal || (folded && foldedOn !== "hidden")) && (
        <button
          type="button"
          data-testid="show-more"
          onClick={() => setMore((n) => n + 1)}
          style={{ color: "var(--ghad-accent)" }}
          className={`mt-3 min-h-11 items-center text-sm font-semibold underline underline-offset-4 ${
            canReveal ? "inline-flex" : foldedOn
          }`}
        >
          {/* Not `More {title}` — the remainder section is already called
              "More to explore", which produced "More more to explore". */}
          Show more
        </button>
      )}
    </section>
  );
}

/**
 * **Within each page of a section, the pictured cards go first.**
 *
 * The view orders every section nearest-first after the composer ordered it
 * picture-first, so "Near you" opened on a card with no photograph whenever
 * the nearest thing had none — and the spotlight is the card a person sees
 * first. Re-ordered a page at a time, so the same eight stay on the first
 * page (nearness still decides *which* eight) and *Show more* never moves a
 * card that is already on screen.
 */
function picturesLeadEachPage(
  items: readonly Experience[],
  size: number,
): Experience[] {
  const out: Experience[] = [];
  for (let at = 0; at < items.length; at += size) {
    out.push(...pictureFirst(items.slice(at, at + size)));
  }
  return out;
}

/**
 * **The room a section will take, before it has cards** — the spotlight's
 * shape in quiet tints, so the page below it is already where it will stay.
 */
function PendingSection({ section }: { readonly section: DiscoverySection }) {
  return (
    <section
      data-testid="discovery-section-pending"
      data-section={section.id}
      aria-busy="true"
    >
      <h2 className="ghad-display text-[24px] leading-[0.98] font-extrabold tracking-[-0.04em] text-[#111] uppercase sm:text-[40px]">
        {section.title}
      </h2>
      <p role="status" className="mt-1 text-[13px] text-black/45">
        {section.note}
      </p>
      <ul
        aria-hidden
        className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-6 lg:grid-cols-4 [&>li:nth-child(n+4)]:hidden sm:[&>li:nth-child(n+4)]:flex lg:[&>li:nth-child(n+6)]:hidden"
      >
        {[0, 1, 2, 3, 4].map((index) => (
          <li
            key={index}
            className={`flex flex-col ${index === 0 ? "col-span-2 lg:row-span-2" : "min-w-0"}`}
          >
            <span className="aspect-[4/3] w-full animate-pulse bg-black/[0.05]" />
            <span className="mt-3 h-3 w-2/5 animate-pulse rounded-full bg-black/[0.05]" />
            <span
              className={`mt-2 w-4/5 animate-pulse rounded-full bg-black/[0.06] ${index === 0 ? "h-8" : "h-5"}`}
            />
            <span className="mt-2 h-3 w-full animate-pulse rounded-full bg-black/[0.04]" />
            <span className="mt-auto h-11 w-24 animate-pulse rounded-full bg-black/[0.05] pt-4" />
          </li>
        ))}
      </ul>
    </section>
  );
}
