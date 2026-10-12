import { DIMENSIONS, travelMinutes } from "./checks";
import type { Delta, Run } from "./compare";

/**
 * **The run, in words a person can act on.**
 *
 * The first line says where the evidence came from, in capitals, because a
 * fixture-only run that reads like a real one is exactly the kind of quiet
 * fabrication this critic exists to catch.
 */
const SOURCE: Record<Run["source"]["kind"], string> = {
  "live-atlas": "LIVE ATLAS",
  "atlas-snapshot": "ATLAS SNAPSHOT (a body real Atlas served, saved)",
  fixture: "FIXTURE ONLY — not evidence about real Atlas",
};

const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const cell = (s: string | number | undefined) =>
  s === undefined || s === "" ? "—" : String(s).replace(/\|/g, "\\|");

export function report(
  run: Run,
  delta: Delta | undefined,
  notes: readonly string[],
): string {
  const out: string[] = [];
  const s = run.source;
  out.push(
    `# GO HAVE A DAY critic — ${run.runId}`,
    "",
    `**Evidence: ${SOURCE[s.kind]}.** ${s.candidates} candidates from \`${s.where}\` (sha256 \`${s.sha256.slice(0, 12)}\`${s.fetchedAt ? `, fetched ${s.fetchedAt}` : ""}). The body answers \`on=${s.onDate ?? "—"}\`, \`childAge=${s.childAge ?? "—"}\`.`,
    "",
    `**Code:** \`${run.code.branch}\` at \`${run.code.commit}\`${run.code.dirty ? " **(uncommitted changes in src/)**" : ""}, day-code fingerprint \`${run.code.fingerprint}\`. **Day:** ${run.today}.`,
    "",
    `**What \`/go\` asked Atlas for:** on=${run.pageAsked.on ? "yes" : "**no**"}, childAge=${run.pageAsked.childAge ? "yes" : "**no**"}. What it didn't ask, the critic still knows from the body; that difference shows up below as findings the product could have avoided.`,
    "",
    "## Scores",
    "",
    "0–100, from the rules in `scripts/critic/checks.ts`. **Adventure is a proxy** (photo, stated things to do, a challenge), not a judgement. Judgements are listed separately per scenario.",
    "",
    `| | ${DIMENSIONS.join(" | ")} | overall |`,
    `| --- | ${DIMENSIONS.map(() => "---:").join(" | ")} | ---: |`,
    `| **all** | ${DIMENSIONS.map((d) => run.totals[d]).join(" | ")} | **${run.totals.overall}** |`,
    ...run.scenarios.map(
      (x) =>
        `| ${x.id} | ${DIMENSIONS.map((d) => x.scores[d]).join(" | ")} | ${x.scores.overall} |`,
    ),
    "",
    `**${run.totals.objectiveFindings} objective findings.** Distinct stops across the cohort: ${Object.entries(
      run.totals.distinctStops,
    )
      .map(([t, n]) => `${t} ${n}`)
      .join(", ")}.`,
    "",
  );

  if (delta) {
    out.push(
      `## Since ${delta.against}`,
      "",
      `**Why it may have moved:** ${delta.causes.length ? delta.causes.join(", ") : "nothing changed — same code, same data, same cohort"}.${delta.regressed ? " **REGRESSED.**" : ""}`,
      "",
      `Totals: ${Object.entries(delta.totals)
        .map(([k, v]) => `${k} ${sign(v)}`)
        .join(" · ")}`,
      "",
    );
    for (const sc of delta.scenarios.filter(
      (x) => x.added.length || x.removed.length || x.scores.overall !== 0,
    ))
      out.push(
        `- **${sc.id}** overall ${sign(sc.scores.overall ?? 0)}${sc.added.length ? ` · now: ${sc.added.join(", ")}` : ""}${sc.removed.length ? ` · gone: ${sc.removed.join(", ")}` : ""}`,
      );
    if (delta.newFindings.length)
      out.push(
        "",
        "**New findings:**",
        ...delta.newFindings.map((f) => `- \`${f.key}\` — ${f.detail}`),
      );
    if (delta.resolvedFindings.length)
      out.push(
        "",
        "**Resolved:**",
        ...delta.resolvedFindings.map((f) => `- \`${f.key}\``),
      );
    out.push("");
  }

  if (notes.length)
    out.push("## Harness notes", "", ...notes.map((n) => `- ${n}`), "");

  for (const x of run.scenarios) {
    const t = travelMinutes(x.signals.travelKm);
    out.push(
      `## ${x.id}`,
      "",
      `> _"${x.says}"_ — from ${x.town}`,
      "",
      `**Heard:** ${
        Object.entries(x.heard)
          .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join("/") : String(v)}`)
          .join(", ") || "nothing"
      }`,
      "",
      `**Day:** ${x.title} — _${x.opening}_`,
      "",
      "| # | stop | kind | from start | leg | Atlas: today | Atlas: age | rain / exposure | real world |",
      "| -: | --- | --- | --: | --: | --- | --- | --- | --- |",
      ...x.stops.map(
        (s, i) =>
          `| ${i + 1} | ${cell(s.title)}${s.locality ? ` (${cell(s.locality)})` : ""} | ${cell(s.subtype ?? s.kind)} | ${s.kmFromOrigin !== undefined ? `${s.kmFromOrigin} km` : "unplaced"} | ${s.legKm !== undefined ? `${s.legKm} km` : "—"} | ${cell(s.onDate)} | ${cell(s.forAge)} | ${cell([s.rain, s.exposure].filter(Boolean).join(" / "))} | ${cell(s.ledger ?? "unverified")} |`,
      ),
      "",
      `Travel (critic's estimate, not the product's): ${x.signals.travelKm} km straight-line out and back, at least ${t.floor} min, likely ~${t.likely} min. Photos ${x.signals.withPhoto}/${x.signals.stops} · things to do ${x.signals.withVerbs}/${x.signals.stops} · challenges ${x.signals.withChallenge}/${x.signals.stops} · hours known ${x.signals.withHours}/${x.signals.stops} · price known ${x.signals.withPrice}/${x.signals.stops} · Atlas knows today ${x.signals.dateKnown}/${x.signals.stops} · real-world verified ${x.signals.ledgerVerified}/${x.signals.stops}.`,
      "",
      `**On ${run.today}, Atlas says ${x.signals.onDayNearby} other placed things in \`/go\`'s own pool are on inside this day's circle** (${x.signals.onDayNearbyAtlas} across everything Atlas served)${x.missed.length ? ` — ${x.missed.join(", ")}` : ""}. Stops in the day Atlas says are on: ${x.signals.onDayUsed}.`,
      "",
    );
    if (x.findings.length)
      out.push(
        "**Objective findings**",
        "",
        ...x.findings.map(
          (f) =>
            `- \`${f.check}\` [${f.dimension}, ${f.basis}]${f.title ? ` **${f.title}**` : ""} — ${f.detail}`,
        ),
        "",
      );
    else out.push("**Objective findings:** none.", "");
    if (x.judgement)
      out.push(
        `**Judgement** (subjective — ${x.judgement.by}, ${x.judgement.on}${x.judgement.current ? "" : "; **STALE: the stops have changed since**"}): ${Object.entries(
          x.judgement.scores,
        )
          .map(([k, v]) => `${k} ${v}/5`)
          .join(", ")}. ${x.judgement.notes}`,
        "",
      );
  }
  return `${out.join("\n")}\n`;
}
