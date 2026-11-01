import type { Action, Person, SnowDay } from "@/domain/snow/day";

export interface TabProps {
  readonly day: SnowDay;
  /** The person using this phone. */
  readonly me: Person;
  readonly act: (a: Action) => boolean;
  /** Today as `YYYY-MM-DD`, in the phone's own time zone. */
  readonly today: string;
  readonly now: Date;
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
