import type { DayBrief } from "@/domain/day/brief";
import type { DayPlanned } from "@/domain/day/build";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { distanceKm } from "@/lib/environment/geo";
import type { Scenario } from "./cohort";

/**
 * **What the critic checks, and how a check is allowed to fail.**
 *
 * Three kinds of output, never mixed:
 *
 * ```
 * finding    objective: a stated fact, a said word or a rendered page
 *            contradicts the day. Every finding names its evidence.
 * signal     measured: a number about the day (km, shares, counts). Not
 *            good or bad by itself; it feeds the scores.
 * judgement  subjective: a person or agent's opinion, kept in
 *            docs/product/critic/judgements.json, never computed here.
 * ```
 *
 * **Silence is never a failure and never a pass.** Where Atlas says nothing
 * about the rain, the age or the date, the stop is counted as *unknown*, and
 * the unknowns are reported next to the failures so a day can't look clean
 * just because nothing was known about it.
 */

export type Dimension =
  "factual" | "relevance" | "variety" | "practicality" | "adventure" | "trust";

export const DIMENSIONS: readonly Dimension[] = [
  "factual",
  "relevance",
  "variety",
  "practicality",
  "adventure",
  "trust",
];

export interface Finding {
  /** Stable across runs: `scenario:check[:subject]`. Comparisons key on it. */
  readonly key: string;
  readonly scenario: string;
  readonly check: string;
  readonly dimension: Dimension;
  readonly subject?: string;
  readonly title?: string;
  /** What was found, with the evidence, in a sentence. */
  readonly detail: string;
  /** `stated` — Atlas or the page says so. `derived` — Atlas's own inference. */
  readonly basis: "stated" | "derived" | "page" | "ledger";
}

/** A real-world check made outside Atlas, by a person or an agent. */
export interface LedgerEntry {
  readonly title: string;
  readonly verdict:
    | "exists"
    | "exists-with-caveat"
    | "closed"
    | "not-found"
    | "wrong-location"
    | "not-open-on-date";
  readonly checked: string;
  readonly by: string;
  readonly sources: readonly string[];
  /** What the source says about the cohort's day, in its own terms. */
  readonly hoursOnDate?: string;
  readonly notes?: string;
}
export type Ledger = Readonly<Record<string, LedgerEntry>>;

export interface Point {
  readonly latitude: number;
  readonly longitude: number;
}

/** What Atlas would have said with every question asked: the oracle. */
export interface Oracle {
  readonly byId: ReadonlyMap<string, DiscoveryCandidate>;
  /** The `on=` date the oracle body answers, where it was asked one. */
  readonly onDate?: string;
  /** The `childAge=` the oracle body answers, where it was asked one. */
  readonly childAge?: number;
}

/**
 * **Travel, estimated by the critic — never by the product.**
 *
 * Straight-line legs, out and back home, turned into a range: a floor that
 * no real road beats (×1.2 road factor at 80 km/h) and a likely figure
 * (×1.4 at 50 km/h). Atlas measured road/straight ratios of 1.12–2.75 for
 * routed legs (`lane/maps`), so the floor is generous to the plan. When a
 * routing source lands, replace this with it and say so in the report.
 */
export const travelMinutes = (km: number) => ({
  floor: Math.round(((km * 1.2) / 80) * 60),
  likely: Math.round(((km * 1.4) / 50) * 60),
});

/** The shortest time a stop is worth: the builder's own floor. */
const MIN_STOP_MINUTES = 30;

const pointOf = (c: DiscoveryCandidate | undefined): Point | undefined => {
  const xy = c?.geography?.coordinates ?? c?.coordinates;
  return xy ? { latitude: xy[1], longitude: xy[0] } : undefined;
};

interface Exposure {
  readonly value?: string;
  readonly basis?: string;
  readonly evidence?: string;
}
const exposureOf = (c: DiscoveryCandidate | undefined): Exposure | undefined =>
  (c?.environment as { exposure?: Exposure } | undefined)?.exposure;

/** `YYYY-MM-DD` of an instant, in the zone everything Atlas holds is in. */
const dayIn = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Vancouver",
  }).format(new Date(iso));

export interface StopRecord {
  readonly id: string;
  readonly title: string;
  readonly kind: string;
  readonly subtype?: string;
  readonly locality?: string;
  readonly placed: boolean;
  readonly kmFromOrigin?: number;
  readonly legKm?: number;
  readonly minutes: number;
  readonly because: string;
  readonly open?: string;
  readonly cost?: string;
  readonly challenge?: string;
  readonly photo: boolean;
  readonly verbs: readonly string[];
  /** Oracle: what Atlas says about the date, with `on=` asked. */
  readonly onDate?: string;
  /** Oracle: Atlas's verdict for the cohort's child age, with `childAge=` asked. */
  readonly forAge?: string;
  readonly rain?: string;
  readonly exposure?: string;
  readonly ledger?: LedgerEntry["verdict"];
  readonly sourceUrl?: string;
}

export interface Signals {
  readonly stops: number;
  readonly placed: number;
  readonly distinctKinds: number;
  readonly travelKm: number;
  readonly travel: { readonly floor: number; readonly likely: number };
  readonly hoursPlanned: number;
  readonly withPhoto: number;
  readonly withVerbs: number;
  readonly withChallenge: number;
  readonly withHours: number;
  readonly withPrice: number;
  readonly dateKnown: number;
  readonly ageKnown: number;
  readonly ledgerVerified: number;
  readonly farthestKm?: number;
  /**
   * Placed things Atlas says are on that day, inside the day's own circle,
   * that the day did not use. Not a failure: a measure of what was there.
   */
  readonly onDayNearby: number;
  /** The same, across everything Atlas served, before `/go`'s feed policy. */
  readonly onDayNearbyAtlas: number;
  readonly onDayUsed: number;
}

export interface DayEvidence {
  readonly scenario: Scenario;
  readonly origin: Point;
  readonly brief: DayBrief;
  readonly day: DayPlanned;
  readonly oracle: Oracle;
  readonly ledger: Ledger;
  /** Stop ids, in order, as `/go` rendered them. */
  readonly screenIds: readonly string[];
  /** Stop ids, in order, as `/go/print` rendered them from `/go`'s own link. */
  readonly printIds: readonly string[];
  /** Visible text of both pages, for broken-text checks. */
  readonly screenText: string;
  readonly printText: string;
  /** Ids `/go` had to choose from: its pool after the feed policy. */
  readonly poolIds: ReadonlySet<string>;
  /** Map links on the printed guide. */
  readonly printMapLinks: number;
  /** After the "Less driving" revision: screen ids vs printed ids. */
  readonly revised?: {
    readonly said: string;
    readonly screenIds: readonly string[];
    readonly printIds: readonly string[];
  };
}

export interface ScenarioResult {
  readonly id: string;
  readonly town: string;
  readonly says: string;
  readonly heard: Readonly<Record<string, unknown>>;
  readonly title: string;
  readonly opening: string;
  readonly stops: readonly StopRecord[];
  readonly unknowns: readonly string[];
  readonly findings: readonly Finding[];
  readonly signals: Signals;
  /** Evidence the day can be judged on at all: share of facts known. */
  /** Up to five of `onDayNearby` (in `/go`'s pool), nearest first. */
  readonly missed: readonly string[];
  readonly coverage: {
    readonly date: number;
    readonly realWorld: number;
  };
}

const pct = (n: number, d: number) => (d === 0 ? 0 : n / d);

/**
 * Words that mean something rendered a value that wasn't there — or a
 * number that was never checked against its noun ("1 hours").
 */
const BROKEN =
  /\bundefined\b|\bNaN\b|\[object Object\]|\bnull\b|\b1 (?:hours|stops|minutes)\b/;

export function examine(e: DayEvidence): ScenarioResult {
  const { scenario, brief, day, oracle, origin } = e;
  const findings: Finding[] = [];
  const add = (f: Omit<Finding, "key" | "scenario">) =>
    findings.push({
      ...f,
      scenario: scenario.id,
      key: [scenario.id, f.check, f.subject].filter(Boolean).join(":"),
    });

  // ── Did it hear what was said? ─────────────────────────────────────────
  const h = scenario.hears;
  if (h.hours !== undefined && brief.hours !== h.hours)
    add({
      check: "reading.hours",
      dimension: "relevance",
      basis: "page",
      detail: `Said ${h.hours} hours; read ${brief.hours ?? "nothing"}.`,
    });
  if (h.childAge && brief.childAge === undefined)
    add({
      check: "reading.child-age",
      dimension: "relevance",
      basis: "page",
      detail:
        "Children's ages were said; no age was read, so Atlas was never asked who this suits.",
    });
  if (h.shelter && brief.shelter !== h.shelter)
    add({
      check: "reading.shelter",
      dimension: "relevance",
      basis: "page",
      detail: `Asked for ${h.shelter}; read ${brief.shelter ?? "nothing"}.`,
    });
  if (h.appetite && brief.appetite !== h.appetite)
    add({
      check: "reading.appetite",
      dimension: "relevance",
      basis: "page",
      detail: `Asked for ${h.appetite}; read ${brief.appetite ?? "nothing"}.`,
    });
  const reach = reachOf(day);
  if (h.reachAtLeastKm !== undefined && (reach ?? 0) < h.reachAtLeastKm)
    add({
      check: "reading.reach",
      dimension: "relevance",
      basis: "page",
      detail: `Asked to go further; the day was drawn inside ${reach ?? "no stated"} km (wanted at least ${h.reachAtLeastKm}).${brief.hours !== undefined ? ` Read as ${brief.hours} hour(s).` : ""}`,
    });
  if (h.reachAtMostKm !== undefined && (reach ?? Infinity) > h.reachAtMostKm)
    add({
      check: "reading.reach",
      dimension: "relevance",
      basis: "page",
      detail: `Asked to stay close; the day was drawn inside ${reach ?? "no stated"} km (wanted at most ${h.reachAtMostKm}).`,
    });
  for (const word of h.unheld ?? [])
    add({
      check: `reading.unheld.${word.split(" ")[0]}`,
      dimension: "relevance",
      basis: "page",
      detail: `Said "${word}"; the brief has nowhere to hold it, so the day ignores it.`,
    });

  // ── Each stop, against the oracle ──────────────────────────────────────
  let previous: Point | undefined = origin;
  let travelKm = 0;
  const stops: StopRecord[] = day.stops.map((stop) => {
    const x = stop.experience;
    const raw = oracle.byId.get(x.id);
    const here = pointOf(raw);
    const leg = previous && here ? distanceKm(previous, here) : undefined;
    if (leg !== undefined) travelKm += leg;
    previous = here ?? previous;
    const fromOrigin = here ? distanceKm(origin, here) : undefined;
    const onDate = raw?.schedule?.onDate;
    const forAge = raw?.suitability?.forAge;
    // Atlas serves `verdict` beside `reading`; this branch's type has only
    // `reading`, which says the same thing in the cases checked here.
    const ageVerdict = forAge
      ? ((forAge as { verdict?: string }).verdict ?? forAge.reading)
      : undefined;
    const exposure = exposureOf(raw);
    const rain = raw?.environment?.rain?.reading;
    const ledger = e.ledger[x.id];
    const subject = x.id;
    const title = x.title;

    if (!raw)
      add({
        check: "stop.not-in-atlas",
        dimension: "factual",
        basis: "stated",
        subject,
        title,
        detail: "Not in the Atlas body the day was built from.",
      });
    if (!here)
      add({
        check: "stop.unplaced",
        dimension: "practicality",
        basis: "stated",
        subject,
        title,
        detail: `Atlas holds no coordinates${x.geography?.locality ? ` (only the town ${x.geography.locality})` : ""}: no travel can be worked out and the map link is a name search.`,
      });
    if (onDate && onDate.date === oracle.onDate && onDate.reading === "not-on")
      add({
        check: "stop.not-on-date",
        dimension: "factual",
        basis: "stated",
        subject,
        title,
        detail: `Atlas says it is not on ${onDate.date}${onDate.basis ? ` (${onDate.basis})` : ""}.`,
      });
    if (stop.open && onDate?.reading === "not-on")
      add({
        check: "claim.open-contradicted",
        dimension: "factual",
        basis: "stated",
        subject,
        title,
        detail: `The day says "${stop.open}" and Atlas says it is not on ${onDate.date}.`,
      });
    const ends = x.endTime ?? x.startTime;
    if (
      x.kind === "Event" &&
      ends &&
      oracle.onDate &&
      dayIn(ends) < oracle.onDate
    )
      add({
        check: "stop.event-over",
        dimension: "factual",
        basis: "stated",
        subject,
        title,
        detail: `An event that ended ${dayIn(ends)}, before ${oracle.onDate}.`,
      });
    if (
      ledger &&
      ledger.verdict !== "exists" &&
      ledger.verdict !== "exists-with-caveat"
    )
      add({
        check: `stop.real-world.${ledger.verdict}`,
        dimension: "factual",
        basis: "ledger",
        subject,
        title,
        detail: `${ledger.verdict} — ${ledger.notes ?? ""} (checked ${ledger.checked} by ${ledger.by}: ${ledger.sources.join(", ")})`,
      });

    const n = scenario.needs;
    if (n.sheltered) {
      if (rain === "exposed" || rain === "weather-dependent")
        add({
          check: "need.sheltered",
          dimension: "relevance",
          basis: "stated",
          subject,
          title,
          detail: `Asked for somewhere dry; Atlas reads the rain here as "${rain}".`,
        });
      else if (
        exposure?.value === "outdoor" &&
        rain !== "sheltered" &&
        rain !== "partly-sheltered" &&
        rain !== "runs-in-rain"
      )
        add({
          check: "need.sheltered",
          dimension: "relevance",
          basis: exposure.basis === "derived" ? "derived" : "stated",
          subject,
          title,
          detail: `Asked for somewhere dry; Atlas reads it as outdoors (${exposure.basis ?? "?"}: ${exposure.evidence ?? "?"}).`,
        });
    }
    if (n.youngChildren) {
      if (ageVerdict === "excluded")
        add({
          check: "need.young-children",
          dimension: "relevance",
          basis: "stated",
          subject,
          title,
          detail: `Atlas says it is not for a ${forAge?.age}-year-old.`,
        });
    }
    if (
      n.withinKm !== undefined &&
      fromOrigin !== undefined &&
      fromOrigin > n.withinKm
    )
      add({
        check: "need.within",
        dimension: "relevance",
        basis: "stated",
        subject,
        title,
        detail: `${fromOrigin.toFixed(1)} km from the start; asked to stay within ${n.withinKm}.`,
      });

    const verbs = (x.knowledge?.affordances ?? []).map((a) => a.name);
    return {
      id: x.id,
      title,
      kind: x.kind,
      ...(x.subtype ? { subtype: x.subtype } : {}),
      ...(x.geography?.locality ? { locality: x.geography.locality } : {}),
      placed: Boolean(here),
      ...(fromOrigin !== undefined ? { kmFromOrigin: round1(fromOrigin) } : {}),
      ...(leg !== undefined ? { legKm: round1(leg) } : {}),
      minutes: stop.minutes,
      because: stop.because,
      ...(stop.open ? { open: stop.open } : {}),
      ...(stop.cost ? { cost: stop.cost } : {}),
      ...(stop.challenge ? { challenge: stop.challenge } : {}),
      photo: Boolean(x.heroMedia?.src),
      verbs,
      ...(onDate ? { onDate: onDate.reading } : {}),
      ...(ageVerdict ? { forAge: ageVerdict } : {}),
      ...(rain ? { rain } : {}),
      ...(exposure?.value
        ? { exposure: `${exposure.value} (${exposure.basis ?? "?"})` }
        : {}),
      ...(ledger ? { ledger: ledger.verdict } : {}),
    };
  });

  // The way home counts: nobody's day ends at the last stop.
  if (previous && previous !== origin) travelKm += distanceKm(previous, origin);
  const travel = travelMinutes(travelKm);

  // ── The day as a whole ────────────────────────────────────────────────
  if (day.stops.length === 0)
    add({
      check: "day.empty",
      dimension: "practicality",
      basis: "page",
      detail: "No stops at all.",
    });

  const hours = scenario.needs.fitsHours ?? brief.hours;
  if (hours !== undefined && stops.length > 0) {
    const left = hours * 60 - travel.floor;
    if (left < MIN_STOP_MINUTES * stops.length)
      add({
        check: "day.does-not-fit",
        dimension: "practicality",
        basis: "stated",
        detail: `${stops.length} stops in ${hours} h, with at least ${travel.floor} min of driving (${round1(travelKm)} km straight-line, out and back) leaves ${Math.max(0, left)} min — under ${MIN_STOP_MINUTES} min a stop.`,
      });
  }

  const beyond = scenario.needs.someStopBeyondKm;
  const farthest = Math.max(-1, ...stops.map((s) => s.kmFromOrigin ?? -1));
  if (beyond !== undefined && farthest < beyond)
    add({
      check: "need.worth-the-drive",
      dimension: "relevance",
      basis: "stated",
      detail: `Asked for something worth a longer drive; the farthest placed stop is ${farthest < 0 ? "unknown" : `${round1(farthest)} km`} (wanted one beyond ${beyond} km).`,
    });

  const titles = stops.map((s) => s.title.trim().toLowerCase());
  const dupes = titles.filter((t, i) => titles.indexOf(t) !== i);
  for (const t of new Set(dupes))
    add({
      check: "day.duplicate-title",
      dimension: "variety",
      basis: "stated",
      detail: `"${t}" appears twice in one day — two Atlas records for one place, or the same place twice.`,
    });

  // ── Screen → paper ────────────────────────────────────────────────────
  const same = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((x, i) => x === b[i]);
  if (
    !same(
      e.screenIds,
      day.stops.map((s) => s.experience.id),
    )
  )
    add({
      check: "harness.screen-drift",
      dimension: "trust",
      basis: "page",
      detail: `/go rendered [${e.screenIds.join(", ")}] but the critic's own reading built [${day.stops.map((s) => s.experience.id).join(", ")}]. The critic is out of step with the page; fix the critic before trusting this run.`,
    });
  if (!same(e.screenIds, e.printIds))
    add({
      check: "print.differs",
      dimension: "trust",
      basis: "page",
      detail: `The printed guide has ${e.printIds.length} stops [${e.printIds.join(", ")}]; the screen had ${e.screenIds.length} [${e.screenIds.join(", ")}].`,
    });
  if (e.revised && !same(e.revised.screenIds, e.revised.printIds))
    add({
      check: "print.differs-after-revision",
      dimension: "trust",
      basis: "page",
      detail: `After "${e.revised.said}", the screen had ${e.revised.screenIds.length} stops and the paper printed ${e.revised.printIds.length}: [${e.revised.screenIds.join(", ")}] → [${e.revised.printIds.join(", ")}].`,
    });
  const placedCount = stops.filter((s) => s.placed).length;
  if (e.printIds.length > 0 && e.printMapLinks < placedCount)
    add({
      check: "print.map-links",
      dimension: "practicality",
      basis: "page",
      detail: `${placedCount} placed stops, ${e.printMapLinks} map links on paper.`,
    });
  for (const [where, text] of [
    ["screen", e.screenText],
    ["print", e.printText],
  ] as const) {
    const hit = text.match(BROKEN);
    if (hit)
      add({
        check: `${where}.broken-text`,
        dimension: "trust",
        basis: "page",
        detail: `"${hit[0]}" rendered on the ${where}: …${text.slice(Math.max(0, (hit.index ?? 0) - 60), (hit.index ?? 0) + 40)}…`,
      });
  }

  const circle = reach ?? 30;
  const used = new Set(stops.map((x) => x.id));
  const onDay = oracle.onDate
    ? [...oracle.byId.values()]
        .flatMap((c) => {
          const at = pointOf(c);
          if (!at || used.has(c.id)) return [];
          if (c.schedule?.onDate?.reading !== "on") return [];
          const d = distanceKm(origin, at);
          return d <= circle
            ? [{ title: c.name, km: round1(d), inPool: e.poolIds.has(c.id) }]
            : [];
        })
        .sort((a, b) => a.km - b.km)
    : [];

  const signals: Signals = {
    stops: stops.length,
    placed: placedCount,
    distinctKinds: new Set(
      stops.map((s) => (s.subtype ?? s.kind).toLowerCase()),
    ).size,
    travelKm: round1(travelKm),
    travel,
    hoursPlanned: brief.hours ?? 4,
    withPhoto: stops.filter((s) => s.photo).length,
    withVerbs: stops.filter((s) => s.verbs.length > 0).length,
    withChallenge: stops.filter((s) => s.challenge).length,
    withHours: stops.filter((s) => s.open).length,
    withPrice: stops.filter((s) => s.cost).length,
    dateKnown: stops.filter((s) => s.onDate && s.onDate !== "unknown").length,
    ageKnown: stops.filter((s) => s.forAge && s.forAge !== "unknown").length,
    ledgerVerified: stops.filter(
      (s) => s.ledger === "exists" || s.ledger === "exists-with-caveat",
    ).length,
    ...(farthest >= 0 ? { farthestKm: round1(farthest) } : {}),
    onDayNearby: onDay.filter((m) => m.inPool).length,
    onDayNearbyAtlas: onDay.length,
    onDayUsed: stops.filter((s) => s.onDate === "on").length,
  };

  return {
    id: scenario.id,
    town: scenario.town,
    says: scenario.says,
    heard: heardOf(brief, reach),
    title: day.title,
    opening: day.opening,
    stops,
    unknowns: day.unknowns,
    findings,
    signals,
    missed: onDay
      .filter((m) => m.inPool)
      .slice(0, 5)
      .map((m) => `${m.title} (${m.km} km)`),
    coverage: {
      date: pct(signals.dateKnown, signals.stops),
      realWorld: pct(signals.ledgerVerified, signals.stops),
    },
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The planning circle the day states in its opening line, in km. */
function reachOf(day: DayPlanned): number | undefined {
  const m = day.opening.match(/inside (\d+(?:\.\d+)?) km/);
  return m?.[1] ? Number(m[1]) : undefined;
}

function heardOf(brief: DayBrief, reach: number | undefined) {
  return {
    ...(brief.hours !== undefined ? { hours: brief.hours } : {}),
    ...(brief.childAge !== undefined ? { childAge: brief.childAge } : {}),
    ...(brief.town ? { town: brief.town.id } : {}),
    ...(brief.on ? { on: brief.on } : {}),
    ...(brief.shelter ? { shelter: brief.shelter } : {}),
    ...(brief.appetite ? { appetite: brief.appetite } : {}),
    ...(brief.withinKm !== undefined ? { withinKm: brief.withinKm } : {}),
    ...(brief.lessDriving ? { lessDriving: true } : {}),
    ...(brief.interests.length ? { interests: brief.interests } : {}),
    ...(reach !== undefined ? { circleKm: reach } : {}),
  };
}

// ── Scores ───────────────────────────────────────────────────────────────

export type Scores = Readonly<Record<Dimension, number>> & {
  readonly overall: number;
};

/**
 * **Six numbers, each 0–100, each from a rule written down here.**
 *
 * They exist so two runs can be compared, not so a day can be graded in the
 * abstract. `adventure` is a **proxy** (photos, stated things to do, a
 * challenge) and says so wherever it is printed; what makes a day exciting is
 * a judgement and lives with the judgements.
 *
 * `repeats` is, per stop id, how many scenarios in the same town chose it.
 */
export function score(
  r: ScenarioResult,
  scenario: Scenario,
  repeats: ReadonlyMap<string, number>,
): Scores {
  const n = r.stops.length;
  const failedOn = (d: Dimension) =>
    new Set(
      r.findings
        .filter((f) => f.dimension === d && f.subject)
        .map((f) => f.subject),
    );
  const dayFail = (d: Dimension) =>
    r.findings.filter((f) => f.dimension === d && !f.subject).length;

  const factual = n === 0 ? 0 : 100 * pct(n - failedOn("factual").size, n);

  const readingMisses = r.findings.filter((f) =>
    f.check.startsWith("reading."),
  ).length;
  const expected = expectations(scenario);
  const heard = expected === 0 ? 1 : Math.max(0, 1 - readingMisses / expected);
  const needOk =
    n === 0
      ? 0
      : pct(n - failedOn("relevance").size, n) *
        (r.findings.some((f) => f.check === "need.worth-the-drive") ? 0.5 : 1);
  const relevance = 100 * (0.5 * heard + 0.5 * needOk);

  const repeated = r.stops.filter((s) => (repeats.get(s.id) ?? 0) >= 3).length;
  const variety =
    n === 0
      ? 0
      : 100 *
        avg([
          pct(r.signals.distinctKinds, n),
          1 - pct(repeated, n),
          dayFail("variety") === 0 ? 1 : 0,
        ]);

  const fits = r.findings.some((f) => f.check === "day.does-not-fit") ? 0 : 1;
  const practicality =
    n === 0
      ? 0
      : 100 *
        avg([
          fits,
          pct(r.signals.placed, n),
          pct(r.stops.filter((s) => s.open || s.cost).length, n),
        ]);

  const adventure =
    n === 0
      ? 0
      : 100 *
        avg([
          pct(r.signals.withPhoto, n),
          pct(r.signals.withVerbs, n),
          pct(r.signals.withChallenge, n),
        ]);

  const trustFails = r.findings.filter(
    (f) => f.dimension === "trust" && !f.check.startsWith("harness."),
  ).length;
  const trust = n === 0 ? 0 : Math.max(0, 100 - 25 * trustFails);

  const s = { factual, relevance, variety, practicality, adventure, trust };
  const rounded = Object.fromEntries(
    Object.entries(s).map(([k, v]) => [k, Math.round(v)]),
  ) as Record<Dimension, number>;
  return { ...rounded, overall: Math.round(avg(Object.values(s))) };
}

/** How many things the sentence said that a reading should hold. */
function expectations(scenario: Scenario): number {
  const { unheld = [], ...rest } = scenario.hears;
  return (
    Object.values(rest).filter((v) => v !== undefined).length + unheld.length
  );
}

const avg = (xs: readonly number[]) =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
