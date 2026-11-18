import type { Complete } from "./sourceCheck";
import type { Reasons } from "./modes";

/**
 * **An optional AI summary of a decision's reasons.** Offered only where
 * Passport already has its approved AI service (OPENAI_API_KEY, as for
 * Insiders and the source check), only when someone presses the button, and
 * only over the reasons the page already shows (released in steps of five).
 * It is labelled as AI and as possibly wrong. Without the key there is no
 * button and the plain word counts stand alone.
 */

const SYSTEM =
  'You summarise anonymous reasons people gave when answering a yes/no/not-yet question for a friend. Use ONLY the reasons given. For each answer that has reasons, write one plain sentence saying what those people mostly said. Do not add advice of your own, do not invent reasons, do not name or guess who anyone is, and do not say which answer is right. If an answer has no reasons, leave it out. Reply as JSON: {"lines": [{"answer": string, "summary": string}]}.';

export interface AiSummary {
  readonly lines: readonly {
    readonly answer: string;
    readonly summary: string;
  }[];
  /** How many reasons it was given. */
  readonly basedOn: number;
}

export const MIN_REASONS_FOR_AI = 5;

export async function summariseReasons(
  question: string,
  reasons: Reasons,
  complete: Complete,
): Promise<AiSummary | null> {
  const groups = (reasons.groups ?? []).filter((g) => g.quotes.length > 0);
  const basedOn = groups.reduce((a, g) => a + g.quotes.length, 0);
  if (basedOn < MIN_REASONS_FOR_AI) return null;
  const reply = await complete(
    SYSTEM,
    `Question: ${question}\n\n${groups
      .map(
        (g) =>
          `Answer "${g.label}":\n${g.quotes.map((q) => `- ${q}`).join("\n")}`,
      )
      .join("\n\n")}`,
  );
  try {
    const parsed = JSON.parse(reply.replace(/^```(?:json)?|```$/g, "").trim());
    const labels = new Set(groups.map((g) => g.label));
    const lines = (Array.isArray(parsed.lines) ? parsed.lines : [])
      .filter(
        (l: unknown): l is { answer: string; summary: string } =>
          !!l &&
          typeof (l as { answer?: unknown }).answer === "string" &&
          typeof (l as { summary?: unknown }).summary === "string" &&
          labels.has((l as { answer: string }).answer),
      )
      .map((l: { answer: string; summary: string }) => ({
        answer: l.answer,
        summary: l.summary.trim().slice(0, 280),
      }));
    return lines.length ? { lines, basedOn } : null;
  } catch {
    return null;
  }
}
