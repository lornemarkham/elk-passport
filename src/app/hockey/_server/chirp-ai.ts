import "server-only";
import OpenAI from "openai";
import { Limiter } from "@/domain/hockey/chirp";
import { PERSONA } from "@/domain/hockey/chirp-voice";

/**
 * **Asking a model for Chirp Bot's words, when one is configured.**
 *
 * The same provider and shape as Discovery's reader (`lib/ai/ask/model.ts`):
 * OpenAI, `OPENAI_API_KEY` on the server only, a small model, a short
 * timeout and no retries. Any failure — no key, a timeout, bad JSON, a
 * limit reached — returns null and the caller uses the library. A broken
 * model is never worse than no model.
 *
 * Cost is bounded twice: per person (six requests in ten minutes), and per
 * server instance (two hundred an hour). What Chirp Bot *posts* is bounded
 * separately, and persistently, by the database (`chirp.ts`).
 */

const perPerson = new Limiter(10 * 60_000, 6);
const perInstance = new Limiter(60 * 60_000, 200);

export function modelConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function askModel(
  request: string,
  who: string,
  now = Date.now(),
): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!perPerson.take(who, now) || !perInstance.take("all", now)) return null;
  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 4_000,
      maxRetries: 0,
    });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_CHIRP_MODEL ?? "gpt-4o-mini",
      temperature: 1,
      max_tokens: 300,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PERSONA },
        { role: "user", content: request },
      ],
    });
    return completion.choices[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}
