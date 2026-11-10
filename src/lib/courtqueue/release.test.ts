import {
  createDecipheriv,
  createECDH,
  createHmac,
  randomBytes,
} from "node:crypto";
import { describe, expect, it } from "vitest";
import { applyClub, applySession, tick, unsound, windDown } from "./engine";
import { prepared, inOrder } from "./fair";
import {
  MINUTE,
  filled,
  isActiveGame,
  type Club,
  type Session,
  type Skill,
} from "./model";
import { changeNotices, dueReminders, openingNotice } from "./notices";
import {
  OFFICIAL_CANCELLED,
  isScheduled,
  registrationOpensAt,
  registrationState,
  seasonDates,
  sessionWindow,
  upcomingNights,
} from "./schedule";
import { ORG, T0, as, club, must, night, refused } from "./testkit";
import { nightView, seasonView } from "./view";
import { encryptPayload, validSubscription, vapidFromSeed } from "./webpush";

/**
 * The owner's release brief, rule by rule: the season, same-day sign-up,
 * nobody starts a game CourtQueue didn't assign, explicit BACK IN THE QUEUE,
 * the fairness order, and what phones are told.
 */

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const OPENS = registrationOpensAt("2026-11-12");
const active = (s: Session) => s.games.filter(isActiveGame);

function here(c: Club, s: Session, who: string[], now: number) {
  for (const id of who) {
    s = must(c, s, as(id), { type: "register" }, now);
    s = must(c, s, as(id), { type: "check-in" }, now);
  }
  return s;
}

describe("the season", () => {
  it("is every Monday and Thursday from Oct 5, 2026 to Apr 15, 2027", () => {
    const dates = seasonDates();
    expect(dates[0]).toBe("2026-10-05");
    expect(dates.at(-1)).toBe("2027-04-15");
    expect(dates).toHaveLength(56);
    expect(isScheduled("2026-11-10")).toBe(false); // a Tuesday
    expect(isScheduled("2027-04-19")).toBe(false); // after the season
  });

  it("has the gym's hours: Monday 7–9 pm, Thursday 6:30–8:30 pm, in BC", () => {
    const thu = sessionWindow("2026-11-12");
    expect((thu.end - thu.start) / MINUTE).toBe(120);
    const mon = sessionWindow("2026-11-16");
    // BC is on UTC-7 all year (legalOffset): 7:00 pm is 02:00 UTC next day.
    expect(new Date(mon.start).toISOString()).toBe("2026-11-17T02:00:00.000Z");
    expect(new Date(thu.start).toISOString()).toBe("2026-11-13T01:30:00.000Z");
    expect(new Date(OPENS).toISOString()).toBe("2026-11-12T15:00:00.000Z");
  });

  it("types in no cancelled dates it wasn't given", () => {
    expect(Object.keys(OFFICIAL_CANCELLED)).toHaveLength(0);
  });

  it("lets an organizer cancel a night, on the record, and nobody else", () => {
    const c0 = club([3]);
    expect(
      applyClub(
        c0,
        as("p1"),
        { type: "cancel-night", date: "2026-11-16", cancelled: true },
        T0,
      ).ok,
    ).toBe(false);
    const out = applyClub(
      c0,
      ORG,
      {
        type: "cancel-night",
        date: "2026-11-16",
        cancelled: true,
        reason: "Gym closed",
      },
      T0,
    );
    if (!out.ok) throw new Error(out.error);
    const c = out.value;
    expect(
      registrationState("2026-11-16", T0 + 4 * 86_400_000, c.cancelled),
    ).toBe("cancelled");
    expect(c.scheduleLog!.at(-1)!.what).toMatch(
      /Monday Nov 16 cancelled — Gym closed/,
    );
    expect(upcomingNights(T0, c.cancelled, 3)).toEqual([
      "2026-11-12",
      "2026-11-19",
      "2026-11-23",
    ]);
    const v = seasonView(c, T0);
    expect(v.nights.find((n) => n.date === "2026-11-16")!.status).toBe(
      "cancelled",
    );
    expect(v.confirmed).toBeNull();
    // Not a club night: refused.
    expect(
      applyClub(
        c,
        ORG,
        { type: "cancel-night", date: "2026-11-17", cancelled: true },
        T0,
      ).ok,
    ).toBe(false);
    // Sign-up and check-in on a cancelled night are refused.
    const mon = night("2026-11-16");
    const at = registrationOpensAt("2026-11-16") + 60 * MINUTE;
    expect(refused(c, mon, as("p1"), { type: "register" }, at)).toMatch(
      /cancelled/,
    );
    expect(refused(c, mon, as("p1"), { type: "check-in" }, at)).toMatch(
      /cancelled/,
    );
  });
});

describe("same-day sign-up", () => {
  it("opens at 8:00 am on the day, for everyone, organizer included", () => {
    const c = club([3, 3]);
    const s = night();
    expect(refused(c, s, as("p1"), { type: "register" }, OPENS - 1)).toMatch(
      /8:00 am today/,
    );
    expect(
      refused(c, s, ORG, { type: "register", playerId: "p2" }, OPENS - 1),
    ).toMatch(/8:00/);
    expect(
      refused(c, s, as("p1"), { type: "register" }, OPENS - 86_400_000),
    ).toMatch(/8:00 am on Thursday Nov 12/);
    must(c, s, as("p1"), { type: "register" }, OPENS);
    // After the night is over, no more sign-ups.
    expect(
      refused(
        c,
        s,
        as("p1"),
        { type: "register" },
        sessionWindow(s.date).end + 1,
      ),
    ).toMatch(/over/);
  });

  it("confirms the first 25, waitlists the rest, and promotes in order", () => {
    const c = club(Array(28).fill(3) as Skill[]);
    let s = night();
    ids(28).forEach((id, i) => {
      s = must(c, s, as(id), { type: "register" }, OPENS + i * 1000);
    });
    const status = (id: string) =>
      s.roster.find((r) => r.playerId === id)!.status;
    expect(s.roster.filter((r) => r.status === "confirmed")).toHaveLength(25);
    expect([status("p25"), status("p26"), status("p27")]).toEqual([
      "confirmed",
      "waitlist",
      "waitlist",
    ]);
    const before = s;
    s = must(c, s, as("p3"), { type: "cancel" }, OPENS + 60 * MINUTE);
    expect(status("p26")).toBe("confirmed");
    expect(status("p27")).toBe("waitlist");
    // p26 hears about it.
    const n = changeNotices(c, before, s);
    expect(n.find((x) => x.to.includes("p26"))?.title).toMatch(/You're in/);
    // Capacity is the server's: an organizer can't promote past 25.
    expect(
      refused(
        c,
        s,
        ORG,
        { type: "promote", playerId: "p27" },
        OPENS + 61 * MINUTE,
      ),
    ).toMatch(/25/);
    expect(unsound(c, s)).toBeNull();
  });
});

describe("nobody starts a game CourtQueue didn't assign", () => {
  it("only the four called can start it, and only with four", () => {
    const c = club(Array(5).fill(3) as Skill[]);
    let s = here(c, night(), ids(5), T0);
    for (const id of ids(4)) s = must(c, s, as(id), { type: "play" }, T0);
    const g = active(s)[0]!;
    expect(filled(g.slots).sort()).toEqual(ids(4).sort());
    // p5 is here, but not in it.
    expect(
      refused(c, s, as("p5"), { type: "start", gameId: g.id }, T0 + MINUTE),
    ).toMatch(/Only the four/);
    expect(
      refused(c, s, as("p5"), { type: "finish", gameId: g.id }, T0 + MINUTE),
    ).toMatch(/Only the four/);
    // A player drops out: the game can't start with three.
    s = must(c, s, as("p4"), { type: "decline", gameId: g.id }, T0 + MINUTE);
    const three = s.games.find((x) => x.id === g.id)!;
    expect(filled(three.slots)).toHaveLength(3);
    expect(
      refused(c, s, as("p1"), { type: "start", gameId: g.id }, T0 + MINUTE),
    ).toMatch(/fourth/);
    // There is no command that starts a game without a called four.
    expect(
      refused(c, s, as("p1"), { type: "start", gameId: "g999" }, T0),
    ).toMatch(/isn't here/);
  });

  it("records who, which court, start, finish, duration, score, minutes and waiting", () => {
    const c = club(Array(4).fill(3) as Skill[]);
    let s = here(c, night(), ids(4), T0);
    for (const id of ids(4)) s = must(c, s, as(id), { type: "play" }, T0);
    const g0 = active(s)[0]!;
    s = must(c, s, as("p2"), { type: "start", gameId: g0.id }, T0 + 3 * MINUTE);
    s = must(
      c,
      s,
      as("p3"),
      { type: "finish", gameId: g0.id, score: [21, 18] },
      T0 + 17 * MINUTE,
    );
    const g = s.games.find((x) => x.id === g0.id)!;
    expect(g.court).toBeGreaterThan(0);
    expect(g.startedAt).toBe(T0 + 3 * MINUTE);
    expect(g.finishedAt).toBe(T0 + 17 * MINUTE);
    expect(g.score).toEqual([21, 18]);
    const v = nightView(c, s, "p1", T0 + 18 * MINUTE).me!;
    expect(v.games).toBe(1);
    expect(v.minutes).toBe(14);
    expect(v.played[0]!.minutes).toBe(14);
    expect(v.phase).toBe("finished");
  });
});

describe("the open-court workflow", () => {
  it("frees the court on FINISH, never requeues, and BACK IN THE QUEUE is explicit", () => {
    const c = club(Array(8).fill(3) as Skill[]);
    let s = here(c, night(), ids(8), T0);
    for (const id of ids(8)) s = must(c, s, as(id), { type: "play" }, T0);
    // Two of three courts called (eight players), none waiting.
    expect(active(s)).toHaveLength(2);
    const g = active(s)[0]!;
    const four = filled(g.slots);
    s = must(c, s, as(four[0]!), { type: "start", gameId: g.id }, T0 + MINUTE);
    expect(nightView(c, s, four[1]!, T0 + 2 * MINUTE).me!.phase).toBe(
      "playing",
    );
    // Finished with no score: the court is free at once anyway.
    s = must(
      c,
      s,
      as(four[0]!),
      { type: "finish", gameId: g.id },
      T0 + 15 * MINUTE,
    );
    expect(s.games.find((x) => x.id === g.id)!.status).toBe("finished");
    expect(active(s).some((x) => x.court === g.court)).toBe(false);
    expect(s.queue.map((q) => q.playerId)).toEqual([]);
    for (const id of four)
      expect(nightView(c, s, id, T0 + 15 * MINUTE).me!.phase).toBe("finished");
    // The score comes later — provisional until another player confirms.
    s = must(
      c,
      s,
      as(four[1]!),
      { type: "score", gameId: g.id, score: [15, 21] },
      T0 + 16 * MINUTE,
    );
    expect(
      refused(
        c,
        s,
        as(four[1]!),
        { type: "confirm", gameId: g.id },
        T0 + 16 * MINUTE,
      ),
    ).toMatch(/Someone else/);
    s = must(
      c,
      s,
      as(four[2]!),
      { type: "confirm", gameId: g.id },
      T0 + 17 * MINUTE,
    );
    expect(s.games.find((x) => x.id === g.id)!.confirmedBy).toBe(four[2]);
    // Three tap BACK IN THE QUEUE; one takes a break.
    for (const id of four.slice(0, 3))
      s = must(c, s, as(id), { type: "play" }, T0 + 18 * MINUTE);
    expect(s.queue.map((q) => q.playerId).sort()).toEqual(
      four.slice(0, 3).sort(),
    );
    expect(nightView(c, s, four[3]!, T0 + 18 * MINUTE).me!.phase).toBe(
      "finished",
    );
    expect(nightView(c, s, four[0]!, T0 + 18 * MINUTE).me!.phase).toBe(
      "waiting",
    );
  });

  it("an organizer correction is kept on the record with the reason", () => {
    const c = club(Array(4).fill(3) as Skill[]);
    let s = here(c, night(), ids(4), T0);
    for (const id of ids(4)) s = must(c, s, as(id), { type: "play" }, T0);
    const g = active(s)[0]!;
    s = must(c, s, as("p1"), { type: "start", gameId: g.id }, T0);
    s = must(
      c,
      s,
      as("p1"),
      { type: "finish", gameId: g.id, score: [21, 19] },
      T0 + 12 * MINUTE,
    );
    s = must(
      c,
      s,
      ORG,
      {
        type: "correct",
        gameId: g.id,
        score: [19, 21],
        reason: "Teams swapped",
      },
      T0 + 30 * MINUTE,
    );
    expect(s.games[0]!.score).toEqual([19, 21]);
    expect(s.audit.at(-1)!.what).toMatch(/score 21–19 → 19–21 — Teams swapped/);
    expect(s.audit.at(-1)!.by).toBe("org");
  });

  it("prepares the next game, and calls exactly that four when the court frees", () => {
    const skills = [...Array(8).fill(4), ...Array(8).fill(3)] as Skill[];
    const c = club(skills);
    let s = here(c, night(), ids(16), T0);
    for (const id of ids(16))
      s = must(c, s, as(id), { type: "play" }, T0 + MINUTE);
    expect(active(s)).toHaveLength(3);
    for (const g of active(s))
      s = must(c, s, ORG, { type: "start", gameId: g.id }, T0 + 2 * MINUTE);
    const next = prepared(c, s, T0 + 5 * MINUTE);
    expect(next.length).toBeGreaterThanOrEqual(1);
    const first = next[0]!;
    const view = nightView(c, s, filled(first.slots)[0]!, T0 + 5 * MINUTE);
    expect(view.me!.next?.court).toBe(first.court);
    // That court finishes first.
    const g = active(s).find((x) => x.court === first.court)!;
    s = must(c, s, ORG, { type: "finish", gameId: g.id }, T0 + 14 * MINUTE);
    const called = active(s).find((x) => x.court === first.court)!;
    expect(called.status).toBe("called");
    expect(filled(called.slots).sort()).toEqual(filled(first.slots).sort());
  });
});

describe("fairness", () => {
  it("fewest games, then fewest minutes, then longest wait", () => {
    const c = club(Array(12).fill(3) as Skill[]);
    const s = here(c, night(), ids(12), T0);
    s.games.push(
      ...(["p1", "p2"] as const).map((id, i) => ({
        id: `x${i}`,
        court: 1 as const,
        slots: [id, "p9", "p10", "p11"] as [string, string, string, string],
        source: "fair" as const,
        why: [],
        status: "finished" as const,
        calledAt: T0,
        accepted: {},
        declined: [],
        waitedSince: {},
        startedAt: T0,
        finishedAt: T0 + (i === 0 ? 20 : 8) * MINUTE,
        kudos: [],
      })),
    );
    // p3 has no games; p1 played 20 minutes, p2 played 8. p1 queued first.
    s.queue = [
      { playerId: "p1", since: T0 + 30 * MINUTE },
      { playerId: "p2", since: T0 + 31 * MINUTE },
      { playerId: "p3", since: T0 + 32 * MINUTE },
    ];
    expect(inOrder(c, s).map((w) => w.playerId)).toEqual(["p3", "p2", "p1"]);
  });

  it("a challenge never goes ahead of fairness, however long it waits", () => {
    const c = club(Array(12).fill(4) as Skill[]);
    let s = here(c, night(), ids(12), T0);
    for (const id of ids(12)) s = must(c, s, as(id), { type: "play" }, T0);
    // Courts full; p1..p4 play, and challenge each other for next time.
    const g1 = active(s).find((g) => g.slots.includes("p1"))!;
    const four = filled(g1.slots);
    s = must(c, s, ORG, { type: "start", gameId: g1.id }, T0 + MINUTE);
    s = must(c, s, ORG, { type: "finish", gameId: g1.id }, T0 + 12 * MINUTE);
    s = must(
      c,
      s,
      as(four[0]!),
      { type: "challenge", slots: four as [string, string, string, string] },
      T0 + 12 * MINUTE,
    );
    for (const id of four.slice(1))
      s = must(
        c,
        s,
        as(id),
        { type: "challenge-accept", challengeId: s.challenges[0]!.id },
        T0 + 12 * MINUTE,
      );
    // The court went to the four with fewer games, not the challenge.
    const next = active(s).find((g) => g.court === g1.court)!;
    expect(next.source).toBe("fair");
    // An hour later, still waiting for a court, nobody has played a second
    // game yet: the challenge still doesn't jump them.
    const later = tick(c, s, T0 + 75 * MINUTE);
    expect(later).toBe(false);
    expect(s.challenges[0]!.status).toBe("ready");
  });
});

describe("a night puts itself away", () => {
  it("an hour after the end, the queue is gone and the history stays", () => {
    const c = club(Array(6).fill(3) as Skill[]);
    let s = here(c, night(), ids(6), T0);
    for (const id of ids(6)) s = must(c, s, as(id), { type: "play" }, T0);
    const end = sessionWindow(s.date).end;
    expect(windDown(c, s, end + 30 * MINUTE)).toBeNull();
    const done = windDown(c, s, end + 61 * MINUTE)!;
    expect(done.status).toBe("ended");
    expect(done.queue).toHaveLength(0);
    expect(done.roster).toHaveLength(6);
    expect(done.audit.at(-1)!.by).toBe("courtqueue");
    expect(
      applySession(c, done, as("p1"), { type: "play" }, end + 62 * MINUTE).ok,
    ).toBe(false);
  });
});

describe("notifications", () => {
  it("tells each of the four their court, once", () => {
    const c = club(Array(4).fill(3) as Skill[], ["Ann Lee", "Bo", "Cy", "Di"]);
    let s = here(c, night(), ids(4), T0);
    for (const id of ids(3)) s = must(c, s, as(id), { type: "play" }, T0);
    const before = s;
    s = must(c, s, as("p4"), { type: "play" }, T0);
    const n = changeNotices(c, before, s);
    const court = active(s)[0]!.court;
    expect(
      n
        .filter((x) => x.title === `COURT ${court} — YOU'RE UP!`)
        .flatMap((x) => x.to)
        .sort(),
    ).toEqual(ids(4));
    expect(n.find((x) => x.to.includes("p4"))!.body).toMatch(
      /With Ann, Bo, Cy/,
    );
    // Nothing new, nothing sent.
    expect(changeNotices(c, s, s)).toHaveLength(0);
  });

  it("reminds a court nobody started, and a game running long, once each", () => {
    const c = club(Array(8).fill(3) as Skill[]);
    let s = here(c, night(), ids(8), T0);
    for (const id of ids(8)) s = must(c, s, as(id), { type: "play" }, T0);
    const [a, b] = active(s);
    s = must(c, s, ORG, { type: "start", gameId: b!.id }, T0);
    const due = dueReminders(c, s, T0 + 40 * MINUTE);
    expect(due.map((d) => d.key).sort()).toEqual(
      [`long:${b!.id}`, `slow:${a!.id}`].sort(),
    );
    s.notified = Object.fromEntries(due.map((d) => [d.key, T0]));
    expect(dueReminders(c, s, T0 + 41 * MINUTE)).toHaveLength(0);
  });

  it("says sign-up is open once, on the day, to subscribers not yet in", () => {
    const c = club([3, 3, 3]);
    let s = night();
    expect(openingNotice(c, s, ["p1"], OPENS - 1)).toBeNull();
    s = must(c, s, as("p2"), { type: "register" }, OPENS);
    const n = openingNotice(c, s, ["p1", "p2", "ghost"], OPENS + MINUTE)!;
    expect(n.to).toEqual(["p1"]);
    expect(n.body).toMatch(/24 spots/);
    s.notified = { open: OPENS + MINUTE };
    expect(openingNotice(c, s, ["p1"], OPENS + 2 * MINUTE)).toBeNull();
  });
});

describe("web push", () => {
  // The receiving side of RFC 8291, written from the RFC, to check ours.
  function decrypt(
    body: Buffer,
    ua: ReturnType<typeof createECDH>,
    auth: Buffer,
  ) {
    const salt = body.subarray(0, 16);
    const idlen = body[20]!;
    const asPublic = body.subarray(21, 21 + idlen);
    const data = body.subarray(21 + idlen);
    const h = (k: Buffer, d: Buffer) =>
      createHmac("sha256", k).update(d).digest();
    const shared = ua.computeSecret(asPublic);
    const ikm = h(
      h(auth, shared),
      Buffer.concat([
        Buffer.from("WebPush: info\0"),
        ua.getPublicKey(),
        asPublic,
        Buffer.from([1]),
      ]),
    );
    const prk = h(salt, ikm);
    const cek = h(
      prk,
      Buffer.from("Content-Encoding: aes128gcm\0\x01", "binary"),
    ).subarray(0, 16);
    const nonce = h(
      prk,
      Buffer.from("Content-Encoding: nonce\0\x01", "binary"),
    ).subarray(0, 12);
    const d = createDecipheriv("aes-128-gcm", cek, nonce);
    d.setAuthTag(data.subarray(data.length - 16));
    const out = Buffer.concat([
      d.update(data.subarray(0, data.length - 16)),
      d.final(),
    ]);
    expect(out.at(-1)).toBe(2);
    return out.subarray(0, -1).toString();
  }

  it("encrypts a message only that phone can read", () => {
    const ua = createECDH("prime256v1");
    ua.generateKeys();
    const auth = randomBytes(16);
    const sub = {
      endpoint: "https://web.push.apple.com/abc",
      keys: {
        p256dh: ua.getPublicKey().toString("base64url"),
        auth: auth.toString("base64url"),
      },
    };
    const msg = JSON.stringify({ title: "COURT 2 — YOU'RE UP!" });
    expect(decrypt(encryptPayload(sub, Buffer.from(msg)), ua, auth)).toBe(msg);
  });

  it("derives the same VAPID keys from the same seed, and only talks to push services", () => {
    expect(vapidFromSeed("a").publicKey).toBe(vapidFromSeed("a").publicKey);
    expect(vapidFromSeed("a").publicKey).not.toBe(vapidFromSeed("b").publicKey);
    const keys = {
      p256dh: createECDH("prime256v1").generateKeys().toString("base64url"),
      auth: randomBytes(16).toString("base64url"),
    };
    expect(
      validSubscription({ endpoint: "https://web.push.apple.com/x", keys }),
    ).toBe(true);
    expect(
      validSubscription({
        endpoint: "https://fcm.googleapis.com/fcm/send/x",
        keys,
      }),
    ).toBe(true);
    expect(
      validSubscription({ endpoint: "https://evil.example/x", keys }),
    ).toBe(false);
    expect(
      validSubscription({ endpoint: "http://fcm.googleapis.com/x", keys }),
    ).toBe(false);
  });
});
