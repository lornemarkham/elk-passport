import { scorePrompt } from "@/experience-lab/core/scoring";
import type { LivePrompt } from "@/experience-lab/core/engine";
import type {
  Participant,
  Prompt,
  ResponseValue,
} from "@/experience-lab/core/types";

/**
 * **What somebody picked, said the way you would say it out loud.**
 *
 * "4–2", "Yes", "Canucks", "Maya", "6 goals". Used by the reveal, which only
 * ever receives answers the database already let this person see — sealed
 * answers are sealed in Postgres (`passport_occasion_answer_visible`), not by
 * this file.
 */
export function answerText(
  prompt: Pick<Prompt, "kind" | "options" | "unit">,
  value: ResponseValue,
  people: readonly Pick<Participant, "id" | "name">[] = [],
): string {
  if (Array.isArray(value)) {
    return value.length === 2 && value.every((v) => typeof v === "number")
      ? `${value[0]}–${value[1]}`
      : value.join(", ");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    return prompt.unit ? `${value} ${prompt.unit}` : String(value);
  }
  const option = prompt.options?.find((o) => o.id === value);
  if (option) return option.label;
  const person = people.find((p) => p.id === value);
  return person?.name ?? String(value);
}

export type Verdict = "exact" | "partial" | "wrong" | "open";

/**
 * Right, half right, wrong — or not known yet. The engine's own scoring
 * decides, so the reveal can never disagree with the Cup.
 */
export function verdictFor(
  live: Pick<LivePrompt, "prompt" | "showResolution">,
  response: LivePrompt["responses"][number],
): Verdict {
  if (live.prompt.resolution === undefined || !live.showResolution)
    return "open";
  if (!live.prompt.scoring) return "open";
  const line = scorePrompt(live.prompt, response);
  return line?.kind ?? "wrong";
}

/** The sealed questions in a deck: how many there are, and how many are mine. */
export function pickProgress(prompts: readonly LivePrompt[]): {
  readonly total: number;
  readonly mine: number;
  readonly open: boolean;
} {
  return {
    total: prompts.length,
    mine: prompts.filter((p) => p.myResponse !== undefined).length,
    open: prompts.some((p) => p.open),
  };
}
