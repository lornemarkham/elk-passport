import type { IngestionEvent, IngestionRun } from "./runData";
import {
  computeVitals,
  groupAttention,
  type AttentionGroup,
  type RunVitals,
} from "./heartbeat";
import type { WorkspaceBundle } from "./workspaceData";

/**
 * Everything Mission Control shows, derived from persisted data.
 *
 * ## Why this exists as its own layer
 *
 * The Heartbeat answered *"what did this run do?"*. Mission Control answers
 * a different and harder question: *"what is Atlas doing, and what should I
 * do next?"* — which cannot be read off a single run. It needs the queue,
 * the corpus, and every run at once.
 *
 * ## The honesty constraint, restated because it is easy to erode here
 *
 * Excitement must come from real accumulation, never from motion. No
 * progress bar advances because time passed; no number is projected; no
 * event is invented to fill a quiet moment. Where Atlas genuinely doesn't
 * know something — how far through a region it is, whether more work
 * exists beyond the queue — Mission Control says so rather than drawing a
 * plausible bar. A dashboard that looks busy while nothing happens is
 * worse than an empty one, because it destroys the trust that makes the
 * real numbers worth watching.
 */

export type MissionStatus = "learning" | "idle" | "attention" | "never-run";

export interface Mission {
  readonly status: MissionStatus;
  /** What Atlas is doing, in a sentence. Present tense while running. */
  readonly headline: string;
  readonly detail: string;
  readonly runId?: string;
  readonly startedAt?: string;
  /** The subject of the current work — a resort, a directory, a region. Never invented. */
  readonly focus?: string;
}

export interface QueueHealth {
  readonly remaining: number;
  readonly ingested: number;
  readonly rejected: number;
  readonly total: number;
  /**
   * Share of the *known* queue that has been consumed. Explicitly not
   * "progress through the region": Atlas cannot know how much it has yet
   * to discover, and a bar implying otherwise would be the fake progress
   * this page refuses.
   */
  readonly percentOfKnownQueue: number | null;
  readonly nextUp: readonly { id: string; url: string; sourceType: string }[];
}

export interface KnowledgeTotals {
  readonly entities: number;
  readonly places: number;
  readonly organizations: number;
  readonly sources: number;
  readonly relationships: number;
  readonly facts: number;
  readonly entitiesWithFirstPartySource: number;
  readonly coveragePercent: number | null;
}

export type GrowthKind =
  "discovered" | "created" | "enriched" | "connected" | "verified" | "conflict";

export interface GrowthItem {
  readonly kind: GrowthKind;
  readonly subject: string;
  readonly message: string;
  readonly at: string;
  readonly entityId?: string;
  readonly runId: string;
  /** The page this moment concerns, when the event named one — so "open website" is real, not guessed. */
  readonly detailUrl?: string;
}

export interface NextAction {
  readonly title: string;
  readonly why: string;
  readonly href?: string;
  readonly command?: string;
  readonly tone: "act" | "review" | "calm";
}

/** One sentence of current state that answers "so what should I do?". */
export interface StatusLine {
  readonly text: string;
  readonly href?: string;
  readonly tone: "calm" | "ready" | "attention";
}

export interface MissionComplete {
  readonly runId: string;
  readonly label: string;
  readonly learned: readonly string[];
  readonly needsYou: readonly string[];
  /**
   * One true, mildly interesting thing about the corpus — derived, never
   * generated. Present only when something genuinely qualifies; a run that
   * produced nothing remarkable gets no observation rather than a
   * manufactured one.
   */
  readonly observation?: string;
  readonly exploreEntityId?: string;
  readonly exploreEntityName?: string;
  /**
   * What the traveller-facing product gained. Derived from the specific
   * fields that changed — never a generated summary.
   */
  readonly passportImprovements: readonly string[];
}

/**
 * Translates a change to Atlas into what Passport can now do.
 *
 * This is the step the whole product loop was missing. "Atlas learned 2
 * things" is Atlas-centric and means nothing to someone deciding whether
 * teaching was worthwhile; "restaurant pages now show opening hours" is
 * the same fact expressed as the reason anyone should care.
 *
 * Each rule is keyed to a **specific field** appearing in a real
 * enrichment message, so nothing is claimed that didn't happen. A field
 * with no articulated traveller benefit produces no line rather than a
 * vague one — if learning something doesn't change what Passport can
 * answer, saying so honestly is more useful than padding the list.
 */
export function passportImprovementsFrom(
  enrichmentMessages: readonly string[],
): string[] {
  const all = enrichmentMessages.join(" · ").toLowerCase();
  const improvements: string[] = [];

  if (/\bhours\b/.test(all)) {
    improvements.push(
      "Pages can now say when this is open — and itineraries can avoid sending someone to a closed door.",
    );
  }
  if (/\baddress\b/.test(all)) {
    improvements.push(
      "An address means this can eventually be placed on a map and ordered by what's nearby.",
    );
  }
  if (/external identifier|first-party/.test(all)) {
    improvements.push(
      "A first-party source means every claim on this page traces back to the business itself.",
    );
  }
  if (/\bimageurl\b|\bimage\b/.test(all)) {
    improvements.push(
      "A real photograph — the difference between a listing and somewhere you want to go.",
    );
  }
  if (/\bfact\(s\)/.test(all)) {
    improvements.push(
      "New facts give Passport more to say about this than a name and a category.",
    );
  }
  if (/\bactivit|\bfacilit/.test(all)) {
    improvements.push(
      "Knowing what's available here makes this matchable to what a traveller actually wants to do.",
    );
  }
  if (/\bdescription\b/.test(all)) {
    improvements.push(
      "A real description, in the source's own words rather than a template.",
    );
  }

  return improvements;
}

export interface MissionControlModel {
  readonly mission: Mission;
  readonly statusLines: readonly StatusLine[];
  readonly missionComplete?: MissionComplete;
  readonly lifetime: RunVitals;
  readonly knowledge: KnowledgeTotals;
  readonly queue: QueueHealth;
  readonly growth: readonly GrowthItem[];
  readonly attention: readonly AttentionGroup[];
  readonly nextActions: readonly NextAction[];
}

export interface RunWithEvents {
  readonly run: IngestionRun;
  readonly events: readonly IngestionEvent[];
}

export function buildMissionControl(
  runs: readonly RunWithEvents[],
  bundle: WorkspaceBundle | null,
): MissionControlModel {
  const ordered = [...runs].sort(
    (a, b) =>
      new Date(b.run.startedAt).getTime() - new Date(a.run.startedAt).getTime(),
  );
  const allEvents = ordered.flatMap((r) => r.events);

  const lifetime = computeVitals(allEvents);
  const knowledge = computeKnowledge(bundle);
  const queue = computeQueue(bundle);
  const mission = computeMission(ordered, queue, lifetime);
  const growth = computeGrowth(ordered);
  const attention = groupAttention(currentEventsOnly(ordered));

  return {
    mission,
    statusLines: computeStatusLines(queue, knowledge, attention),
    missionComplete: computeMissionComplete(ordered, bundle),
    lifetime,
    knowledge,
    queue,
    growth,
    attention,
    nextActions: computeNextActions({
      mission,
      queue,
      knowledge,
      attention,
      lifetime,
    }),
  };
}

/**
 * The current state, as several short sentences instead of one.
 *
 * "Atlas is ready to learn" is true and useless — it tells a person
 * nothing about what to do. Each line here names a real quantity and links
 * to where it is resolved, so the status *is* the to-do list rather than a
 * mood indicator sitting above one.
 */
function computeStatusLines(
  queue: QueueHealth,
  knowledge: KnowledgeTotals,
  attention: readonly AttentionGroup[],
): StatusLine[] {
  const lines: StatusLine[] = [];

  if (queue.remaining > 0) {
    lines.push({
      text: `${queue.remaining} discovered source${queue.remaining === 1 ? "" : "s"} ${queue.remaining === 1 ? "is" : "are"} ready to read.`,
      tone: "ready",
    });
  }

  const identity = attention.find((g) => g.reason === "Identity");
  if (identity) {
    lines.push({
      text: `${identity.events.length} identity decision${identity.events.length === 1 ? "" : "s"} need your judgement — merging can't be undone.`,
      href: "/admin/duplicates",
      tone: "attention",
    });
  }

  const conflicts = attention.find((g) => g.reason === "Source conflict");
  if (conflicts) {
    lines.push({
      text: `${conflicts.events.length} source conflict${conflicts.events.length === 1 ? "" : "s"} — two sources disagree and Atlas kept what it had.`,
      href: conflicts.events[0]?.entityId
        ? `/admin/entities/${conflicts.events[0].entityId}`
        : undefined,
      tone: "attention",
    });
  }

  const missing = knowledge.entities - knowledge.entitiesWithFirstPartySource;
  if (missing > 0) {
    lines.push({
      text: `${missing} entit${missing === 1 ? "y" : "ies"} still ${missing === 1 ? "has" : "have"} no first-party website, so ${missing === 1 ? "it" : "they"} can only hold second-hand knowledge.`,
      href: "/admin/entities",
      tone: "calm",
    });
  }

  if (lines.length === 0) {
    lines.push({
      text: "Nothing is queued, nothing is in conflict, and every entity traces to a source.",
      tone: "calm",
    });
  }
  return lines;
}

/**
 * How the most recent finished mission went, in the words a colleague
 * would use — plus one true observation, when one exists.
 *
 * "Run completed" is the least interesting true sentence available. This
 * replaces it with what was actually gained and what is actually
 * outstanding, and then points at somewhere to go look.
 */
function computeMissionComplete(
  runs: readonly RunWithEvents[],
  bundle: WorkspaceBundle | null,
): MissionComplete | undefined {
  const latest = runs.find((r) => r.run.status === "completed");
  if (!latest) return undefined;

  const vitals = computeVitals(latest.events);
  const learned: string[] = [];
  if (vitals.thingsLearned > 0)
    learned.push(
      `${vitals.thingsLearned} new thing${vitals.thingsLearned === 1 ? "" : "s"}`,
    );
  if (vitals.entitiesCreated > 0)
    learned.push(
      `${vitals.entitiesCreated} new entit${vitals.entitiesCreated === 1 ? "y" : "ies"}`,
    );
  if (vitals.entitiesEnriched > 0)
    learned.push(
      `${vitals.entitiesEnriched} entit${vitals.entitiesEnriched === 1 ? "y" : "ies"} improved`,
    );
  if (vitals.relationshipsCreated > 0)
    learned.push(
      `${vitals.relationshipsCreated} new connection${vitals.relationshipsCreated === 1 ? "" : "s"}`,
    );
  if (vitals.pagesReused > 0)
    learned.push(
      `${vitals.pagesReused} source${vitals.pagesReused === 1 ? "" : "s"} reused rather than duplicated`,
    );
  if (vitals.entitiesRecognised > 0)
    learned.push(
      `${vitals.entitiesRecognised} existing entit${vitals.entitiesRecognised === 1 ? "y" : "ies"} recognised`,
    );

  const needsYou = groupAttention(latest.events).map(
    (g) =>
      `${g.events.length} ${g.reason.toLowerCase()}${g.events.length === 1 ? "" : "s"}`,
  );

  const enrichmentEvents = latest.events.filter(
    (e) => e.stage === "entity-enriched" && e.outcome === "ok",
  );
  const enrichedEvent = enrichmentEvents[0];

  return {
    runId: latest.run.id,
    label: latest.run.label,
    learned,
    needsYou,
    observation: computeObservation(bundle),
    exploreEntityId: enrichedEvent?.entityId,
    exploreEntityName: enrichedEvent?.subject,
    passportImprovements: passportImprovementsFrom(
      enrichmentEvents.map((e) => e.message),
    ),
  };
}

/**
 * One true thing about the corpus worth noticing.
 *
 * Every candidate below is a measurement, and the first that clears its
 * own bar wins. If none do, there is no observation — a "did you know"
 * generated to fill space is exactly the fabrication this page refuses,
 * and it would be the most tempting kind because it reads as insight.
 */
function computeObservation(
  bundle: WorkspaceBundle | null,
): string | undefined {
  if (!bundle) return undefined;
  const entities = bundle.entities ?? [];
  if (entities.length === 0) return undefined;

  const withHours = entities.filter(
    (e) => (e as { hours?: string }).hours,
  ).length;
  if (withHours > 0 && withHours <= 3) {
    return `Only ${withHours} of ${entities.length} entities know their opening hours — that's the kind of gap a first-party page fills fastest.`;
  }

  const byType = new Map<string, number>();
  for (const source of bundle.sources ?? []) {
    byType.set(source.sourceType, (byType.get(source.sourceType) ?? 0) + 1);
  }
  const dominant = [...byType.entries()].sort((a, b) => b[1] - a[1])[0];
  if (dominant && (bundle.sources?.length ?? 0) > 0) {
    const share = Math.round((dominant[1] / bundle.sources!.length) * 100);
    if (share >= 60) {
      return `${share}% of Atlas's evidence comes from ${dominant[0]} sources — broadening that is how a region stops sounding like one voice.`;
    }
  }

  const organizations = entities.filter(
    (e) => e.kind === "Organization",
  ).length;
  if (organizations > 0) {
    return `Atlas now knows ${organizations} organization${organizations === 1 ? "" : "s"} alongside ${entities.length - organizations} place${entities.length - organizations === 1 ? "" : "s"}.`;
  }
  return undefined;
}

/**
 * Events from the **latest attempt at each piece of work** only.
 *
 * "Atlas wants you" must mean *outstanding now*, not *every warning ever
 * recorded*. The live corpus made the difference obvious: The BullWheel
 * was attempted six times before the extraction ontology was fixed, so
 * naive aggregation demanded attention for five failures that the sixth
 * run had already resolved — asking a curator to act on problems that no
 * longer exist.
 *
 * A run's `label` identifies the work rather than the attempt, so keeping
 * only the newest run per label supersedes earlier tries without needing
 * any new concept. Growth and lifetime totals deliberately keep every
 * event: those are a record of what happened, and history is exactly what
 * they are for.
 */
function currentEventsOnly(
  ordered: readonly RunWithEvents[],
): IngestionEvent[] {
  const seen = new Set<string>();
  const current: IngestionEvent[] = [];
  // `ordered` is newest-first, so the first run for a label is its latest attempt.
  for (const { run, events } of ordered) {
    if (seen.has(run.label)) continue;
    seen.add(run.label);
    current.push(...events);
  }
  return current;
}

function computeMission(
  runs: readonly RunWithEvents[],
  queue: QueueHealth,
  lifetime: RunVitals,
): Mission {
  const running = runs.find((r) => r.run.status === "running");
  if (running) {
    const vitals = computeVitals(running.events);
    const last = running.events.at(-1);
    return {
      status: "learning",
      headline: "Atlas is learning",
      detail: last ? `${last.subject} — ${last.message}` : "Working…",
      runId: running.run.id,
      startedAt: running.run.startedAt,
      focus: running.run.label,
    };
  }

  const latest = runs[0];
  if (!latest) {
    return {
      status: "never-run",
      headline: "Atlas hasn't learned anything yet",
      detail: "Give it a source and it will begin.",
    };
  }

  if (queue.remaining > 0) {
    return {
      status: "attention",
      headline: "Atlas is ready to learn",
      detail: `${queue.remaining} source${queue.remaining === 1 ? "" : "s"} queued and waiting. Nothing runs on its own — Atlas waits to be asked.`,
      runId: latest.run.id,
      startedAt: latest.run.startedAt,
      focus: latest.run.label,
    };
  }

  return {
    status: "idle",
    headline: "Atlas is up to date",
    detail:
      lifetime.thingsLearned > 0
        ? `Everything queued has been read. ${lifetime.thingsLearned} thing${lifetime.thingsLearned === 1 ? "" : "s"} learned so far.`
        : "Everything queued has been read.",
    runId: latest.run.id,
    startedAt: latest.run.startedAt,
    focus: latest.run.label,
  };
}

function computeKnowledge(bundle: WorkspaceBundle | null): KnowledgeTotals {
  if (!bundle) {
    return {
      entities: 0,
      places: 0,
      organizations: 0,
      sources: 0,
      relationships: 0,
      facts: 0,
      entitiesWithFirstPartySource: 0,
      coveragePercent: null,
    };
  }

  const entities = bundle.entities ?? [];
  const withFirstParty = entities.filter((e) =>
    (e as { externalIds?: { system: string }[] }).externalIds?.some(
      (x) => x.system === "first-party-url",
    ),
  ).length;

  return {
    entities: entities.length,
    places: entities.filter((e) => e.kind === "Place").length,
    organizations: entities.filter((e) => e.kind === "Organization").length,
    sources: bundle.sources?.length ?? 0,
    relationships: bundle.relationships?.length ?? 0,
    facts: entities.reduce(
      (n, e) => n + ((e as { keyFacts?: unknown[] }).keyFacts?.length ?? 0),
      0,
    ),
    entitiesWithFirstPartySource: withFirstParty,
    coveragePercent:
      entities.length > 0
        ? Math.round((withFirstParty / entities.length) * 100)
        : null,
  };
}

function computeQueue(bundle: WorkspaceBundle | null): QueueHealth {
  const candidates = bundle?.candidateSources ?? [];
  const remaining = candidates.filter(
    (c) => c.status === "queued" || c.status === "discovered",
  );
  const ingested = candidates.filter((c) => c.status === "ingested").length;
  const rejected = candidates.filter((c) => c.status === "rejected").length;

  return {
    remaining: remaining.length,
    ingested,
    rejected,
    total: candidates.length,
    percentOfKnownQueue:
      candidates.length > 0
        ? Math.round((ingested / candidates.length) * 100)
        : null,
    nextUp: remaining
      .slice()
      .sort(
        (a, b) =>
          new Date(a.discoveredAt).getTime() -
          new Date(b.discoveredAt).getTime(),
      )
      .slice(0, 5)
      .map((c) => ({ id: c.id, url: c.url, sourceType: c.sourceType })),
  };
}

/** The most recent meaningful moments across every run — Atlas's pulse. */
function computeGrowth(runs: readonly RunWithEvents[]): GrowthItem[] {
  const items: GrowthItem[] = [];

  for (const { run, events } of runs) {
    for (const event of events) {
      const kind = growthKindOf(event);
      if (!kind) continue;
      items.push({
        kind,
        subject: event.subject,
        message: event.message,
        at: event.at,
        entityId: event.entityId,
        runId: run.id,
        detailUrl: event.message.match(/https?:\/\/[^\s"]+/)?.[0],
      });
    }
  }

  return items
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 24);
}

function growthKindOf(event: IngestionEvent): GrowthKind | undefined {
  if (event.stage === "entity-enriched" && event.outcome === "ok")
    return "enriched";
  if (event.stage === "entity-created" && event.outcome === "ok")
    return "created";
  if (event.stage === "relationship-created" && event.outcome === "ok")
    return "connected";
  if (event.stage === "source-discovered") return "discovered";
  if (event.stage === "source-verified" && event.outcome === "ok")
    return "verified";
  if (event.outcome === "needs-attention" && /disagrees/.test(event.message))
    return "conflict";
  return undefined;
}

/**
 * What Atlas suggests doing next — derived, never hardcoded.
 *
 * Ordered by what a person should actually do first: unblock the queue,
 * then resolve what only a human can, then extend coverage. Each carries
 * *why* it is being suggested, because a recommendation a curator cannot
 * evaluate is just an instruction.
 *
 * When there is genuinely nothing to do, this says so rather than
 * manufacturing a task — a dashboard that always has five suggestions
 * teaches you to ignore all five.
 */
function computeNextActions(input: {
  mission: Mission;
  queue: QueueHealth;
  knowledge: KnowledgeTotals;
  attention: readonly AttentionGroup[];
  lifetime: RunVitals;
}): NextAction[] {
  const actions: NextAction[] = [];
  const { queue, knowledge, attention, mission } = input;

  if (queue.remaining > 0) {
    actions.push({
      title: `Let Atlas learn ${queue.remaining} queued source${queue.remaining === 1 ? "" : "s"}`,
      why: "These pages were discovered but deliberately not fetched. Atlas never runs on its own.",
      command: "npm run run-queue -- --dry-run",
      tone: "act",
    });
  }

  const conflicts = attention.find((g) => g.reason === "Source conflict");
  if (conflicts) {
    const first = conflicts.events[0];
    actions.push({
      title:
        conflicts.events.length === 1 && first
          ? `Review the ${conflictField(first.message)} conflict on ${first.subject}`
          : `Resolve ${conflicts.events.length} source conflicts`,
      why: "Two sources disagree. Atlas kept what it had rather than picking a winner — only you can decide.",
      href: first?.entityId ? `/admin/entities/${first.entityId}` : undefined,
      tone: "review",
    });
  }

  const identity = attention.find((g) => g.reason === "Identity");
  if (identity) {
    actions.push({
      title: `Review ${identity.events.length} unresolved ${identity.events.length === 1 ? "identity" : "identities"}`,
      why: "Atlas could not prove two things are the same, so it changed nothing. Merging is irreversible and stays with you.",
      href: "/admin/duplicates",
      tone: "review",
    });
  }

  const missingSource =
    knowledge.entities - knowledge.entitiesWithFirstPartySource;
  if (missingSource > 0 && knowledge.entities > 0) {
    actions.push({
      title: `${missingSource} entit${missingSource === 1 ? "y has" : "ies have"} no first-party source`,
      why: "An entity Atlas cannot trace to its own website can only ever hold second-hand knowledge.",
      href: "/admin/entities",
      tone: "review",
    });
  }

  if (queue.remaining === 0 && knowledge.entities > 0) {
    actions.push({
      title: "Discover new sources",
      why: "The queue is empty. Atlas can propose what each entity should read next — Wikipedia, OpenStreetMap, its own site.",
      command: "npm run run-queue -- --dry-run",
      tone: "calm",
    });
  }

  if (actions.length === 0 && mission.status !== "never-run") {
    actions.push({
      title: "Nothing needs you",
      why: "The queue is empty, nothing is in conflict, and every entity traces to a source. This is what finished looks like.",
      tone: "calm",
    });
  }

  return actions;
}

function conflictField(message: string): string {
  return message.match(/"([^"]+)" disagrees/)?.[1] ?? "source";
}
