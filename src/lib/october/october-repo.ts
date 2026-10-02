import { SignedOutError } from "@/lib/data/boards-repo";
import type { OctoberKind, OctoberThing } from "./types";

/**
 * **My October, as the browser sees it.** Relative `/api/october/...` only;
 * the server decides whose October this is. A 401 becomes `SignedOutError`
 * so a caller can offer a sign-in rather than an apology — the same shape
 * as `boards-repo`.
 */
async function request(
  path: string,
  init: RequestInit | undefined,
  failure: string,
) {
  const response = await fetch(`/api/october/things${path}`, init);
  if (response.status === 401) {
    const body = await response.json().catch(() => null);
    throw new SignedOutError(
      typeof body?.message === "string"
        ? body.message
        : "Sign in to keep this.",
    );
  }
  if (!response.ok) throw new Error(failure);
  return response;
}

export async function listOctoberThings(): Promise<OctoberThing[]> {
  return (await request("", undefined, "Couldn't load your October.")).json();
}

export async function wantToDo(thing: {
  entityId: string;
  entityKind: OctoberKind;
  name: string;
  startsAt?: string | null;
}): Promise<OctoberThing> {
  return (
    await request(
      `/${encodeURIComponent(thing.entityId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityKind: thing.entityKind,
          name: thing.name,
          startsAt: thing.startsAt ?? null,
        }),
      },
      "Couldn't keep that.",
    )
  ).json();
}

export async function didThis(entityId: string): Promise<OctoberThing> {
  return (
    await request(
      `/${encodeURIComponent(entityId)}`,
      { method: "POST" },
      "Couldn't record that.",
    )
  ).json();
}

export async function forget(entityId: string): Promise<void> {
  await request(
    `/${encodeURIComponent(entityId)}`,
    { method: "DELETE" },
    "Couldn't remove that.",
  );
}

/**
 * **Give something in your October a day** — or take the day back off.
 *
 * PATCH rather than PUT because PUT is idempotent by design: saving the same
 * thing twice must never rewrite what is already there, so it cannot also be
 * how a date is set.
 */
export async function planFor(
  entityId: string,
  day: string | null,
): Promise<OctoberThing> {
  return (
    await request(
      `/${encodeURIComponent(entityId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day }),
      },
      "Couldn't plan that.",
    )
  ).json();
}
