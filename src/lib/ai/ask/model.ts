import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import { townById } from "@/domain/discovery/towns";
import {
  readAsk,
  windowFor,
  type DiscoveryAsk,
  type ReadContext,
} from "./read";

/**
 * **A model reading the same question, where one is configured.**
 *
 * Used only when `OPENAI_API_KEY` is set, and only to fill what the
 * deterministic reading left empty — "something to burn off the kids'
 * energy before dinner" has no word `readAsk` knows, and a model can tell it
 * is a child, today, a few hours, outdoors.
 *
 * ## What it may not do
 *
 * - **Name a place.** The output has no field for one. Picks are Atlas
 *   subjects chosen by evidence in `answer.ts`, every time.
 * - **Overrule what was said.** A number, a town or a day the deterministic
 *   reading found stays exactly as found; the model fills gaps only.
 * - **Invent a value.** Every field is validated against the same closed sets
 *   the page uses — a verb Atlas offers, a town in `towns.ts`, a real date —
 *   and anything else is dropped rather than repaired.
 *
 * Any failure — no key, a timeout, malformed JSON — returns the deterministic
 * reading unchanged. A broken model must never be worse than no model.
 */
const modelReading = z.object({
  hours: z.number().positive().max(24).optional(),
  company: z.enum(["alone", "child", "group"]).optional(),
  childAge: z.number().int().min(0).max(17).optional(),
  day: z.enum(["today", "tomorrow"]).optional(),
  partOfDay: z.enum(["morning", "afternoon", "evening"]).optional(),
  town: z.string().optional(),
  near: z.boolean().optional(),
  doing: z.string().optional(),
  shelter: z.enum(["indoor", "outdoor"]).optional(),
  lens: z.enum(["unusual", "drive", "kids", "time"]).optional(),
});

export type ModelReading = z.infer<typeof modelReading>;

const SYSTEM = `You read one sentence somebody typed into a local discovery app \
and return what it says about their situation, as JSON. You never suggest, \
name or describe places — another system chooses those from real records.

Return only fields the sentence supports; omit anything it does not say. \
Never guess a child's age from words like "kid" — only a stated number.

Fields:
- hours: number of hours they have
- company: "alone" | "child" | "group"
- childAge: integer, only if a number was stated
- day: "today" | "tomorrow"
- partOfDay: "morning" | "afternoon" | "evening"
- town: a town name, only if one was named
- near: true if they want somewhere close
- doing: one activity, chosen ONLY from the provided list, copied exactly
- shelter: "indoor" | "outdoor"
- lens: "unusual" (odd, hidden, surprising), "drive" (worth a trip / road trip), \
"kids" (about a child), "time" (about how long they have)`;

/**
 * Merge a validated model reading under the deterministic one. Pure, so the
 * rule — what was said wins, the model fills gaps — is tested without a key.
 */
export function fillGaps(
  floor: DiscoveryAsk,
  model: ModelReading,
  context: ReadContext,
): DiscoveryAsk {
  const filled: Record<string, unknown> = {};
  if (floor.hours === undefined && model.hours !== undefined) {
    filled.hours = model.hours;
    if (floor.window === undefined) filled.window = windowFor(model.hours);
  }
  if (floor.window === undefined && model.partOfDay && !filled.window)
    filled.window =
      model.partOfDay === "evening" ? undefined : ("half-day" as const);
  if (floor.company === undefined && model.company)
    filled.company = model.company;
  if (floor.childAge === undefined && model.childAge !== undefined)
    filled.childAge = model.childAge;
  if (floor.on === undefined && model.day) {
    filled.on =
      model.day === "today"
        ? context.today
        : new Date(Date.parse(`${context.today}T12:00:00Z`) + 86_400_000)
            .toISOString()
            .slice(0, 10);
  }
  if (floor.partOfDay === undefined && model.partOfDay)
    filled.partOfDay = model.partOfDay;
  if (floor.townId === undefined && model.town) {
    const id = model.town
      .trim()
      .toLowerCase()
      .replace(/,?\s*bc$/, "")
      .replace(/\s+/g, "-");
    if (townById(id)) filled.townId = id;
  }
  if (floor.near === undefined && model.near) filled.near = true;
  if (floor.doing === undefined && model.doing) {
    const verb = context.verbs?.find(
      (v) => v.toLowerCase() === model.doing!.trim().toLowerCase(),
    );
    if (verb) filled.doing = verb;
  }
  if (floor.shelter === undefined && model.shelter)
    filled.shelter = model.shelter;
  if (floor.lens === undefined && model.lens) filled.lens = model.lens;

  const merged = Object.fromEntries(
    Object.entries({ ...filled, ...floor }).filter(([, v]) => v !== undefined),
  );
  return merged as unknown as DiscoveryAsk;
}

export async function readAskWithModel(
  said: string,
  context: ReadContext,
): Promise<{ ask: DiscoveryAsk; by: "words" | "model" }> {
  const floor = readAsk(said, context);
  if (!process.env.OPENAI_API_KEY) return { ask: floor, by: "words" };

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 4_000,
      maxRetries: 0,
    });
    const verbs = (context.verbs ?? []).slice(0, 120).join(", ");
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_DISCOVERY_MODEL ?? "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Activities available: ${verbs || "none"}\nSentence: ${said}`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) return { ask: floor, by: "words" };
    const parsed = modelReading.safeParse(JSON.parse(raw));
    if (!parsed.success) return { ask: floor, by: "words" };
    return { ask: fillGaps(floor, parsed.data, context), by: "model" };
  } catch {
    // Deliberately silent about the sentence: it is what somebody typed, and
    // it goes nowhere but the model. The failure itself is not news.
    return { ask: floor, by: "words" };
  }
}
