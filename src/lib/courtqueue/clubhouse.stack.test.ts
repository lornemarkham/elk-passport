import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { chat, chatHistory, live, register, signIn, act } from "./service";
import { postgresStore, setStoreForTests } from "./store";
import type { LiveView } from "./view";

/**
 * The Clubhouse through the real service on a real Postgres (PostgREST, the
 * public anon key, the SECURITY DEFINER functions) — and across a restart of
 * the whole database stack. Two phases, with the restart between them:
 *
 *   node docs/product/badminton/verification/stack.mjs start
 *   set -a; . ~/passport/scratch/courtqueue-stack/env; set +a
 *   STACK_PHASE=write npx vitest run src/lib/courtqueue/clubhouse.stack.test.ts
 *   node docs/product/badminton/verification/stack.mjs restart
 *   STACK_PHASE=read  npx vitest run src/lib/courtqueue/clubhouse.stack.test.ts
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PHASE = process.env.STACK_PHASE;
const on = !!URL && !!ANON && URL.includes("127.0.0.1:573") && !!PHASE;
const KEY = "courtqueue-local-stack-key-0123456789";
const MEMO = "/tmp/clubhouse-stack-memo.json";

describe.skipIf(!on)("Clubhouse on Postgres, across a restart", () => {
  const store = on ? postgresStore(URL!, ANON!, KEY) : null!;

  it.runIf(PHASE === "write")(
    "writes accounts, chat and a challenge",
    async () => {
      setStoreForTests(store);
      const run = Math.random().toString(36).slice(2, 6);
      const names = ["Ana", "Bo", "Cy", "Di"].map((n) => `${n} ${run}`);
      const cookies: string[] = [];
      for (const name of names) {
        const out = await register({ name, pin: "2468", skill: 3 });
        if (!out.ok) throw new Error(out.error);
        cookies.push(out.value.cookie);
      }
      const ids = cookies.map((c) => c.split(".")[0]!);
      expect(
        (await chat(cookies[0], { type: "post", text: "Season opener 🏸" })).ok,
      ).toBe(true);
      await new Promise((r) => setTimeout(r, 1100));
      expect(
        (
          await chat(cookies[1], {
            type: "post",
            text: "Bring the good shuttles",
          })
        ).ok,
      ).toBe(true);
      const v = (await live(cookies[0], null)) as LiveView;
      const night = v.sessions[0]!;
      const sent = await act(cookies[0], {
        scope: "session",
        sessionId: night.id,
        cmd: {
          type: "challenge",
          slots: ids as [string, string, string, string],
          note: "Winner picks the snacks",
        },
      });
      expect(sent.ok).toBe(true);
      fs.writeFileSync(MEMO, JSON.stringify({ names, night: night.id, run }));
    },
  );

  it.runIf(PHASE === "read")(
    "reads it all back after the stack restarted, with a fresh store",
    async () => {
      setStoreForTests(postgresStore(URL!, ANON!, KEY));
      const memo = JSON.parse(fs.readFileSync(MEMO, "utf8")) as {
        names: string[];
        night: string;
      };
      // The accounts survived: the same names and PINs sign in.
      const back = await signIn(memo.names[2], "2468");
      expect(back.ok).toBe(true);
      const cookie = (back as { value: { cookie: string } }).value.cookie;
      const v = (await live(cookie, null)) as LiveView;
      expect(v.me!.name).toBe(memo.names[2]);
      const texts = v.clubhouse!.messages.map((m) => m.text);
      expect(texts).toContain("Season opener 🏸");
      expect(texts).toContain("Bring the good shuttles");
      // …and so did the challenge, and its Clubhouse card.
      const ch = v.sessions
        .find((s) => s.id === memo.night)!
        .challenges.find((c) => c.note === "Winner picks the snacks")!;
      expect(ch.status).toBe("pending");
      expect(
        v.clubhouse!.messages.some((m) => m.ref?.challenge === ch.id),
      ).toBe(true);
      // New talk lands after the old.
      await new Promise((r) => setTimeout(r, 1100));
      expect(
        (await chat(cookie, { type: "post", text: "Back after the restart" }))
          .ok,
      ).toBe(true);
      const again = (await live(cookie, null)) as LiveView;
      expect(again.clubhouse!.messages.at(-1)!.text).toBe(
        "Back after the restart",
      );
      expect(
        (await chatHistory(cookie, again.clubhouse!.messages.at(-1)!.id))!
          .messages.length,
      ).toBeGreaterThanOrEqual(0);
    },
  );
});
