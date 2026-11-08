// @vitest-environment node
import fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { createAdventure, createInvite } from "@/lib/adventures/store";
import { standings } from "@/domain/snow/scoring";
import { act, inviteLink, joinDay, loadDay, photoOf, startDay } from "./shared";

/**
 * **Powder Day on two phones, against a real database**: real GoTrue
 * accounts, real PostgREST, real Postgres with the migrations applied twice.
 * Lorne starts a snow day, Jess joins from a link on her own account, and
 * they plan, vote, chat, predict, compete and share memories in the SAME day.
 * A stranger and a Hockey Night member get nothing. Every refusal that is not
 * a sentence from `plan()` is Postgres'.
 *
 *   node docs/product/snow/verification/stack.mjs start
 *   SNOW_STACK_ENV=~/passport/scratch/snow-stack/env \
 *     npx vitest run src/app/snow/_server/shared.stack.test.ts
 */
const ENV_FILE = process.env.SNOW_STACK_ENV?.replace(
  /^~/,
  process.env.HOME ?? "",
);
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
  const { data, error } = await db.auth.signUp({
    email: `${name}-${Date.now()}@example.test`,
    password: "correct horse battery",
  });
  if (error || !data.user) throw error ?? new Error("no user");
  return { id: data.user.id, db };
}

const NOW = "2026-12-20T09:00:00.000Z";
const rider = {
  discipline: "snowboard",
  ability: "beginner",
  ownGear: false,
} as const;

describe.skipIf(!ENV_FILE)("Powder Day on two phones (real stack)", () => {
  it("is one shared day: plan, vote, chat, predict, compete, remember — privately", async () => {
    const lorne = await signUp("lorne");
    const jess = await signUp("jess");
    const mallory = await signUp("mallory");

    // ---- crew and invitations
    const id = await startDay(lorne.db, {
      title: "Powder Day",
      name: "Lorne",
      discipline: "ski",
      ability: "advanced",
      ownGear: true,
    });
    expect(id).toMatch(/^[a-f0-9]{32}$/);
    const token = await inviteLink(lorne.db, id, lorne.id);
    expect(
      await joinDay(jess.db, jess.id, token, { name: "Jess", ...rider }),
    ).toBe(id);
    // A second tap on the same link changes nothing, not even her profile.
    expect(
      await act(
        jess.db,
        id,
        jess.id,
        {
          type: "updatePerson",
          id: (await loadDay(jess.db, id, jess.id)).me,
          patch: { ability: "intermediate" },
        },
        NOW,
      ),
    ).toMatchObject({ ok: true });
    expect(
      await joinDay(jess.db, jess.id, token, { name: "Jess", ...rider }),
    ).toBe(id);

    const L = () => loadDay(lorne.db, id, lorne.id);
    const J = () => loadDay(jess.db, id, jess.id);
    const [l0, j0] = [await L(), await J()];
    expect(l0.isOwner).toBe(true);
    expect(j0.isOwner).toBe(false);
    expect(l0.day.people.map((p) => p.name)).toEqual(["Lorne", "Jess"]);
    expect(j0.day.people).toEqual(l0.day.people);
    expect(j0.day.people[1]).toMatchObject({
      ability: "intermediate",
      discipline: "snowboard",
    });
    // Nobody's user id is in what a phone receives.
    expect(JSON.stringify(j0)).not.toContain(lorne.id);
    expect(JSON.stringify(l0)).not.toContain(jess.id);

    // A stranger, and a link made for a different kind of adventure, get nothing.
    await expect(loadDay(mallory.db, id, mallory.id)).rejects.toThrow();
    const hockey = await createAdventure(lorne.db, {
      kind: "hockey-night",
      title: "Game",
      displayName: "Lorne",
      startsOn: null,
      endsOn: null,
      timeZone: null,
      destinationLabel: null,
      destinationTownId: null,
    });
    const hockeyLink = (
      await createInvite(lorne.db, hockey, lorne.id, {
        label: null,
        maxUses: 5,
        expiresInDays: 1,
      })
    ).token;
    expect(
      await joinDay(mallory.db, mallory.id, hockeyLink, {
        name: "Mallory",
        ...rider,
      }),
    ).toBeNull();

    // ---- plan and votes
    const proposed = await act(
      jess.db,
      id,
      jess.id,
      {
        type: "propose",
        proposal: {
          id: "x",
          topic: "mountain",
          label: "Big White",
          by: (await J()).me,
        },
      },
      NOW,
    );
    expect(proposed.ok).toBe(true);
    await act(
      lorne.db,
      id,
      lorne.id,
      {
        type: "propose",
        proposal: {
          id: "x",
          topic: "mountain",
          label: "Silver Star",
          by: l0.me,
        },
      },
      NOW,
    );
    const options = (await L()).day.proposals.filter(
      (p) => p.topic === "mountain",
    );
    expect(options.map((p) => p.label)).toEqual(["Big White", "Silver Star"]);
    const [bigWhite, silver] = options;

    // Activities are a stored topic too (20261108000000_passport_snow_activity).
    const activity = await act(
      jess.db,
      id,
      jess.id,
      {
        type: "propose",
        proposal: {
          id: "x",
          topic: "activity",
          label: "Tube Town",
          by: j0.me,
          source: "atlas",
        },
      },
      NOW,
    );
    expect(activity.ok).toBe(true);
    const tubeTown = (await L()).day.proposals.find(
      (p) => p.topic === "activity",
    );
    expect(tubeTown?.label).toBe("Tube Town");
    await act(
      jess.db,
      id,
      jess.id,
      { type: "vote", proposalId: tubeTown!.id, personId: j0.me, on: true },
      NOW,
    );
    expect((await L()).day.votes[tubeTown!.id]).toEqual([j0.me]);

    await act(
      lorne.db,
      id,
      lorne.id,
      { type: "vote", proposalId: bigWhite.id, personId: l0.me, on: true },
      NOW,
    );
    await act(
      jess.db,
      id,
      jess.id,
      { type: "vote", proposalId: bigWhite.id, personId: j0.me, on: true },
      NOW,
    );
    expect((await J()).day.votes[bigWhite.id]).toHaveLength(2);
    // Backing another option moves her vote; one vote per person per topic.
    await act(
      jess.db,
      id,
      jess.id,
      { type: "vote", proposalId: silver.id, personId: j0.me, on: true },
      NOW,
    );
    const afterMove = (await L()).day.votes;
    expect(afterMove[bigWhite.id]).toEqual([l0.me]);
    expect(afterMove[silver.id]).toEqual([j0.me]);

    // Only the host decides — and a moved plan tells everyone once.
    const nope = await act(
      jess.db,
      id,
      jess.id,
      {
        type: "choose",
        topic: "mountain",
        proposalId: bigWhite.id,
        by: j0.me,
        changeId: "c1",
      },
      NOW,
    );
    expect(nope).toEqual({ ok: false, reason: "Only the host can do that." });
    await act(
      lorne.db,
      id,
      lorne.id,
      {
        type: "choose",
        topic: "mountain",
        proposalId: bigWhite.id,
        by: l0.me,
        changeId: "c1",
      },
      NOW,
    );
    await act(
      lorne.db,
      id,
      lorne.id,
      {
        type: "choose",
        topic: "mountain",
        proposalId: silver.id,
        by: l0.me,
        changeId: "c2",
      },
      NOW,
    );
    const moved = (await J()).day;
    expect(moved.chosen.mountain).toBe(silver.id);
    expect(
      moved.announcements.filter((a) => a.kind === "change").map((a) => a.text),
    ).toEqual(["Mountain changed to Silver Star."]);

    // ---- one date, set by the host, seen by the guest
    await act(
      lorne.db,
      id,
      lorne.id,
      { type: "when", date: "2026-12-27", meetTime: "07:45" },
      NOW,
    );
    expect((await J()).day).toMatchObject({
      date: "2026-12-27",
      meetTime: "07:45",
    });
    expect(
      (
        await act(
          jess.db,
          id,
          jess.id,
          { type: "when", date: "2026-12-28" },
          NOW,
        )
      ).ok,
    ).toBe(false);

    // ---- chat, both ways; you cannot speak as the other person
    await act(
      jess.db,
      id,
      jess.id,
      { type: "say", id: "x", by: j0.me, text: "Bringing the hot chocolate" },
      NOW,
    );
    await act(
      lorne.db,
      id,
      lorne.id,
      { type: "say", id: "x", by: l0.me, text: "Leaving at 7:45 sharp" },
      NOW,
    );
    expect(
      (await L()).day.chat.map(
        (m) => `${m.by === l0.me ? "L" : "J"}:${m.text}`,
      ),
    ).toEqual(["J:Bringing the hot chocolate", "L:Leaving at 7:45 sharp"]);
    expect(
      (
        await act(
          jess.db,
          id,
          jess.id,
          { type: "say", id: "x", by: l0.me, text: "I am Lorne" },
          NOW,
        )
      ).ok,
    ).toBe(false);
    const chatNow = (await J()).day.chat;
    expect(
      (
        await act(
          jess.db,
          id,
          jess.id,
          { type: "unsay", id: chatNow[1].id },
          NOW,
        )
      ).ok,
    ).toBe(false);
    await act(
      lorne.db,
      id,
      lorne.id,
      { type: "unsay", id: chatNow[0].id },
      NOW,
    ); // the host moderates
    expect((await J()).day.chat).toHaveLength(1);

    // ---- predictions: call before, settle after, same points on both phones
    await act(
      lorne.db,
      id,
      lorne.id,
      {
        type: "predict",
        id: "x",
        text: "Someone falls over on the very first run.",
        by: l0.me,
      },
      NOW,
    );
    const prediction = (await J()).day.predictions[0];
    await act(
      jess.db,
      id,
      jess.id,
      { type: "guess", id: prediction.id, personId: j0.me, says: true },
      NOW,
    );
    await act(
      lorne.db,
      id,
      lorne.id,
      { type: "guess", id: prediction.id, personId: l0.me, says: false },
      NOW,
    );
    expect((await L()).day.predictions[0].guesses).toEqual({
      [j0.me]: true,
      [l0.me]: false,
    });
    await act(
      lorne.db,
      id,
      lorne.id,
      { type: "settle", id: prediction.id, outcome: true },
      NOW,
    );
    // Settled means settled: no guessing after the fact.
    expect(
      (
        await act(
          jess.db,
          id,
          jess.id,
          { type: "guess", id: prediction.id, personId: j0.me, says: false },
          NOW,
        )
      ).ok,
    ).toBe(false);

    // ---- challenges and points
    await act(
      jess.db,
      id,
      jess.id,
      {
        type: "customChallenge",
        id: "x",
        title: "Ride the whole run backwards, slowly",
        by: j0.me,
      },
      NOW,
    );
    const custom = (await L()).day.customChallenges[0];
    await act(
      jess.db,
      id,
      jess.id,
      {
        type: "complete",
        challengeId: custom.id,
        personId: j0.me,
      },
      NOW,
    );
    await act(
      jess.db,
      id,
      jess.id,
      {
        type: "complete",
        challengeId: custom.id,
        personId: j0.me,
      },
      NOW,
    ); // twice: still one
    expect(
      (
        await act(
          lorne.db,
          id,
          lorne.id,
          {
            type: "complete",
            challengeId: custom.id,
            personId: j0.me,
          },
          NOW,
        )
      ).ok,
    ).toBe(false);
    const [onL, onJ] = [await L(), await J()];
    expect(onL.day.completions).toHaveLength(1);
    expect(standings(onL.day)).toEqual(standings(onJ.day));
    const jessPoints = standings(onJ.day).find((s) => s.person.id === j0.me)!;
    expect(jessPoints.points).toBeGreaterThan(
      standings(onJ.day).find((s) => s.person.id === l0.me)!.points,
    );

    // ---- memories: both add, both see, strangers cannot
    const jpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";
    await act(
      jess.db,
      id,
      jess.id,
      {
        type: "photo",
        photo: {
          id: "x",
          personId: j0.me,
          caption: "First chair",
          src: jpeg,
          at: NOW,
        },
      },
      NOW,
    );
    await act(
      lorne.db,
      id,
      lorne.id,
      {
        type: "moment",
        moment: {
          id: "x",
          personId: l0.me,
          text: "Jess landed her first turn",
          at: NOW,
        },
      },
      NOW,
    );
    const shared = (await L()).day;
    expect(shared.moments.map((m) => m.text)).toEqual([
      "Jess landed her first turn",
    ]);
    expect(shared.photos).toHaveLength(1);
    expect(shared.photos[0].src).toBe(
      `/snow/api/${id}/photo/${shared.photos[0].id}`,
    );
    expect(await photoOf(lorne.db, id, shared.photos[0].id)).toBe(jpeg);
    await expect(
      photoOf(mallory.db, id, shared.photos[0].id),
    ).rejects.toThrow();

    // ---- Postgres refuses what a modified client would try
    const forged = await jess.db.from("passport_snow_posts").insert({
      adventure_id: id,
      user_id: lorne.id,
      kind: "chat",
      body: "forged",
    });
    expect(forged.error?.code).toBe("42501");
    const stranger = await mallory.db
      .from("passport_snow_posts")
      .insert({ adventure_id: id, kind: "chat", body: "hello" });
    expect(stranger.error).not.toBeNull();
    // Announcements are the core's notices, and the core's rule is the
    // owner's alone: a crew member cannot announce, even calling Postgres.
    const notice = await jess.db.from("passport_adventure_notices").insert({
      adventure_id: id,
      kind: "snow-change",
      headline: "CHANGE OF PLANS",
    });
    expect(notice.error?.code).toBe("42501");
    const asChat = await jess.db
      .from("passport_snow_posts")
      .insert({ adventure_id: id, kind: "change", body: "CHANGE OF PLANS" });
    expect(asChat.error?.code).toBe("23514");
    const decide = await jess.db
      .from("passport_snow_decisions")
      .upsert({ adventure_id: id, topic: "meals", proposal_id: bigWhite.id });
    expect(decide.error).not.toBeNull();
    // A member of a Hockey Night cannot write snow rows into it.
    const hockeyWrite = await lorne.db
      .from("passport_snow_posts")
      .insert({ adventure_id: hockey, kind: "chat", body: "x" });
    expect(hockeyWrite.error).not.toBeNull();
    for (const table of [
      "posts",
      "proposals",
      "votes",
      "completions",
      "people",
      "predictions",
      "guesses",
    ]) {
      const read = await mallory.db
        .from(`passport_snow_${table}`)
        .select("*")
        .eq("adventure_id", id);
      expect({ table, rows: read.data }).toEqual({ table, rows: [] });
    }
    // The core's tables hold this day's notices and photos: a stranger gets
    // none of them, and neither does a signed-out visitor.
    for (const table of ["notices", "moments"]) {
      const read = await mallory.db
        .from(`passport_adventure_${table}`)
        .select("*")
        .eq("adventure_id", id);
      expect({ table, rows: read.data }).toEqual({ table, rows: [] });
    }
    const strangerPhoto = await mallory.db
      .from("passport_adventure_moments")
      .insert({ adventure_id: id, kind: "moment", body: "let me in" });
    expect(strangerPhoto.error?.code).toBe("42501");
    const anon = await client().from("passport_snow_posts").select("*");
    expect(anon.data ?? []).toEqual([]);
    const anonCore = await client()
      .from("passport_adventure_moments")
      .select("*");
    expect(anonCore.data ?? []).toEqual([]);
    // The tables hold no way to re-attribute a row or move it to another day.
    const rehome = await jess.db
      .from("passport_snow_predictions")
      .update({ adventure_id: hockey })
      .eq("id", prediction.id);
    expect(rehome.error).not.toBeNull();

    // ---- leaving takes your own data and leaves the group's
    const leaving = await act(
      jess.db,
      id,
      jess.id,
      { type: "removePerson", id: j0.me },
      NOW,
    );
    expect(leaving.ok).toBe(true);
    const after = (await L()).day;
    expect(after.people.map((p) => p.name)).toEqual(["Lorne"]);
    expect(after.completions).toEqual([]);
    expect(after.photos).toEqual([]);
    expect(Object.values(after.votes).flat()).toEqual([l0.me]);
    expect(after.chat.map((m) => m.text)).toEqual(["Leaving at 7:45 sharp"]);
    expect(after.predictions[0].guesses).toEqual({ [l0.me]: false });
    await expect(loadDay(jess.db, id, jess.id)).rejects.toThrow();
  }, 60_000);

  it("changes the plan all at once or not at all, and takes raster photos only", async () => {
    const lorne = await signUp("lorne");
    const jess = await signUp("jess");
    const host = {
      name: "Lorne",
      discipline: "ski",
      ability: "advanced",
      ownGear: true,
    } as const;

    // A start that Postgres refuses half way leaves no half-made day.
    const mine = async () =>
      (await lorne.db.from("passport_adventures").select("id")).data?.length;
    const none = await mine();
    const broken = await lorne.db.rpc("passport_snow_start", {
      p_title: "Half a day",
      p_display_name: "Lorne",
      p_discipline: "sled",
      p_ability: "advanced",
      p_own_gear: true,
      p_note: null,
    });
    expect(broken.error?.code).toBe("23514");
    expect(await mine()).toBe(none);
    const signedOut = await client().rpc("passport_snow_start", {
      p_title: "x",
      p_display_name: "x",
      p_discipline: "ski",
      p_ability: "advanced",
      p_own_gear: true,
      p_note: null,
    });
    expect(signedOut.error).not.toBeNull();

    const id = await startDay(lorne.db, { title: "Atomic", ...host });
    const l = await loadDay(lorne.db, id, lorne.id);
    expect(l.day.people[0]).toMatchObject({
      name: "Lorne",
      ability: "advanced",
    });
    await joinDay(jess.db, jess.id, await inviteLink(lorne.db, id, lorne.id), {
      name: "Jess",
      ...rider,
    });
    for (const label of ["Big White", "Silver Star"])
      await act(
        lorne.db,
        id,
        lorne.id,
        {
          type: "propose",
          proposal: { id: "x", topic: "mountain", label, by: l.me },
        },
        NOW,
      );
    const [bigWhite, silver] = (await loadDay(lorne.db, id, lorne.id)).day
      .proposals;
    const choose = (proposalId: string, changeId: string) =>
      act(
        lorne.db,
        id,
        lorne.id,
        { type: "choose", topic: "mountain", proposalId, by: l.me, changeId },
        NOW,
      );
    expect((await choose(bigWhite.id, "c1")).ok).toBe(true);

    // A lock-in whose "plan changed" notice cannot be stored must not move
    // the mountain either. (Postgres refuses a headline over the core's 120.)
    const refused = await lorne.db.rpc("passport_snow_decide", {
      p_adventure: id,
      p_topic: "mountain",
      p_proposal: silver.id,
      p_set_when: true,
      p_starts_on: "2027-02-02",
      p_meet_time: null,
      p_notice: "x".repeat(121),
    });
    expect(refused.error?.code).toBe("23514");
    const j = await loadDay(jess.db, id, jess.id);
    expect(j.day.chosen.mountain).toBe(bigWhite.id);
    expect(j.day.date).toBeUndefined();
    expect(j.day.announcements.filter((a) => a.kind === "change")).toEqual([]);

    // Through the app the same move lands whole: the lock, and one notice —
    // the core's, so Jess sees it as a plan change.
    expect((await choose(silver.id, "c2")).ok).toBe(true);
    const moved = await loadDay(jess.db, id, jess.id);
    expect(moved.day.chosen.mountain).toBe(silver.id);
    expect(
      moved.day.announcements.filter((a) => a.kind === "change"),
    ).toHaveLength(1);
    const core = await lorne.db
      .from("passport_adventure_notices")
      .select("kind, ask_ack")
      .eq("adventure_id", id);
    expect(core.data).toEqual([{ kind: "snow-change", ask_ack: false }]);

    // Chat is limited per person per minute, and a refused line says so.
    for (let i = 0; i < 20; i++)
      await act(
        jess.db,
        id,
        jess.id,
        { type: "say", id: "x", by: j.me, text: `line ${i}` },
        NOW,
      );
    expect(
      await act(
        jess.db,
        id,
        jess.id,
        { type: "say", id: "x", by: j.me, text: "one too many" },
        NOW,
      ),
    ).toEqual({ ok: false, reason: "Easy — give it a few seconds." });

    // Only the host settles the plan, even calling Postgres directly.
    const sneaky = await jess.db.rpc("passport_snow_decide", {
      p_adventure: id,
      p_topic: "mountain",
      p_proposal: bigWhite.id,
      p_set_when: true,
      p_starts_on: "2027-01-01",
      p_meet_time: null,
      p_notice: null,
    });
    expect(sneaky.error?.code).toBe("42501");
    expect((await loadDay(jess.db, id, jess.id)).day.chosen.mountain).toBe(
      silver.id,
    );

    // An SVG is a document that can run script: Postgres will not hold one.
    // Photos live on the core's table; Snow's guard holds them to rasters.
    const svg = await jess.db.from("passport_adventure_moments").insert({
      adventure_id: id,
      kind: "photo",
      body: "",
      photo: "data:image/svg+xml;base64,PHN2Zy8+",
    });
    expect(svg.error?.code).toBe("23514");
    const jpeg = await jess.db.from("passport_adventure_moments").insert({
      adventure_id: id,
      kind: "photo",
      body: "",
      photo: "data:image/jpeg;base64,/9j/2w==",
    });
    expect(jpeg.error).toBeNull();

    // The guard is a snow-day rule only: a day of any other kind keeps the
    // core's own, so Christmas and Hockey are not changed by this release.
    const other = await createAdventure(lorne.db, {
      kind: "christmas",
      title: "Not snow",
      displayName: "Lorne",
      startsOn: null,
      endsOn: null,
      timeZone: null,
      destinationLabel: null,
      destinationTownId: null,
    });
    const elsewhere = await lorne.db.from("passport_adventure_moments").insert({
      adventure_id: other,
      kind: "tradition",
      body: "core rules",
    });
    expect(elsewhere.error).toBeNull();

    // Leaving takes what you shared on a snow day; the host's notice stays.
    await act(jess.db, id, jess.id, { type: "removePerson", id: j.me }, NOW);
    const left = await lorne.db
      .from("passport_adventure_moments")
      .select("id")
      .eq("adventure_id", id);
    expect(left.data).toEqual([]);
    const kept = await lorne.db
      .from("passport_adventure_notices")
      .select("id")
      .eq("adventure_id", id);
    expect(kept.data).toHaveLength(1);
  }, 60_000);
});
