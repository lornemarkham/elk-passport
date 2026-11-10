import "server-only";
import { after } from "next/server";
import type { Notice } from "./notices";
import { courtStore, storeKey, type DocStore } from "./store";
import {
  sendPush,
  vapidFromSeed,
  validSubscription,
  type PushSubscriptionJSON,
  type Vapid,
} from "./webpush";

/**
 * **Push notifications for CourtQueue.** Who allowed them, on which phones,
 * kept in one document (`push`) beside the club; and delivering a batch of
 * notices after the response has gone, so a tap is never slowed by Apple's
 * or Google's servers.
 *
 * The VAPID keys come from the CourtQueue server key, so production needs
 * nothing new. A phone that unsubscribed (the push service answers 404 or
 * 410) is forgotten on the next send.
 */

const PUSH = "push";
const SUBJECT = "https://gohaveaday.com/badminton";
const PER_PLAYER = 4;

interface Stored extends PushSubscriptionJSON {
  readonly at: number;
}

export interface PushDoc {
  players: Record<string, Stored[]>;
}

const g = globalThis as unknown as { __cqVapid?: Vapid | null };

function vapid(): Vapid | null {
  if (g.__cqVapid !== undefined) return g.__cqVapid;
  const seed =
    storeKey() ??
    (process.env.NODE_ENV !== "production" ||
    process.env.COURTQUEUE_STORE === "memory"
      ? "courtqueue-development-only"
      : null);
  g.__cqVapid = seed ? vapidFromSeed(seed) : null;
  return g.__cqVapid;
}

/** What a browser subscribes with. Null when push can't work here. */
export const vapidPublicKey = () => vapid()?.publicKey ?? null;

async function readPush(store: DocStore) {
  const d = (await store.get([PUSH])).get(PUSH);
  return {
    doc: (d?.value as PushDoc | undefined) ?? { players: {} },
    version: d?.version ?? 0,
  };
}

async function changePush(store: DocStore, fn: (doc: PushDoc) => PushDoc) {
  for (let attempt = 0; attempt < 12; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, Math.random() * 80));
    const { doc, version } = await readPush(store);
    if (await store.put(PUSH, fn(structuredClone(doc)), version)) return true;
  }
  return false;
}

export async function subscribe(playerId: string, sub: unknown) {
  if (!validSubscription(sub))
    return {
      ok: false as const,
      error: "That phone can't take notifications.",
    };
  const clean: Stored = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    at: Date.now(),
  };
  const ok = await changePush(courtStore(), (doc) => {
    // One endpoint belongs to one player: a shared phone moves to whoever
    // signed in last.
    for (const id of Object.keys(doc.players))
      doc.players[id] = doc.players[id]!.filter(
        (s) => s.endpoint !== clean.endpoint,
      );
    doc.players[playerId] = [...(doc.players[playerId] ?? []), clean].slice(
      -PER_PLAYER,
    );
    return doc;
  });
  return ok
    ? { ok: true as const, value: null }
    : { ok: false as const, error: "Busy — try again." };
}

export async function unsubscribe(playerId: string, endpoint: unknown) {
  await changePush(courtStore(), (doc) => {
    doc.players[playerId] = (doc.players[playerId] ?? []).filter(
      (s) => s.endpoint !== endpoint,
    );
    return doc;
  });
  return { ok: true as const, value: null };
}

export async function subscribedPlayers(store: DocStore): Promise<string[]> {
  const { doc } = await readPush(store);
  return Object.entries(doc.players)
    .filter(([, subs]) => subs.length > 0)
    .map(([id]) => id);
}

export async function isSubscribed(playerId: string, endpoint: string) {
  const { doc } = await readPush(courtStore());
  return (doc.players[playerId] ?? []).some((s) => s.endpoint === endpoint);
}

/** Send now. Returns how many phones were reached, for tests and logs. */
export async function deliver(
  notices: readonly Notice[],
  store: DocStore = courtStore(),
  fetcher: typeof fetch = fetch,
): Promise<{ sent: number; failed: number; gone: number }> {
  const v = vapid();
  const tally = { sent: 0, failed: 0, gone: 0 };
  if (!v || !notices.length) return tally;
  const { doc } = await readPush(store);
  const gone = new Set<string>();
  await Promise.all(
    notices.flatMap((n) =>
      n.to.flatMap((id) =>
        (doc.players[id] ?? []).map(async (sub) => {
          const r = await sendPush(
            v,
            SUBJECT,
            sub,
            { title: n.title, body: n.body, tag: n.tag, url: "/badminton" },
            { urgency: "high", ttlSeconds: 900 },
            fetcher,
          );
          tally[r] += 1;
          if (r === "gone") gone.add(sub.endpoint);
        }),
      ),
    ),
  );
  if (gone.size)
    await changePush(store, (d) => {
      for (const id of Object.keys(d.players))
        d.players[id] = d.players[id]!.filter((s) => !gone.has(s.endpoint));
      return d;
    });
  return tally;
}

/** Send after the response, when there's a request to hang it on. */
export function sendLater(notices: readonly Notice[]) {
  if (!notices.length) return;
  const job = () =>
    deliver(notices).then(
      () => undefined,
      (e) => console.error("courtqueue-push", e),
    );
  try {
    after(job);
  } catch {
    void job();
  }
}
