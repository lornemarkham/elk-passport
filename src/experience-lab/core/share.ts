import type { Standing } from "./scoring";
import type { ExperienceDefinition, VoiceTone } from "./types";

/**
 * **The thing that leaves the building.**
 *
 * Most of this group already lives in a `#hockey` Slack channel, and the
 * honest version of "growth" for a product like this is not an invite flow —
 * it is one person pasting the standings into a channel and eight people
 * asking what that is.
 *
 * So the shareable artefact is plain text, deliberately. It survives Slack,
 * iMessage, a group chat and a screenshot, needs no integration, no unfurl
 * and no account, and it is the same in every one of them. Building a Slack
 * app before knowing whether anyone wants to paste this would be solving the
 * second problem first.
 */

const RUNNING: Record<VoiceTone, string> = {
  rowdy: "There is still time for this to go badly for somebody.",
  hype: "Still everything to play for.",
  warm: "Plenty left to get wrong.",
  intimate: "",
};

const FINISHED: Record<VoiceTone, string> = {
  rowdy: "No money changed hands. Somehow that makes it worse.",
  hype: "That's the day.",
  warm: "Nobody lost, exactly.",
  intimate: "",
};

export function shareStandings(
  definition: ExperienceDefinition,
  table: readonly Standing[],
  settled: boolean,
): string | null {
  const scoring = table.filter((row) => row.points > 0);
  if (scoring.length === 0) return null;

  const leader = table[0];
  const headline = settled
    ? `🏆 ${leader.participant.name.toUpperCase()} WINS ${definition.title.toUpperCase()}`
    : `🚨 ${leader.participant.name.toUpperCase()} HAS TAKEN THE LEAD`;

  const rows = table
    .map((row) => `${row.participant.name} ${row.points}`)
    .join("\n");

  const footer = settled ? FINISHED[definition.tone] : RUNNING[definition.tone];

  return [headline, "", definition.title, rows, "", footer]
    .filter((line, index, all) => !(line === "" && all[index - 1] === ""))
    .join("\n")
    .trim();
}
