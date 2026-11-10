import "server-only";
import OpenAI from "openai";
import { KINDS } from "@/domain/insiders/model";
import type { Draft } from "@/domain/insiders/extract";

/**
 * **What an AI may add to a submission**: copying, never knowing.
 *
 * Two jobs, both optional — without `OPENAI_API_KEY` the rules in
 * `src/domain/insiders/extract.ts` do all the reading and the form says so.
 *
 * - `transcribePoster` reads the words on a poster or photo, verbatim. The
 *   rules then read those words exactly as they read typed text, so a date
 *   from a poster is a date the poster states.
 * - `readSubmission` fills fields the rules left empty, from closed sets
 *   where there are any. `mergeReading` throws away any value it gives that
 *   does not appear in the text.
 *
 * The photo itself is not kept: only the words read from it.
 */

const MODEL = "gpt-4o-mini";

function client(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  return key ? new OpenAI({ apiKey: key }) : null;
}

export const aiAvailable = () => !!process.env.OPENAI_API_KEY;

export async function transcribePoster(
  dataUrl: string,
): Promise<string | null> {
  const ai = client();
  if (!ai) return null;
  const response = await ai.chat.completions.create({
    model: MODEL,
    temperature: 0,
    max_tokens: 800,
    messages: [
      {
        role: "system",
        content:
          "Transcribe every word printed on this poster or photo, line by line, exactly as written, including dates, times, places, names and web addresses. Do not add, explain, summarise or correct anything. If there is no readable text, answer with nothing.",
      },
      {
        role: "user",
        content: [{ type: "image_url", image_url: { url: dataUrl } }],
      },
    ],
  });
  return response.choices[0]?.message.content?.trim() || null;
}

export async function readSubmission(
  text: string,
  today: string,
): Promise<Partial<Draft> | null> {
  const ai = client();
  if (!ai) return null;
  const response = await ai.chat.completions.create({
    model: MODEL,
    temperature: 0,
    max_tokens: 400,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You turn a local's note about something to do into fields. Copy only what the text states; leave a field out rather than guess.",
          `Today is ${today}. Fields (all optional): kind (one of ${KINDS.join(", ")}), title (the thing's own name), town, venue, interests (short lower-case activity words), organizer (only if the text names who runs it), organizerUrl, registrationUrl (only links present in the text), starts and ends (YYYY-MM-DD, only for a date the text states), schedule (a recurring rhythm in the text's words).`,
          "Answer with one JSON object.",
        ].join(" "),
      },
      { role: "user", content: text.slice(0, 4000) },
    ],
  });
  try {
    const raw = JSON.parse(
      response.choices[0]?.message.content ?? "{}",
    ) as Record<string, unknown>;
    const str = (k: string) =>
      typeof raw[k] === "string" && raw[k] ? (raw[k] as string) : undefined;
    const kind = str("kind");
    const out: Partial<Draft> = {
      interests: Array.isArray(raw.interests)
        ? raw.interests
            .filter((i): i is string => typeof i === "string")
            .slice(0, 6)
        : [],
    };
    if (kind && (KINDS as readonly string[]).includes(kind))
      out.kind = kind as Draft["kind"];
    for (const k of [
      "title",
      "town",
      "venue",
      "organizer",
      "organizerUrl",
      "registrationUrl",
      "starts",
      "ends",
      "schedule",
    ] as const) {
      const v = str(k);
      if (v) (out as Record<string, unknown>)[k] = v;
    }
    return out;
  } catch {
    return null;
  }
}
