import type { ConditionRead } from "@/domain/october/conditions";

/**
 * **What the conditions mean for this thing, on its card.**
 *
 * A line and, under it, the handful of facts behind it — "7°C · dry · dark by
 * 6:35" — so a row stays scannable for somebody who only wants the numbers.
 * Rendered only where `conditionsFor` returned something, which it does for a
 * minority of cards and never for an indoor thing on an ordinary evening.
 *
 * Ember where it changes a plan, grey where it merely informs.
 */
export function CardWeather({ read }: { readonly read: ConditionRead }) {
  return (
    // A block `span`, not a `p`: this renders inside a card and inside a row
    // that is itself one `<a>`, and a paragraph nested in an anchor is invalid.
    <span
      data-testid="card-weather"
      data-weight={read.weight}
      className="mt-1.5 block"
    >
      <span
        className={`block text-xs ${
          read.weight === "warning"
            ? "text-[#d09a4e]"
            : read.weight === "good"
              ? "text-[#9ab08f]"
              : "text-[#e9e6da]/60"
        }`}
      >
        {read.line}
      </span>
      {read.facts ? (
        <span
          data-testid="card-weather-facts"
          className="mt-0.5 block text-[11px] text-[#e9e6da]/35"
        >
          {read.facts}
        </span>
      ) : null}
    </span>
  );
}
