import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { DiscoveryCandidate } from "@/lib/data/types";
import type { Experience } from "@/domain/experience/types";
import { readBrief, reviseBrief, type DayBrief } from "@/domain/day/brief";
import { buildDay, type DayPlanned } from "@/domain/day/build";
import { townById } from "@/domain/discovery/towns";
import { GoHaveADay } from "@/components/go/GoHaveADay";
import GoPage from "@/app/go/page";
import PrintPage from "@/app/go/print/page";
import { resolvePrintDay } from "@/lib/go/printDay";
import { dayQueryFor, writeDayQuery } from "@/lib/domains/integration/dayQuery";
import { COHORT, type Scenario } from "./cohort";
import { DIMENSIONS, examine, score, type Ledger, type Oracle } from "./checks";
import { compare, type Judged, type Run } from "./compare";
import { report } from "./report";

/**
 * **The GO HAVE A DAY critic — one run.**
 *
 * Asks the real `/go` page each cohort question, over one Atlas body, and
 * checks the day it builds and the paper it prints. It renders the pages
 * themselves (the route components, server-side), so what is measured is
 * what a person would get, not a re-implementation of it. Atlas is the only
 * thing replaced, and it is replaced by a body Atlas actually served, trimmed
 * to answer exactly the question the page asked — no `on=`, no `onDate`.
 *
 * The same body also serves as the **oracle**: it was fetched with `on=` and
 * `childAge=`, so it knows things the page never asked about. That gap is
 * the point — "Atlas would have told you it was closed" is a finding.
 *
 * Run it through `scripts/critic/run.sh`, which decides where the evidence
 * comes from and labels it. Direct use:
 *
 *   CRITIC_CORPUS=/tmp/candidates.json CRITIC_SOURCE_KIND=atlas-snapshot \
 *   CRITIC_RUN_DIR=/tmp/run npx vitest run -c scripts/critic/vitest.critic.config.ts
 */

const ROOT = resolve(__dirname, "../..");
const env = process.env;
const CORPUS = env.CRITIC_CORPUS;
const RUN_DIR = env.CRITIC_RUN_DIR ?? `/tmp/ghad-critic-${Date.now()}`;
const DOCS = join(ROOT, "docs/product/critic");

// ── The one thing replaced: Atlas, answering only what it was asked ────────

const atlas = vi.hoisted(() => ({
  body: [] as DiscoveryCandidate[],
  asked: [] as { childAge?: number; on?: string }[],
  answers: {
    onDate: undefined as string | undefined,
    childAge: undefined as number | undefined,
  },
  refused: [] as string[],
}));

vi.mock("@/lib/data/atlas-repo", () => ({
  listDiscoveryCandidates: async (childAge?: number, on?: string) => {
    atlas.asked.push({
      ...(childAge !== undefined ? { childAge } : {}),
      ...(on ? { on } : {}),
    });
    if (on && on !== atlas.answers.onDate)
      atlas.refused.push(
        `page asked on=${on}; the body answers ${atlas.answers.onDate ?? "no date"}`,
      );
    if (childAge !== undefined && childAge !== atlas.answers.childAge)
      atlas.refused.push(
        `page asked childAge=${childAge}; the body answers ${atlas.answers.childAge ?? "no age"}`,
      );
    return atlas.body.map((c) => asAsked(c, childAge, on));
  },
}));
vi.mock("@/lib/auth/currentUser", () => ({ currentUser: async () => null }));

/** What Atlas would have returned for this exact question. */
function asAsked(
  c: DiscoveryCandidate,
  childAge: number | undefined,
  on: string | undefined,
): DiscoveryCandidate {
  let out = c;
  if (!on || on !== atlas.answers.onDate) {
    if (out.schedule?.onDate) {
      const { onDate: _drop, ...schedule } = out.schedule;
      void _drop;
      out = { ...out, schedule };
    }
  }
  if (childAge === undefined || childAge !== atlas.answers.childAge) {
    if (out.suitability?.forAge) {
      const { forAge: _drop, ...suitability } = out.suitability;
      void _drop;
      out = { ...out, suitability };
    }
  }
  return out;
}

// ── Helpers ───────────────────────────────────────────────────────────────

const sha = (data: string | Buffer) =>
  createHash("sha256").update(data).digest("hex");

const readJson = <T,>(path: string, fallback: T): T =>
  existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : fallback;

/** The body's text, the same whether it was saved gzipped or not. */
const bodyText = (path: string) => {
  const raw = readFileSync(path);
  return (path.endsWith(".gz") ? gunzipSync(raw) : raw).toString("utf8");
};

function loadBody(path: string): DiscoveryCandidate[] {
  const text = bodyText(path);
  const parsed = JSON.parse(text) as
    DiscoveryCandidate[] | { candidates: DiscoveryCandidate[] };
  return Array.isArray(parsed) ? parsed : parsed.candidates;
}

const mostCommon = <T,>(xs: readonly T[]): T | undefined => {
  const counts = new Map<T, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
};

const git = (args: string) => {
  try {
    return execSync(`git ${args}`, { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
};

/** The files that decide what a day is. A change here is a code change. */
const CODE = [
  "src/domain/day",
  "src/components/go",
  "src/app/go",
  "src/domain/discovery/suitability.ts",
  "src/domain/discovery/environment.ts",
  "src/domain/discovery/recurrence.ts",
  "src/domain/discovery/defaultFeed.ts",
  "src/domain/discovery/towns.ts",
  "src/domain/experience/atlasMapper.ts",
];
function fingerprint(paths: readonly string[]): string {
  const files: string[] = [];
  const walk = (p: string) => {
    const abs = join(ROOT, p);
    if (!existsSync(abs)) return;
    if (statSync(abs).isDirectory())
      for (const f of readdirSync(abs).sort()) walk(join(p, f));
    else if (!/\.test\.tsx?$/.test(p)) files.push(p);
  };
  paths.forEach(walk);
  return sha(
    files.map((f) => `${f}\n${readFileSync(join(ROOT, f), "utf8")}`).join("\0"),
  ).slice(0, 16);
}

/** Depth-first search of a rendered element tree for one component. */
function findElement(
  node: ReactNode,
  type: unknown,
): ReactElement<Record<string, unknown>> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findElement(child, type);
      if (hit) return hit;
    }
    return undefined;
  }
  if (!isValidElement(node)) return undefined;
  const el = node as ReactElement<Record<string, unknown>>;
  if (el.type === type) return el;
  return findElement(el.props.children as ReactNode, type);
}

const text = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

const unescape = (s: string) => s.replace(/&amp;/g, "&");

/**
 * The print link `/go` builds, for a brief the page never rendered — the
 * revision probe needs it, and revisions are client state. Since integration
 * (M178) `/go` writes it through the one day-query codec, so this is that
 * codec rather than a replica — still checked against the real link on every
 * scenario before it is trusted (`harness.print-replica-drift`).
 */
function printParams(brief: DayBrief, day: DayPlanned) {
  return new URLSearchParams(writeDayQuery(dayQueryFor(brief, day)));
}

/**
 * The paper, rendered by the real page, and the day it printed — read through
 * the same resolver the page uses (`resolvePrintDay`), because the page now
 * renders `PrintableAdventure` from a view model, not a `DayPlanned`.
 */
async function renderPrint(params: URLSearchParams) {
  atlas.asked.length = 0;
  const query = Object.fromEntries(params.entries());
  const el = (await PrintPage({
    searchParams: Promise.resolve(query),
  })) as ReactElement;
  const html = renderToStaticMarkup(el);
  const asked = [...atlas.asked];
  const resolved = await resolvePrintDay(query);
  return {
    day: resolved.kind === "day" ? resolved.day : undefined,
    html,
    asked,
  };
}

// ── The run ───────────────────────────────────────────────────────────────

describe.skipIf(!CORPUS)("GO HAVE A DAY critic", () => {
  const results: Run["scenarios"][number][] = [];
  const shots: { id: string; go: string; print: string }[] = [];
  const pageAsked = { on: false, childAge: false };
  const harnessNotes: string[] = [];
  let ledger: Ledger = {};
  let oracle: Oracle;
  let today = "";

  it("asks every cohort question", async () => {
    const body = loadBody(CORPUS!);
    atlas.body = body;
    atlas.answers.onDate = mostCommon(
      body.map((c) => c.schedule?.onDate?.date).filter(Boolean),
    ) as string | undefined;
    atlas.answers.childAge = mostCommon(
      body
        .map((c) => c.suitability?.forAge?.age)
        .filter((a) => a !== undefined),
    ) as number | undefined;
    oracle = {
      byId: new Map(body.map((c) => [c.id, c])),
      ...(atlas.answers.onDate ? { onDate: atlas.answers.onDate } : {}),
      ...(atlas.answers.childAge !== undefined
        ? { childAge: atlas.answers.childAge }
        : {}),
    };
    today =
      env.CRITIC_TODAY ??
      atlas.answers.onDate ??
      new Date().toISOString().slice(0, 10);
    if (atlas.answers.onDate && today !== atlas.answers.onDate)
      harnessNotes.push(
        `Today is ${today} but the body answers on=${atlas.answers.onDate}: date checks are against the wrong day and are not run.`,
      );
    if (!atlas.answers.onDate)
      harnessNotes.push("The body was not fetched with on=: no date checks.");
    if (atlas.answers.childAge === undefined)
      harnessNotes.push(
        "The body was not fetched with childAge=: no age checks.",
      );

    // Noon in Vancouver, so the page's own "today" is the cohort's day.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${today}T19:00:00Z`));

    ledger = readJson<Ledger>(join(DOCS, "ledger.json"), {});
    const judgements = readJson<Record<string, JudgementEntry>>(
      join(DOCS, "judgements.json"),
      {},
    );

    for (const scenario of COHORT) {
      const query = { say: scenario.says, at: scenario.town };
      atlas.asked.length = 0;
      const page = await GoPage({ searchParams: Promise.resolve(query) });
      const asked = [...atlas.asked];
      if (asked.some((a) => a.on)) pageAsked.on = true;
      if (asked.some((a) => a.childAge !== undefined))
        pageAsked.childAge = true;

      const go = findElement(page, GoHaveADay);
      expect(go, "GoPage no longer renders GoHaveADay").toBeTruthy();
      const props = go!.props as { pool: readonly Experience[]; today: string };
      const goHtml = renderToStaticMarkup(go!);
      const href = goHtml.match(/href="(\/go\/print\?[^"]+)"/)?.[1];
      const screenParams = new URLSearchParams(
        href ? unescape(href).split("?")[1] : "",
      );
      const screenIds = (screenParams.get("stops") ?? "")
        .split(",")
        .filter(Boolean);

      // The critic's own reading, to know *why* — checked against the page.
      const brief = readBrief(scenario.says, {
        ...(townById(scenario.town) ? { town: townById(scenario.town)! } : {}),
        on: props.today,
      });
      const day = buildDay({ pool: props.pool, brief });

      const printed = href
        ? await renderPrint(screenParams)
        : { day: undefined, html: "", asked: [] };
      const printIds = printed.day?.stops.map((s) => s.experience.id) ?? [];

      // The revision probe: "Less driving", then print.
      let revised;
      const replica = printParams(brief, day);
      const sorted = (p: URLSearchParams) =>
        [...p.entries()]
          .sort()
          .map((e) => e.join("="))
          .join("&");
      if (href && sorted(replica) !== sorted(screenParams)) {
        harnessNotes.push(
          `${scenario.id}: the critic's print-link replica no longer matches /go's; revision probe skipped.`,
        );
      } else if (href) {
        const said = "Less driving";
        const rb = reviseBrief(brief, said);
        const rd = buildDay({ pool: props.pool, brief: rb });
        const ids = rd.stops.map((s) => s.experience.id);
        const rp = ids.length
          ? await renderPrint(printParams(rb, rd))
          : undefined;
        revised = {
          said,
          screenIds: ids,
          printIds: rp?.day?.stops.map((s) => s.experience.id) ?? [],
        };
      }

      const result = examine({
        scenario,
        origin: {
          latitude: brief.town!.latitude,
          longitude: brief.town!.longitude,
        },
        brief,
        day,
        oracle,
        ledger,
        screenIds,
        printIds,
        screenText: text(goHtml),
        printText: text(printed.html),
        poolIds: new Set(props.pool.map((x) => x.id)),
        printMapLinks: (printed.html.match(/google\.com\/maps\/search/g) ?? [])
          .length,
        ...(revised ? { revised } : {}),
      });
      results.push({
        ...result,
        scores: {
          ...Object.fromEntries(DIMENSIONS.map((d) => [d, 0])),
          overall: 0,
        } as Run["scenarios"][number]["scores"],
        ...judgedFor(
          judgements[scenario.id],
          result.stops.map((s) => s.id),
        ),
      });
      shots.push({
        id: scenario.id,
        go: `/go?${new URLSearchParams(query).toString()}`,
        print: href ? unescape(href) : "",
      });
    }
    vi.useRealTimers();
  });

  afterAll(() => {
    if (results.length === 0) return;
    // Repetition is a property of the cohort, so scores come last.
    const repeats = new Map<string, number>();
    for (const town of new Set(results.map((r) => r.town))) {
      const counts = new Map<string, number>();
      for (const r of results.filter((x) => x.town === town))
        for (const s of r.stops) counts.set(s.id, (counts.get(s.id) ?? 0) + 1);
      for (const [id, n] of counts) repeats.set(`${town}:${id}`, n);
    }
    // Two different questions answered with the same day: the answer did not
    // depend on the question. Measured, not judged.
    const withCohort = results.map((r, i) => {
      const ids = r.stops.map((s) => s.id).join(",");
      const twin = results
        .slice(0, i)
        .find(
          (o) =>
            o.town === r.town &&
            ids &&
            o.stops.map((s) => s.id).join(",") === ids,
        );
      return twin
        ? {
            ...r,
            findings: [
              ...r.findings,
              {
                key: `${r.id}:cohort.same-day`,
                scenario: r.id,
                check: "cohort.same-day",
                dimension: "variety" as const,
                basis: "page" as const,
                detail: `Exactly the same stops, in the same order, as "${twin.says}" (${twin.id}).`,
              },
            ],
          }
        : r;
    });
    const scored = withCohort.map((r) => {
      const scenario = COHORT.find((s) => s.id === r.id) as Scenario;
      const local = new Map(
        r.stops.map((s) => [s.id, repeats.get(`${r.town}:${s.id}`) ?? 0]),
      );
      return { ...r, scores: score(r, scenario, local) };
    });
    const mean = (k: (typeof DIMENSIONS)[number] | "overall") =>
      Math.round(scored.reduce((a, s) => a + s.scores[k], 0) / scored.length);

    const fetchedAt = env.CRITIC_FETCHED_AT;
    const run: Run = {
      schema: "ghad-critic/1",
      runId:
        env.CRITIC_RUN_ID ?? new Date().toISOString().replace(/[:.]/g, "-"),
      startedAt: new Date().toISOString(),
      today,
      source: {
        kind: (env.CRITIC_SOURCE_KIND as Run["source"]["kind"]) ?? "fixture",
        where: env.CRITIC_SOURCE_WHERE ?? CORPUS!,
        sha256: sha(bodyText(CORPUS!)),
        candidates: atlas.body.length,
        ...(fetchedAt ? { fetchedAt } : {}),
        ...(atlas.answers.onDate ? { onDate: atlas.answers.onDate } : {}),
        ...(atlas.answers.childAge !== undefined
          ? { childAge: atlas.answers.childAge }
          : {}),
      },
      code: {
        commit: git("rev-parse --short HEAD"),
        branch: git("rev-parse --abbrev-ref HEAD"),
        dirty: git("status --porcelain -- src").length > 0,
        fingerprint: fingerprint(CODE),
      },
      cohortFingerprint: fingerprint([
        "scripts/critic/cohort.ts",
        "scripts/critic/checks.ts",
      ]),
      pageAsked,
      scenarios: scored,
      totals: {
        ...(Object.fromEntries(DIMENSIONS.map((d) => [d, mean(d)])) as Record<
          (typeof DIMENSIONS)[number],
          number
        >),
        overall: mean("overall"),
        objectiveFindings: scored.reduce(
          (a, s) =>
            a +
            s.findings.filter((f) => !f.check.startsWith("harness.")).length,
          0,
        ),
        distinctStops: Object.fromEntries(
          [...new Set(scored.map((s) => s.town))].map((t) => [
            t,
            new Set(
              scored
                .filter((s) => s.town === t)
                .flatMap((s) => s.stops.map((x) => x.id)),
            ).size,
          ]),
        ),
      },
    };

    mkdirSync(RUN_DIR, { recursive: true });
    const previous = env.CRITIC_PREVIOUS;
    const delta =
      previous && existsSync(previous)
        ? compare(run, JSON.parse(readFileSync(previous, "utf8")) as Run)
        : undefined;
    writeFileSync(
      join(RUN_DIR, "run.json"),
      `${JSON.stringify(run, null, 2)}\n`,
    );
    if (delta)
      writeFileSync(
        join(RUN_DIR, "delta.json"),
        `${JSON.stringify(delta, null, 2)}\n`,
      );
    writeFileSync(
      join(RUN_DIR, "pages.json"),
      `${JSON.stringify(shots, null, 2)}\n`,
    );
    writeFileSync(
      join(RUN_DIR, "report.md"),
      report(run, delta, [...harnessNotes, ...atlas.refused]),
    );
  });
});

interface JudgementEntry {
  readonly stops: readonly string[];
  readonly by: string;
  readonly on: string;
  readonly scores: Readonly<Record<string, number>>;
  readonly notes: string;
}

/** A judgement applies to the stops it judged; otherwise it is stale. */
function judgedFor(
  entry: JudgementEntry | undefined,
  ids: readonly string[],
): { judgement?: Judged } {
  if (!entry) return {};
  const current =
    entry.stops.length === ids.length &&
    entry.stops.every((s, i) => s === ids[i]);
  return {
    judgement: {
      by: entry.by,
      on: entry.on,
      current,
      scores: entry.scores,
      notes: entry.notes,
    },
  };
}
