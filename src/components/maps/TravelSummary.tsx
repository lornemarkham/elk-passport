import type { Journey, TravelMode } from "@/lib/routing/journey";
import { describeTravelTotal, travelTotal, type Leg } from "@/lib/routing/legs";
import type { TravelStatus } from "@/lib/routing/useTravelTimes";
import { RoutingAttribution } from "./RoutingAttribution";

const STATUS_NOTE: Partial<Record<TravelStatus, string>> = {
  loading: "Working out travel times…",
  "not-served":
    "Atlas does not give travel times between places yet, so the distances here are straight lines.",
  failed:
    "Could not get travel times just now, so the distances here are straight lines.",
};

/**
 * **What the travel in a day adds up to, and on whose word.**
 *
 * The total is summed only from routed legs (`travelTotal`); a day with a
 * leg Atlas could not route says *at least* and names that leg. Under it, the
 * provider's limitations — said once for the whole day — and the credit the
 * routes owe. A failure offers to ask again; nothing retries by itself.
 */
export function TravelSummary({
  legs,
  answers,
  status,
  mode,
  planned,
  onRetry,
}: {
  readonly legs: readonly Leg[];
  /** Atlas's journey per leg, aligned with `legs`. */
  readonly answers: readonly (Journey | undefined)[];
  readonly status: TravelStatus;
  readonly mode: TravelMode;
  /** The plan's own minutes at the stops, to state the whole day. */
  readonly planned?: number;
  readonly onRetry?: () => void;
}) {
  if (legs.length === 0) return null;
  const total = travelTotal(legs, answers, mode);
  const words =
    status === "ready" ? describeTravelTotal(total, planned) : undefined;
  const limitations = [
    ...new Set(
      answers.flatMap((j) => (j?.kind === "routed" ? j.limitations : [])),
    ),
  ].filter((l) => !/©|\bodbl\b/i.test(l));
  const note =
    STATUS_NOTE[status] ??
    (status === "ready" && total.kind === "none"
      ? "Atlas has no travel time for any leg of this day, so the distances here are straight lines."
      : undefined);

  if (!words && !note) return null;

  return (
    <div
      data-testid="travel-summary"
      data-status={status}
      data-total={total.kind}
      aria-live="polite"
      aria-busy={status === "loading" || undefined}
      className="mt-4 max-w-[64ch]"
    >
      {words && (
        <p className="text-[15px] leading-relaxed text-[#111]">
          <span className="font-semibold">{words.headline}.</span>{" "}
          <span className="text-black/55">{words.caveat}</span>
        </p>
      )}
      {note && (
        <p className="text-[14px] leading-relaxed text-black/55">
          {note}
          {status === "failed" && onRetry && (
            <>
              {" "}
              <button
                type="button"
                data-testid="travel-retry"
                onClick={onRetry}
                style={{ color: "var(--ghad-accent)" }}
                className="font-semibold underline underline-offset-4"
              >
                Try again
              </button>
            </>
          )}
        </p>
      )}
      {limitations.length > 0 && (
        <p className="mt-1 text-[13px] leading-relaxed text-black/45">
          What these estimates leave out: {limitations.join("; ")}.
        </p>
      )}
      <RoutingAttribution
        journeys={answers}
        className="mt-1 text-[12px] leading-relaxed text-black/40"
      />
    </div>
  );
}
