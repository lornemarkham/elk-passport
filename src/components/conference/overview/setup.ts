import type { ConferenceSummary } from "@/domain/conference/contracts";

export interface SetupStep {
  readonly done: boolean;
  readonly label: string;
  readonly hint: string;
  readonly href: string;
}

/**
 * The few things that make a conference useful to everyone else, each
 * pointing at the settings section that finishes it. Shown in full on
 * Organiser settings; Home carries one line saying how many are left.
 */
export function setupSteps(
  c: ConferenceSummary,
  participants: number,
): SetupStep[] {
  const admin = `/conferences/${c.id}/admin`;
  return [
    {
      done: !!c.venue,
      label: "Add the venue",
      hint: "So everyone knows where to be, and Explore measures walks from it.",
      href: `${admin}#details`,
    },
    {
      done: (c.agenda ?? []).length > 0 || !c.modules.includes("schedule"),
      label: "Publish the agenda",
      hint: "Sessions, breaks and the evening. Home answers “what’s next?” from it.",
      href: `${admin}#agenda`,
    },
    {
      done: participants > 1,
      label: "Invite people",
      hint: "A link or a code. Nobody needs an account to join.",
      href: `${admin}#access`,
    },
    {
      done: !!c.tagline,
      label: "Write a line of welcome",
      hint: "One sentence under the name, in your own words.",
      href: `${admin}#details`,
    },
  ];
}
