import { describe, expect, it } from "vitest";
import { renderBotRow, runupPlan, type BotRow, type Fan } from "./chirp";

const START = "2026-11-15T03:00:00+00:00";
let n = 0;
const row = (over: Partial<BotRow>): BotRow => ({
  id: `00000000-0000-0000-0000-${String(++n).padStart(12, "0")}`,
  actor_id: "u1",
  text: null,
  at: "2026-11-10T01:00:00Z",
  bot_key: null,
  bot_line: null,
  bot_sig: null,
  ...over,
});
const fans = new Map<string, Fan>([
  ["u1", { id: "u1", name: "Lorne", team: "CGY" }],
]);

describe("Chirp Bot and the run-up", () => {
  const base = {
    startsAt: START,
    timeZone: "UTC",
    members: 3,
    lastHumanNoteAt: "2026-11-10T00:00:00Z",
    seed: 3,
  };

  it("says one thing per stage, and nothing in the first week or on game day", () => {
    expect(
      runupPlan({ ...base, now: new Date("2026-11-05T20:00:00Z"), rows: [] }),
    ).toBeNull();
    const rivalry = runupPlan({
      ...base,
      now: new Date("2026-11-10T20:00:00Z"),
      rows: [],
    });
    expect(rivalry?.key).toBe("runup:2026-11-15T0300:rivalry");
    expect(rivalry?.line).toMatch(/^ru\.rv\./);
    expect(
      runupPlan({ ...base, now: new Date("2026-11-13T20:00:00Z"), rows: [] })
        ?.line,
    ).toMatch(/^ru\.ch\./);
    expect(
      runupPlan({ ...base, now: new Date("2026-11-14T20:00:00Z"), rows: [] })
        ?.line,
    ).toMatch(/^ru\.fn\./);
    expect(
      runupPlan({ ...base, now: new Date("2026-11-15T01:00:00Z"), rows: [] }),
    ).toBeNull();
  });

  it("never repeats a stage, and waits for a human to speak after its last line", () => {
    const said = row({
      bot_key: "runup:2026-11-15T0300:rivalry",
      bot_line: "ru.rv.1",
      at: "2026-11-10T02:00:00Z",
    });
    expect(
      runupPlan({
        ...base,
        now: new Date("2026-11-10T20:00:00Z"),
        rows: [said],
      }),
    ).toBeNull();
    // Next stage, but nobody has spoken since the last run-up line: silence.
    expect(
      runupPlan({
        ...base,
        now: new Date("2026-11-13T20:00:00Z"),
        rows: [said],
        lastHumanNoteAt: "2026-11-10T00:00:00Z",
      }),
    ).toBeNull();
    expect(
      runupPlan({
        ...base,
        now: new Date("2026-11-13T20:00:00Z"),
        rows: [said],
        lastHumanNoteAt: "2026-11-12T00:00:00Z",
      })?.line,
    ).toMatch(/^ru\.ch\./);
  });

  it("says nothing to a person alone", () => {
    expect(
      runupPlan({
        ...base,
        members: 1,
        now: new Date("2026-11-10T20:00:00Z"),
        rows: [],
      }),
    ).toBeNull();
  });

  it("renders with tonight's teams and the days", () => {
    const line = renderBotRow(
      row({ bot_key: "runup:2026-11-15T0300:rivalry", bot_line: "ru.rv.2" }),
      {
        fans,
        verify: () => true,
        sides: { home: "Canucks", away: "Wild" },
        daysOut: 5,
      },
    );
    expect(line?.text).toBe(
      "5 days to Canucks vs Wild and nobody has made a prophecy yet. Cowards, all of you.",
    );
  });
});
