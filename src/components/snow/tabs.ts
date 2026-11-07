import type { Action, Person, SnowDay } from "@/domain/snow/day";
import type { CrewLocation } from "./useCrewLocation";

export interface TabProps {
  readonly day: SnowDay;
  /** The person using this phone. */
  readonly me: Person;
  readonly act: (a: Action) => boolean;
  /** Today as `YYYY-MM-DD`, in the phone's own time zone. */
  readonly today: string;
  readonly now: Date;
  /** Opt-in, temporary location sharing. Only on a shared day. */
  readonly crew?: CrewLocation;
  /** Jump to another section of the day. */
  readonly go: (tab: TabKey) => void;
  /** Present only when the day is shared between phones. */
  readonly shared?: { readonly id: string; readonly isOwner: boolean };
}

export const TABS = [
  ["plan", "Plan"],
  ["crew", "Crew"],
  ["hype", "Get ready"],
  ["play", "Challenges"],
  ["mountain", "On the hill"],
  ["memories", "Memories"],
] as const;
export type TabKey = (typeof TABS)[number][0];
