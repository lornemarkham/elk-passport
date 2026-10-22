import type { Block } from "@/experience-lab/core/types";

/**
 * **Plan, Play, Chat, Group — four rooms instead of one long corridor.**
 *
 * The night used to be every block in one column: the vote, the meeting
 * point, seven picks, the conversation, the guest list and the settings,
 * about eight phone screens deep before the game and still five after. The
 * group's actual decisions were three screens down and the chat was below the
 * picks. Tabs split the page by what a person came to do:
 *
 * - **Plan** — where we eat, where we meet, when we leave; after the game,
 *   where we go next and the next night.
 * - **Play** — picks, intermission games, the Cup, the receipts, the recap.
 * - **Chat** — the night's conversation.
 * - **Group** — who's in, you, your limit; the host's invitations and
 *   settings.
 *
 * Grouping only: every block the phase puts on the page is still on it, in
 * the phase's order, in exactly one tab. Nothing is hidden by a tab that the
 * hero does not summarise — the plan's answers are on the hero's plan strip
 * whichever tab is open.
 */
export type TabId = "plan" | "play" | "chat" | "group";

export const TABS: readonly { readonly id: TabId; readonly label: string }[] = [
  { id: "plan", label: "Plan" },
  { id: "play", label: "Play" },
  { id: "chat", label: "Chat" },
  { id: "group", label: "Group" },
];

/** The questions that are the group's plan rather than a game. */
export const PLAN_PROMPT_IDS: ReadonlySet<string> = new Set([
  "pregame-spot",
  "meet-spot",
  "hard-out",
  "postgame",
]);

export function tabOfBlock(block: Pick<Block, "kind" | "promptIds">): TabId {
  switch (block.kind) {
    case "feed":
      return "chat";
    case "roster":
      return "group";
    case "runItBack":
    case "panel":
      return "plan";
    case "leaderboard":
    case "recap":
      return "play";
    case "promptGroup":
      return block.promptIds?.some((id) => PLAN_PROMPT_IDS.has(id))
        ? "plan"
        : "play";
  }
}

/**
 * Which room the page opens in. Before the game and once it is over, the
 * plan; in an intermission and on the morning after, the games and what came
 * of them.
 */
export function defaultTab(phaseId: string): TabId {
  switch (phaseId) {
    case "int1":
    case "int2":
    case "morning":
      return "play";
    default:
      return "plan";
  }
}

export function isTabId(value: string): value is TabId {
  return TABS.some((t) => t.id === value);
}
