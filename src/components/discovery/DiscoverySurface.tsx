"use client";

import { useMemo, useState, type ReactNode } from "react";
import { FilterChipGroup, type FacetOption } from "./FilterChipGroup";

/**
 * **The mechanics every discovery surface shares, and nothing else.**
 *
 * Passport will want to browse Events, Activities and Organizations the way it
 * now browses Places. Those four have almost nothing in common as *content* —
 * an Event has dates, an Organization has no coordinates at all (ADR 019) — but
 * they share the same *mechanics*: count the results, offer a facet, lay them
 * out, say something useful when there are none, make each one clickable.
 *
 * So this owns the mechanics and knows nothing about any entity. It is generic
 * over `T` and never reads a field: the caller supplies `facetValuesOf` to say
 * what a chip means, `renderItem` to say what a result looks like, and `keyOf`
 * to identify one. There is deliberately **no** shared entity model and **no**
 * card with a `kind` switch in it — an `EventCard` should be free to look
 * nothing like a `PlaceCard`, and forcing both through one component is how a
 * card ends up full of conditionals nobody can safely change.
 *
 * ## What a second entity type has to write
 *
 * A page, a card, and the four lines of configuration below. Not a filter, not
 * a grid, not an empty state, not the selection state machine.
 */
export interface DiscoverySurfaceProps<T> {
  readonly items: readonly T[];
  /** Stable identity for the list. Never an array index. */
  readonly keyOf: (item: T) => string;
  /**
   * The entity's own card. Given the whole item, so a card may read fields no
   * other entity type has — which is the point of keeping cards specific.
   */
  readonly renderItem: (item: T) => ReactNode;
  readonly title: string;
  readonly intro?: ReactNode;
  /** Singular and plural, because "1 places" is the kind of detail that makes a product feel unfinished. */
  readonly noun: { readonly one: string; readonly many: string };
  /**
   * The one facet this surface filters on, or absent for no filtering.
   *
   * Returns a list rather than a single string so a future entity whose facet
   * is genuinely multi-valued — an Activity's tags, say — needs no change here.
   * An item contributes to every value it returns.
   */
  readonly facet?: {
    readonly label: string;
    readonly allLabel?: string;
    readonly valuesOf: (item: T) => readonly string[];
  };
  /** Shown when a filter matches nothing. Entity-specific wording; the shell has no opinion. */
  readonly emptyMessage: string;
  /** Optional stable ordering. Applied after filtering. */
  readonly compare?: (a: T, b: T) => number;
}

export function DiscoverySurface<T>({
  items,
  keyOf,
  renderItem,
  title,
  intro,
  noun,
  facet,
  emptyMessage,
  compare,
}: DiscoverySurfaceProps<T>) {
  const [selected, setSelected] = useState<string | null>(null);

  const options = useMemo<FacetOption[]>(() => {
    if (!facet) return [];
    const counts = new Map<string, number>();
    for (const item of items) {
      for (const value of facet.valuesOf(item)) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    // Commonest first, then alphabetical — a stable order that puts the values
    // actually worth browsing at the front without ranking them by hand.
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, count }));
  }, [items, facet]);

  const visible = useMemo(() => {
    const matching =
      selected === null || !facet
        ? items
        : items.filter((item) => facet.valuesOf(item).includes(selected));
    return compare ? [...matching].sort(compare) : [...matching];
  }, [items, facet, selected, compare]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {intro && (
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
            {intro}
          </p>
        )}
      </header>

      {facet && options.length > 0 && (
        <FilterChipGroup
          label={facet.label}
          allLabel={facet.allLabel ?? "All"}
          options={options}
          selected={selected}
          totalCount={items.length}
          onSelect={setSelected}
        />
      )}

      <p
        className="text-muted-foreground mb-5 text-sm"
        aria-live="polite"
        data-testid="result-count"
      >
        {visible.length} {visible.length === 1 ? noun.one : noun.many}
        {selected ? ` · ${selected}` : ""}
      </p>

      {visible.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border p-6 text-sm">
          {emptyMessage}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((item) => (
            <li key={keyOf(item)}>{renderItem(item)}</li>
          ))}
        </ul>
      )}
    </main>
  );
}
