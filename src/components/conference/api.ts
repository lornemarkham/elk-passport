/**
 * Client calls to `/api/conferences`, and what to tell a person when one
 * fails. One place for the words, so "wrong code" reads the same everywhere.
 */
export type Call<T> =
  | ({ ok: true } & T)
  | {
      ok: false;
      /** The server's error code, e.g. `signed-out`. */
      error: string;
      message: string;
      issues?: { path: string; message: string }[];
    };

const WORDS: Record<string, string> = {
  closed: "Conferences aren't open here yet.",
  "signed-out": "Sign in to Passport first, then come back to this.",
  "not-found": "That conference isn't here, or you're not in it.",
  forbidden: "Only organisers can do that.",
  invalid: "Something there doesn't look right.",
  "wrong-code": "That's not a code we know. Check the invitation.",
  "dead-link":
    "That link has stopped working. Ask the organiser for a new one.",
  "slow-down":
    "Too many tries. Have a coffee and try again in fifteen minutes.",
  "last-organiser":
    "You're the only organiser. Delete the conference instead, or hand it over first.",
};

export async function call<T extends object>(
  method: "POST" | "PATCH" | "DELETE",
  url: string,
  body?: unknown,
): Promise<Call<T>> {
  try {
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await r.json().catch(() => ({}))) as {
      error?: string;
      issues?: { path: string; message: string }[];
    } & T;
    if (r.ok) return { ok: true, ...data };
    return {
      ok: false,
      error: data.error ?? "unknown",
      message: WORDS[data.error ?? ""] ?? "That didn't work. Try again?",
      ...(data.issues ? { issues: data.issues } : {}),
    };
  } catch {
    return {
      ok: false,
      error: "offline",
      message: "Couldn't reach Passport. Are you online?",
    };
  }
}
