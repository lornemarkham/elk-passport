import { describe, expect, it } from "vitest";
import { SYCLE_VANCOUVER_2026 } from "@/domain/conference/fixtures";
import type { IdentityKey } from "@/domain/conference/types";
import { VANCOUVER_PLACES } from "@/domain/collections/vancouver";
import { curatedFacts } from "@/domain/conference-explore/explore";
import { remindersFor } from "@/domain/conference-plans/reminders";
import * as conf from "@/lib/conference/service";
import { memoryStore } from "@/lib/conference/store";
import * as chat from "@/lib/conference-chat/service";
import { chatLifecycle } from "@/lib/conference-chat/service";
import { memoryChat } from "@/lib/conference-chat/store";
import * as mem from "@/lib/conference-memories/service";
import { memoriesLifecycle } from "@/lib/conference-memories/service";
import { memoryMemories } from "@/lib/conference-memories/store";
import * as people from "@/lib/conference-people/service";
import { peopleLifecycle } from "@/lib/conference-people/service";
import { memoryPeople } from "@/lib/conference-people/store";
import * as plans from "@/lib/conference-plans/service";
import { plansLifecycle } from "@/lib/conference-plans/service";
import { memoryPlans } from "@/lib/conference-plans/store";

/**
 * The shared modules' rules, end to end on the memory stores: the morning
 * walk on two days with separate answers, invitations to selected coworkers
 * that strangers to the plan can't see, a venue vote, chat that needs a name,
 * a location that expires and stops at once, photos with reactions, and
 * "leave" forgetting all of it.
 */

const ORG: IdentityKey = "user:organiser";
const ANA: IdentityKey = "user:ana";
const BEN: IdentityKey = "user:ben";
const CAT: IdentityKey = "user:cat";
const EVE: IdentityKey = "user:eve";

// A small JPEG-shaped base64 string: the schema checks the shape and size.
const JPEG = `/9j/${"A".repeat(200)}`;

function world(start = "2026-10-26T12:00:00Z") {
  const stores = {
    plans: memoryPlans(),
    chat: memoryChat(),
    people: memoryPeople(),
    memories: memoryMemories(),
  };
  const store = memoryStore();
  let now = new Date(start);
  const lifecycle = [
    plansLifecycle(() => stores.plans),
    chatLifecycle(() => stores.chat),
    peopleLifecycle(() => stores.people),
    memoriesLifecycle(() => stores.memories),
  ];
  const base = () => ({ store, lifecycle, now });
  const curated = new Map(VANCOUVER_PLACES.map((p) => [p.id, curatedFacts(p)]));
  return {
    conf: base,
    set: (t: string) => void (now = new Date(t)),
    plans: () => ({
      conference: base(),
      store: stores.plans,
      lookup: (id: string) => curated.get(id) ?? null,
      enabled: true,
    }),
    chat: () => ({
      conference: base(),
      store: stores.chat,
      plans: stores.plans,
      enabled: true,
    }),
    people: () => ({ conference: base(), store: stores.people, enabled: true }),
    memories: () => ({
      conference: base(),
      store: stores.memories,
      plans: stores.plans,
      enabled: true,
    }),
  };
}

async function conference(w: ReturnType<typeof world>) {
  const made = await conf.createConference(w.conf(), ORG, {
    ...SYCLE_VANCOUVER_2026,
    startsOn: "2026-10-26",
    endsOn: "2026-10-29",
    modules: ["plans", "community", "people", "memories", "discover"],
  });
  if (!made.ok) throw new Error(made.error);
  const id = made.conference.id;
  const code = await conf.setAccessCode(w.conf(), ORG, id, "new");
  for (const who of [ANA, BEN, CAT])
    await conf.joinWithCode(w.conf(), who, code.ok && code.accessCode);
  for (const [who, name] of [
    [ORG, "Olivia"],
    [ANA, "Ana"],
    [BEN, "Ben"],
  ] as const)
    await conf.updateMe(w.conf(), who, id, {
      displayName: name,
      visibility: "members",
    });
  // Cat is in, and stays hidden.
  return id;
}

const memberOf = async (
  w: ReturnType<typeof world>,
  id: string,
  who: IdentityKey,
) => (await conf.homeFor(w.conf(), who, id))!.you.memberId;

const walk = {
  kind: "morning-walk",
  title: "Early risers — Vancouver morning walk",
  description: "Seawall loop, back by 8.",
  days: ["2026-10-27", "2026-10-28"],
  time: "07:00",
  meeting: "Hotel lobby",
};

describe("plans: the morning walk on two days", () => {
  it("makes one occurrence per day at 7:00 Vancouver time, and the organiser is in", async () => {
    const w = world();
    const id = await conference(w);
    const made = await plans.createPlan(w.plans(), ANA, id, walk);
    expect(made.ok).toBe(true);
    const board = await plans.readPlans(w.plans(), BEN, id);
    const p = board!.plans[0]!;
    expect(p.title).toBe(walk.title);
    expect(p.meeting?.label).toBe("Hotel lobby");
    expect(p.occurrences.map((o) => o.startsAt)).toEqual([
      "2026-10-27T14:00:00.000Z",
      "2026-10-28T14:00:00.000Z",
    ]);
    expect(p.occurrences.map((o) => o.going.map((g) => g.name))).toEqual([
      ["Ana"],
      ["Ana"],
    ]);
    expect(p.organiser).toEqual({ name: "Ana", you: false });
  });

  it("takes answers per occurrence: in Tuesday, maybe Wednesday", async () => {
    const w = world();
    const id = await conference(w);
    await plans.createPlan(w.plans(), ANA, id, walk);
    const [p] = (await plans.readPlans(w.plans(), BEN, id))!.plans;
    const [tue, wed] = p!.occurrences;
    await plans.answer(w.plans(), BEN, id, {
      planId: p!.id,
      occurrenceId: tue!.id,
      answer: "in",
    });
    await plans.answer(w.plans(), BEN, id, {
      planId: p!.id,
      occurrenceId: wed!.id,
      answer: "maybe",
    });
    const after = (await plans.readPlans(w.plans(), BEN, id))!.plans[0]!;
    expect(after.occurrences[0]!.mine).toBe("in");
    expect(after.occurrences[1]!.mine).toBe("maybe");
    expect(after.occurrences[0]!.counts).toEqual({ in: 2, maybe: 0, out: 0 });
    expect(after.occurrences[0]!.going.map((g) => [g.name, g.you])).toEqual([
      ["Ben", true],
      ["Ana", false],
    ]);
    // Taking it back.
    await plans.answer(w.plans(), BEN, id, {
      planId: p!.id,
      occurrenceId: wed!.id,
      answer: null,
    });
    const back = (await plans.readPlans(w.plans(), BEN, id))!.plans[0]!;
    expect(back.occurrences[1]!.mine).toBeNull();
  });

  it("counts a hidden coworker who's in, and never names them", async () => {
    const w = world();
    const id = await conference(w);
    await plans.createPlan(w.plans(), ANA, id, walk);
    const [p] = (await plans.readPlans(w.plans(), CAT, id))!.plans;
    await plans.answer(w.plans(), CAT, id, {
      planId: p!.id,
      occurrenceId: p!.occurrences[0]!.id,
      answer: "in",
    });
    const seenByBen = (await plans.readPlans(w.plans(), BEN, id))!.plans[0]!;
    expect(seenByBen.occurrences[0]!.counts.in).toBe(2);
    expect(seenByBen.occurrences[0]!.unnamed).toBe(1);
    expect(JSON.stringify(seenByBen)).not.toContain("Cat");
  });

  it("refuses days far from the conference, and an empty title", async () => {
    const w = world();
    const id = await conference(w);
    const far = await plans.createPlan(w.plans(), ANA, id, {
      ...walk,
      days: ["2027-03-01"],
    });
    expect(far).toMatchObject({ ok: false, error: "invalid" });
    const blank = await plans.createPlan(w.plans(), ANA, id, {
      ...walk,
      title: " ",
    });
    expect(blank).toMatchObject({ ok: false, error: "invalid" });
  });

  it("lets only its organiser (or a conference organiser) change or cancel it", async () => {
    const w = world();
    const id = await conference(w);
    const made = await plans.createPlan(w.plans(), ANA, id, walk);
    const planId = made.ok ? made.planId : "";
    expect(
      await plans.updatePlan(w.plans(), BEN, id, planId, walk),
    ).toMatchObject({ ok: false, error: "forbidden" });
    expect(await plans.cancelPlan(w.plans(), BEN, id, planId)).toMatchObject({
      ok: false,
      error: "forbidden",
    });
    // Moving Wednesday to Thursday keeps Tuesday's answers.
    const [p] = (await plans.readPlans(w.plans(), BEN, id))!.plans;
    await plans.answer(w.plans(), BEN, id, {
      planId,
      occurrenceId: p!.occurrences[0]!.id,
      answer: "in",
    });
    expect(
      (
        await plans.updatePlan(w.plans(), ANA, id, planId, {
          ...walk,
          days: ["2026-10-27", "2026-10-29"],
        })
      ).ok,
    ).toBe(true);
    const moved = (await plans.readPlans(w.plans(), BEN, id))!.plans[0]!;
    expect(moved.occurrences[0]!.mine).toBe("in");
    expect(moved.occurrences[1]!.startsAt).toBe("2026-10-29T14:00:00.000Z");
    expect((await plans.cancelPlan(w.plans(), ORG, id, planId)).ok).toBe(true);
    expect((await plans.readPlans(w.plans(), BEN, id))!.plans).toEqual([]);
  });

  it("answers a stranger, and a conference with plans switched off, as not found", async () => {
    const w = world();
    const id = await conference(w);
    expect(await plans.readPlans(w.plans(), EVE, id)).toBeNull();
    expect(await plans.createPlan(w.plans(), EVE, id, walk)).toMatchObject({
      ok: false,
      error: "not-found",
    });
    expect(
      await plans.readPlans({ ...w.plans(), enabled: false }, ANA, id),
    ).toBeNull();
  });
});

describe("invitations", () => {
  it("shows a plan for selected coworkers only to them, without a trace for anyone else", async () => {
    const w = world();
    const id = await conference(w);
    const ben = await memberOf(w, id, BEN);
    const made = await plans.createPlan(w.plans(), ANA, id, {
      kind: "lunch",
      title: "Lunch, just us",
      days: ["2026-10-27"],
      time: "12:30",
      audience: "selected",
      invited: [ben],
    });
    expect(made.ok).toBe(true);
    const planId = made.ok ? made.planId : "";
    expect((await plans.readPlans(w.plans(), BEN, id))!.plans).toHaveLength(1);
    expect((await plans.readPlans(w.plans(), ORG, id))!.plans).toHaveLength(0);
    expect((await plans.readPlans(w.plans(), CAT, id))!.plans).toHaveLength(0);
    // Not even answerable, voteable or chattable by guessing its id.
    expect(
      await plans.answer(w.plans(), CAT, id, {
        planId,
        occurrenceId: "x",
        answer: "in",
      }),
    ).toMatchObject({ error: "not-found" });
    expect(await chat.readRoom(w.chat(), ORG, id, planId)).toBeNull();
  });

  it("can't invite somebody you can't see", async () => {
    const w = world();
    const id = await conference(w);
    const cat = await memberOf(w, id, CAT);
    const r = await plans.createPlan(w.plans(), ANA, id, {
      kind: "dinner",
      title: "Dinner",
      days: ["2026-10-27"],
      time: "19:00",
      audience: "selected",
      invited: [cat],
    });
    expect(r).toMatchObject({ ok: false, error: "invalid" });
  });
});

describe("lunch: suggest, vote, choose", () => {
  it("names suggestions from Passport's own places, tallies one vote each, and lets the organiser choose", async () => {
    const w = world();
    const id = await conference(w);
    const made = await plans.createPlan(w.plans(), ANA, id, {
      kind: "lunch",
      title: "Lunch",
      days: ["2026-10-27"],
      time: "12:30",
    });
    const planId = made.ok ? made.planId : "";
    const a = await plans.suggestVenue(w.plans(), BEN, id, {
      planId,
      placeId: "curated:vancouver:chambar",
    });
    const b = await plans.suggestVenue(w.plans(), ANA, id, {
      planId,
      placeId: "curated:vancouver:miku",
    });
    expect(
      await plans.suggestVenue(w.plans(), ANA, id, {
        planId,
        placeId: "made-up-place",
      }),
    ).toMatchObject({ ok: false, error: "invalid" });
    const chambar = a.ok ? a.optionId : "";
    const miku = b.ok ? b.optionId : "";
    await plans.vote(w.plans(), BEN, id, { planId, optionId: chambar });
    await plans.vote(w.plans(), ORG, id, { planId, optionId: chambar });
    await plans.vote(w.plans(), ANA, id, { planId, optionId: miku });
    // Ana changes her mind: still one vote.
    await plans.vote(w.plans(), ANA, id, { planId, optionId: chambar });
    let p = (await plans.readPlans(w.plans(), ANA, id))!.plans[0]!;
    expect(p.options.map((o) => [o.place.name, o.votes, o.leading])).toEqual([
      ["Chambar", 3, true],
      ["Miku", 0, false],
    ]);
    expect(
      await plans.chooseVenue(w.plans(), BEN, id, {
        planId,
        optionId: chambar,
      }),
    ).toMatchObject({ error: "forbidden" });
    await plans.chooseVenue(w.plans(), ANA, id, { planId, optionId: chambar });
    p = (await plans.readPlans(w.plans(), BEN, id))!.plans[0]!;
    expect(p.venue?.name).toBe("Chambar");
    expect(p.venue && "at" in p.venue && p.venue.at).toBeTruthy();
  });
});

describe("reminders", () => {
  it("reminds only people who are in, once 'today' and once 30 minutes before", async () => {
    const w = world("2026-10-27T13:00:00Z"); // 6:00 in Vancouver
    const id = await conference(w);
    await plans.createPlan(w.plans(), ANA, id, walk);
    const board = (await plans.readPlans(w.plans(), ANA, id))!;
    const tz = board.timeZone;
    expect(
      remindersFor(board.plans, new Date("2026-10-27T13:00:00Z"), tz).map(
        (r) => [r.kind, r.title],
      ),
    ).toEqual([["today", "Morning walk is at 7:00 AM at Hotel lobby."]]);
    expect(
      remindersFor(board.plans, new Date("2026-10-27T13:30:00Z"), tz).map(
        (r) => [r.kind, r.title, r.key],
      ),
    ).toEqual([
      [
        "soon",
        "Morning walk starts in 30 minutes.",
        `${board.plans[0]!.occurrences[0]!.id}:soon`,
      ],
    ]);
    // Ben said nothing: nothing for Ben.
    const ben = (await plans.readPlans(w.plans(), BEN, id))!;
    expect(
      remindersFor(ben.plans, new Date("2026-10-27T13:30:00Z"), tz),
    ).toEqual([]);
  });
});

describe("chat", () => {
  it("lets seen members talk and react, hidden members read, and only authors or organisers unsay", async () => {
    const w = world();
    const id = await conference(w);
    expect(
      (await chat.say(w.chat(), ANA, id, { body: "Anyone for coffee?" })).ok,
    ).toBe(true);
    expect(await chat.say(w.chat(), CAT, id, { body: "me!" })).toMatchObject({
      ok: false,
      error: "forbidden",
    });
    const room = (await chat.readRoom(w.chat(), CAT, id, null))!;
    expect(room.messages.map((m) => [m.by.name, m.body])).toEqual([
      ["Ana", "Anyone for coffee?"],
    ]);
    expect(room.you.canPost).toBe(false);
    const messageId = room.messages[0]!.id;
    await chat.react(w.chat(), BEN, id, { messageId, emoji: "🙌" });
    await chat.react(w.chat(), ORG, id, { messageId, emoji: "🙌" });
    await chat.react(w.chat(), ORG, id, { messageId, emoji: "🙌" }); // toggled off
    const r = (await chat.readRoom(w.chat(), BEN, id, null))!.messages[0]!;
    expect(r.reactions).toEqual([{ emoji: "🙌", count: 1, mine: true }]);
    expect(await chat.unsay(w.chat(), BEN, id, { messageId })).toMatchObject({
      error: "forbidden",
    });
    expect((await chat.unsay(w.chat(), ORG, id, { messageId })).ok).toBe(true);
    expect(await chat.readRoom(w.chat(), EVE, id, null)).toBeNull();
  });

  it("keeps a plan's thread with the plan", async () => {
    const w = world();
    const id = await conference(w);
    const made = await plans.createPlan(w.plans(), ANA, id, walk);
    const planId = made.ok ? made.planId : "";
    await chat.say(w.chat(), BEN, id, { body: "Rain gear?", planId });
    expect(
      (await chat.readRoom(w.chat(), ANA, id, planId))!.messages.map(
        (m) => m.body,
      ),
    ).toEqual(["Rain gear?"]);
    expect((await chat.readRoom(w.chat(), ANA, id, null))!.messages).toEqual(
      [],
    );
  });
});

describe("find my people", () => {
  const here = { lat: 49.288812345, lon: -123.116612345, accuracy: 12 };

  it("shares only by choice, rounded, until it runs out", async () => {
    const w = world();
    const id = await conference(w);
    expect(
      await people.share(w.people(), CAT, id, { ...here, minutes: 30 }),
    ).toMatchObject({ ok: false, error: "forbidden" });
    expect(
      await people.share(w.people(), ANA, id, { ...here, minutes: 600 }),
    ).toMatchObject({ ok: false, error: "invalid" });
    expect(
      (await people.share(w.people(), ANA, id, { ...here, minutes: 30 })).ok,
    ).toBe(true);
    const seen = (await people.readPeople(w.people(), BEN, id))!;
    expect(seen.people.map((p) => [p.name, p.at])).toEqual([
      ["Ana", [49.2888, -123.1166]],
    ]);
    w.set("2026-10-26T12:31:00Z");
    expect((await people.readPeople(w.people(), BEN, id))!.people).toEqual([]);
    expect((await people.readPeople(w.people(), ANA, id))!.you.sharing).toBe(
      false,
    );
    // An update after it ran out shares nothing.
    expect(await people.move(w.people(), ANA, id, here)).toMatchObject({
      error: "not-found",
    });
  });

  it("stops at once, and disappears the moment the sharer stops being seen", async () => {
    const w = world();
    const id = await conference(w);
    await people.share(w.people(), ANA, id, { ...here, minutes: 60 });
    await people.share(w.people(), BEN, id, {
      lat: 49.2899,
      lon: -123.1166,
      minutes: 60,
    });
    const ben = (await people.readPeople(w.people(), BEN, id))!;
    expect(ben.people[0]!.you).toBe(true);
    expect(ben.people[1]!.kmFromYou).toBeCloseTo(0.12, 1);
    await people.stop(w.people(), ANA, id);
    expect(
      (await people.readPeople(w.people(), BEN, id))!.people.map((p) => p.name),
    ).toEqual(["You"]);
    await conf.updateMe(w.conf(), BEN, id, {
      displayName: "Ben",
      visibility: "hidden",
    });
    expect((await people.readPeople(w.people(), ANA, id))!.people).toEqual([]);
    expect(await people.readPeople(w.people(), EVE, id)).toBeNull();
  });
});

describe("memories", () => {
  it("takes photos from seen members, with captions, plans and reactions; uploader or organiser takes them down", async () => {
    const w = world();
    const id = await conference(w);
    const made = await plans.createPlan(w.plans(), ANA, id, walk);
    const planId = made.ok ? made.planId : "";
    const added = await mem.addPhoto(w.memories(), BEN, id, {
      data: JPEG,
      caption: "Sunrise at   Coal Harbour",
      planId,
    });
    expect(added.ok).toBe(true);
    expect(
      await mem.addPhoto(w.memories(), CAT, id, { data: JPEG }),
    ).toMatchObject({ error: "forbidden" });
    expect(
      await mem.addPhoto(w.memories(), ANA, id, { data: "not a jpeg" }),
    ).toMatchObject({ error: "invalid" });
    const photoId = added.ok ? added.id : "";
    await mem.reactToPhoto(w.memories(), ANA, id, photoId, "❤️");
    const album = (await mem.readAlbum(w.memories(), CAT, id))!;
    expect(album.photos[0]).toMatchObject({
      caption: "Sunrise at Coal Harbour",
      by: { name: "Ben", you: false },
      plan: { id: planId, title: walk.title },
      reactions: [{ emoji: "❤️", count: 1, mine: false }],
      canRemove: false,
    });
    const bytes = await mem.photoBytes(w.memories(), CAT, id, photoId);
    expect(bytes?.name).toMatch(
      /^sycle-vancouver-2026-sunrise-at-coal-harbour-.{6}\.jpg$/,
    );
    expect(await mem.photoBytes(w.memories(), EVE, id, photoId)).toBeNull();
    expect(await mem.removePhoto(w.memories(), ANA, id, photoId)).toMatchObject(
      { error: "forbidden" },
    );
    expect((await mem.removePhoto(w.memories(), ORG, id, photoId)).ok).toBe(
      true,
    );
  });
});

describe("private plan photos", () => {
  it("keeps a private plan's photos to the people in it, organisers included", async () => {
    const w = world();
    const id = await conference(w);
    const ben = await memberOf(w, id, BEN);
    const made = await plans.createPlan(w.plans(), ANA, id, {
      kind: "dinner",
      title: "Just us",
      days: ["2026-10-27"],
      time: "19:00",
      audience: "selected",
      invited: [ben],
    });
    const planId = made.ok ? made.planId : "";
    const added = await mem.addPhoto(w.memories(), BEN, id, {
      data: JPEG,
      planId,
    });
    const photoId = added.ok ? added.id : "";
    expect((await mem.readAlbum(w.memories(), ORG, id))!.photos).toEqual([]);
    expect(await mem.photoBytes(w.memories(), ORG, id, photoId)).toBeNull();
    expect(
      await mem.reactToPhoto(w.memories(), ORG, id, photoId, "❤️"),
    ).toMatchObject({ error: "not-found" });
    expect(await mem.removePhoto(w.memories(), ORG, id, photoId)).toMatchObject(
      { error: "not-found" },
    );
    expect((await mem.readAlbum(w.memories(), ANA, id))!.photos).toHaveLength(
      1,
    );
  });
});

describe("leaving", () => {
  it("forgets a person's plans, answers, messages, position and photos", async () => {
    const w = world();
    const id = await conference(w);
    await plans.createPlan(w.plans(), BEN, id, walk);
    await chat.say(w.chat(), BEN, id, { body: "hi" });
    await people.share(w.people(), BEN, id, {
      lat: 49.28,
      lon: -123.11,
      minutes: 60,
    });
    await mem.addPhoto(w.memories(), BEN, id, { data: JPEG });
    await conf.leave(w.conf(), BEN, id);
    expect((await plans.readPlans(w.plans(), ANA, id))!.plans).toEqual([]);
    expect((await chat.readRoom(w.chat(), ANA, id, null))!.messages).toEqual(
      [],
    );
    expect((await people.readPeople(w.people(), ANA, id))!.people).toEqual([]);
    expect((await mem.readAlbum(w.memories(), ANA, id))!.photos).toEqual([]);
  });
});
