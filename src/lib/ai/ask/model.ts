import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import { townById } from "@/domain/discovery/towns";
import { ACTIVITIES, activityByKey } from "@/domain/discovery/activities";
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
  pair: z.boolean().optional(),
  driveMinutes: z.number().positive().max(600).optional(),
  avoid: z.array(z.string()).max(6).optional(),
  free: z.boolean().optional(),
  gentle: z.boolean().optional(),
  different: z.boolean().optional(),
  lens: z
    .enum([
      "unusual",
      "drive",
      "kids",
      "on",
      "couple",
      "group",
      "time",
      "surprise",
      "adventure",
    ])
    .optional(),
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
- doing: one activity key, chosen ONLY from the provided list, copied exactly
- avoid: activity keys from the same list they said they do NOT want
- shelter: "indoor" | "outdoor"
- pair: true if it is the two of them — a partner, a date
- driveMinutes: the most minutes they will travel, if they said
- free: true if they want it to cost nothing
- gentle: true for older company, or nothing strenuous
- different: true if they want something unlike what they were just shown
- lens: "unusual" (odd, hidden, never tried), "drive" (worth a trip / road \
trip), "kids" (about a child), "on" (what is on / happening / events), \
"couple" (a partner or a date), "group" (friends), "time" (about how long \
they have), "surprise" (bored, no idea, surprise me), "adventure" (thrills)

Earlier sentences, where given, are context for reading the last one only: \
"about three hours" after "something with my daughter" is three hours. \
Return what the LAST sentence says, read in that light.`;

/**
 * **An activity the model named, exactly** — a key, a label, or one of the
 * words an activity is known by. Nothing looser: "Submarine tours" is not
 * Tours, it is a model reaching for something Atlas does not hold.
 */
function namedActivity(raw: string) {
  const said = raw.trim().toLowerCase();
  return (
    activityByKey(said) ??
    ACTIVITIES.find(
      (a) => a.label.toLowerCase() === said || a.words.includes(said),
    )
  );
}

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
    const activity = namedActivity(model.doing);
    if (activity) filled.doing = activity.key;
  }
  if (floor.avoid === undefined && model.avoid?.length) {
    const keys = model.avoid
      .map((key) => namedActivity(key)?.key)
      .filter((key): key is NonNullable<typeof key> => key !== undefined);
    if (keys.length > 0) filled.avoid = [...new Set(keys)];
  }
  if (floor.driveMinutes === undefined && model.driveMinutes !== undefined)
    filled.driveMinutes = Math.round(model.driveMinutes);
  if (floor.free === undefined && model.free) filled.free = true;
  if (floor.gentle === undefined && model.gentle) filled.gentle = true;
  if (floor.different === undefined && model.different) filled.different = true;
  if (floor.shelter === undefined && model.shelter)
    filled.shelter = model.shelter;
  // "For two" never sits beside a child: the age row would be lying.
  if (floor.pair === undefined && model.pair && floor.company !== "child")
    filled.pair = true;
  if (floor.lens === undefined && model.lens) filled.lens = model.lens;

  const merged = Object.fromEntries(
    Object.entries({ ...filled, ...floor }).filter(([, v]) => v !== undefined),
  );
  return merged as unknown as DiscoveryAsk;
}

export async function readAskWithModel(
  said: string,
  context: ReadContext,
  /** The conversation's earlier sentences, oldest first. Context only. */
  previous: readonly string[] = [],
): Promise<{ ask: DiscoveryAsk; by: "words" | "model" }> {
  const floor = readAsk(said, context);
  if (!process.env.OPENAI_API_KEY) return { ask: floor, by: "words" };

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 4_000,
      maxRetries: 0,
    });
    const activities = ACTIVITIES.map((a) => `${a.key} (${a.label})`).join(
      ", ",
    );
    const earlier = previous
      .slice(-6)
      .map((line) => `- ${line.slice(0, 300)}`)
      .join("\n");
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_DISCOVERY_MODEL ?? "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Activities: ${activities}\n${earlier ? `Earlier sentences:\n${earlier}\n` : ""}${context.expecting ? `They were just asked about: ${context.expecting}\n` : ""}Last sentence: ${said}`,
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
