// @vitest-environment node
import fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { MARKHAM } from "@/domain/date-night/adventures/markham";
import {
  addItem,
  adventureFor,
  createInvite,
  redeemInvite,
  respond,
  updateItem,
  Refused,
} from "@/lib/adventures/store";
import { momentsOf, share } from "@/app/christmas/_server/together";
import {
  addPacking,
  packingOf,
  removePacking,
  startNight,
  tickPacking,
} from "./night";
import { savePlan } from "./plan";
import { sunsetOf } from "@/domain/date-night/adventures/compose";
import { eveningOf } from "@/domain/date-night/adventures/evenings";
import {
  instantOf,
  templatePlan,
} from "@/domain/date-night/adventures/itinerary";

/**
 * **The Markham Adventure against a real database**: real GoTrue accounts,
 * real PostgREST, real Postgres with the migrations applied twice. Lorne
 * starts it and saves the itinerary, invites Jess with a one-person link;
 * Jess adds her own stop, both pack and share a memory; a stranger gets
 * nothing. Every refusal is Postgres'.
 *
 *   node docs/product/date-night/verification/stack.mjs start
 *   DATE_NIGHT_STACK_ENV=~/passport/scratch/date-night-stack/env \
 *     npx vitest run src/lib/date-night/night.stack.test.ts
 */
const ENV_FILE = process.env.DATE_NIGHT_STACK_ENV;
const env: Record<string, string> = ENV_FILE
  ? Object.fromEntries(
      fs
        .readFileSync(ENV_FILE, "utf8")
        .split("\n")
        .filter((l) => l.includes("="))
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
    )
  : {};

const client = (): SupabaseClient =>
  createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

async function signUp(name: string) {
  const db = client();
  const email = `${name}-${Date.now()}@example.test`;
  const password = "correct horse battery";
  const { data, error } = await db.auth.signUp({ email, password });
  if (error || !data.user) throw error ?? new Error("no user");
  return { id: data.user.id, db, email, password };
}

describe.skipIf(!ENV_FILE)("The Markham Adventure (real stack)", () => {
  it("runs the whole invitation and participation flow, privately", async () => {
    const lorne = await signUp("lorne");
    const jess = await signUp("jess");
    const mallory = await signUp("mallory");

    // Lorne starts it; a second tap lands on the same one.
    const id = await startNight(lorne.db, lorne.id, "Lorne", MARKHAM);
    expect(await startNight(lorne.db, lorne.id, "Lorne", MARKHAM)).toBe(id);
    const first = (await adventureFor(lorne.db, id, lorne.id))!;
    expect(first.kind).toBe("date-night-plan");
    // No loose ideas any more: the night opens on its adventures.
    expect(first.items).toEqual([]);

    // Lorne chooses King Eddie Lake: its stops become the day, in order.
    const day = MARKHAM.day!;
    const eddie = eveningOf("king-eddie")!;
    const stops = templatePlan(eddie, sunsetOf(day)!, day);
    const write = {
      label: eddie.title,
      stops: stops.map((s) => ({
        title: s.title,
        line: s.line,
        at: s.at,
        ...(s.atlasRef ? { atlasRef: s.atlasRef } : {}),
      })),
      base: [],
    };
    await savePlan(lorne.db, id, lorne.id, day, write);
    const planned = (await adventureFor(lorne.db, id, lorne.id))!;
    expect(planned.destinationLabel).toBe("King Eddie Lake");
    const onDay = planned.items
      .filter((i) => i.onDay === day.on)
      .sort((a, b) => a.position - b.position);
    expect(onDay.map((i) => i.label)).toEqual(stops.map((s) => s.title));
    expect(Date.parse(onDay[0]!.startsAt!)).toBe(
      Date.parse(instantOf(day, stops[0]!.at)),
    );
    // A stranger can't write it.
    await expect(
      savePlan(mallory.db, id, mallory.id, day, write),
    ).rejects.toBeInstanceOf(Refused);
    expect((await packingOf(lorne.db, id)).map((p) => p.label)).toEqual([
      ...MARKHAM.packing,
    ]);

    // A stranger sees and changes nothing.
    expect(await adventureFor(mallory.db, id, mallory.id)).toBeNull();
    expect(await packingOf(mallory.db, id)).toEqual([]);
    await expect(addPacking(mallory.db, id, mallory.id, "x")).rejects.toThrow();
    const itemId = onDay[0]!.id;
    await expect(
      respond(mallory.db, id, itemId, mallory.id, "in"),
    ).rejects.toThrow();
    expect(await momentsOf(mallory.db, id, mallory.id)).toEqual([]);
    const anon = await client().from("passport_adventure_packing").select("id");
    expect(anon.error ?? anon.data?.length).toBeTruthy();
    expect(anon.data ?? []).toHaveLength(0);

    // Jess gets a private, one-person link and joins with it.
    const { token } = await createInvite(lorne.db, id, lorne.id, {
      maxUses: 1,
      label: null,
      expiresInDays: null,
    });
    expect(
      await redeemInvite(jess.db, token, {
        displayName: "Jess",
        visibility: "members",
      }),
    ).toBe(id);
    expect(
      await redeemInvite(mallory.db, token, {
        displayName: "Mallory",
        visibility: "members",
      }),
    ).toBeNull();
    expect(await adventureFor(mallory.db, id, mallory.id)).toBeNull();

    // Votes show on the other side.
    await respond(jess.db, id, itemId, jess.id, "in");
    await respond(lorne.db, id, itemId, lorne.id, "maybe");
    const lorneSees = (await adventureFor(lorne.db, id, lorne.id))!;
    const row = lorneSees.items.find((i) => i.id === itemId)!;
    expect(row.responses).toMatchObject({ in: 1, maybe: 1, out: 0 });
    expect(row.yourResponse).toBe("maybe");
    expect(lorneSees.members.map((m) => m.displayName).sort()).toEqual([
      "Jess",
      "Lorne",
    ]);

    // Jess suggests; Jess cannot lock the plan; Lorne can.
    const mine = await addItem(jess.db, id, jess.id, {
      atlasRef: null,
      label: "Hot springs",
      note: null,
      status: "proposed",
      onDay: null,
      startsAt: null,
    });
    await expect(
      updateItem(jess.db, id, itemId, { status: "confirmed" }),
    ).rejects.toThrow();
    await updateItem(lorne.db, id, itemId, { status: "confirmed" });

    // Jess can't rewrite the plan, but she can add her own stop to the day,
    // and change only that.
    await expect(
      savePlan(jess.db, id, jess.id, day, write),
    ).rejects.toBeInstanceOf(Refused);
    const pie = await addItem(jess.db, id, jess.id, {
      atlasRef: null,
      label: "Pie from the bakery",
      note: null,
      status: "proposed",
      onDay: day.on,
      startsAt: instantOf(day, 19 * 60 + 50),
    });
    await updateItem(jess.db, id, pie, { label: "Pie, two forks" });
    await expect(
      updateItem(jess.db, id, onDay[1]!.id, { label: "Mine now" }),
    ).rejects.toThrow();
    expect(
      (await adventureFor(lorne.db, id, lorne.id))!.items.find(
        (i) => i.id === pie,
      ),
    ).toMatchObject({ onDay: day.on, label: "Pie, two forks" });

    // Packing: either ticks, with a name; only owner or adder removes.
    const packing = await packingOf(jess.db, id);
    await tickPacking(jess.db, id, packing[0]!.id, jess.id, true);
    const extra = await addPacking(jess.db, id, jess.id, "Extra socks");
    expect((await packingOf(lorne.db, id))[0]).toMatchObject({
      checked: true,
      checkedBy: "Jess",
    });
    await tickPacking(lorne.db, id, packing[0]!.id, lorne.id, false);
    await expect(
      removePacking(jess.db, id, packing[1]!.id),
    ).rejects.toBeInstanceOf(Refused);
    await removePacking(lorne.db, id, extra);

    // A memory, visible to both and to nobody else.
    await share(jess.db, id, jess.id, {
      kind: "moment",
      text: "Cold. Worth it.",
      photo: null,
      challengeId: null,
      atlasRef: null,
    });
    expect(
      (await momentsOf(lorne.db, id, lorne.id)).map((m) => m.text),
    ).toEqual(["Cold. Worth it."]);

    // Everything survives a brand-new session on each side.
    const again = client();
    await again.auth.signInWithPassword({
      email: jess.email,
      password: jess.password,
    });
    const back = (await adventureFor(again, id, jess.id))!;
    expect(back.items.find((i) => i.id === mine)).toBeTruthy();
    expect(back.items.find((i) => i.id === itemId)?.status).toBe("confirmed");
    expect(back.items.find((i) => i.id === itemId)?.yourResponse).toBe("in");
    expect((await packingOf(again, id))[0]!.checked).toBe(false);
  }, 60_000);
});
