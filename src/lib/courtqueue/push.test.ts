import { createECDH, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Notice } from "./notices";
import { deliver, type PushDoc } from "./push";
import { memoryStore } from "./store";

/** Delivery against a stand-in push service: who gets what, and forgetting gone phones. */
describe("push delivery", () => {
  const keys = () => ({
    p256dh: createECDH("prime256v1").generateKeys().toString("base64url"),
    auth: randomBytes(16).toString("base64url"),
  });

  it("sends each notice to each of the recipient's phones, and drops unsubscribed ones", async () => {
    const store = memoryStore();
    const doc: PushDoc = {
      players: {
        p1: [
          { endpoint: "https://web.push.apple.com/a", keys: keys(), at: 1 },
          {
            endpoint: "https://fcm.googleapis.com/fcm/send/b",
            keys: keys(),
            at: 1,
          },
        ],
        p2: [
          { endpoint: "https://web.push.apple.com/gone", keys: keys(), at: 1 },
        ],
        p3: [{ endpoint: "https://web.push.apple.com/c", keys: keys(), at: 1 }],
      },
    };
    await store.put("push", doc, 0);
    const calls: { url: string; headers: Record<string, string> }[] = [];
    const fetcher = (async (url: string, init: RequestInit) => {
      calls.push({ url, headers: init.headers as Record<string, string> });
      return new Response(null, { status: url.endsWith("/gone") ? 410 : 201 });
    }) as unknown as typeof fetch;
    const out = await deliver(
      [
        {
          to: ["p1", "p2"],
          title: "COURT 2 — YOU'RE UP!",
          body: "Go",
          tag: "up",
        },
      ],
      store,
      fetcher,
    );
    expect(out).toEqual({ sent: 2, failed: 0, gone: 1 });
    expect(calls.map((c) => c.url).sort()).toEqual([
      "https://fcm.googleapis.com/fcm/send/b",
      "https://web.push.apple.com/a",
      "https://web.push.apple.com/gone",
    ]);
    for (const c of calls) {
      expect(c.headers["Content-Encoding"]).toBe("aes128gcm");
      expect(c.headers.Authorization).toMatch(/^vapid t=.+, k=.+$/);
      expect(c.headers.Urgency).toBe("high");
    }
    const after = (await store.get(["push"])).get("push")!.value as PushDoc;
    expect(after.players.p2).toEqual([]);
    expect(after.players.p3).toHaveLength(1);
  });

  it("keeps Clubhouse and court notifications on separate switches", async () => {
    const store = memoryStore();
    const phone = (id: string) => [
      { endpoint: `https://web.push.apple.com/${id}`, keys: keys(), at: 1 },
    ];
    const doc: PushDoc = {
      players: {
        quiet: phone("quiet"), // courts on, chat off (the defaults)
        chatty: phone("chatty"), // courts off, every message
        pinged: phone("pinged"), // courts on, only when mentioned
      },
      prefs: {
        chatty: { courts: false, chat: "all" },
        pinged: { courts: true, chat: "mine" },
      },
    };
    await store.put("push", doc, 0);
    const urls: string[] = [];
    const fetcher = (async (url: string) => {
      urls.push(url.split("/").pop()!);
      return new Response(null, { status: 201 });
    }) as unknown as typeof fetch;
    const who = async (n: Notice) => {
      urls.length = 0;
      await deliver([n], store, fetcher);
      return [...urls].sort();
    };
    const everyone = ["quiet", "chatty", "pinged"];
    // A court call reaches whoever hasn't turned courts off — chat settings are irrelevant.
    expect(
      await who({ to: everyone, title: "up", body: "go", tag: "up" }),
    ).toEqual(["pinged", "quiet"]);
    // A Clubhouse message: the one who asked for everything, and whoever was @mentioned.
    expect(
      await who({
        kind: "chat",
        to: ["pinged"],
        everyone: { except: [] },
        title: "Ada in the Clubhouse",
        body: "hi @pinged",
        tag: "clubhouse",
      }),
    ).toEqual(["chatty", "pinged"]);
    // The author is never pinged about their own message.
    expect(
      await who({
        kind: "chat",
        to: [],
        everyone: { except: ["chatty"] },
        title: "t",
        body: "b",
        tag: "clubhouse",
      }),
    ).toEqual([]);
  });
});
