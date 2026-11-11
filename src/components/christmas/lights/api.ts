"use client";

import type { PinView } from "@/domain/christmas/lights/model";

export interface Answer {
  readonly ok: boolean;
  readonly status: number;
  readonly pin?: PinView | null;
  readonly error?: string;
  readonly signIn?: boolean;
  readonly [k: string]: unknown;
}

/** One call to the lights API, with the refusal said in words. */
export async function send(path: string, body: unknown): Promise<Answer> {
  try {
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    return { ...data, ok: r.ok, status: r.status } as Answer;
  } catch {
    return {
      ok: false,
      status: 0,
      error: "No connection — try again in a moment.",
    };
  }
}

export const signInHref = (next: string) =>
  `/auth?next=${encodeURIComponent(next)}`;
