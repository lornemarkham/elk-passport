import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { summarise, type Options, type Summary } from "./fairness.sim";

const SCENARIOS: { name: string; o: Omit<Options, "seed"> }[] = [
  ...[60, 90, 120].map((minutes) => ({
    name: `${minutes} min, three open courts`,
    o: { minutes },
  })),
  {
    name: "90 min, Court 1 closed to group A, Court 3 closed to group C",
    o: {
      minutes: 90,
      eligible: {
        1: ["B", "C"],
        3: ["A", "B"],
      },
    },
  },
];

const f = (n: number) => n.toFixed(1);

function report() {
  const lines: string[] = [];
  const ratio = (a: number, b: number) =>
    a ? `${f((b / a) * 100 - 100)}%` : "–";
  for (const sc of SCENARIOS) {
    const fifo = summarise("fifo", sc.o);
    const fair = summarise("fair", sc.o);
    lines.push(`### ${sc.name}`, "");
    lines.push("| Measure | FIFO | Fairness engine |", "|---|---|---|");
    const row = (m: string, k: keyof Summary, d = 1) =>
      lines.push(
        `| ${m} | ${(fifo[k] as number).toFixed(d)} | ${(fair[k] as number).toFixed(d)} |`,
      );
    row("Average minutes played", "avgPlayed");
    row("Fewest minutes (worst night)", "fewest", 0);
    row("Most minutes (worst night)", "most", 0);
    row("Spread, most − fewest (avg)", "spread");
    row("Std. deviation of minutes", "stdev");
    row(
      "Players who barely played (<60% of avg), per night",
      "barelyPlayed",
      2,
    );
    row(
      "Players who played disproportionately (>140%), per night",
      "disproportionate",
      2,
    );
    row("Maximum wait (worst night, min)", "maxWait", 0);
    row("Maximum wait (avg of nights, min)", "avgMaxWait");
    row("Idle court-minutes with a line waiting", "idleCourtMinutes", 0);
    lines.push(
      `| Avg minutes — group A / B / C | ${(["A", "B", "C"] as const).map((l) => f(fifo.levelAvg[l])).join(" / ")} | ${(["A", "B", "C"] as const).map((l) => f(fair.levelAvg[l])).join(" / ")} |`,
    );
    row("Gap between levels (min)", "levelGap");
    lines.push(
      "",
      `Spread change: ${ratio(fifo.spread, fair.spread)}; barely-played change: ${ratio(fifo.barelyPlayed, fair.barelyPlayed)}.`,
      "",
    );
  }
  return lines.join("\n");
}

describe("fairness simulation: 25 players, three courts", () => {
  it("narrows the gap in court time against first-in-first-out", () => {
    for (const sc of SCENARIOS) {
      const fifo = summarise("fifo", sc.o);
      const fair = summarise("fair", sc.o);
      expect(fair.spread).toBeLessThan(fifo.spread);
      expect(fair.stdev).toBeLessThan(fifo.stdev);
      expect(fair.barelyPlayed).toBeLessThanOrEqual(fifo.barelyPlayed);
      // Never at the price of idle courts or someone left standing.
      expect(fair.idleCourtMinutes).toBeLessThanOrEqual(
        fifo.idleCourtMinutes * 1.1 + 5,
      );
      expect(fair.maxWait).toBeLessThanOrEqual(fifo.maxWait + 15);
    }
  });

  it("writes the report when asked", () => {
    const out = process.env.FAIRNESS_REPORT;
    if (!out) return;
    writeFileSync(out, report());
    expect(out).toBeTruthy();
  });
});
