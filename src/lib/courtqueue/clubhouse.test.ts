import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { recipients, type PushDoc } from "./push";
import {
  act,
  chat,
  chatHistory,
  claimOrganizer,
  live,
  register,
  signOut,
} from "./service";
import { memoryStore, setStoreForTests } from "./store";
import type { LiveView } from "./view";

/**
 * The Clubhouse through the real service on the memory store, with several
 * accounts, the way phones use it: one room, no private messages, a family
 * friendly tone, organizer controls, and challenges made ahead of the day
 * that only go ahead on the day, from the queue, under the fairness engine.
 */

const WED_NOON = "2026-11-11T20:00:00Z"; // Wed 12:00 pm in BC
const THU_830 = "2026-11-12T16:30:00Z"; // Thu 8:30 am — sign-up is open

function setClock(iso: string) {
  (globalThis as unknown as { __cqClock?: unknown }).__cqClock = undefined;
  process.env.COURTQUEUE_CLOCK = iso;
}

const NAMES = ["Ada", "Ben", "Cleo", "Dev", "Eli", "Fay"];
const cookies: Record<string, string> = {};
const ids: Record<string, string> = {};
let org = "";

const view = async (who: string) =>
  (await live(cookies[who], null)) as LiveView;
const say = (who: string, text: string) =>
  chat(cookies[who], { type: "post", text });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  process.env.COURTQUEUE_STORE = "memory";
  setStoreForTests(memoryStore());
  setClock(WED_NOON);
  for (const [i, name] of [...NAMES, "Olive"].entries()) {
    const out = await register({
      name,
      email: `${name}@example.test`,
      pin: "1234",
      skill: 3 + (i % 2),
    });
    if (!out.ok) throw new Error(out.error);
    cookies[name] = out.value.cookie;
    ids[name] = out.value.cookie.split(".")[0]!;
  }
  org = "Olive";
  const claimed = await claimOrganizer(
    cookies[org],
    "organizer",
    async () => false,
  );
  if (!claimed.ok) throw new Error(claimed.error);
});

afterAll(() => {
  setStoreForTests(undefined);
  delete process.env.COURTQUEUE_CLOCK;
});

describe("one room for the whole club", () => {
  it("is for members only", async () => {
    const out = await chat(undefined, { type: "post", text: "hi" });
    expect(out).toEqual({ ok: false, error: "Sign in first." });
    expect(((await live(undefined, null)) as LiveView).clubhouse).toBeNull();
    expect(await chatHistory(undefined, "2026-11-09:1")).toBeNull();
    await signOut(undefined);
  });

  it("shows every member's message to every other member, with banter and emoji", async () => {
    expect((await say("Ada", "Who's up for doubles tonight? 🏸🔥")).ok).toBe(
      true,
    );
    await wait(1100);
    expect((await say("Ben", "Me! Bring the good shuttles 😂")).ok).toBe(true);
    for (const who of ["Ada", "Ben", "Cleo", "Fay", "Olive"]) {
      const msgs = (await view(who)).clubhouse!.messages;
      expect(msgs.map((m) => m.text)).toEqual([
        "Who's up for doubles tonight? 🏸🔥",
        "Me! Bring the good shuttles 😂",
      ]);
      expect(msgs[0]!.author.name).toBe("Ada");
    }
  });

  it("has no way to message one person: no recipient, no thread", async () => {
    await wait(1100);
    const out = await chat(cookies.Cleo, {
      type: "post",
      text: "just for Dev",
      to: ids.Dev,
      private: true,
    });
    expect(out.ok).toBe(true);
    // Everyone — including Ada, who was not "addressed" — reads it.
    const last = (await view("Ada")).clubhouse!.messages.at(-1)!;
    expect(last.text).toBe("just for Dev");
    expect(Object.keys(last).sort()).toEqual(
      [
        "at",
        "author",
        "by",
        "hidden",
        "id",
        "kind",
        "reactions",
        "ref",
        "reportedByMe",
        "reports",
        "text",
      ].sort(),
    );
    // A server-only kind can't be forged from outside.
    expect(
      (
        await chat(cookies.Cleo, {
          type: "announce",
          kind: "challenge",
          text: "fake",
          ref: { session: "x", challenge: "y" },
        })
      ).ok,
    ).toBe(false);
  });

  it("keeps it family-friendly, link-free and unspammy", async () => {
    await wait(1100);
    for (const bad of [
      "what the f*** was that",
      "this is shit",
      "you f u c k e r",
      "sh1t shot",
      "check www.example.com",
      "https://evil.test/x",
      "   ",
      "x".repeat(301),
    ]) {
      const out = await say("Fay", bad);
      expect(out.ok, bad).toBe(false);
    }
    // Ordinary badminton talk is fine — no false alarms on shuttle talk.
    for (const ok of [
      "Great smash! That shuttlecock flew",
      "Pass the racquet, class act",
      "Assist to Ben, hello there",
    ]) {
      await wait(1050);
      expect((await say("Fay", ok)).ok, ok).toBe(true);
    }
    // Rapid fire and repeats are slowed down.
    await wait(1100);
    expect((await say("Fay", "one")).ok).toBe(true);
    expect((await say("Fay", "two")).ok).toBe(false);
    await wait(1100);
    expect((await say("Fay", "one")).ok).toBe(false);
  }, 20_000);

  it("lets members react and report, and hides a message three people report", async () => {
    const m = (await view("Ada")).clubhouse!.messages[0]!;
    await chat(cookies.Ben, { type: "react", id: m.id, emoji: "🔥" });
    await chat(cookies.Cleo, { type: "react", id: m.id, emoji: "🔥" });
    await chat(cookies.Cleo, { type: "react", id: m.id, emoji: "💩" });
    let r = (await view("Ben")).clubhouse!.messages[0]!.reactions;
    expect(r).toEqual([{ emoji: "🔥", n: 2, mine: true }]);
    await chat(cookies.Cleo, { type: "react", id: m.id, emoji: "🔥" });
    r = (await view("Ben")).clubhouse!.messages[0]!.reactions;
    expect(r).toEqual([{ emoji: "🔥", n: 1, mine: true }]);

    const t = (await view("Ada")).clubhouse!.messages.find(
      (x) => x.author.name === "Fay",
    )!;
    for (const who of ["Ben", "Cleo", "Dev"])
      await chat(cookies[who], { type: "report", id: t.id });
    const hidden = (await view("Eli")).clubhouse!.messages.find(
      (x) => x.id === t.id,
    )!;
    expect(hidden.hidden).toBe("reported");
    expect(hidden.text).toBe("");
    // The organizer still sees it, and what was reported.
    const seen = (await view(org)).clubhouse!.messages.find(
      (x) => x.id === t.id,
    )!;
    expect(seen.text).not.toBe("");
    expect(seen.reports).toBe(3);
    await chat(cookies[org], { type: "remove", id: t.id, restore: true });
    expect(
      (await view("Eli")).clubhouse!.messages.find((x) => x.id === t.id)!
        .hidden,
    ).toBeNull();
  });

  it("gives the organizer controls — and nobody else", async () => {
    const m = (await view("Ada")).clubhouse!.messages[0]!;
    expect((await chat(cookies.Ada, { type: "remove", id: m.id })).ok).toBe(
      false,
    );
    expect((await chat(cookies.Ada, { type: "lock", locked: true })).ok).toBe(
      false,
    );
    expect(
      (await chat(cookies.Ada, { type: "mute", playerId: ids.Ben, hours: 1 }))
        .ok,
    ).toBe(false);
    expect((await chat(cookies.Ada, { type: "pin", text: "hi" })).ok).toBe(
      false,
    );
    expect((await view("Ada")).clubhouse!.moderation).toBeNull();

    // Remove hides for members, keeps for the organizer.
    await chat(cookies[org], { type: "remove", id: m.id });
    expect((await view("Ben")).clubhouse!.messages[0]!.hidden).toBe("removed");
    expect((await view("Ben")).clubhouse!.messages[0]!.text).toBe("");
    expect((await view(org)).clubhouse!.messages[0]!.text).not.toBe("");

    // Pin an announcement (screened like anything else).
    expect(
      (await chat(cookies[org], { type: "pin", text: "ugly shit" })).ok,
    ).toBe(false);
    expect(
      (
        await chat(cookies[org], {
          type: "pin",
          text: "Doors at 6:30 — bring water 💧",
        })
      ).ok,
    ).toBe(true);
    expect((await view("Eli")).clubhouse!.pinned!.text).toContain(
      "bring water",
    );

    // Pause one player: they read, they can't speak or react; others can.
    await chat(cookies[org], { type: "mute", playerId: ids.Dev, hours: 2 });
    await wait(1100);
    expect((await say("Dev", "hello?")).ok).toBe(false);
    expect((await view("Dev")).clubhouse!.muted).not.toBeNull();
    expect((await view("Dev")).clubhouse!.messages.length).toBeGreaterThan(0);
    expect(
      (await view(org)).clubhouse!.moderation!.muted.map((x) => x.person.name),
    ).toEqual(["Dev"]);
    await chat(cookies[org], { type: "unmute", playerId: ids.Dev });
    expect((await say("Dev", "back!")).ok).toBe(true);

    // Pause the whole room: members are told, the organizer can still post.
    await chat(cookies[org], { type: "lock", locked: true });
    await wait(1100);
    expect((await say("Ben", "anyone?")).ok).toBe(false);
    expect((await say(org, "Back at 6:30")).ok).toBe(true);
    await chat(cookies[org], { type: "lock", locked: false });
    expect(
      (await view(org)).clubhouse!.moderation!.log.length,
    ).toBeGreaterThanOrEqual(5);
  });
});

describe("challenges: ahead of the day, on the day", () => {
  it("lets players challenge another pair before game day, reserving nobody's attendance", async () => {
    const v = await view("Ada");
    const thu = v.sessions.find((s) => s.date === "2026-11-12")!;
    expect(thu.registration).toBe("not-yet");
    // Nobody can sign up ahead of the day …
    const early = await act(cookies.Ada, {
      scope: "session",
      sessionId: thu.id,
      cmd: { type: "register" },
    });
    expect(early.ok).toBe(false);
    // … but anyone can throw down a challenge for it.
    const sent = await act(cookies.Ada, {
      scope: "session",
      sessionId: thu.id,
      cmd: {
        type: "challenge",
        slots: [ids.Ada, ids.Ben, ids.Cleo, ids.Dev],
        note: "Loser buys the shuttles 😎",
      },
    });
    expect(sent).toEqual({ ok: true, value: null });
    const after = (await view("Cleo")).sessions.find((s) => s.id === thu.id)!;
    expect(after.challenges).toHaveLength(1);
    const ch = after.challenges[0]!;
    expect(ch.status).toBe("pending");
    expect(ch.accepted).toEqual([ids.Ada]);
    expect(ch.note).toBe("Loser buys the shuttles 😎");
    // Ada said yes by asking; she hasn't signed up (she can't, yet).
    expect(ch.needs.map((n) => n.step).sort()).toEqual([
      "answer",
      "answer",
      "answer",
      "sign-up",
    ]);
    // The Clubhouse announced it, as a card pointing at the challenge.
    const card = (await view("Fay")).clubhouse!.messages.at(-1)!;
    expect(card.kind).toBe("challenge");
    expect(card.ref).toEqual({ session: thu.id, challenge: ch.id });

    // One accepts, one declines; neither is signed up for anything.
    const yes = await act(cookies.Ben, {
      scope: "session",
      sessionId: thu.id,
      cmd: { type: "challenge-accept", challengeId: ch.id },
    });
    expect(yes.ok).toBe(true);
    const mid = (await view("Ben")).sessions.find((s) => s.id === thu.id)!;
    expect(mid.mine).toBeNull();
    expect(mid.confirmed).toBe(0);
    expect(
      mid.challenges[0]!.needs.find((n) => n.playerId === ids.Ben)!.step,
    ).toBe("sign-up");
    // Someone not in it can't answer for them.
    const nope = await act(cookies.Fay, {
      scope: "session",
      sessionId: thu.id,
      cmd: { type: "challenge-accept", challengeId: ch.id },
    });
    expect(nope.ok).toBe(false);
    // Declining ends it for everyone, with no penalty and no attendance.
    const no = await act(cookies.Dev, {
      scope: "session",
      sessionId: thu.id,
      cmd: { type: "challenge-decline", challengeId: ch.id },
    });
    expect(no.ok).toBe(true);
    const done = (await view("Ada")).sessions.find((s) => s.id === thu.id)!;
    expect(done.challenges[0]!.status).toBe("declined");
    expect(done.confirmed).toBe(0);
  });

  it("refuses a challenge with filthy notes and between strangers", async () => {
    const thu = "2026-11-12";
    const dirty = await act(cookies.Ada, {
      scope: "session",
      sessionId: thu,
      cmd: {
        type: "challenge",
        slots: [ids.Ada, ids.Ben, ids.Cleo, ids.Dev],
        note: "you suck, shit",
      },
    });
    expect(dirty.ok).toBe(false);
    const stranger = await act(cookies.Fay, {
      scope: "session",
      sessionId: thu,
      cmd: { type: "challenge", slots: [ids.Ada, ids.Ben, ids.Cleo, ids.Dev] },
    });
    expect(stranger.ok).toBe(false);
  });

  it("goes ahead on the day only when all four are signed up, here, and in the queue", async () => {
    await wait(1100);
    const thu = "2026-11-12";
    const sent = await act(cookies.Ada, {
      scope: "session",
      sessionId: thu,
      cmd: {
        type: "challenge",
        slots: [ids.Ada, ids.Ben, ids.Cleo, ids.Dev],
        rematch: true,
      },
    });
    expect(sent.ok).toBe(true);
    setClock(THU_830);
    const chId = (await view("Ada")).sessions
      .find((s) => s.id === thu)!
      .challenges.find((c) => c.status === "pending")!.id;
    const go = (who: string, cmd: object) =>
      act(cookies[who], { scope: "session", sessionId: thu, cmd });
    for (const who of ["Ben", "Cleo", "Dev"])
      expect(
        (await go(who, { type: "challenge-accept", challengeId: chId })).ok,
      ).toBe(true);
    const steps = async () =>
      (await view("Ada")).sessions
        .find((s) => s.id === thu)!
        .challenges.find((c) => c.id === chId)!;
    // All said yes, none signed up.
    expect((await steps()).needs.every((n) => n.step === "sign-up")).toBe(true);

    // Sign-up opens at 8:00 am: all four register.
    for (const who of ["Ada", "Ben", "Cleo", "Dev"])
      expect((await go(who, { type: "register" })).ok).toBe(true);
    expect((await steps()).needs.every((n) => n.step === "check-in")).toBe(
      true,
    );
    for (const who of ["Ada", "Ben", "Cleo", "Dev"])
      expect((await go(who, { type: "check-in" })).ok).toBe(true);
    expect((await steps()).needs.every((n) => n.step === "queue")).toBe(true);
    expect((await steps()).status).toBe("pending");

    // Three in the queue is not enough …
    for (const who of ["Ada", "Ben", "Cleo"]) await go(who, { type: "play" });
    expect((await steps()).status).toBe("pending");
    expect((await steps()).needs).toEqual([
      { playerId: ids.Dev, step: "queue" },
    ]);

    // … the fourth joins: it's on, and on a free court it starts at once.
    await go("Dev", { type: "play" });
    const v = await view("Ada");
    const c = v.sessions
      .find((s) => s.id === thu)!
      .challenges.find((x) => x.id === chId)!;
    expect(["ready", "on-court"]).toContain(c.status);
    expect(c.needs).toEqual([]);
    expect(v.night!.courts.some((x) => x.game?.source === "challenge")).toBe(
      true,
    );
  });

  it("holds the 25 spots strictly first come, first served — everyone else waits their turn", async () => {
    const thu = "2026-11-12";
    // 20 more members, then one more than fits.
    const more: string[] = [];
    for (let i = 0; i < 21; i++) {
      const out = await register({
        name: `Guest ${i + 1}`,
        email: `guest${i + 1}@example.test`,
        pin: "1234",
        skill: 3,
      });
      if (!out.ok) throw new Error(out.error);
      cookies[`G${i}`] = out.value.cookie;
      more.push(`G${i}`);
    }
    // Ada, Ben, Cleo, Dev signed up already: 4 confirmed. Add Olive + 20 = 25.
    const reg = (who: string) =>
      act(cookies[who], {
        scope: "session",
        sessionId: thu,
        cmd: { type: "register" },
      });
    expect((await reg(org)).ok).toBe(true);
    for (const g of more.slice(0, 20)) expect((await reg(g)).ok).toBe(true);
    const s = (await view("Ada")).sessions.find((x) => x.id === thu)!;
    expect(s.confirmed).toBe(25);
    // The 26th is waitlisted, not confirmed.
    expect((await reg(more[20]!)).ok).toBe(true);
    const w = (await view(more[20]!)).sessions.find((x) => x.id === thu)!;
    expect(w.confirmed).toBe(25);
    expect(w.mine).toBe("waitlist");
    expect(w.waitlistPosition).toBe(1);
    // Someone cancelling moves the first in the line up — nobody jumps it.
    await act(cookies.G0, {
      scope: "session",
      sessionId: thu,
      cmd: { type: "cancel" },
    });
    const after = (await view(more[20]!)).sessions.find((x) => x.id === thu)!;
    expect(after.mine).toBe("confirmed");
    expect(after.confirmed).toBe(25);
  });
});

describe("notifications: the Clubhouse and the courts are separate switches", () => {
  const doc: PushDoc = {
    players: {
      a: [{ endpoint: "e", keys: { p256dh: "p", auth: "a" }, at: 0 }],
      b: [{ endpoint: "f", keys: { p256dh: "p", auth: "a" }, at: 0 }],
      c: [{ endpoint: "g", keys: { p256dh: "p", auth: "a" }, at: 0 }],
      d: [{ endpoint: "h", keys: { p256dh: "p", auth: "a" }, at: 0 }],
    },
    prefs: {
      a: { courts: true, chat: "off" },
      b: { courts: false, chat: "all" },
      c: { courts: true, chat: "mine" },
    },
  };
  const court = { to: ["a", "b", "c", "d"], title: "t", body: "b", tag: "x" };
  const talk = {
    kind: "chat" as const,
    to: ["c", "a"],
    everyone: { except: ["d"] },
    title: "t",
    body: "b",
    tag: "clubhouse",
  };
  it("court calls ignore the Clubhouse setting, and the other way round", () => {
    // Court-ready: everyone except b, who turned courts off. Chat settings don't matter.
    expect(recipients(doc, court)).toEqual(["a", "c", "d"]);
    // Clubhouse: c (mentioned, "mine"), b (every message); not a (off), not d (no pref = off).
    expect(recipients(doc, talk).sort()).toEqual(["b", "c"]);
  });
});
