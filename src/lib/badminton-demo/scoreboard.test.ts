import { describe, expect, it } from "vitest";
import {
  COURT_COUNT,
  advance,
  balance,
  clockLabel,
  estimatedWaits,
  finishMatch,
  newDemo,
  pickFour,
  playNext,
  queue,
  restore,
  rotateAll,
  swapIn,
  toggleRest,
  validScore,
  type Demo,
} from "./scoreboard";

const seated = (d: Demo) =>
  d.courts.flatMap((m) => (m ? [...m.teams[0], ...m.teams[1]] : []));

describe("Badminton Game Night scoreboard demo", () => {
  it("opens with 25 fictional players, levels 1–5, and 4 doubles courts in play", () => {
    const d = newDemo();
    expect(d.players).toHaveLength(25);
    expect(new Set(d.players.map((p) => p.level))).toEqual(
      new Set([1, 2, 3, 4, 5]),
    );
    expect(d.courts).toHaveLength(COURT_COUNT);
    for (const m of d.courts) {
      expect(m).not.toBeNull();
      expect(m!.teams[0]).toHaveLength(2);
      expect(m!.teams[1]).toHaveLength(2);
    }
    expect(new Set(seated(d)).size).toBe(16);
    expect(queue(d)).toHaveLength(9);
  });

  it("always seats the front of the line, and balances the two pairs by level", () => {
    const d = newDemo();
    const line = queue(d);
    const four = pickFour(line)!;
    expect(four[0]!.id).toBe(line[0]!.id);
    const [a, b] = balance(four);
    const lv = (id: string) => d.players.find((p) => p.id === id)!.level;
    const gap = Math.abs(lv(a[0]) + lv(a[1]) - lv(b[0]) - lv(b[1]));
    expect(gap).toBeLessThanOrEqual(2);
  });

  it("accepts only finished badminton scores", () => {
    for (const [a, b] of [
      [21, 0],
      [21, 19],
      [19, 21],
      [22, 20],
      [29, 27],
      [30, 29],
      [30, 28],
    ])
      expect(validScore(a!, b!), `${a}-${b}`).toBe(true);
    for (const [a, b] of [
      [21, 20],
      [20, 18],
      [25, 20],
      [30, 27],
      [31, 29],
      [21, 21],
      [-1, 21],
    ])
      expect(validScore(a!, b!), `${a}-${b}`).toBe(false);
  });

  it("records a score, credits a win to one pair and a loss to the other, and rotates them to the back", () => {
    const d = advance(newDemo(), 3);
    const m = d.courts[0]!;
    const out = finishMatch(d, 1, [21, 15]);
    if (!out.ok) throw new Error(out.error);
    const after = out.demo;
    const p = (id: string) => after.players.find((x) => x.id === id)!;
    for (const id of m.teams[0]) {
      expect(p(id)).toMatchObject({ games: 1, wins: 1, losses: 0 });
      expect(p(id).minutesPlayed).toBe(3);
    }
    for (const id of m.teams[1])
      expect(p(id)).toMatchObject({ games: 1, wins: 0, losses: 1 });
    expect(after.results[0]).toMatchObject({ id: m.id, score: [21, 15] });
    // The court refilled from the line, and the four are now behind everyone.
    expect(after.courts[0]).not.toBeNull();
    expect(after.courts[0]!.id).not.toBe(m.id);
    const line = queue(after).map((x) => x.id);
    for (const id of [...m.teams[0], ...m.teams[1]])
      expect(line.indexOf(id)).toBeGreaterThanOrEqual(line.length - 4);
  });

  it("refuses an unfinished score", () => {
    const out = finishMatch(newDemo(), 1, [21, 20]);
    expect(out.ok).toBe(false);
  });

  it("runs a whole evening fairly: everyone plays, records add up, nobody is on two courts", () => {
    let d = newDemo(42);
    for (let i = 0; i < 180; i++) {
      d = advance(d, 1);
      const on = seated(d);
      expect(new Set(on).size).toBe(on.length);
    }
    const games = d.players.map((p) => p.games);
    expect(Math.min(...games)).toBeGreaterThan(0);
    // Matches run 12–20 minutes and the four who finish together rejoin
    // together, so even strict first-in-line spreads by a few games.
    expect(Math.max(...games) - Math.min(...games)).toBeLessThanOrEqual(4);
    for (const p of d.players) expect(p.wins + p.losses).toBe(p.games);
    const wins = d.players.reduce((s, p) => s + p.wins, 0);
    const losses = d.players.reduce((s, p) => s + p.losses, 0);
    expect(wins).toBe(losses);
    for (const r of d.results) expect(validScore(...r.score!)).toBe(true);
  });

  it("is deterministic for a seed", () => {
    expect(advance(newDemo(7), 60)).toEqual(advance(newDemo(7), 60));
  });

  it("estimates waits that never go down further back in line", () => {
    const d = advance(newDemo(), 5);
    const waits = estimatedWaits(d);
    const line = queue(d);
    expect(waits.size).toBe(line.length);
    const ordered = line.map((p) => waits.get(p.id)!);
    for (let i = 1; i < ordered.length; i++)
      expect(ordered[i]!).toBeGreaterThanOrEqual(ordered[i - 1]!);
    const soonest = Math.min(
      ...d.courts.map((m) => Math.max(m!.endsAt - d.now, 0)),
    );
    expect(ordered[0]).toBe(soonest);
  });

  it("lets a waiting player sit out and come back at the back of the line", () => {
    const d = newDemo();
    const first = queue(d)[0]!;
    const resting = toggleRest(d, first.id);
    expect(queue(resting).map((p) => p.id)).not.toContain(first.id);
    const back = toggleRest(advance(resting, 1), first.id);
    expect(queue(back).at(-1)!.id).toBe(first.id);
    // Someone on court can't be sat out.
    const playing = d.courts[0]!.teams[0][0];
    expect(toggleRest(d, playing)).toBe(d);
  });

  it("restores a saved night and refuses anything else", () => {
    const d = advance(newDemo(), 20);
    expect(restore(JSON.stringify(d))).toEqual(d);
    expect(restore(null)).toBeNull();
    expect(restore("{oops")).toBeNull();
    expect(restore(JSON.stringify({ ...d, v: 0 }))).toBeNull();
  });

  it("tells the time from 7 pm", () => {
    expect(clockLabel(0)).toBe("7:00 pm");
    expect(clockLabel(65)).toBe("8:05 pm");
    expect(clockLabel(300)).toBe("12:00 am");
  });

  it("gives someone an extra game: they go to the front and take the next court", () => {
    let d = newDemo();
    const last = queue(d).at(-1)!;
    d = playNext(d, last.id);
    expect(queue(d)[0]!.id).toBe(last.id);
    const out = finishMatch(d, 1, [21, 15]);
    if (!out.ok) throw new Error(out.error);
    expect(seated(out.demo)).toContain(last.id);
  });

  it("overrides an assignment: a waiting player takes a seat, the other joins the line", () => {
    const d = newDemo();
    const on = d.courts[0]!.teams[0][0];
    const off = queue(d)[7]!;
    const out = swapIn(d, 1, on, off.id);
    if (!out.ok) throw new Error(out.error);
    expect(out.demo.courts[0]!.teams[0]).toContain(off.id);
    expect(out.demo.players.find((p) => p.id === on)!.status).toBe("waiting");
    expect(new Set(seated(out.demo)).size).toBe(16);
    expect(swapIn(d, 1, on, d.courts[1]!.teams[0][0]).ok).toBe(false);
  });

  it("rotates every court at once and nobody is on two", () => {
    const d = rotateAll(newDemo());
    expect(d.results).toHaveLength(4);
    expect(d.courts.every(Boolean)).toBe(true);
    expect(new Set(seated(d)).size).toBe(16);
  });
});
