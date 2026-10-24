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

/** Why the model gave nothing usable — logged, never shown, never the key. */
export type ModelMiss =
  | "no-key"
  | "limited"
  | "timeout"
  | "connection"
  | "empty"
  | "cut-off"
  | "rejected"
  | `http-${number}`
  | "error";

function missOf(error: unknown): ModelMiss {
  // By name and shape, not `instanceof`: the SDK's classes are not always
  // the ones a bundle or a test loaded.
  const e = error as {
    name?: unknown;
    status?: unknown;
    constructor?: { name?: string };
  } | null;
  const name = e?.constructor?.name ?? e?.name;
  if (name === "APIConnectionTimeoutError") return "timeout";
  if (name === "APIConnectionError") return "connection";
  if (typeof e?.status === "number") return `http-${e.status}`;
  return "error";
}

/**
 * Says once per cause and instance why Chirp Bot fell back to the library
 * (2026-10-23: every failure was swallowed by a bare `catch`, so nobody
 * could ever tell why the model path had never produced a line). The
 * message carries the cause and the provider's own error text, which never
 * contains the key; not the request, not anybody's words.
 */
const told = new Set<string>();
export function tell(miss: ModelMiss, detail?: string): void {
  if (miss === "limited" || miss === "no-key") return;
  if (told.has(miss)) return;
  told.add(miss);
  console.warn(
    `[hockey] chirp bot model fell back to the library: ${miss}${detail ? ` (${scrub(detail).slice(0, 200)})` : ""}`,
  );
}

/** A provider's error can quote a masked key ("sk-ab***yz"): drop even that. */
export function scrub(text: string): string {
  return text.replace(/\b(sk|key|rk)-[A-Za-z0-9_*-]+/gi, "$1-…");
}

/** Bounded knobs, read per call so a deploy's env is what counts. */
function settings() {
  const ms = Number(process.env.OPENAI_CHIRP_TIMEOUT_MS);
  const effort = process.env.OPENAI_CHIRP_REASONING_EFFORT;
  return {
    model: process.env.OPENAI_CHIRP_MODEL || "gpt-4o-mini",
    timeout: Number.isFinite(ms) && ms >= 1_000 ? Math.min(ms, 20_000) : 4_000,
    // Reasoning models spend tokens thinking before they write; without
    // this a small budget can come back empty (seen: a local qwen3 returned
    // "" every time until told "none").
    reasoningEffort:
      effort && /^(none|minimal|low|medium|high)$/.test(effort)
        ? effort
        : undefined,
  };
}

export async function askModel(
  request: string,
  who: string,
  now = Date.now(),
): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!perPerson.take(who, now) || !perInstance.take("all", now)) return null;
  const { model, timeout, reasoningEffort } = settings();
  try {
    // OPENAI_BASE_URL, when set, is honoured by the client: an
    // OpenAI-compatible endpoint (used to verify this path against a local
    // model, 2026-10-23).
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout,
      maxRetries: 0,
    });
    const completion = await client.chat.completions.create({
      model,
      temperature: 1,
      // Not `max_tokens`: reasoning models refuse it; every chat model
      // takes this.
      max_completion_tokens: 300,
      response_format: { type: "json_object" },
      ...(reasoningEffort
        ? { reasoning_effort: reasoningEffort as "low" }
        : {}),
      messages: [
        { role: "system", content: PERSONA },
        { role: "user", content: request },
      ],
    });
    const choice = completion.choices[0];
    const content = choice?.message?.content?.trim();
    if (!content) {
      tell(choice?.finish_reason === "length" ? "cut-off" : "empty", model);
      return null;
    }
    return content;
  } catch (error) {
    tell(missOf(error), error instanceof Error ? error.message : undefined);
    return null;
  }
}
