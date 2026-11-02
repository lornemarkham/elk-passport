import { describe, expect, it } from "vitest";
import { applyAction, type Action, type SnowDay } from "./day";
import { assemble, parseAction, plan, type SharedRows } from "./shared";

const NOW = "2026-12-20T09:00:00.000Z";
const U = {
  lorne: "user-lorne-secret",
  jess: "user-jess-secret",
  gone: "user-gone",
};

const rows = (over: Partial<SharedRows> = {}): SharedRows => ({
  adventure: {
    id: "a".repeat(32),
    title: "Powder Day",
    starts_on: null,
    created_at: NOW,
  },
  members: [
    {
      user_id: U.jess,
      member_id: "m-jess",
      role: "participant",
      display_name: "Jess",
      joined_at: "2026-12-20T08:00:00Z",
    },
    {
      user_id: U.lorne,
      member_id: "m-lorne",
      role: "owner",
      display_name: "Lorne",
      joined_at: "2026-12-20T07:00:00Z",
    },
  ],
  day: null,
  people: [
    {
      user_id: U.jess,
      discipline: "snowboard",
      ability: "beginner",
      own_gear: false,
      note: null,
    },
  ],
  proposals: [],
  votes: [],
  decisions: [],
  posts: [],
  challenges: [],
  completions: [],
  moments: [],
  predictions: [],
  guesses: [],
  checkins: [],
  packed: [],
  ideas: [],
  idea_votes: [],
  songs: [],
  ...over,
});

describe("assemble", () => {
  it("puts the host first, defaults a missing profile, and never carries a user id", () => {
    const day = assemble(
      rows({
        proposals: [
          {
            id: "p1",
            user_id: U.jess,
            topic: "mountain",
            label: "Big White",
            detail: null,
            source: "crew",
            created_at: NOW,
          },
        ],
        votes: [
          { user_id: U.lorne, proposal_id: "p1" },
          { user_id: U.gone, proposal_id: "p1" },
        ],
        posts: [
          {
            id: "c1",
            user_id: U.gone,
            kind: "chat",
            body: "from someone who left",
            created_at: NOW,
          },
        ],
      }),
    );
    expect(
      day.people.map((p) => [p.id, p.name, p.discipline, p.ability]),
    ).toEqual([
      ["m-lorne", "Lorne", "ski", "intermediate"],
      ["m-jess", "Jess", "snowboard", "beginner"],
    ]);
    expect(day.votes.p1).toEqual(["m-lorne"]); // the one who left is dropped
    expect(day.chat[0]).toMatchObject({
      by: "",
      text: "from someone who left",
    });
    expect(JSON.stringify(day)).not.toMatch(/user-/);
  });

  it("splits announcements (newest first) from chat (oldest first)", () => {
    const day = assemble(
      rows({
        posts: [
          {
            id: "1",
            user_id: U.lorne,
            kind: "chat",
            body: "one",
            created_at: "2026-12-20T10:00:00Z",
          },
          {
            id: "2",
            user_id: U.lorne,
            kind: "announcement",
            body: "older",
            created_at: "2026-12-20T10:01:00Z",
          },
          {
            id: "3",
            user_id: U.lorne,
            kind: "change",
            body: "newer",
            created_at: "2026-12-20T10:02:00Z",
          },
          {
            id: "4",
            user_id: U.jess,
            kind: "chat",
            body: "two",
            created_at: "2026-12-20T10:03:00Z",
          },
        ],
      }),
    );
    expect(day.chat.map((m) => m.text)).toEqual(["one", "two"]);
    expect(day.announcements.map((a) => [a.text, a.kind])).toEqual([
      ["newer", "change"],
      ["older", "announcement"],
    ]);
  });

  it("serves photos by a members-only path, never inline", () => {
    const day = assemble(
      rows({
        moments: [
          {
            id: "ph1",
            user_id: U.jess,
            kind: "photo",
            body: "first chair",
            created_at: NOW,
          },
        ],
      }),
    );
    expect(day.photos[0].src).toBe(`/snow/api/${"a".repeat(32)}/photo/ph1`);
  });

  it("derives the same points from the same rows for everyone", () => {
    const r = rows({
      predictions: [
        {
          id: "q",
          user_id: U.lorne,
          body: "Someone falls over",
          outcome: true,
          created_at: NOW,
        },
      ],
      guesses: [
        { prediction_id: "q", user_id: U.jess, says: true },
        { prediction_id: "q", user_id: U.lorne, says: false },
      ],
    });
    expect(assemble(r)).toEqual(assemble(r));
    expect(assemble(r).predictions[0]).toMatchObject({
      outcome: true,
      guesses: { "m-jess": true, "m-lorne": false },
    });
  });
});

describe("plan: who may do what", () => {
  const base = assemble(
    rows({
      proposals: [
        {
          id: "p1",
          user_id: U.jess,
          topic: "mountain",
          label: "Big White",
          detail: null,
          source: null,
          created_at: NOW,
        },
        {
          id: "p2",
          user_id: U.lorne,
          topic: "mountain",
          label: "Silver Star",
          detail: null,
          source: null,
          created_at: NOW,
        },
      ],
    }),
  );
  const host = { me: "m-lorne", isOwner: true };
  const guest = { me: "m-jess", isOwner: false };
  const vote = (personId: string): Action => ({
    type: "vote",
    proposalId: "p1",
    personId,
    on: true,
  });

  it("only lets you act as yourself", () => {
    expect(plan(base, vote("m-lorne"), guest, NOW)).toEqual({
      ok: false,
      reason: "You can only do that as yourself.",
    });
    const mine = plan(base, vote("m-jess"), guest, NOW);
    expect(mine).toMatchObject({
      ok: true,
      ops: [{ k: "vote", topic: "mountain", proposalId: "p1" }],
    });
  });

  it("keeps the host's decisions with the host", () => {
    const choose: Action = {
      type: "choose",
      topic: "mountain",
      proposalId: "p1",
      by: "m-jess",
      changeId: "c",
    };
    expect(plan(base, choose, guest, NOW)).toEqual({
      ok: false,
      reason: "Only the host can do that.",
    });
    expect(
      plan(base, { type: "title", title: "Mine now" }, guest, NOW).ok,
    ).toBe(false);
    expect(
      plan(
        base,
        {
          type: "choose",
          topic: "mountain",
          proposalId: "p1",
          by: "m-lorne",
          changeId: "c",
        },
        host,
        NOW,
      ).ok,
    ).toBe(true);
  });

  it("lets the host moderate what others added, and nobody else", () => {
    expect(plan(base, { type: "withdraw", id: "p2" }, guest, NOW).ok).toBe(
      false,
    );
    expect(plan(base, { type: "withdraw", id: "p1" }, guest, NOW).ok).toBe(
      true,
    );
    expect(plan(base, { type: "withdraw", id: "p1" }, host, NOW).ok).toBe(true);
  });

  it("does not add people by hand: they join by invitation", () => {
    const add: Action = {
      type: "addPerson",
      person: {
        id: "x",
        name: "Pat",
        discipline: "ski",
        ability: "beginner",
        ownGear: true,
      },
    };
    expect(plan(base, add, host, NOW)).toMatchObject({
      ok: false,
      reason: expect.stringContaining("invite link"),
    });
  });

  it("settles a prediction only for its author or the host", () => {
    const withCall = applyAction(
      base,
      {
        type: "predict",
        id: "q",
        text: "We take a group photo at the top.",
        by: "m-lorne",
      },
      NOW,
    );
    if (!withCall.ok) throw new Error("setup");
    const id = withCall.day.predictions[0].id;
    expect(
      plan(withCall.day, { type: "settle", id, outcome: true }, guest, NOW).ok,
    ).toBe(false);
    expect(
      plan(withCall.day, { type: "settle", id, outcome: true }, host, NOW).ok,
    ).toBe(true);
  });

  it("turns choosing a changed plan into a decision, a date and one notice", () => {
    let day: SnowDay = {
      ...base,
      proposals: [
        ...base.proposals,
        { id: "d1", topic: "date", label: "2026-12-27", by: "m-lorne" },
      ],
    };
    const first = plan(
      day,
      {
        type: "choose",
        topic: "mountain",
        proposalId: "p1",
        by: "m-lorne",
        changeId: "c1",
      },
      host,
      NOW,
    );
    if (!first.ok) throw new Error("setup");
    day = first.day;
    const moved = plan(
      day,
      {
        type: "choose",
        topic: "mountain",
        proposalId: "p2",
        by: "m-lorne",
        changeId: "c2",
      },
      host,
      NOW,
    );
    expect(moved).toMatchObject({
      ok: true,
      ops: [
        { k: "decide", topic: "mountain", proposalId: "p2" },
        { k: "post", kind: "change", text: "Mountain changed to Silver Star." },
      ],
    });
    const dated = plan(
      base.proposals.length
        ? {
            ...base,
            proposals: [
              ...base.proposals,
              { id: "d1", topic: "date", label: "2026-12-27", by: "m-lorne" },
            ],
          }
        : base,
      {
        type: "choose",
        topic: "date",
        proposalId: "d1",
        by: "m-lorne",
        changeId: "c3",
      },
      host,
      NOW,
    );
    expect(dated).toMatchObject({
      ok: true,
      ops: [{ k: "decide" }, { k: "when", date: "2026-12-27" }],
    });
  });

  it("still refuses nonsense the same way the local screen does", () => {
    expect(
      plan(
        base,
        { type: "say", id: "x", by: "m-jess", text: "   " },
        guest,
        NOW,
      ),
    ).toEqual({ ok: false, reason: "Write something first." });
  });
});

describe("parseAction", () => {
  it("accepts what the screen sends and nothing else", () => {
    const ok: unknown[] = [
      { type: "say", id: "1", by: "m", text: "hi" },
      { type: "vote", proposalId: "p", personId: "m", on: true },
      { type: "guess", id: "q", personId: "m", says: null },
      { type: "settle", id: "q", outcome: false },
      {
        type: "choose",
        topic: "meals",
        proposalId: null,
        by: "m",
        changeId: "c",
      },
      {
        type: "updatePerson",
        id: "m",
        patch: { ability: "advanced", ownGear: false },
      },
    ];
    for (const a of ok) expect(parseAction(a)).toEqual(a);
    const bad: unknown[] = [
      null,
      "say",
      [],
      {},
      { type: "nope" },
      { type: "say", id: 1, by: "m", text: "hi" },
      { type: "say", id: "1", by: "m", text: "x".repeat(500) },
      { type: "vote", proposalId: "p", personId: "m", on: "yes" },
      {
        type: "choose",
        topic: "bogus",
        proposalId: null,
        by: "m",
        changeId: "c",
      },
      { type: "updatePerson", id: "m", patch: { isOwner: true } },
      { type: "addPerson", person: {} },
      {
        type: "photo",
        photo: {
          id: "1",
          personId: "m",
          caption: "",
          src: "http://evil/x.png",
        },
      },
    ];
    for (const a of bad) expect(parseAction(a)).toBeNull();
  });

  it("understands every action type the screen can send", () => {
    // Typed over the whole union: adding an Action without a sample here is a
    // compile error, and a sample the parser drops fails the test, so a new
    // action cannot ship as a 400 on somebody's phone.
    const samples: Record<Action["type"], Action> = {
      title: { type: "title", title: "T" },
      when: { type: "when", date: "2026-12-27", meetTime: "07:45" },
      addPerson: {
        type: "addPerson",
        person: {
          id: "x",
          name: "P",
          discipline: "ski",
          ability: "beginner",
          ownGear: true,
        },
      },
      updatePerson: { type: "updatePerson", id: "m", patch: { note: "n" } },
      removePerson: { type: "removePerson", id: "m" },
      propose: {
        type: "propose",
        proposal: { id: "p", topic: "meals", label: "L", by: "m" },
      },
      withdraw: { type: "withdraw", id: "p" },
      vote: { type: "vote", proposalId: "p", personId: "m", on: false },
      choose: {
        type: "choose",
        topic: "meals",
        proposalId: "p",
        by: "m",
        changeId: "c",
      },
      announce: { type: "announce", id: "a", by: "m", text: "t" },
      unannounce: { type: "unannounce", id: "a" },
      pack: { type: "pack", personId: "m", itemId: "goggles", on: true },
      challenges: { type: "challenges", on: false },
      customChallenge: {
        type: "customChallenge",
        id: "c",
        title: "t",
        by: "m",
      },
      complete: { type: "complete", challengeId: "c", personId: "m" },
      uncomplete: { type: "uncomplete", challengeId: "c", personId: "m" },
      photo: {
        type: "photo",
        photo: {
          id: "p",
          personId: "m",
          caption: "c",
          src: "data:image/jpeg;base64,AA==",
          at: "",
        },
      },
      removePhoto: { type: "removePhoto", id: "p" },
      moment: {
        type: "moment",
        moment: { id: "m1", personId: "m", text: "t", at: "" },
      },
      checkIn: { type: "checkIn", personId: "m", spot: "Lodge" },
      checkOut: { type: "checkOut", personId: "m" },
      song: { type: "song", id: "s", title: "t", by: "m" },
      removeSong: { type: "removeSong", id: "s" },
      idea: { type: "idea", id: "i", text: "t", by: "m" },
      voteIdea: { type: "voteIdea", id: "i", personId: "m", on: true },
      predict: { type: "predict", id: "q", text: "t", by: "m" },
      removePrediction: { type: "removePrediction", id: "q" },
      guess: { type: "guess", id: "q", personId: "m", says: true },
      settle: { type: "settle", id: "q", outcome: null },
      say: { type: "say", id: "s", by: "m", text: "t" },
      unsay: { type: "unsay", id: "s" },
    };
    for (const [type, action] of Object.entries(samples)) {
      // People are added by invitation only, never by an action.
      expect(parseAction(action), type).toEqual(
        type === "addPerson" ? null : action,
      );
    }
  });
});
