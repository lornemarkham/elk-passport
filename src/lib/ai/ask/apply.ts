import type { DiscoverySession } from "@/domain/discovery/session";
import type { Window } from "@/domain/discovery/situation";
import type { DiscoveryAsk } from "./read";

/**
 * **A question, applied to the page's answers — and nothing else touched.**
 *
 * The doctrine's own example (§2.5) is a sentence that changes two things and
 * says *leave everything else alone*. So a question sets only what it says:
 * "three hours" changes how long, and leaves the town, the day and the child
 * exactly as the person last set them.
 *
 * Three deliberate exceptions, each because the question replaces the thing
 * rather than adding to it:
 *
 * - **A chosen kind and an intent are cleared.** The answer only appears
 *   on the composed page.
 * - **"Worth the drive" clears the radius.** A 15 km circle cannot hold an
 *   answer that starts at 40.
 * - **Saying who is coming replaces the child's age** unless it is a child.
 *   An age belongs to the child, not to the friends.
 *
 * "Nearby" becomes a 15 km radius only where there is somewhere to measure
 * from — a town in the sentence or one already chosen, or a shared position.
 * Otherwise it stays a wish and the answer asks *from where?*.
 */
export const NEARBY_KM = 15;

export function applyAsk(
  session: DiscoverySession,
  ask: DiscoveryAsk,
  options: {
    readonly hasOrigin: boolean;
    /** Every sentence of the conversation so far, this one last. */
    readonly conversation?: readonly string[];
  },
): DiscoverySession {
  const next: Record<string, unknown> = {
    ...session,
    ask: options.conversation ?? [ask.said],
    intent: undefined,
    kind: undefined,
    everywhere: undefined,
  };
  if (ask.window) next.window = ask.window satisfies Window;
  if (ask.company) {
    next.company = ask.company;
    if (ask.company !== "child") next.age = undefined;
  }
  if (ask.childAge !== undefined) next.age = ask.childAge;
  if (ask.on) next.on = ask.on;
  if (ask.townId) next.at = ask.townId;
  if (ask.withinKm !== undefined) next.within = ask.withinKm;
  else if (ask.near && (options.hasOrigin || ask.townId || session.at))
    next.within = NEARBY_KM;
  if (ask.lens === "drive") next.within = undefined;
  if (ask.doing) next.doing = ask.doing;

  return Object.fromEntries(
    Object.entries(next).filter(([, value]) => value !== undefined),
  ) as DiscoverySession;
}

/**
 * **The sentence `/go` is handed.** The person's own, except where `/go`
 * would misread it: "worth driving an hour for" is about distance, and
 * `readBrief` would take "an hour" as the length of the day.
 */
export function daySentence(ask: DiscoveryAsk): string {
  if (ask.lens === "drive")
    return ask.hours !== undefined
      ? `${ask.hours} hours, worth the drive`
      : "A whole day out, worth the drive";
  return ask.said;
}

/** What a day on `/go` is called when nobody asked a question — from the row. */
export function windowSentence(window: Window | undefined): string {
  if (window === "an-hour") return "An hour or two";
  if (window === "all-day") return "A whole day";
  return "Half a day";
}
