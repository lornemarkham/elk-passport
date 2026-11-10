import { describe, expect, it } from "vitest";
import { applySession, unsound } from "./engine";
import { localClock, localDate } from "./clock";
import {
  MINUTE,
  filled,
  isActiveGame,
  type Session,
  type Skill,
} from "./model";
import { playerStats } from "./stats";
import { nightView } from "./view";
import { ORG, T0, arrive, as, club, must, night, refused } from "./testkit";

const ids = (n: number, from = 1) =>
  Array.from({ length: n }, (_, i) => `p${i + from}`);
const active = (s: Session) => s.games.filter(isActiveGame);
const onCourt = (s: Session, court: number) =>
  s.games.find((g) => g.court === court && isActiveGame(g));

describe("CourtQueue engine", () => {
  it("is set on Thursday Nov 12 in Vancouver", () => {
    expect(localDate(T0)).toBe("2026-11-12");
  });

  it("caps the night at 25 and promotes from the waitlist on a cancellation", () => {
    const c = club(Array(27).fill(3) as Skill[]);
    let s = night();
    for (const id of ids(27)) s = must(c, s, as(id), { type: "register" }, T0);
    expect(s.roster.filter((r) => r.status === "confirmed")).toHaveLength(25);
    expect(
      s.roster.filter((r) => r.status === "waitlist").map((r) => r.playerId),
    ).toEqual(["p26", "p27"]);
    s = must(c, s, as("p3"), { type: "cancel" }, T0 + 1);
    expect(s.roster.find((r) => r.playerId === "p26")!.status).toBe(
      "confirmed",
    );
    expect(s.roster.find((r) => r.playerId === "p27")!.status).toBe("waitlist");
    // A waitlisted player can't check in; a no-show frees a place.
    expect(refused(c, s, as("p27"), { type: "check-in" }, T0 + 2)).toMatch(
      /waitlist/,
    );
    s = must(c, s, ORG, { type: "no-show", playerId: "p5" }, T0 + 3);
    expect(s.roster.find((r) => r.playerId === "p27")!.status).toBe(
      "confirmed",
    );
  });

  it("only signs up and checks in on the day", () => {
    const c = club([3]);
    expect(
      refused(c, night("2026-11-16"), as("p1"), { type: "register" }, T0),
    ).toMatch(/8:00 am on Monday Nov 16/);
    expect(
      refused(c, night("2026-11-16"), as("p1"), { type: "check-in" }, T0),
    ).toMatch(/on the day/);
  });

  it("fills three courts from twelve players and keeps the other twelve waiting", () => {
    const skills: Skill[] = [
      1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 2, 3, 4, 1, 3,
    ];
    const c = club(skills);
    const s = arrive(c, night(), ids(24), T0);
    expect(active(s)).toHaveLength(3);
    expect(s.queue).toHaveLength(12);
    const seated = active(s).flatMap((g) => filled(g.slots));
    expect(new Set(seated).size).toBe(12);
    // Nobody rated Beginner or Beginner+ is on the expert court.
    for (const id of filled(onCourt(s, 3)!.slots))
      expect(c.players[id]!.skill).toBeGreaterThanOrEqual(3);
    // The beginner court has no experts.
    for (const id of filled(onCourt(s, 1)!.slots))
      expect(c.players[id]!.skill).toBeLessThanOrEqual(3);
    expect(unsound(c, s)).toBeNull();
  });

  it("starts and finishes on the server's clock, and counts only playing time", () => {
    const c = club([3, 3, 3, 3]);
    let s = arrive(c, night(), ids(4), T0);
    const g = active(s)[0]!;
    // Called at T0; they take 4 minutes to walk on — that's waiting, not playing.
    s = must(c, s, as("p2"), { type: "accept", gameId: g.id }, T0 + 1 * MINUTE);
    s = must(c, s, as("p1"), { type: "start", gameId: g.id }, T0 + 4 * MINUTE);
    expect(s.games[0]!.status).toBe("playing");
    expect(nightView(c, s, "p3", T0 + 5 * MINUTE).me!.state).toBe("playing");
    s = must(
      c,
      s,
      as("p4"),
      { type: "finish", gameId: g.id, score: [21, 17] },
      T0 + 19 * MINUTE,
    );
    const done = s.games[0]!;
    expect(done.startedAt).toBe(T0 + 4 * MINUTE);
    expect(done.finishedAt).toBe(T0 + 19 * MINUTE);
    expect(done.winner).toBe(0);
    const v = nightView(c, s, "p1", T0 + 20 * MINUTE);
    expect(v.me!.minutes).toBe(15);
    expect(v.me!.games).toBe(1);
    expect(
      v.courts.every((x) => x.game === null || x.game.status === "called"),
    ).toBe(true);
    const st = playerStats(c, [s], "p3");
    expect(st).toMatchObject({
      games: 1,
      minutes: 15,
      wins: 0,
      losses: 1,
      attended: 1,
    });
  });

  it("a second player confirms the score; the scorer can't confirm their own", () => {
    const c = club([3, 3, 3, 3]);
    let s = arrive(c, night(), ids(4), T0);
    const id = active(s)[0]!.id;
    s = must(c, s, as("p1"), { type: "start", gameId: id }, T0);
    s = must(
      c,
      s,
      as("p1"),
      { type: "finish", gameId: id, score: [15, 21] },
      T0 + 12 * MINUTE,
    );
    expect(
      refused(
        c,
        s,
        as("p1"),
        { type: "confirm", gameId: id },
        T0 + 13 * MINUTE,
      ),
    ).toMatch(/Someone else/);
    s = must(c, s, as("p3"), { type: "confirm", gameId: id }, T0 + 13 * MINUTE);
    expect(s.games[0]!.confirmedBy).toBe("p3");
  });

  it("never puts two games on one court, even when organizer and engine collide", () => {
    const c = club(Array(8).fill(3) as Skill[]);
    let s = arrive(c, night(), ids(8), T0);
    // The engine filled courts with the first eight; court 2 is busy.
    expect(onCourt(s, 2)).toBeTruthy();
    s = must(c, s, ORG, { type: "check-in", playerId: "org" }, T0);
    expect(
      refused(
        c,
        s,
        ORG,
        { type: "assign", court: 2, slots: ["p1", "p2", "p3", "org"] },
        T0,
      ),
    ).toMatch(/already has a game|already on a court/);
  });

  it("refuses a beginner on the expert court, even from the organizer", () => {
    const c = club([1, 5, 5, 5]);
    let s = night();
    for (const id of ids(4)) {
      s = must(c, s, as(id), { type: "register" }, T0);
      s = must(c, s, as(id), { type: "check-in" }, T0);
    }
    expect(
      refused(
        c,
        s,
        ORG,
        { type: "assign", court: 3, slots: ["p1", "p2", "p3", "p4"] },
        T0,
      ),
    ).toMatch(/never on the expert court/);
    // The same four in a challenge are sent to a court that allows them.
    s = must(
      c,
      s,
      as("p1"),
      { type: "challenge", slots: ["p1", "p2", "p3", "p4"] },
      T0,
    );
    for (const id of ["p2", "p3", "p4"])
      s = must(
        c,
        s,
        as(id),
        { type: "challenge-accept", challengeId: s.challenges[0]!.id },
        T0,
      );
    const g = active(s)[0]!;
    expect(g.court).not.toBe(3);
  });

  it("lets an intermediate partner an expert on the expert court", () => {
    const c = club([3, 5, 5, 5]);
    let s = night();
    for (const id of ids(4)) {
      s = must(c, s, as(id), { type: "register" }, T0);
      s = must(c, s, as(id), { type: "check-in" }, T0);
    }
    // Close the other two so the expert court is the only option.
    s = must(c, s, ORG, { type: "court-closed", court: 1, closed: true }, T0);
    s = must(c, s, ORG, { type: "court-closed", court: 2, closed: true }, T0);
    s = must(
      c,
      s,
      as("p1"),
      { type: "challenge", slots: ["p1", "p2", "p3", "p4"] },
      T0,
    );
    const ch = s.challenges[0]!.id;
    for (const id of ["p2", "p3", "p4"])
      s = must(c, s, as(id), { type: "challenge-accept", challengeId: ch }, T0);
    const g = active(s)[0]!;
    expect(g.court).toBe(3);
    expect(g.source).toBe("challenge");
    // Intermediate + intermediate is not an expert-court team.
    const c2 = club([3, 3, 5, 5]);
    let s2 = night();
    for (const id of ids(4)) {
      s2 = must(c2, s2, as(id), { type: "register" }, T0);
      s2 = must(c2, s2, as(id), { type: "check-in" }, T0);
    }
    s2 = must(
      c2,
      s2,
      ORG,
      { type: "court-closed", court: 1, closed: true },
      T0,
    );
    s2 = must(
      c2,
      s2,
      ORG,
      { type: "court-closed", court: 2, closed: true },
      T0,
    );
    expect(
      refused(
        c2,
        s2,
        as("p1"),
        { type: "challenge", slots: ["p1", "p2", "p3", "p4"] },
        T0,
      ),
    ).toMatch(/No open court/);
  });

  it("a challenge needs all four, and a decline gives everyone their place back", () => {
    const c = club(Array(12).fill(4) as Skill[]);
    let s = arrive(c, night(), ids(12), T0);
    // All courts busy with p1..p12; free them up.
    for (const g of active(s)) {
      s = must(c, s, ORG, { type: "start", gameId: g.id }, T0 + MINUTE);
      s = must(c, s, ORG, { type: "finish", gameId: g.id }, T0 + 15 * MINUTE);
      for (const id of filled(g.slots))
        s = must(c, s, as(id), { type: "play" }, T0 + 15 * MINUTE);
    }
    // Everyone has one game; new games got called. Let p1..p4's game finish too.
    const queueBefore = s.queue.map((q) => q.playerId);
    const challenger = queueBefore[0]!;
    const friends = queueBefore.slice(1, 4);
    s = must(
      c,
      s,
      as(challenger),
      {
        type: "challenge",
        slots: [challenger, ...friends] as [string, string, string, string],
      },
      T0 + 16 * MINUTE,
    );
    const ch = s.challenges[0]!;
    expect(ch.status).toBe("pending");
    // Saying yes to a challenge still waiting for the others holds no place.
    expect(s.queue.some((q) => q.playerId === challenger)).toBe(true);
    s = must(
      c,
      s,
      as(friends[0]!),
      { type: "challenge-accept", challengeId: ch.id },
      T0 + 17 * MINUTE,
    );
    s = must(
      c,
      s,
      as(friends[1]!),
      { type: "challenge-decline", challengeId: ch.id },
      T0 + 18 * MINUTE,
    );
    expect(s.challenges[0]!.status).toBe("declined");
    // The two who had accepted are back in line with their old waiting time.
    for (const id of [challenger, friends[0]!]) {
      const q = s.queue.find((x) => x.playerId === id);
      expect(q).toBeTruthy();
      expect(q!.since).toBeLessThanOrEqual(T0 + 15 * MINUTE);
    }
    expect(unsound(c, s)).toBeNull();
  });

  it("a challenge never jumps someone waiting for their first game", () => {
    const c = club(Array(9).fill(4) as Skill[]);
    let s = night();
    // One court tonight, to make the order visible.
    s = must(c, s, ORG, { type: "go-live" }, T0);
    s = must(c, s, ORG, { type: "court-closed", court: 1, closed: true }, T0);
    s = must(c, s, ORG, { type: "court-closed", court: 2, closed: true }, T0);
    // p1..p4 play a game and sit out afterwards.
    s = arrive(c, s, ids(4), T0);
    for (const id of ids(4))
      s = must(c, s, as(id), { type: "auto-requeue", on: false }, T0);
    s = must(c, s, as("p1"), { type: "start", gameId: s.games[0]!.id }, T0);
    s = must(
      c,
      s,
      as("p1"),
      { type: "finish", gameId: s.games[0]!.id },
      T0 + 15 * MINUTE,
    );
    expect(active(s)).toHaveLength(0);
    s = must(
      c,
      s,
      as("p1"),
      { type: "challenge", slots: ["p1", "p2", "p3", "p4"] },
      T0 + 16 * MINUTE,
    );
    // A first-timer is waiting (alone, so no fair game can be made yet).
    s = arrive(c, s, ["p5"], T0 + 16 * MINUTE);
    for (const id of ["p2", "p3", "p4"])
      s = must(
        c,
        s,
        as(id),
        { type: "challenge-accept", challengeId: s.challenges[0]!.id },
        T0 + 17 * MINUTE,
      );
    expect(s.challenges[0]!.status).toBe("ready");
    expect(active(s)).toHaveLength(0);
    // Once four first-timers can play, they go first.
    s = arrive(c, s, ["p6", "p7", "p8"], T0 + 18 * MINUTE);
    expect(onCourt(s, 3)!.source).toBe("fair");
    expect(filled(onCourt(s, 3)!.slots).sort()).toEqual([
      "p5",
      "p6",
      "p7",
      "p8",
    ]);
    for (const id of ["p5", "p6", "p7", "p8"])
      s = must(c, s, as(id), { type: "auto-requeue", on: false }, T0);
    s = must(
      c,
      s,
      as("p5"),
      { type: "start", gameId: onCourt(s, 3)!.id },
      T0 + 19 * MINUTE,
    );
    // p9 arrives mid-game: a first-timer again — still blocks the challenge.
    s = arrive(c, s, ["p9"], T0 + 25 * MINUTE);
    s = must(
      c,
      s,
      as("p5"),
      { type: "finish", gameId: onCourt(s, 3)!.id },
      T0 + 30 * MINUTE,
    );
    expect(active(s)).toHaveLength(0);
    // p9 heads home; the challenge goes on.
    s = must(c, s, as("p9"), { type: "leave" }, T0 + 31 * MINUTE);
    expect(onCourt(s, 3)!.source).toBe("challenge");
  });

  it("a player is never in two games or reservations at once", () => {
    const c = club(Array(11).fill(3) as Skill[]);
    const s = arrive(c, night(), ids(11), T0);
    const g = onCourt(s, 2) ?? active(s)[0]!;
    const busy = filled(g.slots)[0]!;
    const others = s.queue.slice(0, 3).map((q) => q.playerId);
    expect(
      refused(
        c,
        s,
        as(busy),
        {
          type: "challenge",
          slots: [busy, others[0]!, others[1]!, others[2]!],
        },
        T0,
      ),
    ).toMatch(/Finish your game/);
    expect(refused(c, s, as(busy), { type: "play" }, T0)).toMatch(
      /already on a court/,
    );
  });

  it("declining a recommended game keeps your place and isn't counted against you", () => {
    const c = club(Array(5).fill(3) as Skill[]);
    let s = night();
    s = arrive(c, s, ids(5), T0);
    const g = active(s)[0]!;
    const out = filled(g.slots).find((id) => id !== "p5")!;
    s = must(c, s, as(out), { type: "decline", gameId: g.id }, T0 + MINUTE);
    const game = s.games[0]!;
    expect(game.slots).toContain("p5");
    expect(game.slots).not.toContain(out);
    expect(s.queue.find((q) => q.playerId === out)!.since).toBe(T0);
  });

  it("leaving early takes you out of line and out of a called game", () => {
    const c = club(Array(6).fill(3) as Skill[]);
    let s = arrive(c, night(), ids(6), T0);
    const g = active(s)[0]!;
    const leaver = filled(g.slots)[0]!;
    s = must(c, s, as(leaver), { type: "leave" }, T0 + MINUTE);
    expect(filled(s.games[0]!.slots)).not.toContain(leaver);
    expect(filled(s.games[0]!.slots)).toHaveLength(4);
    expect(s.queue.some((q) => q.playerId === leaver)).toBe(false);
    // Can't walk out mid-game.
    const playing = s.games[0]!;
    s = must(
      c,
      s,
      as(filled(playing.slots)[0]!),
      { type: "start", gameId: playing.id },
      T0 + 2 * MINUTE,
    );
    expect(
      refused(
        c,
        s,
        as(filled(playing.slots)[1]!),
        { type: "leave" },
        T0 + 3 * MINUTE,
      ),
    ).toMatch(/Finish/);
  });

  it("a forgotten START is estimated from the players' word, and audited", () => {
    const c = club([3, 3, 3, 3]);
    let s = arrive(c, night(), ids(4), T0);
    const id = active(s)[0]!.id;
    s = must(
      c,
      s,
      as("p2"),
      { type: "finish", gameId: id, startedMinutesAgo: 16 },
      T0 + 20 * MINUTE,
    );
    const g = s.games[0]!;
    expect(g.startEstimated).toBe(true);
    expect(g.finishedAt! - g.startedAt!).toBe(16 * MINUTE);
    expect(s.audit.at(-1)!.what).toMatch(/Start forgotten/);
    // It can't be earlier than when the court was called.
    let s2 = arrive(c, night(), ids(4), T0);
    s2 = must(
      c,
      s2,
      as("p2"),
      { type: "finish", gameId: active(s2)[0]!.id, startedMinutesAgo: 90 },
      T0 + 20 * MINUTE,
    );
    expect(s2.games[0]!.startedAt).toBe(T0);
  });

  it("a forgotten FINISH is fixed by the organizer, with an audit trail", () => {
    const c = club([3, 3, 3, 3]);
    let s = arrive(c, night(), ids(4), T0);
    const id = active(s)[0]!.id;
    s = must(c, s, as("p1"), { type: "start", gameId: id }, T0);
    // 50 minutes later the court is still "occupied".
    const view = nightView(c, s, "p1", T0 + 50 * MINUTE);
    expect(view.courts.find((x) => x.game?.id === id)!.game!.status).toBe(
      "playing",
    );
    expect(
      refused(
        c,
        s,
        as("p1"),
        { type: "correct", gameId: id, finishedAt: "19:20", reason: "x" },
        T0 + 50 * MINUTE,
      ),
    ).toMatch(/organizer/);
    const at = T0 + 18 * MINUTE;
    const hhmm = localClock(at).replace(/ (am|pm)$/, (_, ap) =>
      ap === "pm" ? "pm" : "",
    );
    const [h, m] = hhmm.replace("pm", "").split(":").map(Number);
    const wall = `${(h! % 12) + (hhmm.endsWith("pm") ? 12 : 0)}:${String(m).padStart(2, "0")}`;
    s = must(
      c,
      s,
      ORG,
      {
        type: "correct",
        gameId: id,
        finishedAt: wall,
        reason: "Forgot to finish",
      },
      T0 + 50 * MINUTE,
    );
    const g = s.games[0]!;
    expect(g.status).toBe("finished");
    expect(Math.round((g.finishedAt! - g.startedAt!) / MINUTE)).toBe(18);
    expect(s.audit.at(-1)!.what).toContain(
      `finish — → ${localClock(at)} — Forgot to finish`,
    );
  });

  it("disputes are resolved by the organizer", () => {
    const c = club([3, 3, 3, 3]);
    let s = arrive(c, night(), ids(4), T0);
    const id = active(s)[0]!.id;
    s = must(c, s, as("p1"), { type: "start", gameId: id }, T0);
    s = must(
      c,
      s,
      as("p1"),
      { type: "finish", gameId: id, score: [21, 19] },
      T0 + 14 * MINUTE,
    );
    s = must(c, s, as("p3"), { type: "dispute", gameId: id }, T0 + 15 * MINUTE);
    expect(s.games[0]!.disputedBy).toBe("p3");
    s = must(
      c,
      s,
      ORG,
      {
        type: "correct",
        gameId: id,
        score: [19, 21],
        reason: "Agreed at the net",
      },
      T0 + 16 * MINUTE,
    );
    expect(s.games[0]).toMatchObject({ winner: 1, confirmedBy: "org" });
    expect(s.games[0]!.disputedBy).toBeUndefined();
  });

  it("many phones tapping PLAY against one stored night all land exactly once", async () => {
    const { memoryStore } = await import("./store");
    const store = memoryStore(5);
    const c = club(
      Array.from({ length: 24 }, (_, i) => (i % 2 ? 4 : 3)) as Skill[],
    );
    let s = night();
    for (const id of ids(24)) {
      s = must(c, s, as(id), { type: "register" }, T0);
      s = must(c, s, as(id), { type: "check-in" }, T0);
    }
    await store.put("s", s, 0);
    let conflicts = 0;
    await Promise.all(
      ids(24).map(async (id, i) => {
        for (;;) {
          const d = (await store.get(["s"])).get("s")!;
          const out = applySession(
            c,
            d.value as Session,
            as(id),
            { type: "play" },
            T0 + i,
          );
          if (!out.ok) throw new Error(out.error);
          if (await store.put("s", out.value, d.version)) return;
          conflicts++;
        }
      }),
    );
    const final = (await store.get(["s"])).get("s")!.value as Session;
    expect(conflicts).toBeGreaterThan(0);
    expect(active(final)).toHaveLength(3);
    expect(final.queue).toHaveLength(12);
    expect(unsound(c, final)).toBeNull();
  });

  it("two groups racing for the same free court: one wins, the other re-reads and waits", async () => {
    const { memoryStore } = await import("./store");
    const store = memoryStore(3);
    const c = club(Array(12).fill(3) as Skill[]);
    let s = night();
    for (const id of ids(12)) {
      s = must(c, s, as(id), { type: "register" }, T0);
      s = must(c, s, as(id), { type: "check-in" }, T0);
    }
    s = must(c, s, ORG, { type: "court-closed", court: 1, closed: true }, T0);
    s = must(c, s, ORG, { type: "court-closed", court: 3, closed: true }, T0);
    await store.put("s", s, 0);
    const assign = async (slots: [string, string, string, string]) => {
      for (;;) {
        const d = (await store.get(["s"])).get("s")!;
        const out = applySession(
          c,
          d.value as Session,
          ORG,
          { type: "assign", court: 2, slots },
          T0,
        );
        if (!out.ok) return out.error;
        if (await store.put("s", out.value, d.version)) return "ok";
      }
    };
    const results = await Promise.all([
      assign(["p1", "p2", "p3", "p4"]),
      assign(["p5", "p6", "p7", "p8"]),
    ]);
    expect(results.filter((r) => r === "ok")).toHaveLength(1);
    expect(results.find((r) => r !== "ok")).toMatch(/already has a game/);
    const final = (await store.get(["s"])).get("s")!.value as Session;
    expect(active(final)).toHaveLength(1);
  });
});
