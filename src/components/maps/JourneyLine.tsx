import { describeJourney, type Journey } from "@/lib/routing/journey";
import type { TravelStatus } from "@/lib/routing/useTravelTimes";

const STATUS_NOTE: Partial<Record<TravelStatus, string>> = {
  loading: "Working out a travel time…",
  "not-served": "Travel times are not available from Atlas yet.",
  failed: "Could not get a travel time just now.",
};

/**
 * **How far one place is, in the most truthful words available.**
 *
 * A routed journey from Atlas wins when there is one. Otherwise the straight
 * line is shown — always as a straight line — with a note saying why there is
 * no travel time: still asking, not served yet, or failed. Those are three
 * different sentences and none of them is "no route".
 *
 * Renders nothing only when there is nothing at all to say.
 */
export function JourneyLine({
  status,
  routed,
  straightLine,
}: {
  readonly status: TravelStatus;
  /** Atlas's answer for this place, when `status` is `ready`. */
  readonly routed?: Journey;
  /** Atlas's straight-line reading, when it has one. */
  readonly straightLine?: Journey;
}) {
  const shown = status === "ready" && routed ? routed : straightLine;
  const note =
    STATUS_NOTE[status] ??
    (status === "ready" && !routed && straightLine
      ? "Atlas has no travel time for this place."
      : undefined);

  if (!shown && !note) return null;
  const words = shown ? describeJourney(shown) : undefined;

  return (
    <p
      data-testid="journey-line"
      data-journey={shown?.kind ?? "none"}
      data-status={status}
      aria-busy={status === "loading" || undefined}
      className="text-[15px] leading-relaxed text-[#111]"
    >
      {words && <>{words.headline}. </>}
      <span className="text-black/45">
        {[words?.caveat, note].filter(Boolean).join(" ")}
      </span>
    </p>
  );
}
