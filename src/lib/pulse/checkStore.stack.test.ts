import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { sealSource } from "./checkSeal";
import {
  CONFIRMATIONS,
  addPost,
  correctCheck,
  createCheck,
  isCheckCreator,
  postToken,
  reportPost,
  type Stores,
} from "./checkService";
import { postgresCheckStore } from "./checkStore";
import { newDevice } from "./service";
import { postgresStore, pulseRpc } from "./store";

/**
 * Pulse Check's store through real PostgREST and the anon key, as production
 * reaches it. Runs only beside the local stack with every People's Pulse
 * migration applied, then `20261120000000_passport_pulse_check.sql` (twice):
 *
 *   export STACK=~/scratch/m906/pulse-stack
 *   node docs/product/badminton/verification/stack.mjs apply supabase/migrations/20261120000000_passport_pulse_check.sql
 *   set -a; . $STACK/env; set +a
 *   npx vitest run src/lib/pulse/checkStore.stack.test.ts
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const live = !!URL && !!ANON && URL.includes("127.0.0.1:573");
const KEY = "pulse-local-stack-key-0123456789";
const CONFIRM = Object.fromEntries(
  Object.keys(CONFIRMATIONS).map((k) => [k, true]),
);

describe.skipIf(!live)("Pulse Check on Postgres", () => {
  // Built only beside the stack: describe bodies run even when skipped.
  const stores: Stores = live
    ? {
        pulses: postgresStore(URL!, ANON!, KEY),
        checks: postgresCheckStore(pulseRpc(URL!, ANON!, KEY)),
      }
    : (null as unknown as Stores);
  const now = () => new Date();
  // Each run is its own network, so the daily limit of earlier runs can't stop it.
  const ip = `ip:stack-${Math.random()}`;
  const source = {
    url: "https://www.interiorhealth.ca/news/occupancy",
    title: "Hospital occupancy update",
    site: "Interior Health",
    published: "2026-11-14",
    readAt: new Date().toISOString(),
    excerpts: [
      "Kelowna General Hospital was at 147 per cent of funded capacity.",
    ],
    figureFound: true,
  };

  async function publish(device = newDevice(), file?: string) {
    const r = await createCheck(
      stores,
      KEY,
      {
        claim: {
          text: "Kelowna General Hospital is operating at 147% capacity.",
          form: "screenshot",
          seenOn: "facebook",
        },
        why: "Saw it on Facebook. Is it right?",
        scope: { kind: "city", province: "BC", city: "Kelowna" },
        ask: "fact",
        sources: [{ sealed: sealSource(KEY, source), stance: "supports" }],
        assessment: "supported",
        confirm: CONFIRM,
        file,
        openedAt: Date.now() - 60_000,
      },
      { device, ip, now: now() },
    );
    if (!r.ok) throw new Error(r.message);
    return r;
  }

  it("publishes the Pulse, its check and a private file together", async () => {
    const device = newDevice();
    const jpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.alloc(2000, 7),
    ]);
    const r = await publish(device, jpeg.toString("base64"));
    const pulse = await stores.pulses.get(r.pulse.id);
    expect(pulse?.kind).toBe("check");
    const stored = await stores.checks.get(r.pulse.id);
    expect(stored?.check.slug).toBe(r.check.slug);
    expect(stored?.check.sources[0]?.excerpts[0]).toMatch(/147 per cent/);
    expect(stored?.version).toBe(1);
    const file = await stores.checks.file(r.pulse.id);
    expect(file?.mime).toBe("image/jpeg");
    expect(file?.bytes.equals(jpeg)).toBe(true);
    expect(await isCheckCreator(stores.checks, KEY, r.pulse.id, device)).toBe(
      true,
    );
    expect(
      await isCheckCreator(stores.checks, KEY, r.pulse.id, newDevice()),
    ).toBe(false);
  });

  it("takes corrections from the asker and moderators only, from the version read", async () => {
    const device = newDevice();
    const r = await publish(device);
    const stranger = await correctCheck(
      stores,
      KEY,
      r.pulse.id,
      { note: "This is wrong!" },
      { device: newDevice() },
      now(),
    );
    expect(!stranger.ok && stranger.error).toBe("forbidden");
    const mine = await correctCheck(
      stores,
      KEY,
      r.pulse.id,
      { note: "Added the date of the figure." },
      { device },
      now(),
    );
    expect(mine.ok).toBe(true);
    const mod = await correctCheck(
      stores,
      KEY,
      r.pulse.id,
      { note: "Moderator looked at the wording." },
      "moderator",
      now(),
    );
    expect(mod.ok).toBe(true);
    const stored = await stores.checks.get(r.pulse.id);
    expect(stored?.version).toBe(3);
    expect(stored?.check.corrections.map((c) => c.by)).toEqual([
      "asker",
      "moderator",
    ]);
    expect(
      await stores.checks.update(r.pulse.id, stored!.check, 1, "moderator"),
    ).toBe("conflict");
  });

  it("lists checks with counts, not their whole investigation", async () => {
    const r = await publish();
    const listed = await stores.checks.list(50);
    const row = listed.find((c) => c.pulseId === r.pulse.id);
    expect(row).toMatchObject({
      slug: r.check.slug,
      assessment: "supported",
      ask: "fact",
      sources: 1,
      corrections: 0,
      votes: 0,
      posts: 0,
      scope: { kind: "city", province: "BC", city: "Kelowna" },
    });
  });

  it("holds a discussion: posts, mine, limits, three reports hide", async () => {
    const r = await publish();
    const id = r.pulse.id;
    const me = newDevice();
    const tok = postToken(KEY, id, new Date(Date.now() - 5_000));
    const p = await addPost(
      stores,
      KEY,
      id,
      {
        type: "experience",
        body: "Hallway beds when I was there on Monday.",
        token: tok,
      },
      { device: me, ip, now: now() },
    );
    if (!p.ok) throw new Error(p.message);
    const mineList = await stores.checks.posts(
      id,
      (await import("./checkService")).authorOf(KEY, me),
    );
    expect(mineList).toEqual([
      expect.objectContaining({
        id: p.post.id,
        type: "experience",
        mine: true,
      }),
    ]);
    expect((await stores.checks.posts(id, null))[0]?.mine).toBeUndefined();
    for (const d of [newDevice(), newDevice(), newDevice()])
      expect(await reportPost(stores.checks, KEY, p.post.id, "spam", d)).toBe(
        "ok",
      );
    expect(await stores.checks.posts(id, null)).toEqual([]);
    const reported = await stores.checks.reportedPosts();
    expect(reported.find((x) => x.id === p.post.id)).toMatchObject({
      status: "hidden",
      reports: 3,
    });
    expect(await stores.checks.setPostStatus(p.post.id, "live")).toBe(true);
    expect((await stores.checks.posts(id, null)).length).toBe(1);
  });

  it("counts visits and shares as aggregates only", async () => {
    await stores.checks.count("visit", "facebook");
    await stores.checks.count("share", "copy-comment");
    const rows = await stores.checks.usage(7);
    expect(
      rows.some(
        (r) => r.event === "visit" && r.source === "facebook" && r.n >= 1,
      ),
    ).toBe(true);
    await expect(
      stores.checks.count("visit", "somewhere-else"),
    ).rejects.toThrow();
  });

  it("is closed to the anon key and to the wrong key", async () => {
    const anon = createClient(URL!, ANON!, { auth: { persistSession: false } });
    for (const table of [
      "passport_pulse_checks",
      "passport_pulse_check_files",
      "passport_pulse_posts",
      "passport_pulse_check_events",
    ]) {
      const { data, error } = await anon.from(table).select("*").limit(1);
      expect(error ?? (data?.length === 0 ? "empty" : null)).toBeTruthy();
      expect(data ?? []).toEqual([]);
    }
    const { error } = await anon.rpc("passport_pulse_check_file", {
      p_key: "x".repeat(32),
      p_id: "abcdefgh",
    });
    expect(error?.code).toBe("28000");
  });
});
