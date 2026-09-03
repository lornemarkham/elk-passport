"use client";

import { useMemo, useState } from "react";
import { DestinationCard } from "@/components/place-detail/DestinationCard";
import type { Place } from "@/lib/data/types";

/**
 * Every Place Atlas holds, browsable by the type the source itself gave it.
 *
 * ## Why this is only a type filter
 *
 * `/discovery` already lists these places and links to the same detail pages,
 * but it filters on `seasons`, `companions`, `energyLevel`, `priceLevel` and
 * `duration` — none of which Atlas knows. `atlasMapper` supplies them as
 * identical constants for all 65 places, so those controls answer questions
 * with invented data.
 *
 * `placeType` is different: it is on the record, it came from the source, and
 * it is the one axis Atlas can actually answer. So it is the only axis here.
 * A control that filters honestly on one real field is worth more than five
 * that appear to filter on fields nobody has.
 *
 * ## Why the vocabulary is not tidied
 *
 * The chips are the corpus's own words, counted — `provincial park` and `park`
 * sit side by side because two publishers said two different things, and
 * collapsing them here would be Atlas asserting an equivalence no source
 * stated (ADR 017's reasoning, applied to a filter). `unknown` is shown for
 * the same reason: sixteen places genuinely have no stated type, and hiding
 * that would make the corpus look better than it is.
 */
export function PlacesIndexView({
  places,
}: {
  readonly places: readonly Place[];
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const types = useMemo(() => {
    const counts = new Map<string, number>();
    for (const place of places) {
      const type = normalizeType(place.placeType);
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    // Commonest first, then alphabetical — a stable order that puts the types
    // actually worth browsing at the front without ranking them by hand.
    return [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
  }, [places]);

  const visible = useMemo(() => {
    const matching = selected
      ? places.filter((place) => normalizeType(place.placeType) === selected)
      : places;
    return [...matching].sort((a, b) => a.name.localeCompare(b.name));
  }, [places, selected]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Places
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          Everywhere Atlas currently knows about in the Okanagan. Filter by the
          kind of place it is, then open one to see what Atlas has learned.
        </p>
      </header>

      <div
        className="mb-6 flex flex-wrap gap-2"
        role="group"
        aria-label="Filter by place type"
      >
        <Chip
          label="All"
          count={places.length}
          active={selected === null}
          onClick={() => setSelected(null)}
        />
        {types.map(([type, count]) => (
          <Chip
            key={type}
            label={type}
            count={count}
            active={selected === type}
            onClick={() => setSelected(selected === type ? null : type)}
          />
        ))}
      </div>

      <p className="text-muted-foreground mb-5 text-sm" aria-live="polite">
        {visible.length} {visible.length === 1 ? "place" : "places"}
        {selected ? ` of type “${selected}”` : ""}
      </p>

      {visible.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border p-6 text-sm">
          Nothing of that type. Atlas holds no place it can describe that way
          yet.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((place) => (
            <li key={place.id}>
              {/* The same card the detail page's nearby rails use — one visual
                  definition of "here's a real place worth going", and it
                  already falls back to a placeholder when Atlas holds no
                  photograph, which is true for 42 of these. */}
              <DestinationCard
                place={place}
                caption={normalizeType(place.placeType)}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  readonly label: string;
  readonly count: number;
  readonly active: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "hover:border-primary/40 text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}{" "}
      <span className={active ? "opacity-70" : "opacity-60"}>{count}</span>
    </button>
  );
}

/** A missing or blank type is `unknown` — the same word Atlas itself stores. */
function normalizeType(placeType: string | undefined): string {
  const trimmed = (placeType ?? "").trim();
  return trimmed.length > 0 ? trimmed : "unknown";
}
