"use client";

/**
 * One row of single-select facet chips, each showing how many results it would
 * leave. Knows nothing about what is being filtered — the values arrive
 * already counted.
 *
 * Single-select on purpose. Multi-select is a different interaction (an OR
 * within a facet, an AND across facets) and nothing needs it yet; adding the
 * state machine for it now would be guessing at how a second entity type wants
 * to filter before that type exists.
 */
export interface FacetOption {
  readonly value: string;
  readonly count: number;
}

export function FilterChipGroup({
  label,
  allLabel,
  options,
  selected,
  totalCount,
  onSelect,
}: {
  /** Names the group for assistive technology — "Filter by place type". */
  readonly label: string;
  readonly allLabel: string;
  readonly options: readonly FacetOption[];
  readonly selected: string | null;
  readonly totalCount: number;
  readonly onSelect: (value: string | null) => void;
}) {
  return (
    <div
      className="mb-6 flex flex-wrap gap-2"
      role="group"
      aria-label={label}
      data-testid="filter-chips"
    >
      <Chip
        label={allLabel}
        count={totalCount}
        active={selected === null}
        onClick={() => onSelect(null)}
      />
      {options.map((option) => (
        <Chip
          key={option.value}
          label={option.value}
          count={option.count}
          active={selected === option.value}
          // Clicking the active chip clears it, so the filter is escapable
          // without hunting for the "All" chip at the far end of a long row.
          onClick={() =>
            onSelect(selected === option.value ? null : option.value)
          }
        />
      ))}
    </div>
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
