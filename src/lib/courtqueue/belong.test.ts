import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { as, club, must, night, ORG, T0 } from "./testkit";
import { MOODS, emptyClub, tidyClub, type Club } from "./model";
import { nightView } from "./view";
import { changeNotices } from "./notices";
import { propose } from "./fair";

/** Everyone belongs: nothing in CourtQueue knows, shows or compares how good anyone is. */

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

describe("everyone belongs", () => {
  it("offers three friendly, optional ways to answer 'what sounds fun today?'", () => {
    expect(MOODS.map((m) => m.label)).toEqual([
      "I’m here to have fun!",
      "I’d love some friendly rallies.",
      "I’m up for a challenge!",
    ]);
  });

  it("drops stored skill levels, level history and court tiers the next time a club is read", () => {
    const old = emptyClub() as unknown as Club;
    old.courts[0]!.name = "Beginner Court";
    old.courts[1]!.name = "Intermediate Court";
    old.courts[2]!.name = "Expert Court";
    Object.assign(old.courts[2]!, { kind: "expert", minSkill: 4, maxSkill: 5 });
    old.players.a = {
      id: "a",
      name: "Ann",
      createdAt: 0,
      pinHash: "",
      tokenHashes: [],
      mentor: false,
      organizer: false,
      photo: false,
      ...{ skill: 1, skillHistory: [{ to: 1 }], statsPublic: true },
    };
    const tidy = tidyClub(old);
    expect(tidy.courts.map((c) => c.name)).toEqual([
      "Court 1",
      "Court 2",
      "Court 3",
    ]);
    expect(JSON.stringify(tidy)).not.toMatch(
      /skill|statsPublic|"kind"|Beginner|Expert|Intermediate/i,
    );
    // A club with none of it comes back as it was, untouched.
    expect(tidyClub(tidy)).toBe(tidy);
  });

  it("never sends a level, a score or a win record to anyone's phone", () => {
    const c = club(8);
    let s = night();
    for (const id of ids(8)) {
      s = must(c, s, as(id), { type: "register" }, T0);
      s = must(c, s, as(id), { type: "check-in" }, T0);
      s = must(c, s, as(id), { type: "play" }, T0);
    }
    s = must(c, s, as("p1"), { type: "mood", mood: "rallies" }, T0);
    const json = JSON.stringify(nightView(c, s, "p2", T0));
    expect(json).not.toMatch(/skill|rating|beginner|expert|intermediate/i);
    expect(json).not.toMatch(/"winner"|"wins"|"losses"|"winPct"|"points"/);
    // Nobody else's mood travels either.
    expect(json).not.toContain('"rallies"');
  });

  it("seats anyone with anyone, on any court, by turns and fresh faces — not by ability", () => {
    const c = club(12);
    let s = night();
    for (const id of ids(12)) {
      s = must(c, s, as(id), { type: "register" }, T0);
      s = must(c, s, as(id), { type: "check-in" }, T0);
    }
    s = must(c, s, as("p1"), { type: "mood", mood: "challenge" }, T0);
    s = must(c, s, as("p2"), { type: "mood", mood: "fun" }, T0);
    for (const id of ids(12)) s = must(c, s, as(id), { type: "play" }, T0);
    const games = s.games.filter((g) => g.status === "called");
    expect(games).toHaveLength(3);
    // Everyone got a game: the first twelve in line all play, none are passed over.
    expect(new Set(games.flatMap((g) => g.slots)).size).toBe(12);
    for (const g of games) expect(g.why.join(" ")).not.toMatch(/level|skill/i);
  });

  it("welcomes a newcomer next to a volunteer who is happy to say hello", () => {
    const c = club(8);
    // p8 joined this week; p3 is a volunteer host; everyone else is long-standing.
    const sessionDate = night().date;
    for (const id of ids(8)) c.players[id]!.createdAt = 0;
    c.players.p2!.createdAt = Date.parse(sessionDate) - 2 * 24 * 3600_000;
    c.players.p5!.mentor = true;
    let s = night();
    for (const id of ids(8)) {
      s = must(c, s, as(id), { type: "register" }, T0);
      s = must(c, s, as(id), { type: "check-in" }, T0);
    }
    s.queue = ids(8).map((id, i) => ({ playerId: id, since: T0 + i }));
    // p1 anchors. p2 is new; the volunteer host p5 is a little further back.
    const pick = propose(c, s, c.courts[0]!, T0 + 5 * 60_000)!;
    expect(pick.slots).toContain("p2");
    expect(pick.slots).toContain("p5");
    expect(pick.why.join(" ")).toMatch(/Player 5 is here to say hello/);
  });

  it("uses only warm words in notifications", () => {
    const c = club(16);
    let s = night();
    for (const id of ids(16)) {
      s = must(c, s, as(id), { type: "register" }, T0);
      s = must(c, s, as(id), { type: "check-in" }, T0);
    }
    const before = must(c, s, ORG, { type: "go-live" }, T0);
    let after = before;
    for (const id of ids(16))
      after = must(c, after, as(id), { type: "play" }, T0);
    after = must(
      c,
      after,
      as("p13"),
      {
        type: "challenge",
        slots: ["p13", "p14", "p15", "p16"],
      },
      T0,
    );
    const text = changeNotices(c, before, after)
      .map((n) => `${n.title} ${n.body}`)
      .join("\n");
    expect(text).not.toMatch(/challenged|score|level|skill|beat/i);
  });
});

describe("the source stays free of skill language", () => {
  const root = join(__dirname, "..", "..");
  const files = [
    ...readdirSync(join(root, "app", "badminton", "_ui")).map((f) =>
      join(root, "app", "badminton", "_ui", f),
    ),
    ...readdirSync(__dirname)
      .filter((f) => !/\.test\.ts$|testkit/.test(f) && f.endsWith(".ts"))
      .map((f) => join(__dirname, f)),
  ];
  it("has no Beginner / Intermediate / Expert tiers, win records or boards", () => {
    const banned =
      /\b(Beginner|Intermediate|Expert|Advanced)\b|skill|leaderboard|winPct|won–lost|club board|Level history/i;
    const hits = files.flatMap((f) =>
      readFileSync(f, "utf8")
        .split("\n")
        .map((line, i) => ({ f, line, n: i + 1 }))
        .filter(
          ({ line }) =>
            banned.test(line) &&
            // model.ts keeps the names it must scrub from old stored clubs.
            !/LEGACY|legacy|Clubs stored before|"skill"|skillHistory|statsPublic|beginner\|intermediate\|expert|skill levels/.test(
              line,
            ) &&
            !/^\s*"(minSkill|maxSkill)",$/.test(line) &&
            !/^\s*(\*|\/\/)/.test(line),
        ),
    );
    expect(hits.map((h) => `${h.f}:${h.n} ${h.line.trim()}`)).toEqual([]);
  });
});
