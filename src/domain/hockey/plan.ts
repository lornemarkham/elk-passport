import type { Block, Prompt, PanelLine } from "@/experience-lab/core/types";
import type { NightRows } from "./night";

/**
 * **What the group has settled, said back to the group.**
 *
 * The pregame vote lives in "Before the game", which leaves the page at
 * warm-up. Without this, the evening's one real decision — where we eat, when
 * we're leaving — is something everybody voted on and nobody can find while
 * walking to the arena.
 *
 * Only tallies of questions that reveal immediately are used, so this can
 * never leak a sealed answer. A tie is reported as a tie; it is not broken.
 * Votes from people who have since left do not count.
 */
const PLAN_PROMPTS = [
  { id: "pregame-spot", label: "Eating" },
  { id: "meet-spot", label: "Meeting" },
  { id: "hard-out", label: "Leaving" },
] as const;

export function planLines(
  prompts: readonly Prompt[],
  rows: Pick<NightRows, "members" | "options" | "responses">,
): PanelLine[] {
  const members = new Set(rows.members.map((m) => m.user_id));
  const lines: PanelLine[] = [];

  for (const { id, label } of PLAN_PROMPTS) {
    const prompt = prompts.find((p) => p.id === id);
    if (!prompt || prompt.reveal !== "immediate") continue;

    const names = new Map<string, string>();
    for (const o of prompt.options ?? []) names.set(o.id, o.label);
    for (const o of rows.options)
      if (o.prompt_id === id && members.has(o.added_by))
        names.set(o.id, o.label);

    const counts = new Map<string, number>();
    for (const r of rows.responses) {
      if (r.prompt_id !== id || !members.has(r.user_id)) continue;
      if (typeof r.value !== "string" || !names.has(r.value)) continue;
      counts.set(r.value, (counts.get(r.value) ?? 0) + 1);
    }

    if (counts.size === 0) {
      lines.push({ label, value: "Nobody has voted yet" });
      continue;
    }
    const top = Math.max(...counts.values());
    const leaders = [...counts]
      .filter(([, n]) => n === top)
      .map(([option]) => names.get(option) as string);
    const votes = `${top} ${top === 1 ? "vote" : "votes"}`;
    lines.push(
      leaders.length === 1
        ? { label, value: `${leaders[0]} · ${votes}`, emphasis: true }
        : { label, value: `Tied at ${votes}: ${leaders.join(" / ")}` },
    );
  }
  // A plan nobody has contributed to is the empty ballot again, twice.
  return lines.some((l) => l.emphasis || l.value.startsWith("Tied"))
    ? lines
    : [];
}

/** The plan as a panel block, placed on every phase the night is open. */
export function planBlock(
  lines: readonly PanelLine[],
  phaseIds: readonly string[],
): Block | null {
  return lines.length === 0
    ? null
    : {
        id: "plan",
        kind: "panel",
        title: "The plan",
        subtitle: "What the group has settled so far.",
        phaseIds,
        lines,
      };
}

/**
 * **The group's plan, as the page shows it** — the same rule as `planLines`
 * (only questions that reveal as they happen; a tie stays a tie), read from
 * what the engine already let this person see rather than from rows, so the
 * page's plan moves the moment somebody votes.
 */
export interface PlanItem {
  readonly id: string;
  readonly label: string;
  /** The leading option labels; more than one is a tie. Empty: nobody voted. */
  readonly leaders: readonly string[];
  readonly votes: number;
  /** Everybody who has voted on it at all. */
  readonly voters: number;
  readonly locked: boolean;
  /** What I voted for, if I did. */
  readonly mine?: string;
}

const LIVE_PLAN = [
  { id: "pregame-spot", label: "Eating" },
  { id: "meet-spot", label: "Meeting" },
  { id: "hard-out", label: "Leaving" },
  { id: "postgame", label: "After" },
] as const;

export function planItems(
  prompts: readonly {
    readonly prompt: Pick<Prompt, "id" | "reveal">;
    readonly locked: boolean;
    readonly myResponse?: { readonly value: unknown };
    readonly tally: readonly {
      readonly optionId: string;
      readonly label: string;
      readonly voters: readonly unknown[];
    }[];
  }[],
): PlanItem[] {
  return LIVE_PLAN.flatMap(({ id, label }) => {
    const live = prompts.find((p) => p.prompt.id === id);
    if (!live || live.prompt.reveal !== "immediate") return [];
    const top = Math.max(0, ...live.tally.map((o) => o.voters.length));
    return [
      {
        id,
        label,
        leaders:
          top === 0
            ? []
            : live.tally
                .filter((o) => o.voters.length === top)
                .map((o) => o.label),
        votes: top,
        voters: live.tally.reduce((n, o) => n + o.voters.length, 0),
        locked: live.locked,
        mine: live.tally.find((o) => o.optionId === live.myResponse?.value)
          ?.label,
      },
    ];
  });
}
