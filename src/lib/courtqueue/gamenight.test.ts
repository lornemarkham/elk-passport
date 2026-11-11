import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { instantOn } from "./clock";
import {
  COUNTDOWN_MS,
  longDate,
  registrationCountdown,
  spacesWords,
  untilWords,
} from "./countdown";
import {
  FICTIONAL_COUNT,
  addPlayer,
  advance,
  assignNext,
  finishGame,
  movePlayer,
  newGameNight,
  nextAt,
  nextEvent,
  onCourt,
  picture,
  playToEnd,
  removePlayer,
  rotate,
  setCourtClosed,
  setUnavailable,
  startGame,
  type GameNight,
} from "./gamenight";
import { MINUTE, isActiveGame } from "./model";
import { registrationOpensAt, sessionWindow } from "./schedule";

// Tuesday 2026-11-10, noon in Vancouver: the next club night is Thursday.
const TODAY = Date.parse("2026-11-10T12:00:00-07:00");
const fresh = (seed = 1) => newGameNight({ today: TODAY, seed });

function ok<T>(out: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!out.ok) throw new Error(out.error);
  return out.value;
}

/** Step until `done`, checking the night after every single event. */
function stepUntil(n: GameNight, done: (n: GameNight) => boolean) {
  for (let i = 0; i < 2000 && !done(n); i++) {
    const was = n.now;
    n = nextEvent(n);
    expect(n.now).toBeGreaterThanOrEqual(was);
    const busy = onCourt(n);
    expect(new Set(busy).size, "nobody on two courts").toBe(busy.length);
    expect(picture(n).broken).toBeNull();
  }
  return n;
}

describe("registration countdown", () => {
  const date = "2026-11-12";
  const opens = instantOn(date, "08:00")!;

  it("opens at 8:00 a.m. Vancouver time on the night's own date", () => {
    expect(registrationOpensAt(date)).toBe(opens);
    expect(new Date(opens).toISOString()).toBe("2026-11-12T15:00:00.000Z");
    expect(registrationOpensAt("2026-11-16")).toBe(
      Date.parse("2026-11-16T15:00:00Z"),
    );
  });

  it("names the day and time more than 12 hours ahead", () => {
    const c = registrationCountdown(date, opens - COUNTDOWN_MS - MINUTE);
    expect(c.state).toBe("scheduled");
    expect(c.headline).toBe(
      "Registration opens Thursday, November 12 at 8:00 a.m.",
    );
    expect(c.day).toBe("Thursday, November 12");
    expect(c.opens).toBe("Opens Thursday at 8:00 a.m.");
  });

  it("counts down inside the 12 hours", () => {
    expect(registrationCountdown(date, opens - COUNTDOWN_MS).state).toBe(
      "counting",
    );
    const c = registrationCountdown(date, opens - (11 * 60 + 42) * MINUTE);
    expect(c.headline).toBe("Registration opens in 11h 42m");
    expect(registrationCountdown(date, opens - 30_000).headline).toBe(
      "Registration opens in under a minute",
    );
    expect(untilWords(90 * MINUTE)).toBe("1h 30m");
    expect(untilWords(5 * MINUTE + 1)).toBe("6m");
  });

  it("says open at 8:00, and nothing more", () => {
    const c = registrationCountdown(date, opens);
    expect(c.state).toBe("open");
    expect(c.headline).toBe("Registration is open!");
    expect(spacesWords(12, 25)).toBe("13 of 25 spaces left");
    expect(spacesWords(25, 25)).toBe("Full — all 25 spaces taken");
    expect(longDate("2026-11-16")).toBe("Monday, November 16");
  });
});

describe("Test Game Night", () => {
  it("loads 25 fictional players for the club's next night", () => {
    const n = fresh();
    expect(n.date).toBe("2026-11-12");
    expect(n.cast).toHaveLength(25);
    expect(FICTIONAL_COUNT).toBe(25);
    expect(new Set(n.cast.map((f) => f.name)).size).toBe(25);
    expect(Object.keys(n.club.players)).toHaveLength(26); // + the organizer
    // A range of experience and of attendance, first-timers included.
    expect(new Set(n.cast.map((f) => f.level))).toEqual(
      new Set(["beginner", "intermediate", "advanced", null]),
    );
    expect(n.cast.filter((f) => f.nights === 0).length).toBeGreaterThan(1);
    expect(n.cast.filter((f) => f.nights >= 15).length).toBeGreaterThan(3);
    expect(n.now).toBeLessThan(registrationOpensAt(n.date));
    expect(picture(n).countdown.state).toBe("counting");
  });

  it("plays a whole night: registered, arriving, courts, rotation, summary", () => {
    let n = fresh();
    const stages = new Set<string>();
    const titles = new Set<string>();
    const watch = (x: GameNight) => {
      const p = picture(x);
      stages.add(p.moment.stage);
      titles.add(p.moment.title);
      return x.session.status === "ended";
    };
    n = stepUntil(n, watch);
    expect(n.session.status).toBe("ended");
    expect([...stages]).toEqual(["before", "during", "after"]);
    for (const t of [
      "Before registration",
      "Players registered",
      "Waiting for courts",
      "Players arriving",
      "Courts in play",
      "Session complete",
    ])
      expect(titles).toContain(t);

    const p = picture(n);
    expect(p.confirmed).toBe(25);
    expect(p.gamesPlayed).toBeGreaterThan(15);
    // Fair participation: everyone who came played, and nobody played more
    // than two games more than anyone else.
    const came = p.players.filter((r) => r.state === "done");
    expect(came.length).toBeGreaterThanOrEqual(23);
    for (const r of came) expect(r.games).toBeGreaterThan(0);
    expect(p.spread!.most - p.spread!.fewest).toBeLessThanOrEqual(2);
    expect(p.players.find((r) => r.state === "no-show")).toBeTruthy();
    expect(nextAt(n)).toBeNull();
  });

  it("is the same night for the same seed, and a different one for another", () => {
    const a = playToEnd(fresh(3));
    const b = playToEnd(fresh(3));
    const c = playToEnd(fresh(4));
    expect(a.session.games.map((g) => g.slots)).toEqual(
      b.session.games.map((g) => g.slots),
    );
    expect(a.session.games.map((g) => g.slots)).not.toEqual(
      c.session.games.map((g) => g.slots),
    );
  });

  it("explains every suggested game and who's next", () => {
    let n = fresh();
    n = stepUntil(n, (x) => x.session.games.filter(isActiveGame).length === 3);
    n = advance(n, 4);
    const p = picture(n);
    for (const c of p.courts) {
      expect(c.game).not.toBeNull();
      expect(c.game!.why.length).toBeGreaterThan(0);
      expect(c.game!.teams[0]).toHaveLength(2);
      expect(c.game!.teams[1]).toHaveLength(2);
    }
    expect(p.line.length).toBeGreaterThan(0);
    expect(p.courts.some((c) => c.next && c.next.why.length > 0)).toBe(true);
  });

  it("waiting times grow with the clock and reset when called", () => {
    let n = fresh();
    n = stepUntil(
      n,
      (x) =>
        x.session.queue.length >= 4 &&
        x.session.games.filter(isActiveGame).length === 3,
    );
    const head = picture(n).line[0]!;
    const later = advance(n, 3);
    const again = picture(later).players.find((r) => r.id === head.id)!;
    if (again.state === "in line")
      expect(again.waitingNow).toBe((head.waitingNow ?? 0) + 3);
    else expect(again.waited).toBeGreaterThanOrEqual(head.waited);
  });

  it("the organizer can start, finish, rotate, assign, move, close, rest, add and remove", () => {
    let n = fresh();
    n = stepUntil(n, (x) => x.session.games.filter(isActiveGame).length === 3);
    const called = n.session.games.find((g) => g.status === "called")!;
    n = ok(startGame(n, called.id));
    expect(n.session.games.find((g) => g.id === called.id)!.status).toBe(
      "playing",
    );
    n = ok(finishGame(n, called.id));
    expect(n.session.games.find((g) => g.id === called.id)!.status).toBe(
      "finished",
    );
    // The finished four are not in line until they tap back in.
    const four = n.session.games.find((g) => g.id === called.id)!.slots;
    for (const id of four)
      expect(n.session.queue.some((q) => q.playerId === id)).toBe(false);

    n = stepUntil(
      n,
      (x) => x.session.games.filter((g) => g.status === "playing").length >= 2,
    );
    const playing = n.session.games.filter((g) => g.status === "playing");
    const [a, b] = [playing[0]!, playing[1]!];
    const moved = ok(movePlayer(n, a.slots[0]!, b.slots[2]!));
    expect(moved.session.games.find((g) => g.id === b.id)!.slots).toContain(
      a.slots[0],
    );
    expect(moved.session.games.find((g) => g.id === a.id)!.slots).toContain(
      b.slots[2],
    );
    expect(picture(moved).broken).toBeNull();
    n = moved;

    n = stepUntil(
      n,
      (x) =>
        x.session.queue.length >= 4 &&
        x.session.games.some((g) => g.status === "playing"),
    );
    const busy = n.session.games.find((g) => g.status === "playing")!;
    const before = n.session.games.length;
    n = ok(assignNext(n, busy.court));
    expect(n.session.games.find((g) => g.id === busy.id)!.status).toBe(
      "finished",
    );
    expect(n.session.games.length).toBe(before + 1);
    expect(
      n.session.games.find((g) => g.court === busy.court && isActiveGame(g))!
        .status,
    ).toBe("called");

    n = stepUntil(n, (x) =>
      x.session.games.some((g) => g.status === "playing"),
    );
    const rotated = ok(rotate(n));
    expect(
      rotated.session.games.filter((g) => g.status === "playing"),
    ).toHaveLength(0);
    n = rotated;

    // Unavailable: out of the line, and the simulation leaves them out.
    const someone = n.session.queue[0]!.playerId;
    n = ok(setUnavailable(n, someone, true));
    n = advance(n, 40);
    expect(picture(n).players.find((r) => r.id === someone)!.state).toMatch(
      /unavailable|playing|called/,
    );
    n = ok(setUnavailable(n, someone, false));

    // Close a court: no new game goes there.
    const free = n.session.games.find(
      (g) => g.court === 3 && g.status === "playing",
    );
    if (free) n = ok(finishGame(n, free.id));
    const closedNow = setCourtClosed(n, 3, true);
    if (closedNow.ok) {
      n = advance(closedNow.value, 30);
      expect(
        n.session.games.some((g) => g.court === 3 && isActiveGame(g)),
      ).toBe(false);
      n = ok(setCourtClosed(n, 3, false));
    }

    // Tonight is full: a walk-in goes on the waitlist; removing someone lets
    // them in.
    n = ok(addPlayer(n));
    const walkIn = n.cast.at(-1)!;
    expect(picture(n).players.find((r) => r.id === walkIn.id)!.state).toBe(
      "waitlist",
    );
    const leaving = n.session.queue.at(-1)!.playerId;
    n = ok(removePlayer(n, leaving));
    expect(picture(n).players.find((r) => r.id === leaving)!.state).toBe(
      "removed",
    );
    expect(n.session.roster.find((r) => r.playerId === walkIn.id)!.status).toBe(
      "confirmed",
    );
    n = advance(n, 20);
    expect(n.session.present[walkIn.id]).toBeTruthy();
    expect(picture(n).broken).toBeNull();
  });

  it("refuses moves that would put someone in two places", () => {
    let n = fresh();
    n = stepUntil(n, (x) => x.session.games.filter(isActiveGame).length === 3);
    const g = n.session.games.find(isActiveGame)!;
    const out = movePlayer(n, g.slots[0]!, g.slots[1]!);
    expect(out.ok).toBe(false);
    const queuedId = n.session.queue[0]?.playerId;
    if (queuedId) expect(movePlayer(n, queuedId, g.slots[0]!).ok).toBe(false);
  });

  it("runs on the copy it was given: the starting night is never changed", () => {
    const n = fresh();
    const frozen = JSON.stringify(n);
    playToEnd(n);
    nextEvent(n);
    expect(JSON.stringify(n)).toBe(frozen);
  });

  it("starts the night at doors open and ends it at the booked end", () => {
    const n = playToEnd(fresh());
    const { end } = sessionWindow(n.date);
    expect(n.session.endedAt).toBe(end);
  });

  it("touches nothing real: no store, server, notification or chat code", () => {
    const src = readFileSync(join(__dirname, "gamenight.ts"), "utf8");
    const imports = [...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    for (const banned of [
      "./store",
      "./service",
      "./push",
      "./webpush",
      "./chat",
      "./notices",
      "./http",
    ])
      expect(imports).not.toContain(banned);
    expect(src).not.toMatch(/fetch\(|localStorage|process\.env/);
  });
});
