/**
 * **Missions — the finite work inside a permanent Knowledge Domain.**
 *
 * A Knowledge Domain never finishes. Recreation is a standing responsibility
 * and will be one for as long as Atlas exists. A **Mission** is the opposite:
 * a job small enough that an operator can start it, finish it, and see that it
 * is finished.
 *
 * That distinction used to be missing, and its absence was the whole problem.
 * Recreation's one piece of work read *"Map what there is to do around Ellison
 * and the North Okanagan"* — a remit, not a job. Nobody could ever complete it,
 * so nobody ever felt they had.
 *
 * ## Completion is derived, never awarded
 *
 * The governing rule is that **health is derived from facts, never from
 * completed tasks**. It has a corollary that is easy to miss: completion itself
 * must also be derived from facts, or an operator can tick a box while nothing
 * real has changed.
 *
 * So a mission carries `done` — a list of conditions, each evaluated against
 * Atlas's own state. A mission is complete when all of them are true. Nothing
 * is stored, nothing is scored, no points are awarded. Health does not move
 * because a mission completed; health and completion both move because the
 * corpus changed.
 *
 * **Consequence, stated plainly:** completion is recomputed on every render,
 * and if reality regresses a mission un-completes. That is correct, and it is
 * also why nothing is persisted — a stored "done" flag is a durable claim that
 * can disagree with the corpus, and the first time it did, nobody would know
 * which to believe.
 *
 * ## `unverifiable` is a legitimate result
 *
 * Some finishes genuinely cannot be read off Atlas. `batch-ingest` bypasses
 * `RunRecorder`, so *"the BC Parks batch has run"* leaves no durable trace; an
 * ADR being written is not something Atlas can see at all. Those conditions
 * report **cannot be verified**, with the reason and where to look — the same
 * `unknown` grade ADR 042 established, rather than an unticked box that implies
 * work is outstanding.
 *
 * ## Size is a design rule
 *
 * If a mission's finish cannot be stated as conditions, it is not a mission —
 * it is a domain concern, and it belongs in `knowledgeDomains.ts` as a blocker
 * or an opportunity. That test is what keeps missions finishable.
 */

import type { PlacementReadiness } from "./placementReadiness";
import type { WorkGroupKey } from "./workQueue";

/* -------------------------------------------------------------------------
 * What a condition can see
 * ---------------------------------------------------------------------- */

export interface ContextEntity {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  /** Which of the domain's category keys this entity matched. */
  readonly categories: readonly string[];
}

/**
 * Everything a done-condition may read.
 *
 * Deliberately a flat snapshot rather than a live handle on the loaders: a
 * condition that could issue its own query would be a second implementation of
 * a number the page already has, and this codebase has paid for that mistake
 * once already.
 */
export interface MissionContext {
  /** Entities in this domain's categories. */
  readonly entities: readonly ContextEntity[];
  /** Entity ids a curator has placed in the region being built. */
  readonly placedIds: ReadonlySet<string>;
  /** How many of the domain's entities fall in each category key. */
  readonly heldByCategory: ReadonlyMap<string, number>;
  /** Distinct source types describing each entity id. */
  readonly sourceTypes: ReadonlyMap<string, ReadonlySet<string>>;
  /**
   * **Whether asking a curator to place each entity is a reasonable question.**
   *
   * Computed once by `placementReadiness.ts` where the full entity records
   * live, and read here rather than recomputed — a condition that re-derived
   * it could disagree with the rows on screen, which is the failure this
   * codebase has already paid for twice.
   */
  readonly placementReadiness: ReadonlyMap<string, PlacementReadiness>;
  /** Irreversible questions still open in this domain, by kind. */
  readonly openDecisions: {
    readonly duplicate: number;
    readonly relationship: number;
  };
  /** Pages queued for reading against this domain's entities. */
  readonly queuedPages: number;
  /** Entities with pages still to read. The curator's unit, and the wording's. */
  readonly learningEntities: number;
  /** Pages Atlas read and could apply nothing from. A result, not outstanding work. */
  readonly learnedNothing: number;
  /** Passport readiness per category key, counted over places only. */
  readonly passportByCategory: ReadonlyMap<
    string,
    { readonly ready: number; readonly total: number }
  >;
  /**
   * **False when a read behind these counters did not answer.**
   *
   * A condition asking "no duplicate is waiting" would read zero from a failed
   * fetch and report *done*. That is the fabricated zero with a mission
   * completion attached to it, so any condition resting on a counter reports
   * `unverifiable` instead when this is false.
   */
  readonly readsComplete: boolean;
  /** The region being built, for wording. */
  readonly regionName: string;
  /**
   * **False when this domain's work cannot be attributed to it at all.**
   *
   * Organizations is cross-cutting: its entities sit inside every other
   * domain's categories, so no entity, decision or queued page can be said to
   * be its own. Every counter in this context is therefore zero — and a
   * condition reading "no duplicate is waiting" would evaluate *true* and
   * complete a mission on the strength of a number that was never measured.
   *
   * That is the fabricated zero, one level up, and it is why `evaluateMission`
   * refuses to grade anything when this is false.
   */
  readonly scopeable: boolean;
}

export type ConditionState = "done" | "not-done" | "unverifiable";

export interface ConditionResult {
  readonly state: ConditionState;
  /** What makes it true, or exactly what is left. Never a bare number. */
  readonly detail: string;
}

export interface DoneCondition {
  readonly id: string;
  readonly label: string;
  readonly evaluate: (ctx: MissionContext) => ConditionResult;
}

/* -------------------------------------------------------------------------
 * Condition factories
 *
 * Kept as factories so the catalogue below stays declarative. A mission whose
 * finish is written as prose is a mission nobody can check.
 * ---------------------------------------------------------------------- */

/** Atlas holds at least one thing in any of these categories. */
export function holdsSomethingIn(
  keys: readonly string[],
  label: string,
): DoneCondition {
  return {
    id: `holds:${keys.join("+")}`,
    label,
    evaluate: (ctx) => {
      const counts = keys.map(
        (k) => [k, ctx.heldByCategory.get(k) ?? 0] as const,
      );
      const total = counts.reduce((sum, [, n]) => sum + n, 0);
      const filled = counts.filter(([, n]) => n > 0);
      return {
        state: total > 0 ? "done" : "not-done",
        detail:
          total === 0
            ? `Nothing yet in ${keys.join(", ")}.`
            : filled.map(([k, n]) => `${k} ${n}`).join(" · "),
      };
    },
  };
}

/** No duplicate group touches this domain. */
export function noOpenDuplicates(): DoneCondition {
  return {
    id: "no-duplicates",
    label: "No duplicate is waiting on a decision",
    evaluate: (ctx) => {
      if (!ctx.readsComplete && ctx.openDecisions.duplicate === 0)
        return {
          state: "unverifiable",
          detail:
            "The duplicate scan did not answer, so zero here is a failed read rather than a fact.",
        };
      return {
        state: ctx.openDecisions.duplicate === 0 ? "done" : "not-done",
        detail:
          ctx.openDecisions.duplicate === 0
            ? "Atlas proposes no merge here."
            : `${ctx.openDecisions.duplicate} group${ctx.openDecisions.duplicate === 1 ? "" : "s"} to answer in Review.`,
      };
    },
  };
}

export function noOpenRelationships(): DoneCondition {
  return {
    id: "no-relationships",
    label: "No relationship is waiting on a decision",
    evaluate: (ctx) => {
      if (!ctx.readsComplete && ctx.openDecisions.relationship === 0)
        return {
          state: "unverifiable",
          detail:
            "The relationship-candidate read did not answer, so zero here is a failed read rather than a fact.",
        };
      return {
        state: ctx.openDecisions.relationship === 0 ? "done" : "not-done",
        detail:
          ctx.openDecisions.relationship === 0
            ? "Atlas proposes no connection here."
            : `${ctx.openDecisions.relationship} to answer in Review.`,
      };
    },
  };
}

/**
 * **The entities this domain holds that are not yet in the Region.**
 *
 * Exported because the Recreation page renders exactly this list as its
 * working surface, and a second filter written in the UI would be a second
 * answer to "what is left". When the list empties the condition below turns
 * `done` for the same reason the list disappeared — one predicate, read twice.
 */
export function unplacedEntities(
  ctx: MissionContext,
): readonly ContextEntity[] {
  return ctx.entities.filter((e) => !ctx.placedIds.has(e.id));
}

/**
 * **The unplaced entities Atlas can justify asking about.**
 *
 * Not every unplaced entity is a pending decision. An entity Atlas cannot
 * name, locate or attribute is not a placement question a curator can answer —
 * it is an evidence gap wearing a placement question's clothes, and clicking
 * *Place* on it would be asserting a membership Atlas has no grounds to
 * propose. The gate is `assessPlacementReadiness`; this is the population it
 * admits.
 *
 * An entity with no readiness entry is treated as **not** ready. A missing
 * assessment means the gate did not run, and admitting on absence is the
 * fabricated zero again — the safe reading of "Atlas said nothing" is "Atlas
 * cannot justify this yet", which costs a curator a delay rather than a wrong
 * assertion.
 */
export function placementDecisions(
  ctx: MissionContext,
): readonly ContextEntity[] {
  return unplacedEntities(ctx).filter(
    (e) => ctx.placementReadiness.get(e.id)?.ready === true,
  );
}

/**
 * **The unplaced entities Atlas is withholding from the question.**
 *
 * Counted and named everywhere the ready ones are, never quietly dropped: a
 * gate that shrank a to-do list without saying so would be indistinguishable
 * from a gate that worked.
 */
export function withheldFromPlacement(
  ctx: MissionContext,
): readonly ContextEntity[] {
  return unplacedEntities(ctx).filter(
    (e) => ctx.placementReadiness.get(e.id)?.ready !== true,
  );
}

/** Every entity in this domain has been placed in the region. */
export function allPlacedInRegion(): DoneCondition {
  return {
    id: "all-placed",
    label: "Every entity Atlas can justify placing is in the region",
    evaluate: (ctx) => {
      // `placedIds` is empty both when nothing is placed and when Atlas could
      // not tell us which Region is being built. Reporting the first when the
      // second is true would put every entity on the operator's to-do list on
      // the strength of a read that failed.
      if (!ctx.readsComplete && ctx.placedIds.size === 0)
        return {
          state: "unverifiable",
          detail: `Atlas could not identify ${ctx.regionName}'s membership, so "unplaced" cannot be counted.`,
        };
      if (ctx.entities.length === 0)
        return {
          state: "not-done",
          detail: "Atlas holds nothing here to place.",
        };

      // The mission is about placement *decisions*, so it is graded on the
      // entities Atlas can justify asking about. An entity that fails the
      // evidence gate is not an unanswered question — it is a question Atlas
      // has not earned the right to ask, and no amount of clicking resolves
      // it. Grading on the whole unplaced set would leave this mission
      // permanently at "6 remaining" with nothing a curator could do about it,
      // which is the uncompletable mission this architecture exists to avoid.
      //
      // The withheld are never silently dropped: the detail states them either
      // way, and the work queue carries them as a group of their own with a
      // next action attached.
      const decisions = placementDecisions(ctx);
      const withheld = withheldFromPlacement(ctx);
      const withheldNote =
        withheld.length === 0
          ? ""
          : ` ${withheld.length} withheld — Atlas cannot justify asking yet.`;

      if (decisions.length > 0) {
        return {
          state: "not-done",
          detail: `${decisions.length} ready to place — ${decisions
            .slice(0, 3)
            .map((e) => e.name)
            .join(", ")}${decisions.length > 3 ? "…" : ""}.${withheldNote}`,
        };
      }

      return {
        state: "done",
        detail: `Every entity Atlas can justify placing is in ${ctx.regionName}.${withheldNote}`,
      };
    },
  };
}

/**
 * **Named places exist and carry a source from a particular publisher.**
 *
 * ## Why this is an exact name, and why it checks every match
 *
 * This condition used a name **fragment** resolved with `.find()`, and that is
 * how Mission 5 became unfinishable. `"Ellison"` matched four entities and
 * returned *Ellison Provincial Park **Road***, an OSM road; `"Kalamalka"`
 * matched six and returned *Kalamalka Lake **Provincial** Park*, a different
 * record sourced from Wikipedia. Neither carried a BC Parks source, so the
 * mission reported not-done — while the two parks it is actually about had
 * been ingested and held 44 and 47 facts.
 *
 * First-hit ordering is not a tie-break; it is an unrecorded decision, and it
 * is the third place in this codebase where `.find()` over an ambiguous name
 * silently chose a record.
 *
 * The name is now matched **exactly**, which is this codebase's standing
 * discipline everywhere identity is involved, and the caller supplies the
 * entity's real name rather than a fragment that happens to appear in it.
 *
 * ## Every match must carry the evidence, not merely one of them
 *
 * An exact name can still match more than one record — Atlas holds two called
 * *Kalamalka Lake Park* today. Asking whether **some** match carries the source
 * would let a duplicate satisfy the mission by luck; asking whether **every**
 * match does is strictly stronger and cannot be. Where the matches disagree,
 * Atlas cannot say which record is the park, so the condition reports
 * `unverifiable` and names them — never a quiet pass, and never an unticked
 * box, which would read as outstanding work.
 *
 * Still display-grade in one respect, deliberately: no identity is resolved
 * here and nothing is written. A wrong name reads *not found*, which is
 * visible and harmless.
 */
export function namedPlacesHaveSource(
  /** The entities' exact names, as Atlas holds them. Never a fragment. */
  names: readonly string[],
  sourceTypeFragment: string,
  label: string,
): DoneCondition {
  return {
    id: `sourced:${sourceTypeFragment}:${names.join("+")}`,
    label,
    evaluate: (ctx) => {
      const missing: string[] = [];
      const unsourced: string[] = [];
      const ambiguous: string[] = [];

      const carriesSource = (entityId: string): boolean =>
        [...(ctx.sourceTypes.get(entityId) ?? [])].some((type) =>
          type.toLowerCase().includes(sourceTypeFragment.toLowerCase()),
        );

      for (const name of names) {
        const matches = ctx.entities.filter(
          (e) => e.name.toLowerCase() === name.toLowerCase(),
        );
        if (matches.length === 0) {
          missing.push(name);
          continue;
        }
        const sourced = matches.filter((m) => carriesSource(m.id));
        if (sourced.length === matches.length) continue;
        if (sourced.length === 0) {
          const types = ctx.sourceTypes.get(matches[0]!.id);
          unsourced.push(
            `${name} (${types && types.size > 0 ? [...types].join(", ") : "no source"})`,
          );
          continue;
        }
        // Some carry it and some do not. Atlas holds more than one record of
        // this name and cannot say which is the park, so it refuses to grade.
        ambiguous.push(
          `${name} — ${matches.length} records, ${sourced.length} carrying a ${sourceTypeFragment} source`,
        );
      }

      if (ambiguous.length > 0)
        return {
          state: "unverifiable",
          detail: `Atlas holds more than one record under a name this mission is about, and they disagree: ${ambiguous.join("; ")}. Resolve the duplicate and this grades itself.`,
        };
      if (missing.length === 0 && unsourced.length === 0)
        return {
          state: "done",
          detail: `All ${names.length} carry a ${sourceTypeFragment} source.`,
        };
      return {
        state: "not-done",
        detail: [
          missing.length > 0 && `Not in Atlas: ${missing.join(", ")}`,
          unsourced.length > 0 &&
            `No ${sourceTypeFragment} source: ${unsourced.join("; ")}`,
        ]
          .filter(Boolean)
          .join(" · "),
      };
    },
  };
}

/** Every place in a category is presentable to a traveller. */
export function categoryPassportReady(
  key: string,
  label: string,
): DoneCondition {
  return {
    id: `passport:${key}`,
    label,
    evaluate: (ctx) => {
      const reading = ctx.passportByCategory.get(key);
      if (!reading || reading.total === 0)
        return {
          state: "not-done",
          detail: `Atlas holds no ${key} yet, so none can be ready.`,
        };
      return {
        state: reading.ready === reading.total ? "done" : "not-done",
        detail: `${reading.ready} of ${reading.total} ready.`,
      };
    },
  };
}

/** No page is still sitting in the queue for this domain. */
/**
 * **Did Atlas process the discovered pages?**
 *
 * That is the question the mission asks, and it is not *did Atlas learn
 * anything*. Running an operation and gaining nothing is still a completed
 * operation: the operation measures what Atlas attempted, learning measures
 * what Atlas gained, and those are different facts.
 *
 * The old rule was effectively `queued pages == 0`, which was wrong twice
 * over. `queued` is the status a candidate keeps when Atlas fetched it,
 * extracted from it, and could not attribute the result — so a page Atlas had
 * already read counted as unread, and the mission demanded an operation that
 * would do nothing. Ten of Big White's thirteen pages were in exactly that
 * state.
 *
 * It now grades attempts. A page read without result does not hold the mission
 * open; it becomes its own piece of work, with the remedy that would actually
 * change it. A broken fetch does hold it open, because re-running the queue
 * genuinely acts on one.
 */
export function queueDrained(): DoneCondition {
  return {
    id: "queue-drained",
    label: "Every discovered page has been attempted",
    evaluate: (ctx) => {
      // Zero here has two meanings — nothing is outstanding, or the read that
      // would have counted it failed — and completing a mission on the second
      // is the fabricated zero with a finish attached.
      if (!ctx.readsComplete && ctx.queuedPages === 0)
        return {
          state: "unverifiable",
          detail:
            "A read behind the queue did not answer, so zero pages outstanding is unknown rather than true.",
        };
      if (ctx.queuedPages === 0)
        return {
          state: "done",
          detail:
            ctx.learnedNothing > 0
              ? `Atlas attempted every discovered page. ${ctx.learnedNothing} produced nothing it could apply — a result, not unfinished work.`
              : "Atlas has attempted every discovered page. Discovery finding more makes this work again.",
        };
      return {
        state: "not-done",
        detail: `${ctx.learningEntities} entit${ctx.learningEntities === 1 ? "y has" : "ies have"} ${ctx.queuedPages} page${ctx.queuedPages === 1 ? "" : "s"} Atlas has not attempted.`,
      };
    },
  };
}

/**
 * A finish Atlas genuinely cannot see.
 *
 * Rendered as *cannot be verified* with where to look, never as an unticked
 * box. An unticked box says work is outstanding; this says Atlas has no way to
 * know either way, which is a different and more useful statement.
 */
export function verifiedByHand(label: string, because: string): DoneCondition {
  return {
    id: `by-hand:${label}`,
    label,
    evaluate: () => ({ state: "unverifiable", detail: because }),
  };
}

/* -------------------------------------------------------------------------
 * The mission itself
 * ---------------------------------------------------------------------- */

/**
 * **A mission's state is derived, never authored.**
 *
 * There is deliberately no `status: "active"` field any more. There was one,
 * and it was the bug: completion was derived from Atlas's facts while
 * *progression* read a hand-written flag, so a mission could render "Mission
 * complete" and stay labelled NOW in the same paragraph. Two sources of truth
 * about the same thing, and the asserted one always won.
 *
 * Now the only authored fact is `blockedBy` — an obstacle in the world that
 * Atlas genuinely cannot observe ("no trail tag in the POI allow list"). Order
 * comes from position in the catalogue; completion comes from conditions;
 * *current* is simply the first mission that is neither blocked nor complete.
 */
export type MissionState = "complete" | "current" | "queued" | "blocked";

export const MISSION_STATE_LABEL: Record<MissionState, string> = {
  complete: "Complete",
  current: "Now",
  queued: "Next",
  blocked: "Blocked",
};

/** One ordered step. Bound to an `Operation` when there is a command for it. */
export interface MissionStep {
  readonly title: string;
  readonly detail: string;
  readonly operationId?: string;
}

export interface Mission {
  readonly id: string;
  /** The Knowledge Domain this belongs to. */
  readonly domain: string;
  /** Imperative, and specific enough to be finished. Names places, not areas. */
  readonly title: string;
  /** One line. What changes in Atlas when this is done. */
  readonly outcome: string;
  /** Two or three bullets, each checkable. */
  readonly why: readonly string[];
  readonly duration: string;
  /**
   * **The one authored fact about a mission's state.**
   *
   * Present means blocked: something in the world stops this starting, and
   * Atlas cannot see it. Everything else — complete, current, queued — is
   * derived by `evaluateDomain`.
   */
  readonly blockedBy?: string;
  readonly steps: readonly MissionStep[];
  /** The operation the Execute phase runs. Absent for a mission with no command. */
  readonly operationId?: string;
  /**
   * **The on-page working surface this mission is performed through.**
   *
   * Declared rather than matched on `id` in the page, so adding a fourth
   * placement mission needs no change to the renderer. Absent means the
   * mission is still performed at the terminal, and the page says so honestly
   * rather than pretending otherwise.
   *
   * `place-in-region` — a list of unplaced entities, each with a button that
   * calls the same `RegionMembershipService` the CLI calls.
   */
  readonly surface?: "place-in-region" | "learn-from-sources";
  /**
   * **Which kinds of outstanding work this mission is responsible for.**
   *
   * Declared here for the same reason `surface` is: so the page can put work
   * inside the mission that owns it without matching on an id. A domain page
   * used to carry a separate *What needs you* section that competed with the
   * mission for the operator's attention, and answering *what do I do next?*
   * meant combining the two by hand.
   *
   * A group named by no mission is genuinely domain-wide — a failed fetch
   * belongs to a run, not to a job — and the page says so rather than
   * pretending it fits somewhere.
   */
  readonly owns?: readonly WorkGroupKey[];
  readonly done: readonly DoneCondition[];
}

/* -------------------------------------------------------------------------
 * The catalogue
 *
 * Asserted, like the domains themselves. Every `operationId` resolves to an
 * `Operation` in `knowledgeDomains.ts`, and every command those operations
 * carry was verified against `atlas/package.json` and the batch files it
 * names — including, for Recreation, reading
 * `bcparks-north-okanagan-batch-1.json` to find that it holds **two** parks
 * rather than the six an earlier draft of this plan assumed.
 * ---------------------------------------------------------------------- */

export const MISSIONS: readonly Mission[] = [
  /* ---------------- Geography & Water ---------------- */
  {
    id: "geo-investigate",
    domain: "geography",
    title: "Investigate one feature the corpus does not hold",
    outcome:
      "An identity proposal with evidence, or a stated reason there is none.",
    why: [
      "All four publishers answer — capability is not the constraint.",
      "Nobody has named the subjects. That is the constraint.",
      "Discovery writes nothing, so a wrong guess costs one command.",
    ],
    duration: "2–4 minutes",
    operationId: "discover",
    steps: [
      {
        title: "Run the investigation",
        detail: "Discovery asks every rung of the ladder and writes nothing.",
        operationId: "discover",
      },
      {
        title: "Read the outcome",
        detail:
          "A proposal, an ambiguity, or a stated reason — which publisher was missing, and why.",
      },
      {
        title: "Confirm or decline the identity",
        detail: "Irreversible, and only a person can make it.",
      },
    ],
    done: [
      verifiedByHand(
        "The investigation has been read",
        "Discovery writes nothing durable, so Atlas cannot see that you read the output. This mission finishes when you have.",
      ),
      noOpenDuplicates(),
    ],
  },
  {
    id: "geo-place-water",
    domain: "geography",
    title: "Place the water features in the Okanagan",
    outcome: "Every lake, river and creek Atlas holds belongs to the region.",
    why: [
      "New entities arrive unplaced. Membership is asserted, never inferred.",
      "Unplaced entities are invisible to every region-scoped view.",
    ],
    duration: "A minute per entity",
    // No `operationId`: Geography's catalogue has no placement operation, and
    // claiming one it does not have would put a command on the page that the
    // repository cannot back. The region page prints the real one.
    steps: [
      {
        title: "Place each unplaced feature",
        detail:
          "One assertion per entity, from the region page. Nothing is guessed from coordinates.",
      },
    ],
    surface: "place-in-region",
    done: [allPlacedInRegion()],
  },
  {
    id: "geo-extent",
    domain: "geography",
    title: "Store a waterbody's extent, not just its point",
    outcome: "A lake stops being a pin and becomes a shape.",
    why: [
      "The Freshwater Atlas returns a real polygon and Atlas discards it.",
      "Every place is currently a point, which no publisher's data requires.",
    ],
    duration: "Not measured — an engineering change",
    blockedBy:
      "There is no write path from a structured record to an entity, and nowhere to store an extent.",
    steps: [
      {
        title: "Add a storable extent to the domain model",
        detail: "Then an ingestion path from structured records.",
      },
    ],
    done: [
      verifiedByHand(
        "A waterbody carries an extent",
        "Nothing in Atlas can hold one yet, so this cannot be measured until the model changes.",
      ),
    ],
  },

  /* ---------------- Recreation ----------------
     Five finite missions, in order, replacing one open-ended expedition.
     Each is a day or less and each names real places. */
  {
    id: "rec-sweep-ellison",
    domain: "recreation",
    title: "Sweep Ellison Provincial Park for recreation points of interest",
    outcome:
      "Atlas holds the campgrounds, picnic sites, boat launches and viewpoints around Ellison.",
    why: [
      "The sweep has never been run — Atlas holds no OpenStreetMap sources.",
      "The batch file exists and covers one bounded box around the park.",
      "It is the first real measurement of what a sweep yields.",
    ],
    duration: "Not measured — one Overpass query, then one extraction",
    operationId: "osm-sweep",
    steps: [
      {
        title: "Run the sweep",
        detail: "One Overpass query over the Ellison box, then extraction.",
        operationId: "osm-sweep",
      },
      {
        title: "Check what came back",
        detail:
          "A 504, or a remark inside a 200, is a failed query — never an empty area.",
      },
    ],
    done: [
      holdsSomethingIn(
        ["campgrounds", "viewpoints", "water-access", "beaches"],
        "Atlas holds points of interest the sweep produces",
      ),
    ],
  },
  {
    id: "rec-resolve-duplicates",
    owns: ["decision"],
    domain: "recreation",
    // The wording is the product decision. "Resolve the duplicates" asks the
    // curator to solve the problem; "review Atlas's merge recommendations"
    // asks them to check a proposal Atlas has already made. The second is the
    // job, and naming it wrongly is what let the surface get away with showing
    // six identical cards and no opinion.
    title: "Review Atlas's merge recommendations",
    outcome:
      "Every proposed duplicate has been accepted or rejected, and no two records describe the same place.",
    why: [
      "A sweep near entities Atlas already holds is the likeliest source of near-matches.",
      "Atlas proposes which record to keep and why; merging is irreversible, so it never decides.",
      "A rejection is remembered, so the same pair is not proposed again.",
    ],
    duration: "Seconds per recommendation",
    steps: [
      {
        title: "Read each recommendation",
        detail:
          "Atlas states which record it would keep, what each of the others adds, and what a merge costs.",
      },
      {
        title: "Accept it, or say they are different things",
        detail:
          "Accepting merges; rejecting records them as distinct so the group does not return.",
      },
    ],
    done: [noOpenDuplicates()],
  },
  {
    id: "rec-place-entities",
    owns: ["placement", "placement-evidence"],
    domain: "recreation",
    title: "Place the new Recreation entities in the Okanagan",
    outcome: "Everything the sweep created belongs to the region.",
    why: [
      "The sweep places nothing — membership is a separate assertion.",
      "Until they are placed they are invisible to every region-scoped view.",
    ],
    duration: "A minute per entity",
    operationId: "place",
    steps: [
      {
        title: "Place each new entity",
        detail: "Asserted by a person. Never inferred from coordinates.",
        operationId: "place",
      },
    ],
    surface: "place-in-region",
    done: [allPlacedInRegion()],
  },
  {
    // Placed before BC Parks, not after. These pages were discovered by runs
    // that already happened and are sitting unread today; gating them behind
    // an acquisition that has not run yet would make the operator wait to do
    // work that is already available. Acquiring more sources later simply
    // makes this mission current again, which is what a derived sequence is
    // for.
    id: "rec-learn-queued",
    owns: ["learning", "learned-nothing"],
    domain: "recreation",
    title: "Read the pages Atlas has discovered",
    // Attempts, not gains. Promising that what each page teaches "is applied"
    // would make an honest outcome — Atlas read it and could apply nothing —
    // look like a failure of the mission rather than a result from it.
    outcome:
      "Every discovered page has been attempted, and what each one produced is recorded against the entity it names.",
    why: [
      "These pages are not proving anything exists — Atlas already trusts these entities.",
      "One entity is one piece of work, however many pages name it.",
      "Running the operation and learning nothing is still a completed operation; the result is recorded either way.",
    ],
    duration: "Not measured — one fetch and one extraction per page",
    operationId: "run-queue",
    surface: "learn-from-sources",
    steps: [
      {
        title: "Run the queue",
        detail:
          "Start with --dry-run. It prints exactly what a real run would attempt and costs nothing.",
        operationId: "run-queue",
      },
      {
        title: "Come back and refresh",
        detail:
          "Each entity's queued count is re-read from Atlas. A page that failed stays listed under its entity.",
      },
    ],
    done: [queueDrained()],
  },
  {
    id: "rec-bcparks",
    domain: "recreation",
    title: "Ingest Ellison Park and Kalamalka Lake Park from BC Parks",
    outcome:
      "The two provincial parks in the batch carry first-party knowledge.",
    why: [
      "BC Parks is the richest source this domain has, and the loader exists.",
      "The batch file holds exactly these two parks — it has never been run.",
      "Both parks are already in the Okanagan's discovery scope.",
    ],
    duration: "Not measured — two page reads and two extractions",
    operationId: "bcparks",
    steps: [
      {
        title: "Run the BC Parks batch",
        detail: "Two parks: ellison-park and kalamalka-lake-park.",
        operationId: "bcparks",
      },
      {
        title: "Answer anything it raises",
        detail: "Conflicts appear in Review. Atlas keeps what it held.",
      },
    ],
    done: [
      namedPlacesHaveSource(
        // The entities' exact names, matching the batch's two slugs
        // (`ellison-park`, `kalamalka-lake-park`). Fragments used to match a
        // road and a different park; these name the records the mission is
        // actually about.
        ["Ellison Park", "Kalamalka Lake Park"],
        "bcparks",
        "Both parks carry a BC Parks source",
      ),
    ],
  },
  {
    id: "rec-park-photos",
    owns: ["enrichment"],
    domain: "recreation",
    title: "Make every provincial park presentable to a traveller",
    outcome:
      "Every park has a name, a description, a picture and a location — so Passport can show it.",
    why: [
      "Atlas holding a park and Passport being able to show one are different things.",
      "A park with no picture renders an empty hero.",
      "This is the shortest route from a corpus that grew to a product that improved.",
    ],
    duration: "Not measured — an engineering change",
    // Measured against the live corpus on 2026-08-21, not assumed: every one
    // of the twelve entities short of Passport readiness is short of exactly
    // one thing, **a picture**. Nothing Atlas can run acquires one. No queued
    // candidate source targets any of them — the queue is Big White and lakes
    // — and no wired publisher supplies park imagery. `run-queue` would read
    // pages about other entities and change nothing here.
    //
    // So this is a capability Atlas does not have, not work waiting on a
    // curator, and saying otherwise would be inventing a task. It can still
    // complete on its own: BC Parks ingestion may carry images for the two
    // parks in its batch, and if the corpus comes to satisfy the condition the
    // blocker cleared in reality and the catalogue was out of date.
    blockedBy:
      "No enrichment operation exists yet. All twelve gaps are a missing picture, no queued source targets any of them, and no wired publisher supplies park images.",
    steps: [
      {
        title: "Wire a publisher that supplies images",
        detail:
          "Or add an operation that acquires one. Until then this cannot be worked from here.",
      },
    ],
    done: [categoryPassportReady("parks", "Every park is Passport ready")],
  },
  {
    id: "rec-trails",
    domain: "recreation",
    title: "Acquire trails and trailheads",
    outcome: "The most requested thing in this domain stops being unreachable.",
    why: [
      "No trail tag in the POI allow list, and no trail publisher wired.",
      "One allow-list change moves three subjects to reachable.",
    ],
    duration: "Not measured — an engineering change",
    blockedBy:
      "Trails cannot be acquired at all: add trail tags to osmPoiAllowList.ts, or wire a trail publisher.",
    steps: [
      {
        title: "Add trail tags to the POI allow list",
        detail: "Or evaluate Recreation Sites & Trails BC as a publisher.",
      },
    ],
    done: [holdsSomethingIn(["trails"], "Atlas holds at least one trail")],
  },

  /* ---------------- Food & Drink ---------------- */
  {
    id: "food-drain-queue",
    domain: "food-and-drink",
    title: "Read the queued Big White sources",
    outcome: "Venues Atlas knows second-hand gain facts from their own pages.",
    why: [
      "Discovered sources are waiting; most known sources have never been read.",
      "Adding publishers now makes the backlog the bottleneck, not coverage.",
    ],
    duration: "Not measured — start with --dry-run, which costs nothing",
    operationId: "queue",
    steps: [
      {
        title: "Dry run first",
        detail: "Costs nothing and shows what would be read.",
        operationId: "queue",
      },
      {
        title: "Run it, then answer the conflicts",
        detail: "Atlas keeps what it held and asks. Nothing resolves itself.",
      },
    ],
    done: [queueDrained()],
  },
  {
    id: "food-place-venues",
    domain: "food-and-drink",
    title: "Place the Big White venues in the Okanagan",
    outcome: "The dining venues belong to the region.",
    why: [
      "Directory expansion creates entities unplaced.",
      "Unplaced venues are invisible to every region-scoped view.",
    ],
    duration: "A minute per entity",
    steps: [
      {
        title: "Place each venue",
        detail: "Asserted by a person, never inferred.",
      },
    ],
    surface: "place-in-region",
    done: [allPlacedInRegion()],
  },

  /* ---------------- Accommodation ---------------- */
  {
    id: "acc-decide-boundary",
    domain: "accommodation",
    title: "Write the ADR on what Atlas may say about a place to sleep",
    outcome: "A written rule separating describing a property from quoting it.",
    why: [
      "Availability and price are not knowledge Atlas should hold.",
      "Wiring a publisher first would encode the answer by accident.",
    ],
    duration: "Not an operation — a written decision",
    steps: [
      {
        title: "Draw the describe-versus-quote line",
        detail: "Which accommodation facts Atlas keeps, and which it refuses.",
      },
      {
        title: "Read the licensing terms on the booking platforms",
        detail: "Assume nothing is permitted until they have been read.",
      },
    ],
    done: [
      verifiedByHand(
        "An ADR exists stating the boundary",
        "Atlas cannot see the repository. Check atlas/docs/architecture/decisions/.",
      ),
    ],
  },

  /* ---------------- Events ---------------- */
  {
    id: "ev-temporal-model",
    domain: "events",
    title: "Add a validity window to a fact",
    outcome: "Atlas can hold something that stops being true.",
    why: [
      "An event that has passed is not wrong and not current — the model cannot say so.",
      "Ingesting first means discovering this at scale.",
    ],
    duration: "Not an operation — a change to the domain model",
    blockedBy: "Atlas has no concept of a fact that expires (ADR 018).",
    steps: [
      {
        title: "Add the validity window",
        detail: "This unblocks Events and Wonder alongside it.",
      },
    ],
    done: [
      verifiedByHand(
        "A fact can carry a validity window",
        "Nothing in the model can express this yet, so it cannot be measured.",
      ),
    ],
  },

  /* ---------------- Organizations & Communities ---------------- */
  {
    id: "org-expand-directory",
    domain: "organizations",
    title: "Expand one directory page into organisations",
    outcome:
      "One child organisation per listed entry, each with a queued source of its own.",
    why: [
      "Every organisation Atlas holds exists because someone pointed at a URL.",
      "No publisher can list organisations for a region.",
      "Directory expansion is the only leverage available today.",
    ],
    duration: "Not measured — one fetch and one extraction",
    operationId: "directory",
    steps: [
      {
        title: "Expand the directory",
        detail:
          "Or learn the page is not a directory, which is also a real result.",
        operationId: "directory",
      },
      {
        title: "Read the queue so the children learn something",
        detail: "Expansion creates them empty; their own pages are queued.",
      },
    ],
    done: [queueDrained(), noOpenRelationships()],
  },
];

/* -------------------------------------------------------------------------
 * Reading the catalogue
 * ---------------------------------------------------------------------- */

export function missionsFor(domainSlug: string): readonly Mission[] {
  return MISSIONS.filter((m) => m.domain === domainSlug);
}

export interface EvaluatedCondition {
  readonly condition: DoneCondition;
  readonly result: ConditionResult;
}

export interface MissionOutcome {
  readonly conditions: readonly EvaluatedCondition[];
  /** True only when every condition is `done`. `unverifiable` never completes a mission on its own. */
  readonly complete: boolean;
  /** True when the only thing left is something Atlas cannot see. */
  readonly awaitingYou: boolean;
  readonly remaining: number;
}

export function evaluateMission(
  mission: Mission,
  ctx: MissionContext,
): MissionOutcome {
  const conditions = mission.done.map((condition) => ({
    condition,
    // A domain whose work cannot be attributed to it has zeroes for every
    // counter, and a condition that reads "nothing is waiting" would pass on
    // a number nobody measured. Unverifiable is the honest grade.
    result: ctx.scopeable
      ? condition.evaluate(ctx)
      : ({
          state: "unverifiable",
          detail:
            "This domain is cross-cutting, so nothing can be attributed to it and there is no number to read.",
        } as ConditionResult),
  }));
  const notDone = conditions.filter((c) => c.result.state === "not-done");
  const unverifiable = conditions.filter(
    (c) => c.result.state === "unverifiable",
  );
  return {
    conditions,
    complete: conditions.every((c) => c.result.state === "done"),
    // An `unverifiable` condition does not block completion silently — it is
    // handed back to the operator as the one thing only they can confirm.
    awaitingYou: notDone.length === 0 && unverifiable.length > 0,
    remaining: notDone.length,
  };
}

/* -------------------------------------------------------------------------
 * Progression — the whole point, and what was missing
 * ---------------------------------------------------------------------- */

export interface MissionProgress {
  readonly mission: Mission;
  readonly outcome: MissionOutcome;
  readonly state: MissionState;
}

export interface DomainProgress {
  readonly missions: readonly MissionProgress[];
  /** The one to work on. Absent when every remaining mission is blocked. */
  readonly current?: MissionProgress;
  /** The one that becomes current when `current` completes. */
  readonly next?: MissionProgress;
  readonly completed: number;
  readonly total: number;
}

/**
 * **Which mission is current, derived from Atlas's facts.**
 *
 * This function is the fix for the defect that made a mission say *"Mission
 * complete"* and *"NOW"* in the same breath. Completion was derived; the
 * pointer to the current mission was a hand-written `status: "active"` in the
 * catalogue, so it never moved. Two answers to one question, and the asserted
 * one won.
 *
 * The rules, in order, and there is nothing else:
 *
 * 1. Every mission is evaluated against the same context.
 * 2. A mission whose conditions are all `done` is **complete** — whether or
 *    not anyone marked it so, and whether or not it was ever started. A
 *    mission with nothing to do was already finished.
 * 3. A mission with `blockedBy` that is not complete is **blocked**, and can
 *    never be current: an operator cannot start it.
 * 4. **Current** is the first mission that is neither complete nor blocked.
 * 5. Everything after it is **queued**.
 *
 * A blocked mission can still complete — if trails appear in the corpus, the
 * blocker cleared in reality and the mission is finished regardless of what
 * the catalogue says about it. Facts outrank the assertion, always.
 *
 * Nothing is stored. Run a command, refresh, and the pointer has moved because
 * the corpus moved.
 */
export function evaluateDomain(
  domainSlug: string,
  ctx: MissionContext,
): DomainProgress {
  const evaluated = missionsFor(domainSlug).map((mission) => ({
    mission,
    outcome: evaluateMission(mission, ctx),
  }));

  let currentIndex = -1;
  const missions: MissionProgress[] = evaluated.map((entry, index) => {
    if (entry.outcome.complete) return { ...entry, state: "complete" as const };
    if (entry.mission.blockedBy) return { ...entry, state: "blocked" as const };
    if (currentIndex === -1) {
      currentIndex = index;
      return { ...entry, state: "current" as const };
    }
    return { ...entry, state: "queued" as const };
  });

  return {
    missions,
    current: currentIndex === -1 ? undefined : missions[currentIndex],
    next: missions.find(
      (m, index) => index > currentIndex && m.state === "queued",
    ),
    completed: missions.filter((m) => m.state === "complete").length,
    total: missions.length,
  };
}
