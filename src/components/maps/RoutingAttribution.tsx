import { attributionFor } from "@/lib/routing/attribution";
import type { Journey } from "@/lib/routing/journey";

/**
 * **The credit a routed travel time owes**, once per provider, wherever one
 * is shown. Renders nothing when nothing on the page was routed.
 */
export function RoutingAttribution({
  journeys,
  className = "text-[12px] leading-relaxed text-black/45",
}: {
  readonly journeys: readonly (Journey | undefined)[];
  readonly className?: string;
}) {
  const lines = attributionFor(journeys);
  if (lines.length === 0) return null;
  return (
    <p data-testid="routing-attribution" className={className}>
      {lines.join(" · ")}
    </p>
  );
}
