"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleSlash,
  Compass,
  Landmark,
  Radio,
  Loader2,
  MapPin,
  Plus,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * **Teach Atlas something new.**
 *
 * Discovery V1 (ADR 031). One input, one name, and an honest account of what
 * Atlas can and cannot establish about it.
 *
 * ## The redesign, and the one rule it follows
 *
 * The previous version rendered the investigation *in the order the machine
 * performed it*: summary, scope, ladder, candidates, refusals, then ten equal
 * source cards. Everything true, nothing prioritised — a curator had to read
 * an audit report to learn whether Atlas had got anywhere.
 *
 * > **A curator asks "what should I do next?" The machine answers "what did I
 * > do?" The interface owes the first question, and only then the second.**
 *
 * So the first screen is a *verdict*, three cards, and nothing else:
 * **what I know · what I'm missing · what I want next**. Every technical
 * artefact still exists, one disclosure away, and the raw receipts live in a
 * dark Engineering Log that reads like DevTools because that is exactly what
 * it is.
 *
 * ## Nothing here decides anything
 *
 * Every judgement below is a *reading of the report*, computed from fields
 * Atlas already returned. This file starts no request that the old one did
 * not, resolves no identity, and writes nothing that was not already a
 * deliberate click. **The verdict is a statement about the investigation,
 * never about the world** — `close` means Atlas has strong evidence and no
 * conclusion, which is a fact about Atlas.
 *
 * ## Atlas speaks in the first person; its receipts do not
 *
 * The copy this file authors is Atlas talking: *"I found it, and I can't
 * name it yet."* The strings Atlas's own backend produced stay verbatim in
 * the third person, inside the disclosures. That split is deliberate — a
 * curator can always tell the difference between Atlas addressing them and
 * Atlas's log being quoted at them, and nothing in the log has been
 * paraphrased into friendliness.
 */

/** See `Lead.corroboration`. Mirrors the API's own union, ADR 040. */
type Corroboration = "enumerated" | "not-enumerated" | "unknown" | "unsought";

const CORROBORATION_STATES: readonly Corroboration[] = [
  "enumerated",
  "not-enumerated",
  "unknown",
  "unsought",
];

interface Lead {
  url: string;
  publisher: string;
  sourceType: string;
  basis: string;
  title?: string;
  /**
   * How much of the curator's words this lead's title shares. Presentation
   * order only — every lead is shown, and none of this decides identity.
   */
  nameMatch?: "exact" | "contains" | "partial" | "unrelated";
  /**
   * Whether the investigation's own other evidence still leaves this
   * plausible. Defaulted rather than required: a tab restoring a snapshot
   * taken before reconciliation existed must not render as though every lead
   * were contradicted.
   */
  standing?: "primary" | "background";
  /** Which evidence demoted it. Present only on `background`. */
  standingReason?: string;
  /**
   * **How this lead relates to the area the investigation is bounded to.**
   *
   * Required on a current report. `unplaced` is not `out-of-scope` — a page
   * that says nothing about where it is has not said it is elsewhere — and
   * `no-scope` means there is no area to be inside or outside of.
   */
  scopeRelation: "in-scope" | "out-of-scope" | "unplaced" | "no-scope";
  /** Why it sits there, saying whether Atlas measured it or read a label. */
  scopeReason: string;
  /**
   * **What this lead's own publisher said about it** (ADR 040).
   *
   * `enumerated` — the publisher's index listed this page.
   * `not-enumerated` — the publisher answered and did not list it.
   * `unknown` — the publisher was asked and Atlas learned nothing.
   * `unsought` — the publisher was not asked in this run.
   *
   * **Required, and not the same question as `basis`.** `basis` says who
   * created the address; this says whether anyone confirmed it resolves. A
   * Wikipedia search hit is `constructed` **and** `enumerated`, which is why
   * this page's verdict used to be wrong when it tested `basis` alone.
   */
  corroboration: Corroboration;
  /** The context the publisher itself attached — `Arkansas`. Verbatim. */
  statedContext?: string;
  reason: string;
  couldEstablish: string[];
  state: "new" | "queued" | "read";
  /** Present once queued — needed to read it. */
  candidateSourceId?: string;
  /**
   * The entity this source taught Atlas. **Absent means read but not
   * learned** — a decision that is still waiting, not one that was made.
   */
  learnedEntityId?: string;
}

interface Match {
  id: string;
  name: string;
  kind: string;
}

interface Consulted {
  publisher: string;
  participated: boolean;
  note: string;
}

type StrategyStatus =
  | "succeeded"
  /**
   * The strategy ran, the publisher answered, and the answer was nothing.
   * A real zero — and deliberately not rendered like `skipped` or
   * `not-applicable`, which are statements about Atlas rather than about
   * the world.
   */
  | "none-found"
  | "multiple-candidates"
  | "failed"
  | "not-applicable"
  | "skipped";

interface Strategy {
  number: number;
  name: string;
  status: StrategyStatus;
  detail: string;
  /** Which name this rung was asked about, when it differed from the subject. */
  askedAbout?: string;
  /**
   * Whether the investigation's area constrained this rung's request.
   *
   * Rendered because a timeline showing four plain successes would imply four
   * publishers answered the same question. Three were asked what is inside a
   * box; Wikipedia was asked what it has anywhere in the world.
   */
  bounding?: "bounded-by-scope" | "unbounded";
}

interface DiscoveryScope {
  bbox: { south: number; west: number; north: number; east: number };
  source: "curator-asserted" | "member-derived";
  label: string;
  derivedFrom?: { id: string; name: string }[];
}

/**
 * A record that already identifies itself, from whichever publisher returned
 * it. `system` names the namespace `externalId` belongs to — `osm`, `bcgnis`.
 *
 * The publisher-specific fields below are optional because they are exactly
 * that: OpenStreetMap publishes `tags` and a matched name field, the province
 * publishes `attributes` and a feature type, and neither has to pretend to
 * have the other's.
 */
interface LocatedRecord {
  system: string;
  externalId: string;
  name: string;
  coordinates?: [number, number];
  url: string;
  whyConsidered: string;
  identity: { hasIdentity: boolean; signals: string[]; reason?: string };
  /** OpenStreetMap's published tags. */
  tags?: Record<string, string>;
  /** Which of OSM's name fields matched. Absent is a real answer. */
  matchedField?: "name" | "alt_name";
  /** BC Geographical Names' published attributes. */
  attributes?: Record<string, string>;
  /** What the province says the feature is — `Lake`, `Creek`. */
  featureType?: string;
}

/** What to call a publisher, from the record's own namespace. */
const SYSTEM_LABEL: Record<string, string> = {
  osm: "OpenStreetMap",
  bcgnis: "BC Geographical Names",
  fwa: "BC Freshwater Atlas",
};

function publisherOf(record: LocatedRecord): string {
  return SYSTEM_LABEL[record.system] ?? record.system;
}

/** One name, as one publisher published it, under the publisher's own key. */
interface PublishedName {
  field: string;
  name: string;
  role: "primary" | "alternate";
}

/** What one publisher contributed to an identity proposal. */
interface ProposalEvidence {
  publisher: string;
  system: string;
  externalId: string;
  url: string;
  publishedNames: PublishedName[];
  /** The slot carrying exactly what the curator typed — absent on most publishers. */
  matchedQuery?: PublishedName;
  featureType?: string;
}

/**
 * **Several publishers appear to be describing one place.**
 *
 * A question with its evidence attached, never a conclusion. Nothing has been
 * renamed, merged or written on the server; this is rendered so a curator can
 * answer, and until they do the investigation is exactly where it was.
 */
interface IdentityProposal {
  key: string;
  searchedFor: string;
  proposedName: string;
  proposedNameFrom: string;
  evidence: ProposalEvidence[];
  signals: string[];
  whyAsking: string;
}

type IdentityReconciliation =
  | { outcome: "proposed"; detail: string; proposal: IdentityProposal }
  | { outcome: "ambiguous"; detail: string; candidates: IdentityProposal[] }
  | { outcome: "no-convergence" | "declined" | "confirmed"; detail: string };

/** One published name, and the publisher and field it came from. */
interface HypothesisName {
  name: string;
  role: "primary" | "alternate";
  publisher: string;
  system: string;
  field: string;
}

/**
 * **What the investigation is about**: one real-world thing with several
 * published names. Distinct from the report's `name` (what this run asked
 * about) and from `originalSearch` (what the curator typed).
 */
interface IdentityHypothesis {
  key: string;
  searchedFor: string;
  primaryName: string;
  primaryNameFrom: string;
  names: HypothesisName[];
  status: "proposed" | "confirmed";
}

/**
 * **The single highest-value thing to do next**, decided by Atlas from its own
 * evidence rather than by this component from the order leads arrived in.
 *
 * The rule lives in `nextMove.ts` on the Atlas side, where it can be tested. A
 * rule that lives in a component is a rule nothing can test — which is how
 * *"read the first unread URL"* survived into a world with converging
 * publishers.
 */
interface NextMove {
  kind:
    | "resolve-ambiguity"
    | "confirm-identity"
    | "read-corroborated"
    | "compare-existing"
    | "give-scope"
    | "supply-url"
    /**
     * Ask again a publisher whose request never completed. Not an error
     * state — the one move whose cost is known and whose answer is genuinely
     * still open.
     */
    | "retry-publisher"
    | "read-constructed";
  label: string;
  why: string;
  url?: string;
}

/**
 * **What one publisher said, in the curator's language.**
 *
 * Comes from the API already written this way (`publisherAccount.ts`). This
 * component renders it and computes nothing from it — the engine vocabulary
 * (`corroboration`, `standing`, identity signals) stays in the engineering
 * detail below, where it belongs.
 */
interface PublisherAccount {
  publisher: string;
  outcome: "found" | "nothing" | "failed" | "not-asked";
  detail: string;
  foundName?: string;
  alsoPublishedAs?: string[];
  asked: string[];
  externalId?: string;
  url?: string;
}

/** A published name this investigation worked with, and who published it. */
interface KnownName {
  name: string;
  from: string;
  field: string;
  role: "primary" | "alternate" | "searched";
  fromRecord?: string;
  system?: string;
}

interface Report {
  /** What the ladder investigated — the resolved name once one is confirmed. */
  name: string;
  /** What the curator typed. Never overwritten by a resolution. */
  originalSearch: string;
  outcome: "already-known" | "leads-found" | "queued-unread" | "no-sources";
  possibleMatches: Match[];
  leads: Lead[];
  consulted: Consulted[];
  strategies: Strategy[];
  /** Which question the investigation is answering — see `investigationPhase`. */
  phase: "identity" | "enrichment";
  phaseDetail: string;
  /** The plain-language account of every publisher. */
  publisherAccounts: PublisherAccount[];
  /** Every published name this investigation worked with, with provenance. */
  knownNames: KnownName[];
  scope?: DiscoveryScope;
  scopeRefusal?: { reason: string; remedy: string };
  structuredRecords: LocatedRecord[];
  /** Always present, including when the answer is "nothing converged". */
  identity: IdentityReconciliation;
  /** The investigation's subject, once several publishers have converged on one. */
  hypothesis?: IdentityHypothesis;
  /** Decided by Atlas from its evidence, not by this component from arrival order. */
  nextMove: NextMove;
  /**
   * What genuinely stops the investigation. **Usually empty** — normal
   * incompleteness is not failure, and rendering it as failure is what made
   * "no dedicated Wikipedia article" look like an obstacle.
   */
  blockers: string[];
  resolvedIdentity?: {
    searchedFor: string;
    resolvedName: string;
    proposalKey: string;
  };
  osmQuery?: string;
  summary: string;
}

/**
 * **The tab is an external system, so it is read like one.**
 *
 * A restored investigation used to be pushed into state from an effect, which
 * is a cascading render and a lint error the codebase has already paid for
 * once. `useSyncExternalStore` is the sanctioned way to read the URL and
 * `sessionStorage`: the server snapshot is `null`, so nothing is claimed
 * before hydration, and both reads return **stable strings** rather than fresh
 * objects, which is what keeps React from looping.
 */
const noSubscribe = () => () => {};

interface Snapshot {
  report: Report;
  at: string;
}

/**
 * **The keys this component reads without checking first.**
 *
 * Every one is an array on a live report, empty when the investigation found
 * nothing of that kind, and **never absent** — asserted on the Atlas side
 * across every path a report can take.
 *
 * The list is here so the assumption is written down in the place that makes
 * it. `verdictOf` reaches straight for `report.structuredRecords.filter`
 * because the contract says it can; this is what makes that true rather than
 * hopeful.
 */
const REPORT_ARRAYS = [
  "possibleMatches",
  "leads",
  "consulted",
  "strategies",
  "structuredRecords",
  "blockers",
  // Added with the bounded-lake workflow. A snapshot taken before it carries
  // neither, and rendering the publisher panel from an absent array would be
  // the crash class this list exists to prevent. Discarding costs one refresh.
  "publisherAccounts",
  "knownNames",
] as const;

/**
 * **Is this actually a report from the Atlas this component was built
 * against?**
 *
 * `as Report` is a claim TypeScript cannot check, and it is made at the two
 * places where the value genuinely comes from outside the program: an HTTP
 * body, and a JSON blob the tab has been holding since who-knows-which build.
 * At both, the cast was wrong often enough to crash — so the cast is gone and
 * this answers the question instead.
 *
 * **Deliberately not optional chaining.** `structuredRecords?.filter(...)`
 * would render a stale payload as though it were an answer, and the answer it
 * produces would be wrong in a way nobody could see: a five-year-old cached
 * report showing "I found nothing" about a place Atlas now finds. A shape that
 * is not this contract is not a weaker report, it is **not a report**, and the
 * honest thing is to say so and offer to ask again.
 */
/**
 * **What each publisher said** — the panel a curator reads first.
 *
 * One row per publisher, in plain words, with the found name given the weight
 * it deserves. Every value is read straight off `report.publisherAccounts`;
 * nothing here decides anything, and nothing here is derived from `standing`,
 * `corroboration` or an identity signal. Those are engineering vocabulary and
 * they stay in the timeline below.
 *
 * The colours are the ones the rest of the page already uses, at contrast that
 * survives a dark background — a found name is the loudest thing in the row,
 * a failure is amber because it is a fact about the request and not about the
 * world, and *nothing found* is quiet because it is a normal outcome.
 */
function PublisherAccounts({
  accounts,
  phaseDetail,
  rise,
}: {
  accounts: PublisherAccount[];
  phaseDetail: string;
  rise: Record<string, unknown>;
}) {
  if (accounts.length === 0) return null;

  const MARK: Record<
    PublisherAccount["outcome"],
    { glyph: string; tone: string }
  > = {
    found: { glyph: "✓", tone: "text-emerald-400" },
    nothing: { glyph: "–", tone: "text-muted-foreground" },
    failed: { glyph: "!", tone: "text-amber-600 dark:text-amber-400" },
    "not-asked": { glyph: "·", tone: "text-muted-foreground" },
  };

  return (
    <motion.section
      {...rise}
      className="bg-card mt-4 overflow-hidden rounded-xl border"
      aria-label="What each publisher said"
    >
      <header className="border-b px-5 py-3">
        <h3 className={cn("text-[13px] font-extrabold tracking-tight", INK)}>
          What each publisher said
        </h3>
        <p className="text-muted-foreground mt-1 text-[12px] leading-relaxed">
          {phaseDetail}
        </p>
      </header>

      <ul className="divide-y">
        {accounts.map((account) => {
          const mark = MARK[account.outcome];
          return (
            <li key={account.publisher} className="flex gap-3 px-5 py-3.5">
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 w-3 shrink-0 text-center text-[13px] font-bold",
                  mark.tone,
                )}
              >
                {mark.glyph}
              </span>
              <div className="min-w-0 flex-1">
                <div className={cn("text-[13px] font-bold", INK)}>
                  {account.publisher}
                </div>

                {account.foundName ? (
                  <div className={cn("mt-0.5 text-[13px]", INK)}>
                    Found{" "}
                    <span className="font-extrabold text-emerald-700 dark:text-emerald-300">
                      {account.foundName}
                    </span>
                  </div>
                ) : (
                  <div className="text-muted-foreground mt-0.5 text-[13px]">
                    {account.detail}
                  </div>
                )}

                {account.alsoPublishedAs &&
                  account.alsoPublishedAs.length > 0 && (
                    <div className="text-muted-foreground mt-0.5 text-[12px]">
                      Also published as{" "}
                      <span className={cn("font-semibold", INK)}>
                        {account.alsoPublishedAs.join(", ")}
                      </span>
                    </div>
                  )}

                {account.asked.length > 0 && (
                  <div className="text-muted-foreground mt-1 text-[11px]">
                    Asked about {account.asked.join(" and ")}
                  </div>
                )}

                {account.url && (
                  <a
                    href={account.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground mt-1 inline-block text-[11px] underline underline-offset-2"
                  >
                    {account.externalId ?? "open"}
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </motion.section>
  );
}

export function isReport(value: unknown): value is Report {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  for (const key of REPORT_ARRAYS) {
    if (!Array.isArray(candidate[key])) return false;
  }
  if (typeof candidate.name !== "string") return false;
  if (typeof candidate.originalSearch !== "string") return false;
  if (typeof candidate.summary !== "string") return false;
  const identity = candidate.identity as Record<string, unknown> | undefined;
  if (!identity || typeof identity.outcome !== "string") return false;
  const nextMove = candidate.nextMove as Record<string, unknown> | undefined;
  if (!nextMove || typeof nextMove.kind !== "string") return false;
  // **A kind this build has no control for is rejected, not rendered.**
  // `whatIWant` indexes `MOVE_ACTION` directly and reads `.id` off the result,
  // so an unrecognised kind is `undefined.id` — the same class of crash as the
  // report whose arrays were assumed rather than checked. A newer API teaching
  // Atlas a move this page cannot perform is a real thing that will happen
  // again; discarding the report costs one refresh, and rendering a button
  // that cannot act costs a curator's trust.
  if (!Object.prototype.hasOwnProperty.call(MOVE_ACTION, nextMove.kind))
    return false;
  // **The verdict now branches on `corroboration`, so it is checked here.**
  // A cached snapshot taken before ADR 040 carries leads without it, and an
  // absent field would silently fall through every branch to *"I can't prove
  // this yet"* — the exact wrong sentence, produced without a symptom.
  // Discarding the report costs one refresh; it is re-derivable from
  // (region, name), which is why caching it was safe in the first place.
  return (candidate.leads as { corroboration?: unknown }[]).every((l) =>
    CORROBORATION_STATES.includes(l?.corroboration as Corroboration),
  );
}

/**
 * A cached investigation, or nothing.
 *
 * A snapshot that does not match the current contract is **discarded rather
 * than repaired**. The report is fully re-derivable from (region, name) — that
 * is why it was safe to cache in the first place — so throwing away a stale
 * one costs one request, and rendering it costs a curator's trust.
 */
function parseSnapshot(raw: string | null): Snapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const { report, at } = parsed as { report?: unknown; at?: unknown };
    if (!isReport(report) || typeof at !== "string") return null;
    return { report, at };
  } catch {
    return null;
  }
}

function snapshotKeyFor(regionId: string, subject: string): string {
  return `atlas.discovery.${regionId}.${subject.trim().toLowerCase()}`;
}

function readUrlSubject(): string | null {
  if (typeof window === "undefined") return null;
  return new URL(window.location.href).searchParams.get("investigate");
}

function readSaved(regionId: string, subject: string | null): string | null {
  if (typeof window === "undefined" || !subject) return null;
  try {
    return sessionStorage.getItem(snapshotKeyFor(regionId, subject));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Reading the report
// ---------------------------------------------------------------------------

type VerdictKind = "known" | "close" | "looking" | "stuck";

interface Verdict {
  kind: VerdictKind;
  /** Four words at most. This is the line read in the first second. */
  headline: string;
  /** One sentence. What Atlas can and cannot say, in its own voice. */
  line: string;
}

/**
 * **The five-second answer.**
 *
 * Derived entirely from fields the report already carries — this computes no
 * confidence, consults nothing, and could not change an investigation if it
 * tried. Each verdict is a claim about *what Atlas has established*, which is
 * why `close` is honest: strong evidence and no conclusion is a real state,
 * and it is the state most investigations end in.
 */
function verdictOf(report: Report): Verdict {
  const learned = report.leads.some((l) => l.learnedEntityId);
  if (learned) {
    return {
      kind: "known",
      headline: "I know this one.",
      line: "I read a source, it identified the place, and there's an entry in Atlas because of it.",
    };
  }

  // **Convergence outranks a record count**, because it is the answer to the
  // question the count was standing in for. This block reads
  // `report.identity`, which the verdict used to ignore entirely — so a run
  // where three publishers had agreed still announced *"3 real features could
  // be it. I won't pick between them"* directly above a panel where Atlas had
  // picked.
  if (report.identity.outcome === "confirmed" && report.hypothesis) {
    const { hypothesis } = report;
    return {
      kind: "known",
      headline: `I'm investigating ${hypothesis.primaryName}.`,
      line: `You searched for ${hypothesis.searchedFor}; several publishers agree that is this place, and you confirmed it. Nothing was renamed, merged or written.`,
    };
  }

  if (report.identity.outcome === "proposed") {
    const { proposal } = report.identity;
    const publishers = [...new Set(proposal.evidence.map((e) => e.publisher))];
    const alias = proposal.evidence.find(
      (e) => e.matchedQuery?.role === "alternate",
    );
    return {
      kind: "close",
      headline: "I think I found your place.",
      line: alias
        ? `${publishers.length} independent publishers converge on ${proposal.proposedName}, which ${alias.publisher} also publishes as ${alias.matchedQuery!.name}. Same thing, different names — tell me if you agree.`
        : `${publishers.length} independent publishers converge on ${proposal.proposedName}. Tell me if that's the one you meant.`,
    };
  }

  if (report.identity.outcome === "ambiguous") {
    // A genuine blocker, and the one verdict state that should look like one.
    return {
      kind: "stuck",
      headline: "Two places could be this.",
      line: "Separate sets of records each converge on a place with this name inside the area I searched. Choosing between them is yours, not mine.",
    };
  }

  const identified = report.structuredRecords.filter(
    (c) => c.identity.hasIdentity,
  );
  if (identified.length > 0) {
    return {
      kind: "close",
      headline: "I found it. I can't prove it's yours yet.",
      line:
        identified.length === 1
          ? "A real feature with a canonical ID and published coordinates, inside the area I searched. Nothing independent corroborates it."
          : `${identified.length} real features could be it. I won't pick between them — that's your judgement, not mine.`,
    };
  }

  // **"Nothing found yet" is only true when nothing was found.** A page some
  // publisher actually listed is a finding; an address Atlas assembled from a
  // name is a guess, and calling both "sources worth reading" is what made
  // this line untrue on runs that had real evidence.
  const readable = report.leads.filter(
    (l) => (l.standing ?? "primary") === "primary",
  );
  // **`basis` is not the test, and testing it here was a defect.** A Wikipedia
  // search hit is `constructed` — deliberately, so it is verified before
  // extraction — and its publisher's own index listed it. It is a page
  // somebody published, and this line used to call it a guess.
  const published = readable.filter(
    (l) => l.basis !== "constructed" || l.corroboration === "enumerated",
  );
  if (published.length > 0) {
    return {
      kind: "looking",
      headline: "I know where to look.",
      line: `${published.length === 1 ? "One source its own publisher listed is" : `${published.length} sources their own publishers listed are`} worth reading. Point me at one and I'll go.`,
    };
  }
  if (readable.length > 0) {
    return {
      kind: "looking",
      headline: "I have somewhere to try.",
      line: `Nothing published turned up. I built ${readable.length === 1 ? "an address" : `${readable.length} addresses`} from the name — nobody has confirmed a page is there, so ${readable.length === 1 ? "it is a guess" : "they are guesses"} worth a click rather than a lead.`,
    };
  }

  // **Found, and elsewhere, is not "nothing found".** Every page Atlas
  // reached is published about a different place — a real finding about how
  // this name is used in the world, and a different sentence from an empty
  // search.
  const elsewhere = report.leads.filter(
    (l) => l.scopeRelation === "out-of-scope",
  );
  if (elsewhere.length > 0) {
    return {
      kind: "looking",
      headline: "Everything I found is somewhere else.",
      line: `${elsewhere.length} pages with this name are published about other places — they're listed below with the reason. None of them is the one you're asking about.`,
    };
  }

  // **Why there is nothing to read — which is three different answers.**
  //
  // Everything reaching this point is an address Atlas built that nothing has
  // corroborated. Before ADR 040 this page said *"Nothing I know how to reach
  // establishes it"* for all three, which is a claim about Atlas's reach on a
  // run where a publisher merely timed out. The summary says whichever of
  // these actually happened; so must the verdict, or the two sentences a
  // curator reads together disagree.
  const unheard = publishersWhere(report, "unknown");
  if (unheard.length > 0) {
    return {
      kind: "looking",
      headline: `I couldn't reach ${listOfNames(unheard)}.`,
      line: `The request didn't complete, so I don't know whether there's a page for this. That's my request failing, not an answer — ask again and I'll find out.`,
    };
  }

  const unasked = publishersWhere(report, "unsought");
  if (unasked.length > 0) {
    return {
      kind: "looking",
      headline: "I haven't checked this yet.",
      line: `I built ${report.leads.length === 1 ? "an address" : `${report.leads.length} addresses`} from the name and haven't put ${report.leads.length === 1 ? "it" : "them"} to ${listOfNames(unasked)}. Nothing has confirmed a page is there — and nothing has said there isn't one.`,
    };
  }

  const searched = publishersWhere(report, "not-enumerated");
  if (searched.length > 0) {
    return {
      kind: "stuck",
      headline: `${listOfNames(searched)} didn't return a page for this.`,
      line: `I searched and nothing matching came back, so the ${report.leads.length === 1 ? "address" : "addresses"} I built ${report.leads.length === 1 ? "is" : "are"} listed below unconfirmed. That's what the search found, not proof the place is undocumented — hand me a URL and I'll read it.`,
    };
  }

  return {
    kind: "stuck",
    headline: "I can't prove this yet.",
    line: "Nothing I know how to reach establishes it. That's my reach, not the world — hand me a URL and I'll read it.",
  };
}

/**
 * The publishers behind this report's leads in one corroboration state.
 *
 * **Read off the lead, never re-derived.** ADR 040 exists so this page does not
 * have to reconstruct what a publisher did from `standing`, from `basis`, or
 * from which arrays happen to be empty — each of which this file has got wrong
 * at least once.
 */
function publishersWhere(report: Report, state: Corroboration): string[] {
  return [
    ...new Set(
      report.leads
        .filter((l) => l.corroboration === state)
        .map((l) => l.publisher.split(" · ")[0] ?? l.publisher),
    ),
  ];
}

function listOfNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * **Three meters, and every number is already in the report.**
 *
 * Progress here is *measured*, never staged. `identity` counts the signals a
 * real candidate carries against the four `assessIdentity` can award;
 * `publishers` counts who answered against who was asked; `sources` counts
 * pages actually fetched against pages proposed. A bar that moved on a timer
 * rather than on a fact would be the fabricated zero wearing a progress
 * animation.
 */
interface Meter {
  label: string;
  have: number;
  of: number;
  note: string;
  /** Warn styling when the bar is meaningfully short of its own target. */
  tone: "good" | "warn";
}

/** The four signals `assessIdentity` can award. The honest denominator. */
const IDENTITY_SIGNALS = 4;

function metersOf(report: Report): Meter[] {
  const strongest = report.structuredRecords
    .slice()
    .sort((a, b) => b.identity.signals.length - a.identity.signals.length)[0];
  const idSignals = strongest?.identity.signals ?? [];

  const reached = report.consulted.filter((c) => c.participated);
  const read = report.leads.filter((l) => l.state === "read");
  const primary = report.leads.filter(
    (l) => (l.standing ?? "primary") === "primary",
  );
  const background = report.leads.length - primary.length;

  return [
    {
      label: "Identity",
      have: idSignals.length,
      of: IDENTITY_SIGNALS,
      note:
        idSignals.length > 0
          ? idSignals.join(" · ")
          : "nothing identifies it yet",
      tone: idSignals.length >= 2 ? "good" : "warn",
    },
    {
      label: "Publishers reached",
      have: reached.length,
      of: report.consulted.length,
      note:
        reached.length > 0
          ? reached.map((c) => c.publisher).join(" · ")
          : "none answered",
      tone: reached.length >= 2 ? "good" : "warn",
    },
    {
      label: "Sources read",
      have: read.length,
      of: report.leads.length,
      note:
        report.leads.length === 0
          ? "none proposed"
          : `${primary.length} worth reading${background > 0 ? `, ${background} contradicted` : ""}`,
      tone: read.length > 0 ? "good" : "warn",
    },
  ];
}

interface Fact {
  label: string;
  /** The evidence behind the tick, in a few words. Never a sentence. */
  detail?: string;
}

/** What Atlas can actually stand behind, each item earned by a field in the report. */
function whatIKnow(report: Report): Fact[] {
  const facts: Fact[] = [];

  if (report.structuredRecords.length > 0) {
    const publishers = [...new Set(report.structuredRecords.map(publisherOf))];
    facts.push({
      label:
        publishers.length === 1
          ? `${publishers[0]} has it`
          : `${publishers.length} publishers have it`,
      detail: report.structuredRecords
        .slice(0, 2)
        .map((c) => c.name)
        .join(" · "),
    });
  }

  const alias = report.structuredRecords.find(
    (c) => c.matchedField === "alt_name",
  );
  if (alias) {
    facts.push({
      label: "Known by another name",
      detail: `${alias.name} — also “${alias.tags?.alt_name ?? report.name}”`,
    });
  }

  const official = report.structuredRecords.find((c) => c.system === "bcgnis");
  if (official) {
    facts.push({
      label: "Officially named by the province",
      detail: `${official.name}${official.featureType ? ` · ${official.featureType}` : ""}`,
    });
  }

  const located = report.structuredRecords.find((c) => c.coordinates);
  if (located) {
    facts.push({
      label: "Coordinates published",
      detail: located.coordinates
        ? `${located.coordinates[1].toFixed(4)}, ${located.coordinates[0].toFixed(4)}`
        : undefined,
    });
  }

  const canonical = report.structuredRecords.find(
    (c) => c.identity.hasIdentity,
  );
  if (canonical) {
    facts.push({ label: "Canonical identifier", detail: canonical.externalId });
  }

  if (report.possibleMatches.length > 0) {
    facts.push({
      label: "I may already hold it",
      detail: report.possibleMatches.map((m) => m.name).join(" · "),
    });
  }

  const readable = report.leads.filter(
    (l) => (l.standing ?? "primary") === "primary",
  );
  if (readable.length > 0) {
    facts.push({
      label: `${readable.length} source${readable.length === 1 ? "" : "s"} worth reading`,
      detail: readable[0]?.publisher,
    });
  }

  const learnedLead = report.leads.find((l) => l.learnedEntityId);
  if (learnedLead) {
    facts.push({
      label: "Already learned from a source",
      detail: learnedLead.publisher,
    });
  }

  return facts;
}

/** The gaps — stated as what is missing, never as what failed. */
/**
 * **What actually stands between here and knowing.**
 *
 * This list used to be a catalogue of everything unfinished — *no dedicated
 * Wikipedia article*, *nothing fetched yet* — rendered under a heading that
 * called them all blockers. None of them block anything. A publisher having
 * nothing **advances** an investigation: it is one fewer place to look. A
 * source not yet read is the ordinary state of every source Atlas has just
 * found.
 *
 * So the genuine blockers now come from Atlas, which decides them from the
 * same evidence it decides the next move from, and the merely-unfinished
 * appear underneath as what they are.
 */
function whatIMiss(report: Report): Fact[] {
  const gaps: Fact[] = [];

  // Atlas's own list. Empty on almost every investigation, which is correct.
  for (const blocker of report.blockers) {
    gaps.push({ label: blocker.split(".")[0]!, detail: blocker });
  }

  const publishersWithEvidence = new Set<string>([
    ...report.structuredRecords.map(publisherOf),
    ...report.leads
      .filter(
        (l) =>
          (l.standing ?? "primary") === "primary" && l.basis !== "constructed",
      )
      .map((l) => l.publisher.split(" · ")[0]!),
  ]);
  // Only worth saying while nothing has corroborated anything. Once several
  // publishers converge, this is answered.
  if (
    publishersWithEvidence.size < 2 &&
    report.identity.outcome !== "confirmed"
  ) {
    gaps.push({
      label: "One authority, not two",
      detail: "one source agreeing with itself isn't corroboration",
    });
  }

  if (!report.leads.some((l) => l.learnedEntityId)) {
    gaps.push({
      label: "Your judgement",
      detail: "nothing exists in Atlas until you say so",
    });
  }

  return gaps;
}

type ActionId = "compare" | "read" | "scope" | "url" | "ask" | "identity";

interface Recommendation {
  id: ActionId;
  label: string;
  why: string;
  /** Available now means a real control exists behind it, and it works. */
  cta?: string;
}

/**
 * **What Atlas wants next — and only things it can actually do.**
 *
 * Every entry maps to a control that exists on this page. A recommendation
 * that cannot be acted on is a button that lies, and the roadmap below it
 * (`WANTED_PUBLISHERS`) exists precisely so that wanting something Atlas
 * cannot do yet has an honest place to live instead.
 */
/** Which control on this page answers each kind of move Atlas can recommend. */
const MOVE_ACTION: Record<NextMove["kind"], { id: ActionId; cta: string }> = {
  "resolve-ambiguity": { id: "scope", cta: "Narrow the area" },
  "confirm-identity": { id: "identity", cta: "Look at the evidence" },
  "read-corroborated": { id: "read", cta: "Read it now" },
  "compare-existing": { id: "compare", cta: "Compare them" },
  "give-scope": { id: "scope", cta: "Show me how" },
  "supply-url": { id: "url", cta: "Show me how" },
  // Re-running the investigation is what re-asks a publisher, and the search
  // box is the control that does it. `MOVE_ACTION` is indexed directly by
  // `report.nextMove.kind`, so a kind missing from this table is `undefined`
  // dereferenced one line later — the shape of crash this file has already
  // paid for once.
  "retry-publisher": { id: "ask", cta: "Ask again" },
  "read-constructed": { id: "read", cta: "Try it" },
};

/**
 * **What Atlas wants next — decided by Atlas.**
 *
 * The first entry is `report.nextMove`, computed server-side from the
 * investigation's own evidence by a rule that has tests. What this function
 * still owns is *which control on this page answers it*, which is genuinely a
 * question about the interface.
 *
 * It used to own the decision too, and the decision was **the first unread
 * lead wins** — which recommended reading a URL Atlas had invented over
 * confirming an identity three publishers had converged on. A rule that lives
 * in a component is a rule nothing can test.
 */
/**
 * **The publisher whose page this move proposes fetching.**
 *
 * Read off the lead the move points at, never parsed out of the URL's
 * hostname — the lead already carries the publisher Atlas asked, and a
 * hostname is a second answer to a question that is already answered. The
 * organisation is the part before the ` · ` qualifier, so a lead published as
 * `Wikipedia · Okanagan` is still Wikipedia.
 *
 * `undefined` when the move names no URL, or names one no lead claims. That
 * is not a defect to paper over with a guess: the caller falls back to the
 * generic wording rather than inventing a publisher.
 */
function publisherOfMove(report: Report): string | undefined {
  if (!report.nextMove.url) return undefined;
  const lead = report.leads.find((l) => l.url === report.nextMove.url);
  return lead?.publisher.split(" · ")[0];
}

function whatIWant(report: Report): Recommendation[] {
  const move = MOVE_ACTION[report.nextMove.kind];
  /**
   * **A constructed address is a guess, and the button has to say whose.**
   *
   * `Try it` names neither the subject nor the publisher, so a curator
   * reading only the button cannot tell what is about to be fetched — and
   * *it* reads as though Atlas already has a page in hand. The subject is
   * `report.name`, which is the entity currently under investigation rather
   * than the words originally typed, so after a confirmation the button
   * offers the resolved name and not the alias.
   *
   * Deliberately not a claim that the page exists: `Try` stays, `Read` is
   * still reserved for `read-corroborated`, where a publisher's own index
   * listed the page (ADR 040). Falls back to the table's wording when no
   * publisher can be named, because a button that invents one would be
   * asserting the very thing this move exists to doubt.
   */
  const publisher = publisherOfMove(report);
  const cta =
    report.nextMove.kind === "read-constructed" && publisher
      ? `Try “${report.name}” on ${publisher}`
      : move.cta;
  const out: Recommendation[] = [
    {
      id: move.id,
      label: report.nextMove.label,
      why: report.nextMove.why,
      cta,
    },
  ];

  // The alternatives, minus whatever is already the headline act.
  if (report.possibleMatches.length > 0 && move.id !== "compare") {
    out.push({
      id: "compare",
      label: "Check the entry I already hold",
      why: "Same name is a question, not an answer.",
      cta: "Compare them",
    });
  }

  if (!report.scope && report.scopeRefusal && move.id !== "scope") {
    out.push({
      id: "scope",
      label: "Give me an area to search",
      why: report.scopeRefusal.remedy,
      cta: "Show me how",
    });
  }

  if (report.leads.length === 0 && move.id !== "url") {
    out.push({
      id: "url",
      label: "Hand me a URL",
      why: "If you know a page that describes it, I'll read that instead of guessing.",
      cta: "Show me how",
    });
  }

  out.push({
    id: "ask",
    label: "Or teach me something else",
    why: "Every named thing you give me sharpens the next investigation.",
    cta: "New name",
  });

  return out;
}

/**
 * **The visual language, in six constants.**
 *
 * Surfaces are white, edges are hairlines, and **colour is an accent rather
 * than a wash**: green means Atlas can stand behind something, amber means an
 * open question, red means an actual problem, and everything else is
 * greyscale. Three colours is the whole palette — a fourth would have to earn
 * a meaning nobody has needed yet.
 *
 * The dark surfaces are deliberate bookends. The verdict at the top and the
 * log at the bottom are both *readouts*, and a readout that looks like the
 * workspace around it is a readout nobody's eye stops on.
 *
 * `INK` is darker than `--foreground` on purpose. Hierarchy built from weight
 * and size on near-black beats hierarchy built from fading text toward the
 * background — muted grey is how an interface whispers, and Atlas has no
 * reason to whisper.
 */
const INK = "text-[oklch(0.14_0.02_55)] dark:text-[oklch(0.97_0.008_85)]";
const BG_INK =
  "bg-[oklch(0.14_0.02_55)] dark:bg-[oklch(0.97_0.008_85)] dark:text-[oklch(0.14_0.02_55)]";
const BORDER_INK =
  "border-[oklch(0.14_0.02_55)] dark:border-[oklch(0.75_0.01_80)]";
const BORDER_L_INK =
  "border-l-[oklch(0.14_0.02_55)] dark:border-l-[oklch(0.75_0.01_80)]";
/** Metadata: mono, spaced, uppercase. Instrument labelling — never a heading. */
const MONO_META =
  "text-muted-foreground font-mono text-[11px] font-semibold uppercase tracking-[0.14em]";
/** A secondary action should be legible and quiet — never a second button. */
const GHOST =
  "text-muted-foreground hover:text-foreground font-semibold underline underline-offset-[3px] decoration-1 transition-colors";

const VERDICT_STYLE: Record<
  VerdictKind,
  { label: string; rail: string; dot: string; text: string }
> = {
  known: {
    label: "Known",
    rail: "bg-emerald-500",
    dot: "bg-emerald-400",
    text: "text-emerald-400",
  },
  close: {
    label: "Close",
    rail: "bg-amber-500",
    dot: "bg-amber-400",
    text: "text-amber-400",
  },
  looking: {
    label: "Open",
    rail: "bg-zinc-500",
    dot: "bg-zinc-400",
    text: "text-zinc-300",
  },
  stuck: {
    label: "Stuck",
    rail: "bg-rose-500",
    dot: "bg-rose-400",
    text: "text-rose-400",
  },
};

/** Descriptive only — the scope's own span, for a disclosure header. */
function approxSpan(scope: DiscoveryScope): string {
  const { north, south, east, west } = scope.bbox;
  const ns = Math.round((north - south) * 111);
  const ew = Math.round(
    (east - west) * 111 * Math.cos(((north + south) / 2) * (Math.PI / 180)),
  );
  return `${ew} × ${ns} km`;
}

export function RegionDiscovery({
  regionId,
  regionName,
}: {
  regionId: string;
  regionName: string;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState<Record<string, "queuing" | "done">>({});
  const [reads, setReads] = useState<Record<string, ReadState>>({});
  /** Which lead has its reasoning open. Prose is one click away, not in the way. */
  const [openWhy, setOpenWhy] = useState<Record<string, boolean>>({});
  const [showBackground, setShowBackground] = useState(false);
  /** Which disclosures are open. Everything starts closed — power, not shouting. */
  const [open, setOpen] = useState<Record<string, boolean>>({});
  /** The curator said the existing entity was the thing. Local, and writes nothing. */
  const [resolvedAs, setResolvedAs] = useState<Match | null>(null);
  const [dismissedMatches, setDismissedMatches] = useState(false);
  /**
   * Identity proposals the curator has turned down.
   *
   * Kept in component state and sent with every later request, because a
   * decline is an answer and an answer that evaporates on the next render is
   * a curator being asked the same question forever. It is deliberately not
   * persisted anywhere: declining a proposal is a decision about *this*
   * investigation, not a fact about the world.
   */
  const [declined, setDeclined] = useState<string[]>([]);
  const [deciding, setDeciding] = useState(false);

  const askRef = useRef<HTMLInputElement>(null);
  const sourcesRef = useRef<HTMLDivElement>(null);
  const matchesRef = useRef<HTMLDivElement>(null);
  const identityRef = useRef<HTMLDivElement>(null);
  const scopeRef = useRef<HTMLDivElement>(null);

  // **The investigation must survive navigation.** It is fully re-derivable
  // from (region, name) — `discover()` writes nothing and every durable
  // artefact a curator creates during one is already stored server-side — so
  // the URL holds the question and the tab holds the answer. That is why this
  // needed no Discovery Mission: an investigation's identity is its inputs.
  const urlSubject = useSyncExternalStore(
    noSubscribe,
    readUrlSubject,
    () => null,
  );
  const savedRaw = useSyncExternalStore(
    noSubscribe,
    () => readSaved(regionId, urlSubject),
    () => null,
  );
  const saved = parseSnapshot(savedRaw);
  const report = fresh ?? saved?.report ?? null;
  /** Set only when the answer came from the tab rather than from Atlas. */
  const restoredAt = fresh ? null : (saved?.at ?? null);

  /**
   * Ask Atlas.
   *
   * `subject` is **always what the curator typed**, including after they have
   * confirmed an identity — the server swaps in the resolved name and hands
   * back both, so the original words cannot be lost by a caller forgetting to
   * send them. `decision` is the curator's answer to a proposal, when they
   * have given one.
   */
  /**
   * **The investigation currently in flight, so it can be abandoned.**
   *
   * A ref rather than state: nothing renders from it, and putting it in state
   * would re-render the page every time a request starts.
   *
   * **What cancelling does and does not do.** It aborts the browser request and
   * frees the page immediately. It does *not* reach into the Atlas API and stop
   * work already in progress there — Atlas is a plain request/response service
   * with no cancellation channel, so an aborted investigation may still be
   * finishing server-side for a few seconds. Saying that plainly is better than
   * a button that implies more than it does.
   */
  const inFlight = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    inFlight.current?.abort(
      new DOMException("Investigation cancelled", "AbortError"),
    );
    inFlight.current = null;
    setBusy(false);
  }, []);

  const run = useCallback(
    async (
      subject: string,
      decision?: {
        confirmIdentity?: {
          resolvedName: string;
          proposalKey: string;
          hypothesis?: IdentityHypothesis;
        };
        declinedIdentities?: string[];
      },
    ) => {
      if (!subject.trim()) return;
      // Starting a new investigation abandons the previous one. Two reports
      // racing to `setFresh` would render whichever finished last, which is not
      // necessarily the one the curator asked for.
      inFlight.current?.abort(new DOMException("Superseded", "AbortError"));
      const controller = new AbortController();
      inFlight.current = controller;
      setBusy(true);
      setError(null);
      setFresh(null);
      setQueued({});
      setResolvedAs(null);
      setDismissedMatches(false);
      setOpen({});
      try {
        const res = await fetch("/api/admin/discovery/named", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: subject, regionId, ...decision }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Atlas could not investigate that.");
          return;
        }
        // A 200 is not a promise about shape. Atlas serves a compiled build
        // loaded at startup, so a running API can predate this component —
        // and a report from an older contract must not be rendered as though
        // it were an answer.
        if (!isReport(data)) {
          setError(
            "Atlas answered in a shape this page does not recognise. That usually means the running Atlas API " +
              "predates this build — it serves a compiled bundle loaded at startup, so restart it with `npm run api` " +
              "and investigate again.",
          );
          return;
        }
        setFresh(data);
        const url = new URL(window.location.href);
        url.searchParams.set("investigate", subject);
        window.history.replaceState(null, "", url.toString());
        try {
          sessionStorage.setItem(
            snapshotKeyFor(regionId, subject),
            JSON.stringify({ report: data, at: new Date().toISOString() }),
          );
        } catch {
          // A tab that refuses storage still works; it just re-asks Atlas.
        }
      } catch (err) {
        // A cancelled investigation is not an error a curator needs to read
        // about — they are the one who cancelled it.
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Could not reach Atlas.");
      } finally {
        // Only the investigation still holding the handle may clear the
        // spinner. A superseded one finishing late must not.
        if (inFlight.current === controller) {
          inFlight.current = null;
          setBusy(false);
        }
      }
    },
    [regionId],
  );

  // Leaving the page abandons whatever is running.
  useEffect(
    () => () =>
      inFlight.current?.abort(new DOMException("Left the page", "AbortError")),
    [],
  );

  async function investigate(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    // A new question is a new investigation, so previous refusals no longer
    // apply — they were about a proposal built from a different search.
    setDeclined([]);
    await run(name);
  }

  /**
   * **The curator answers the identity proposal.**
   *
   * Yes re-runs the investigation under the resolved name, carrying the
   * original search so Atlas can show both. No records the refusal and
   * re-runs unchanged — the same records come back, and the same proposal is
   * not offered again.
   */
  async function decide(proposal: IdentityProposal, accepted: boolean) {
    if (deciding || busy) return;
    setDeciding(true);
    const next = accepted ? declined : [...declined, proposal.key];
    if (!accepted) setDeclined(next);
    try {
      await run(proposal.searchedFor, {
        ...(accepted
          ? {
              confirmIdentity: {
                resolvedName: proposal.proposedName,
                proposalKey: proposal.key,
                // The hypothesis exactly as rendered above, so the next run
                // can ask each publisher about the name its kind calls for.
                // Atlas checks it against the confirmation and refuses if
                // they disagree.
                hypothesis: report?.hypothesis,
              },
            }
          : {}),
        ...(next.length > 0 ? { declinedIdentities: next } : {}),
      });
    } finally {
      setDeciding(false);
    }
  }

  async function queue(lead: Lead) {
    setQueued((q) => ({ ...q, [lead.url]: "queuing" }));
    try {
      const res = await fetch("/api/admin/candidate-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: lead.url,
          sourceType: lead.sourceType,
          reason: lead.reason,
          discoveryBasis: lead.basis,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Atlas refused to queue that source.");
        setQueued((q) => {
          const next = { ...q };
          delete next[lead.url];
          return next;
        });
        return;
      }
      setQueued((q) => ({ ...q, [lead.url]: "done" }));
      if (data?.candidate?.id)
        setReads((r) => ({ ...r, [lead.url]: { id: data.candidate.id } }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach Atlas.");
      setQueued((q) => {
        const next = { ...q };
        delete next[lead.url];
        return next;
      });
    }
  }

  async function readNow(lead: Lead, candidateSourceId: string) {
    setReads((r) => ({
      ...r,
      [lead.url]: { id: candidateSourceId, busy: true },
    }));
    try {
      const res = await fetch(
        `/api/admin/candidate-sources/${encodeURIComponent(candidateSourceId)}/read-targetless`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Atlas could not read that source.");
        setReads((r) => ({ ...r, [lead.url]: { id: candidateSourceId } }));
        return;
      }
      setReads((r) => ({
        ...r,
        [lead.url]: { id: candidateSourceId, result: data },
      }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach Atlas.");
      setReads((r) => ({ ...r, [lead.url]: { id: candidateSourceId } }));
    }
  }

  /**
   * **The write.** Everything before this was reversible; this creates an
   * entity, so it happens only because a person clicked it.
   *
   * The name is sent so Atlas can *refuse a mismatch* — it re-reads the
   * stored evidence in full and will not create a subject the curator did
   * not review.
   */
  async function learn(
    lead: Lead,
    id: string,
    confirmedName: string,
    acknowledgeDuplicate = false,
  ) {
    setReads((r) => ({
      ...r,
      [lead.url]: { ...r[lead.url]!, learning: true },
    }));
    try {
      const res = await fetch(
        `/api/admin/candidate-sources/${encodeURIComponent(id)}/learn`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmedName, acknowledgeDuplicate }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Atlas could not create that entity.");
        setReads((r) => ({
          ...r,
          [lead.url]: { ...r[lead.url]!, learning: false },
        }));
        return;
      }
      setReads((r) => ({
        ...r,
        [lead.url]: {
          ...r[lead.url]!,
          learning: false,
          learned: data as LearnResult,
        },
      }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach Atlas.");
      setReads((r) => ({
        ...r,
        [lead.url]: { ...r[lead.url]!, learning: false },
      }));
    }
  }

  /**
   * **Placing is a second statement.** Creating an entity says it exists;
   * this says it belongs here (ADR 025). Two acts, two clicks, on purpose.
   */
  async function place(lead: Lead, entityId: string, entityName: string) {
    setReads((r) => ({ ...r, [lead.url]: { ...r[lead.url]!, placing: true } }));
    try {
      const res = await fetch("/api/admin/relationships/contains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentId: regionId,
          childId: entityId,
          reason: `Curator placed ${entityName} in ${regionName} after learning it from a discovered source.`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Atlas could not place that entity.");
        setReads((r) => ({
          ...r,
          [lead.url]: { ...r[lead.url]!, placing: false },
        }));
        return;
      }
      setReads((r) => ({
        ...r,
        [lead.url]: { ...r[lead.url]!, placing: false, placed: true },
      }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach Atlas.");
      setReads((r) => ({
        ...r,
        [lead.url]: { ...r[lead.url]!, placing: false },
      }));
    }
  }

  const openSection = useCallback((key: string) => {
    setOpen((o) => ({ ...o, [key]: true }));
  }, []);

  const act = useCallback(
    (id: ActionId) => {
      if (id === "ask") {
        askRef.current?.focus();
        askRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (id === "compare") {
        matchesRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        return;
      }
      if (id === "identity") {
        // The panel is already the first thing on the page; this puts it back
        // in view when a curator has scrolled past it.
        identityRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        return;
      }
      if (id === "read" || id === "url") {
        openSection("sources");
        window.setTimeout(
          () =>
            sourcesRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            }),
          reduce ? 0 : 120,
        );
        return;
      }
      if (id === "scope") {
        openSection("looked");
        window.setTimeout(
          () =>
            scopeRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            }),
          reduce ? 0 : 120,
        );
      }
    },
    [openSection, reduce],
  );

  // **Ordering, and the line it does not cross.** `standing` is Atlas's own
  // reconciliation — a lead its other evidence contradicts. `nameMatch` is the
  // cruder string signal underneath. Both order presentation; **neither
  // decides identity**, and every lead remains on this page, one click away.
  const standingOf = (lead: Lead) => lead.standing ?? "primary";
  const allLeads = report?.leads ?? [];
  // Publishers with no strategy at all — the ones "What each publisher said"
  // has no row for, because Atlas never asked them and could not have.
  const declinedPublishers = (report?.consulted ?? []).filter(
    (c) => !c.participated,
  );
  const primaryLeads = allLeads.filter(
    (l) => standingOf(l) === "primary" && l.nameMatch !== "unrelated",
  );
  const backgroundLeads = allLeads.filter(
    (l) => standingOf(l) === "background" || l.nameMatch === "unrelated",
  );

  // Plain calls, not `useMemo`. Each is a pure read of a report already in
  // hand, and the React Compiler memoizes them for free — hand-written
  // memoization here only stopped it from optimizing the component at all.
  const verdict = report ? verdictOf(report) : null;
  const facts = report ? whatIKnow(report) : [];
  const gaps = report ? whatIMiss(report) : [];
  const wants = report ? whatIWant(report) : [];
  const meters = report ? metersOf(report) : [];

  const rise = reduce
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.35, ease: "easeOut" as const },
      };

  return (
    <section className="flex flex-col">
      {/* ================= THE SEARCH IS THE PAGE =======================
          Not a form above a report — the instrument you came here to use.
          It is the widest, heaviest, highest-contrast thing on the screen,
          because every session starts by typing one name into it. */}
      <div className="pb-4">
        <p className={cn(MONO_META, "text-[10.5px] tracking-[0.22em]")}>
          Atlas · {regionName}
        </p>
        <h2
          className={cn(
            "font-heading mt-2 text-[40px] leading-none font-black tracking-[-0.035em]",
            INK,
          )}
        >
          What should I learn?
        </h2>
        <p className="mt-1.5 max-w-3xl text-[14px] leading-snug">
          Name one thing. I&apos;ll find who would know about it, and tell you
          exactly what I can and can&apos;t establish.
        </p>

        <form
          onSubmit={investigate}
          className={cn(
            "bg-card mt-4 flex items-stretch overflow-hidden rounded-xl border-2 shadow-[0_8px_24px_-14px_rgba(0,0,0,0.35)]",
            BORDER_INK,
          )}
        >
          <Input
            ref={askRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="A lake, a business, a trail…"
            className="h-14 flex-1 rounded-none border-0 bg-transparent px-5 text-[19px] font-bold tracking-[-0.01em] shadow-none focus-visible:ring-0"
          />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className={cn(
              "inline-flex items-center gap-2.5 px-7 font-mono text-[13px] font-semibold tracking-[0.16em] text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40",
              BG_INK,
            )}
          >
            {busy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ASKING PUBLISHERS
              </>
            ) : (
              <>
                INVESTIGATE
                <span className="rounded border border-white/30 px-1.5 text-[10px] tracking-normal dark:border-black/30">
                  ⏎
                </span>
              </>
            )}
          </button>
        </form>

        <p className={cn(MONO_META, "mt-2 text-[10.5px] tracking-[0.04em]")}>
          one named thing · categories not yet supported
        </p>
      </div>

      {error && (
        <p className="mt-3 border-l-2 border-rose-600 bg-rose-500/[0.04] px-4 py-3 text-sm font-semibold">
          {error}
        </p>
      )}

      {busy && !report && <Thinking onCancel={cancel} />}

      {restoredAt && report && (
        <p
          className={cn(MONO_META, "mt-3 flex flex-wrap gap-x-2 text-[10.5px]")}
        >
          <span>
            cached · {report.name} · {new Date(restoredAt).toLocaleTimeString()}
          </span>
          <button
            onClick={() => void run(report.name)}
            className={cn("underline underline-offset-2", INK)}
          >
            ask again
          </button>
        </p>
      )}

      {/* The URL remembers the question even when the tab has forgotten the
          answer. Atlas does not silently re-spend a request to fill the gap.

          "Held an older answer" and "held nothing" are different facts, and a
          curator who is told the second when the first is true will wonder
          where their investigation went. */}
      {urlSubject && !report && !busy && (
        <p
          className={cn(MONO_META, "mt-3 flex flex-wrap gap-x-2 text-[10.5px]")}
        >
          <span>
            was investigating {urlSubject} ·{" "}
            {savedRaw
              ? "this tab held an answer from an older Atlas, so it was discarded"
              : "result not in this tab"}
          </span>
          <button
            onClick={() => void run(urlSubject)}
            className={cn("underline underline-offset-2", INK)}
          >
            investigate again
          </button>
        </p>
      )}

      {report && verdict && (
        <>
          {/* ================= THE QUESTION ============================
              Above the instrument, because it outranks it. Every reading
              below is a reading about a place whose name is still in
              question, and a curator who scrolls past this has been shown
              the answer before the question. */}
          {report.identity.outcome === "proposed" && (
            <IdentityProposalPanel
              panelRef={identityRef}
              proposal={report.identity.proposal}
              busy={deciding || busy}
              onDecide={decide}
              rise={rise}
            />
          )}

          {/* ================= WHAT EACH PUBLISHER SAID ================
              Directly under the question, because it is the evidence the
              question was built from. Plain words; the engine vocabulary is
              in the timeline further down. */}
          <PublisherAccounts
            accounts={report.publisherAccounts}
            phaseDetail={report.phaseDetail}
            rise={rise}
          />

          {/* The resolution, once they have made it. Both names, always —
              the local one is the knowledge that brought them here. */}
          {report.resolvedIdentity && (
            <motion.div
              {...rise}
              className="bg-card mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border border-l-4 border-l-emerald-600 px-5 py-3.5"
            >
              <span className={cn("text-[14px] font-extrabold", INK)}>
                Investigating {report.name}
              </span>
              <span className={cn(MONO_META, "text-[10px]")}>
                you searched {report.resolvedIdentity.searchedFor} · nothing
                renamed, nothing merged
              </span>
            </motion.div>
          )}

          {/* ================= THE INSTRUMENT ==========================
              A rich dark panel: state, subject, one sentence, and three
              measured meters. Dark because this is the readout, and a
              readout should look unlike the workspace around it — the same
              reason the log at the bottom is dark. */}
          <motion.div
            key={`${report.name}-verdict`}
            {...rise}
            className="relative mt-4 overflow-hidden rounded-xl bg-[#0b0b0d] px-6 py-5"
          >
            <span
              className={cn(
                "absolute inset-y-0 left-0 w-[3px]",
                VERDICT_STYLE[verdict.kind].rail,
              )}
            />
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] uppercase",
                  VERDICT_STYLE[verdict.kind].text,
                )}
              >
                <span
                  className={cn(
                    "h-[7px] w-[7px] rounded-full",
                    VERDICT_STYLE[verdict.kind].dot,
                  )}
                />
                {VERDICT_STYLE[verdict.kind].label}
              </span>
              <span className="ml-auto font-mono text-[10.5px] tracking-[0.12em] text-zinc-600 uppercase">
                {report.strategies.length} strategies ·{" "}
                {report.consulted.length} publishers ·{" "}
                {report.structuredRecords.length}{" "}
                {report.structuredRecords.length === 1 ? "feature" : "features"}
              </span>
            </div>

            <h3 className="font-heading mt-3 text-[42px] leading-none font-black tracking-[-0.035em] text-white">
              {report.name}
            </h3>
            <p className="mt-2.5 text-[16px] font-bold tracking-[-0.01em] text-zinc-100">
              {verdict.headline}
            </p>
            <p className="mt-1 max-w-5xl text-[13.5px] leading-normal text-zinc-400">
              {verdict.line}
            </p>

            <div className="mt-4 grid gap-6 border-t border-zinc-800 pt-3.5 sm:grid-cols-3">
              {meters.map((m) => (
                <MeterBar key={m.label} meter={m} reduce={reduce} />
              ))}
            </div>
          </motion.div>

          {/* ================= NEXT MOVE ===============================
              The whole page exists to produce this. One heading, one
              sentence, one solid button — and the alternatives underneath
              as text, so there is never a second thing competing for the
              same click. */}
          {wants.length > 0 && (
            <motion.div
              {...rise}
              className={cn(
                "bg-card mt-3 flex flex-wrap items-center gap-x-6 gap-y-4 rounded-xl border border-l-4 px-5 py-4",
                "border-border",
                BORDER_L_INK,
              )}
            >
              <div className="min-w-0 flex-1">
                <p className={cn(MONO_META, "text-[10px] tracking-[0.2em]")}>
                  Next move
                </p>
                <p
                  className={cn(
                    "mt-1 text-[19px] leading-tight font-extrabold tracking-[-0.02em]",
                    INK,
                  )}
                >
                  {wants[0]!.label}
                </p>
                <p className="mt-0.5 text-[13px] leading-snug">
                  {wants[0]!.why}
                </p>
                {wants.length > 1 && (
                  <div className="mt-2 flex flex-wrap gap-x-4">
                    {wants.slice(1).map((w) => (
                      <button
                        key={w.id}
                        onClick={() => act(w.id)}
                        className={cn(GHOST, "text-[12.5px]")}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => act(wants[0]!.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2.5 rounded-lg px-5 py-3.5 text-[14px] font-extrabold tracking-[-0.01em] text-white transition-transform active:scale-[0.98]",
                  BG_INK,
                )}
              >
                {wants[0]!.cta ?? "Go"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}

          {/* ---- THE EXISTING ENTITY, WHEN THERE IS ONE ---------------- */}
          {report.possibleMatches.length > 0 && !dismissedMatches && (
            <motion.div
              ref={matchesRef}
              {...rise}
              className={cn(
                "bg-card mt-3 overflow-hidden rounded-xl border border-l-4",
                "border-border",
                resolvedAs ? "border-l-emerald-600" : "border-l-amber-500",
              )}
            >
              <div className="border-border flex flex-wrap items-baseline gap-x-2.5 border-b px-5 py-3">
                <span className={cn("text-[14px] font-extrabold", INK)}>
                  {resolvedAs
                    ? `You told me this is ${resolvedAs.name}`
                    : `I may already hold ${report.name}`}
                </span>
                <span className={cn(MONO_META, "text-[10px]")}>
                  {resolvedAs
                    ? "nothing written"
                    : "same name — settle it first"}
                </span>
              </div>
              {!resolvedAs && (
                <ul className="divide-border divide-y">
                  {report.possibleMatches.map((m) => (
                    <li
                      key={m.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-2.5"
                    >
                      <span className={cn("text-[13px] font-bold", INK)}>
                        {m.name}
                      </span>
                      <span className={cn(MONO_META, "text-[10.5px]")}>
                        {m.kind}
                      </span>
                      <span className="flex-1" />
                      <Link
                        href={`/admin/entities/${m.id}?from=discovery`}
                        className={cn(GHOST, "text-[12px]")}
                      >
                        Open and compare
                      </Link>
                      <button
                        onClick={() => setResolvedAs(m)}
                        className={cn(
                          "rounded-md px-3 py-1.5 text-[12px] font-bold text-white",
                          BG_INK,
                        )}
                      >
                        This is what I meant
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-border bg-muted/30 border-t px-5 py-2">
                <button
                  onClick={() => {
                    setResolvedAs(null);
                    setDismissedMatches(true);
                  }}
                  className={cn(GHOST, "text-[11.5px]")}
                >
                  {resolvedAs
                    ? "Actually, keep investigating"
                    : "Not this — keep investigating"}
                </button>
              </div>
            </motion.div>
          )}

          {/* ================= ESTABLISHED · BLOCKING =================== */}
          <div className="mt-3 grid items-start gap-3 lg:grid-cols-2">
            <EvidenceList
              title="Established"
              tone="known"
              facts={facts}
              empty="Nothing I can stand behind yet."
              delay={0}
              reduce={reduce}
            />
            <EvidenceList
              title="In my way"
              tone="missing"
              facts={gaps}
              empty="Nothing in my way."
              delay={1}
              reduce={reduce}
            />
          </div>

          {/* ================= EVERYTHING ELSE, FOLDED ==================
              One strip, four rows, all closed. The page ends here unless
              somebody asks it not to. */}
          <div className="border-border bg-card divide-border mt-3 divide-y overflow-hidden rounded-xl border">
            {report.structuredRecords.length > 0 && (
              <Disclosure
                id="found"
                open={open.found ?? false}
                onToggle={() =>
                  setOpen((o) => ({ ...o, found: !(o.found ?? false) }))
                }
                icon={<MapPin className="h-3.5 w-3.5" />}
                title="Features found"
                count={report.structuredRecords.length}
                reduce={reduce}
              >
                <LocatedRecords
                  candidates={report.structuredRecords}
                  subject={report.name}
                />
              </Disclosure>
            )}

            <div ref={sourcesRef}>
              <Disclosure
                id="sources"
                open={open.sources ?? false}
                onToggle={() =>
                  setOpen((o) => ({ ...o, sources: !(o.sources ?? false) }))
                }
                icon={<Landmark className="h-3.5 w-3.5" />}
                title="Sources"
                count={allLeads.length}
                meta={
                  allLeads.length === 0
                    ? undefined
                    : `${primaryLeads.length} open${backgroundLeads.length > 0 ? ` · ${backgroundLeads.length} contradicted` : ""}`
                }
                reduce={reduce}
              >
                {allLeads.length === 0 ? (
                  <p className="px-5 py-5 text-[13px] leading-snug">
                    I couldn&apos;t construct a single source. That&apos;s about
                    what is published in a form I can reach — not evidence that{" "}
                    {report.name} doesn&apos;t exist. Give me a URL and
                    I&apos;ll read it.
                  </p>
                ) : (
                  <div>
                    {primaryLeads.map((lead, i) => (
                      <LeadRow
                        key={lead.url}
                        lead={lead}
                        report={report}
                        regionName={regionName}
                        featured={i === 0}
                        queued={queued}
                        reads={reads}
                        whyOpen={openWhy[lead.url] ?? false}
                        onToggleWhy={() =>
                          setOpenWhy((w) => ({
                            ...w,
                            [lead.url]: !(w[lead.url] ?? false),
                          }))
                        }
                        onQueue={() => void queue(lead)}
                        onRead={(id) => void readNow(lead, id)}
                        onLearn={(id, n, ack) => void learn(lead, id, n, ack)}
                        onPlace={(eid, en) => void place(lead, eid, en)}
                      />
                    ))}

                    {backgroundLeads.length > 0 && (
                      <div>
                        <button
                          onClick={() => setShowBackground((v) => !v)}
                          className="bg-muted/40 border-border hover:bg-muted/70 flex w-full items-center gap-2 border-y px-5 py-2 text-left transition-colors"
                        >
                          <ChevronDown
                            className={cn(
                              "h-3 w-3 transition-transform",
                              showBackground ? "" : "-rotate-90",
                            )}
                          />
                          <span className={cn(MONO_META, "text-[10px]")}>
                            contradicted by my own evidence
                          </span>
                          <span
                            className={cn(
                              MONO_META,
                              "bg-muted rounded px-1.5 text-[10px]",
                            )}
                          >
                            {backgroundLeads.length}
                          </span>
                        </button>
                        <AnimatePresence initial={false}>
                          {showBackground && (
                            <motion.div
                              initial={
                                reduce ? undefined : { height: 0, opacity: 0 }
                              }
                              animate={
                                reduce
                                  ? undefined
                                  : { height: "auto", opacity: 1 }
                              }
                              exit={
                                reduce ? undefined : { height: 0, opacity: 0 }
                              }
                              transition={{ duration: 0.24, ease: "easeInOut" }}
                              className="overflow-hidden"
                            >
                              {backgroundLeads.map((lead) => (
                                <LeadRow
                                  key={lead.url}
                                  lead={lead}
                                  report={report}
                                  regionName={regionName}
                                  dimmed
                                  queued={queued}
                                  reads={reads}
                                  whyOpen={openWhy[lead.url] ?? false}
                                  onToggleWhy={() =>
                                    setOpenWhy((w) => ({
                                      ...w,
                                      [lead.url]: !(w[lead.url] ?? false),
                                    }))
                                  }
                                  onQueue={() => void queue(lead)}
                                  onRead={(id) => void readNow(lead, id)}
                                  onLearn={(id, n, ack) =>
                                    void learn(lead, id, n, ack)
                                  }
                                  onPlace={(eid, en) =>
                                    void place(lead, eid, en)
                                  }
                                />
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    <p
                      className={cn(
                        MONO_META,
                        "border-border border-t px-5 py-2.5 text-[10px]",
                      )}
                    >
                      queuing writes nothing · I read, verify, then you decide
                    </p>
                  </div>
                )}
              </Disclosure>
            </div>

            {/* **Only what the panel at the top cannot say.**
                "What each publisher said" already reports every publisher Atlas
                actually asked, in plain words. Repeating them here as
                "reached / declined" was the same list twice in two vocabularies
                — so this now carries the one thing that panel has no row for:
                publishers Atlas has **no way to ask at all**, and why. */}
            {declinedPublishers.length > 0 && (
              <Disclosure
                id="publishers"
                open={open.publishers ?? false}
                onToggle={() =>
                  setOpen((o) => ({
                    ...o,
                    publishers: !(o.publishers ?? false),
                  }))
                }
                icon={<Radio className="h-3.5 w-3.5" />}
                title="Publishers Atlas cannot ask"
                count={declinedPublishers.length}
                meta="no way to reach them — the reason is on each"
                reduce={reduce}
              >
                <ul className="divide-border divide-y">
                  {declinedPublishers.map((c) => (
                    <li key={c.publisher} className="px-5 py-3">
                      <p className="flex flex-wrap items-baseline gap-x-2.5">
                        <span
                          className={cn(
                            "font-mono text-[10px] font-semibold tracking-[0.14em] uppercase",
                            c.participated
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-muted-foreground",
                          )}
                        >
                          {c.participated ? "reached" : "declined"}
                        </span>
                        <span className={cn("text-[13.5px] font-bold", INK)}>
                          {c.publisher}
                        </span>
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-[12px] leading-snug">
                        {c.note}
                      </p>
                    </li>
                  ))}
                </ul>
              </Disclosure>
            )}

            <div ref={scopeRef}>
              <Disclosure
                id="looked"
                open={open.looked ?? false}
                onToggle={() =>
                  setOpen((o) => ({ ...o, looked: !(o.looked ?? false) }))
                }
                icon={<Compass className="h-3.5 w-3.5" />}
                title="Search area"
                meta={report.scope ? approxSpan(report.scope) : "none"}
                reduce={reduce}
              >
                <ScopePanel
                  scope={report.scope}
                  refusal={report.scopeRefusal}
                  regionName={regionName}
                />
              </Disclosure>
            </div>
          </div>

          <EngineeringLog
            report={report}
            open={open.log ?? false}
            onToggle={() => setOpen((o) => ({ ...o, log: !(o.log ?? false) }))}
            reduce={reduce}
          />
        </>
      )}
    </section>
  );
}

/**
 * **A measured bar, never a staged one.**
 *
 * Segments rather than a continuous fill: the denominator is small and real
 * (four identity signals, four publishers, six proposed sources), so showing
 * the units is more honest than showing a percentage — and a curator can
 * count what is still dark.
 */
/**
 * **I think I found your place.**
 *
 * The one panel in Discovery that asks a question with two real answers, so
 * it is the one panel allowed two buttons. Everything else on this page
 * follows the rule that a second button competes for the same click; here the
 * competition *is* the point, and the quieter of the two is still a genuine
 * answer rather than a way out.
 *
 * What it must never do is look decided. There is no green tick on the
 * headline, the proposed name is stated as *what the publishers publish*
 * rather than as what this is, and each publisher's own words are shown
 * beside its own field name so a curator can disagree with the evidence
 * rather than with Atlas.
 */
function IdentityProposalPanel({
  panelRef,
  proposal,
  busy,
  onDecide,
  rise,
}: {
  panelRef: React.RefObject<HTMLDivElement | null>;
  proposal: IdentityProposal;
  busy: boolean;
  onDecide: (proposal: IdentityProposal, accepted: boolean) => void;
  rise: Record<string, unknown>;
}) {
  return (
    <motion.div
      ref={panelRef}
      key={proposal.key}
      {...rise}
      className="relative mt-4 overflow-hidden rounded-xl bg-[#0b0b0d] px-6 py-5"
    >
      <span className="absolute inset-y-0 left-0 w-[3px] bg-amber-500" />

      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] text-amber-400 uppercase">
          <span className="h-[7px] w-[7px] rounded-full bg-amber-400" />I think
          I found your place
        </span>
        <span className="ml-auto font-mono text-[10.5px] tracking-[0.12em] text-zinc-600 uppercase">
          {proposal.evidence.length} independent publishers · nothing written
        </span>
      </div>

      <p className="mt-3 font-mono text-[10.5px] tracking-[0.14em] text-zinc-500 uppercase">
        You searched for
      </p>
      <p className="text-[17px] font-bold tracking-[-0.01em] text-zinc-100">
        {proposal.searchedFor}
      </p>

      <p className="mt-3 font-mono text-[10.5px] tracking-[0.14em] text-zinc-500 uppercase">
        Published as
      </p>
      <h3 className="font-heading text-[38px] leading-none font-black tracking-[-0.035em] text-white">
        {proposal.proposedName}
      </h3>

      {/* Each publisher, in its own words, under its own field names. The
          curator is being asked to judge evidence, so the evidence is what
          is on screen — not Atlas's summary of it. */}
      <div className="mt-5 grid gap-px overflow-hidden rounded-lg bg-zinc-800 sm:grid-cols-3">
        {proposal.evidence.map((source) => (
          <div key={source.externalId} className="bg-[#0b0b0d] px-4 py-3.5">
            <p className="flex items-center gap-2 text-[13px] font-extrabold text-zinc-100">
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              {source.publisher}
            </p>
            {source.publishedNames.map((published) => (
              <div key={published.field} className="mt-2">
                <p className="font-mono text-[10px] tracking-[0.12em] text-zinc-600 uppercase">
                  {published.role === "primary"
                    ? "Primary name"
                    : "Alternate name"}
                </p>
                <p
                  className={cn(
                    "text-[13.5px] leading-snug",
                    published.field === source.matchedQuery?.field
                      ? "font-bold text-amber-300"
                      : "text-zinc-300",
                  )}
                >
                  {published.name}
                </p>
              </div>
            ))}
            <p className="mt-2 font-mono text-[10px] break-all text-zinc-700">
              {source.externalId}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-4 max-w-4xl text-[13.5px] leading-normal text-zinc-400">
        {proposal.whyAsking}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-zinc-800 pt-4">
        <button
          disabled={busy}
          onClick={() => onDecide(proposal, true)}
          className="inline-flex shrink-0 items-center gap-2.5 rounded-lg bg-white px-5 py-3 text-[14px] font-extrabold tracking-[-0.01em] text-[#0b0b0d] transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Yes, this is my {proposal.searchedFor}
        </button>
        <button
          disabled={busy}
          onClick={() => onDecide(proposal, false)}
          className="font-semibold text-zinc-400 underline decoration-1 underline-offset-[3px] transition-colors hover:text-zinc-100 disabled:opacity-50"
        >
          Continue investigating
        </button>
        <span className="ml-auto font-mono text-[10px] tracking-[0.1em] text-zinc-700 uppercase">
          {proposal.signals.join(" · ")}
        </span>
      </div>
    </motion.div>
  );
}

function MeterBar({ meter, reduce }: { meter: Meter; reduce: boolean | null }) {
  return (
    <div>
      <p className="flex items-baseline justify-between font-mono text-[10px] tracking-[0.16em] text-zinc-600 uppercase">
        <span>{meter.label}</span>
        <span className="text-zinc-200">
          {meter.have} / {meter.of}
        </span>
      </p>
      <div className="mt-1.5 flex gap-[3px]">
        {Array.from({ length: Math.max(meter.of, 1) }, (_, i) => (
          <motion.span
            key={i}
            initial={reduce ? undefined : { opacity: 0, scaleX: 0.3 }}
            animate={reduce ? undefined : { opacity: 1, scaleX: 1 }}
            transition={{
              duration: 0.3,
              delay: 0.15 + i * 0.05,
              ease: "easeOut",
            }}
            className={cn(
              "h-[5px] flex-1 origin-left rounded-[1px]",
              i < meter.have
                ? meter.tone === "good"
                  ? "bg-emerald-500"
                  : "bg-amber-500"
                : "bg-zinc-800",
            )}
          />
        ))}
      </div>
      <p className="mt-1.5 truncate text-[11px] text-zinc-500">{meter.note}</p>
    </div>
  );
}

/**
 * **Movement that is earned.**
 *
 * Three dots while a real request is in flight. Nothing here pretends to
 * think in stages — the design system's rule is that motion marks a state
 * change, and the only state is *waiting*.
 */
function Thinking({ onCancel }: { onCancel?: () => void }) {
  return (
    <div className="border-border flex items-center gap-3 rounded-md border border-dashed px-5 py-4">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="bg-foreground/60 h-1.5 w-1.5 rounded-full"
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.16 }}
          />
        ))}
      </span>
      <div className="flex-1">
        <p className={cn(MONO_META, "text-[10px]")}>
          Asking everyone I know how to ask
        </p>
        {/* **A curator waiting 30 seconds at a spinner deserves to know that is
            normal.** Measured live: a converging Okanagan lake takes 5–35 s,
            because four publishers are asked in sequence and two of them are
            provincial services. Silence here read as "stuck". */}
        <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
          Four publishers, one after another — this usually takes 5–35 seconds.
        </p>
      </div>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground shrink-0 rounded-md border px-2.5 py-1 text-[11px] font-semibold underline-offset-2 hover:underline"
        >
          Cancel
        </button>
      )}
    </div>
  );
}

/**
 * **Two lists that answer two questions, and nothing else.**
 *
 * *Established* is what Atlas can stand behind, each line carrying the
 * evidence that earned it on the right — a column of values scannable
 * without reading a single label. *Blocking* is what stands between here and
 * an entry, each line carrying why underneath.
 *
 * Amber, not red. A gap is an open question, and colouring it like a failure
 * would tell a curator something broke when in fact Atlas is simply not
 * finished — which is the normal state of an investigation, not an error.
 */
function EvidenceList({
  title,
  tone,
  facts,
  empty,
  delay,
  reduce,
}: {
  title: string;
  tone: "known" | "missing";
  facts: Fact[];
  empty: string;
  delay: number;
  reduce: boolean | null;
}) {
  const known = tone === "known";
  return (
    <motion.div
      {...(reduce
        ? {}
        : {
            initial: { opacity: 0, y: 8 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.3, delay: delay * 0.05, ease: "easeOut" },
          })}
      className="bg-card border-border overflow-hidden rounded-xl border"
    >
      <div className="border-border flex items-center gap-2 border-b px-4 py-2.5">
        <span
          className={cn(
            "font-mono text-[10.5px] font-semibold tracking-[0.18em] uppercase",
            known
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-amber-700 dark:text-amber-400",
          )}
        >
          {title}
        </span>
        <span className="text-muted-foreground ml-auto font-mono text-[11px]">
          {facts.length}
        </span>
      </div>

      {facts.length === 0 ? (
        <p className="px-4 py-3 text-[13px]">{empty}</p>
      ) : (
        <ul className="divide-border/60 divide-y">
          {facts.map((f) => (
            <li key={f.label} className="flex items-baseline gap-2.5 px-4 py-2">
              <span
                className={cn(
                  "shrink-0 font-mono text-[11px] font-semibold",
                  known
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-amber-700 dark:text-amber-400",
                )}
              >
                {known ? "\u2713" : "\u25b2"}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-[13.5px] leading-snug font-bold tracking-[-0.005em]",
                    INK,
                  )}
                >
                  {f.label}
                </span>
                {f.detail && !known && (
                  <span className="text-muted-foreground mt-0.5 block text-[11.5px] leading-snug">
                    {f.detail}
                  </span>
                )}
              </span>
              {f.detail && known && (
                <span className="text-muted-foreground shrink-0 truncate pl-3 font-mono text-[11.5px]">
                  {f.detail}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}

/**
 * **One row in the strip, closed until asked.**
 *
 * No border of its own — the strip owns the frame, so four supporting
 * sections read as one quiet block rather than four competing cards. The row
 * carries a count and a one-phrase summary, which is what lets a curator
 * decide whether to open it *without* opening it.
 */
function Disclosure({
  id,
  open,
  onToggle,
  icon,
  title,
  count,
  meta,
  reduce,
  children,
}: {
  id: string;
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  title: string;
  count?: number;
  meta?: string;
  reduce: boolean | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        className="hover:bg-muted/50 flex w-full items-center gap-2.5 px-5 py-2.5 text-left transition-colors"
      >
        <span className="text-muted-foreground">{icon}</span>
        <span className={cn("text-[13.5px] font-bold", INK)}>{title}</span>
        {typeof count === "number" && (
          <span className="text-muted-foreground bg-muted rounded px-1.5 font-mono text-[11px]">
            {count}
          </span>
        )}
        {meta && (
          <span className="text-muted-foreground ml-auto font-mono text-[10.5px] tracking-[0.12em] uppercase">
            {meta}
          </span>
        )}
        <ChevronDown
          className={cn(
            "text-muted-foreground h-3.5 w-3.5 transition-transform duration-200",
            meta ? "ml-3" : "ml-auto",
            open ? "" : "-rotate-90",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`${id}-panel`}
            initial={reduce ? undefined : { height: 0, opacity: 0 }}
            animate={reduce ? undefined : { height: "auto", opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: "easeInOut" }}
            className="border-border overflow-hidden border-t"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * **The log — structured output, not prose.**
 *
 * Terminal aesthetics all the way down: a `$` prompt, aligned columns, status
 * tokens, `key=value` pairs, and the request highlighted like the code it is.
 * Sentences that belong to a curator live upstairs; what is left here is what
 * an engineer would grep.
 *
 * Nothing above it was built by deleting anything from here — every strategy,
 * status, note, receipt, scope and raw field is present verbatim.
 */
function EngineeringLog({
  report,
  open,
  onToggle,
  reduce,
}: {
  report: Report;
  open: boolean;
  onToggle: () => void;
  reduce: boolean | null;
}) {
  const token = (status: StrategyStatus) =>
    status === "succeeded"
      ? "text-emerald-400"
      : status === "multiple-candidates"
        ? "text-amber-400"
        : status === "failed"
          ? "text-rose-400"
          : "text-zinc-600";

  return (
    <div className="mt-3 overflow-hidden rounded-xl bg-[#0b0b0d]">
      <button
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="log-panel"
        className="flex w-full items-center gap-2.5 px-5 py-2.5 text-left font-mono transition-colors hover:bg-[#141417]"
      >
        <span className="text-[13px] font-semibold text-zinc-600">$</span>
        <span className="text-[13px] font-semibold text-zinc-200">log</span>
        <span className="rounded bg-[#1e1e22] px-1.5 font-mono text-[11px] text-zinc-500">
          {report.strategies.length} strategies
        </span>
        <span className="flex-1" />
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-zinc-600 transition-transform duration-200",
            open ? "" : "-rotate-90",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="log-panel"
            initial={reduce ? undefined : { height: 0, opacity: 0 }}
            animate={reduce ? undefined : { height: "auto", opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: "easeInOut" }}
            className="overflow-hidden border-t border-[#1e1e22]"
          >
            <div className="space-y-4 px-5 py-4 font-mono text-[12px] leading-[1.7] text-zinc-400">
              <section>
                <p className={LOG_H}>ladder</p>
                {report.strategies.map((s) => (
                  <div key={s.number} className="mt-1.5">
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span className="w-9 shrink-0 text-right text-zinc-700">
                        {s.number}
                      </span>
                      <span
                        className={cn(
                          "w-[168px] shrink-0 truncate",
                          token(s.status),
                        )}
                      >
                        {s.status}
                      </span>
                      <span className="text-zinc-200">{s.name}</span>
                      {/* Three publishers were asked what is inside a box and
                          one was asked what it has anywhere in the world. A
                          log that showed both as plain successes would be
                          describing a search Atlas never performed. */}
                      {s.bounding && (
                        <span
                          className={
                            s.bounding === "bounded-by-scope"
                              ? "text-emerald-500/70"
                              : "text-amber-500/70"
                          }
                        >
                          {s.bounding === "bounded-by-scope"
                            ? "bounded by scope"
                            : "unbounded"}
                        </span>
                      )}
                      {s.askedAbout && (
                        <span className="text-cyan-500/70">
                          asked “{s.askedAbout}”
                        </span>
                      )}
                    </p>
                    <p className="pl-[52px] text-zinc-500">{s.detail}</p>
                  </div>
                ))}
              </section>

              <section>
                <p className={LOG_H}>publishers</p>
                {report.consulted.map((c) => (
                  <div key={c.publisher} className="mt-1.5">
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span
                        className={cn(
                          "w-[104px] shrink-0",
                          c.participated ? "text-emerald-400" : "text-zinc-600",
                        )}
                      >
                        {c.participated ? "reached" : "declined"}
                      </span>
                      <span className="text-zinc-200">{c.publisher}</span>
                    </p>
                    <p className="pl-[112px] text-zinc-500">{c.note}</p>
                  </div>
                ))}
              </section>

              <section>
                <p className={LOG_H}>state</p>
                <div className="mt-1.5 space-y-0.5">
                  <LogPair k="outcome" v={report.outcome} accent />
                  <LogPair k="leads" v={String(report.leads.length)} />
                  <LogPair
                    k="structured_records"
                    v={String(report.structuredRecords.length)}
                  />
                  <LogPair
                    k="possible_matches"
                    v={String(report.possibleMatches.length)}
                  />
                  {report.scope && (
                    <>
                      <LogPair
                        k="scope_bbox"
                        v={`${report.scope.bbox.south},${report.scope.bbox.west},${report.scope.bbox.north},${report.scope.bbox.east}`}
                      />
                      <LogPair k="scope_source" v={report.scope.source} />
                    </>
                  )}
                  {!report.scope && report.scopeRefusal && (
                    <LogPair k="scope" v="refused" accent />
                  )}
                </div>
              </section>

              {report.osmQuery && (
                <section>
                  <p className={LOG_H}>overpass</p>
                  <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap text-sky-300">
                    {report.osmQuery}
                  </pre>
                </section>
              )}

              <section>
                <p className={LOG_H}>summary</p>
                <p className="mt-1.5 text-zinc-400">{report.summary}</p>
              </section>

              <details>
                <summary className="cursor-pointer text-zinc-600 hover:text-zinc-300">
                  raw_report.json
                </summary>
                <pre className="mt-2 max-h-96 overflow-auto text-[11px] whitespace-pre-wrap text-zinc-500">
                  {JSON.stringify(report, null, 2)}
                </pre>
              </details>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** `key = value`, aligned. The shape an engineer scans without reading. */
function LogPair({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      <span className="w-[152px] shrink-0 text-zinc-600">{k}</span>
      <span className={accent ? "text-amber-400" : "text-zinc-300"}>{v}</span>
    </p>
  );
}

/** Section heading inside the log. Dim, spaced, unmistakably a machine label. */
const LOG_H =
  "text-[10px] font-semibold tracking-[0.2em] text-zinc-700 uppercase";

/**
 * **The area Atlas was allowed to search.**
 *
 * ADR 032. A Discovery Scope proves nothing; it only says where Atlas looked.
 * When there is none, the refusal and its remedy are shown rather than an
 * empty search — Atlas has no fallback radius and the interface must not
 * imply one exists.
 */
function ScopePanel({
  scope,
  refusal,
  regionName,
}: {
  scope?: DiscoveryScope;
  refusal?: { reason: string; remedy: string };
  regionName: string;
}) {
  if (!scope) {
    if (!refusal) return null;
    return (
      <div className="px-5 py-4">
        <p className={cn("text-[13px] font-bold", INK)}>
          I have no area to search in {regionName}
        </p>
        <p className="mt-1 text-[12.5px] leading-snug">
          {refusal.reason} Location-based sources are searched by area, and I
          won&apos;t pick a radius to fill the gap.
        </p>
        <p className={cn("mt-2 text-[12.5px] leading-snug font-semibold", INK)}>
          {refusal.remedy}
        </p>
      </div>
    );
  }

  const { south, west, north, east } = scope.bbox;
  return (
    <div className="px-5 py-4">
      <p className={cn("text-[13px] font-bold", INK)}>{scope.label}</p>
      <p className="text-muted-foreground mt-1.5 font-mono text-[11.5px]">
        {south}, {west} → {north}, {east}
        <span className={cn(MONO_META, "ml-2 text-[10px]")}>
          {scope.source}
        </span>
      </p>
      {scope.derivedFrom && scope.derivedFrom.length > 0 && (
        <details className="mt-2">
          <summary className={cn(GHOST, "cursor-pointer text-[11.5px]")}>
            The {scope.derivedFrom.length} entities that define this area
          </summary>
          <p className="text-muted-foreground mt-1.5 text-[11.5px] leading-snug">
            {scope.derivedFrom.map((d) => d.name).join(" · ")}
          </p>
        </details>
      )}
    </div>
  );
}

/**
 * **Candidates, deliberately not a shortlist.**
 *
 * Every feature OpenStreetMap returned inside the scope, in the order OSM
 * returned them. Nothing is ranked and nothing is marked "best": the nearest
 * one is nearest to the entities a curator already placed, which would be
 * Atlas's own bias presented as relevance.
 */
function LocatedRecords({
  candidates,
  subject,
}: {
  candidates: LocatedRecord[];
  subject: string;
}) {
  return (
    <div>
      {candidates.map((c) => (
        <div
          key={c.externalId}
          className="border-border border-b px-5 py-4 last:border-b-0"
        >
          <p className="flex flex-wrap items-baseline gap-x-2.5">
            <span
              className={cn(
                "text-[15px] font-extrabold tracking-[-0.01em]",
                INK,
              )}
            >
              {c.name}
            </span>
            <span className="text-muted-foreground font-mono text-[11px]">
              {c.externalId}
            </span>
            <span className={cn(MONO_META, "text-[9.5px]")}>
              {publisherOf(c)}
            </span>
            {c.coordinates && (
              <span className="text-muted-foreground ml-auto font-mono text-[11px]">
                {c.coordinates[1]}, {c.coordinates[0]}
              </span>
            )}
          </p>

          {/* The alternate-name finding, in Atlas's voice. The canonical name
              above is never rewritten to the query. */}
          {c.matchedField === "alt_name" && (
            <p className="mt-2 border-l-2 border-emerald-600 pl-3 text-[12.5px] leading-snug">
              Matched “{subject}” because OpenStreetMap records that as an{" "}
              <span className="font-mono text-[11.5px]">alt_name</span> for it.
            </p>
          )}

          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {c.identity.signals.map((sig) => (
              <span
                key={sig}
                className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400"
              >
                ✓ {sig}
              </span>
            ))}
          </p>

          <div className="mt-2 flex flex-wrap items-baseline gap-x-4">
            {/* Each publisher's own field bag, under whichever key it uses.
                Shown verbatim — the evidence, not a selection from it. */}
            {(() => {
              const published = c.tags ?? c.attributes ?? {};
              const keys = Object.keys(published);
              if (keys.length === 0) return null;
              return (
                <details>
                  <summary
                    className={cn(GHOST, "cursor-pointer text-[11.5px]")}
                  >
                    {keys.length} fields
                  </summary>
                  <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                    {Object.entries(published).map(([k, v]) => (
                      <Fragment key={k}>
                        <dt className="text-muted-foreground font-mono text-[11px]">
                          {k}
                        </dt>
                        <dd className="font-mono text-[11px]">{v}</dd>
                      </Fragment>
                    ))}
                  </dl>
                </details>
              );
            })()}
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(GHOST, "text-[11.5px]")}
            >
              View the published record
            </a>
          </div>
        </div>
      ))}

      {/* Why there is no button here. Queueing an OSM element page would create
          work nothing can currently do — the existing OSM loader reads the
          Overpass API, not openstreetmap.org's rendered page. That failure
          already happened once, with sources that sat in the queue forever. */}
      <p
        className={cn(
          MONO_META,
          "border-border border-t px-5 py-2.5 text-[10px]",
        )}
      >
        Not queueable · reading an OSM feature is a different operation from
        reading a page
      </p>
    </div>
  );
}

/**
 * **One source — and the top one does not look like the others.**
 *
 * The old list gave ten leads identical cards, so scanning it meant reading
 * all of them. Here the first readable source is *featured*: a badge, a real
 * heading, the reason, and a solid primary button. Everything after it is a
 * single dense line with a quiet ghost action, and anything this run's own
 * evidence contradicted is dimmed further and folded away.
 *
 * **Demotion is visual only.** Every lead keeps its URL, its truth gate and
 * its full action set — the moment one is queued or read, the row opens into
 * the same panel the featured one gets, because the decision a curator makes
 * there is identical whatever the row looked like at rest.
 */
function LeadRow({
  lead,
  report,
  regionName,
  featured,
  dimmed,
  queued,
  reads,
  whyOpen,
  onToggleWhy,
  onQueue,
  onRead,
  onLearn,
  onPlace,
}: {
  lead: Lead;
  report: Report;
  regionName: string;
  featured?: boolean;
  dimmed?: boolean;
  queued: Record<string, "queuing" | "done">;
  reads: Record<string, ReadState>;
  whyOpen: boolean;
  onToggleWhy: () => void;
  onQueue: () => void;
  onRead: (id: string) => void;
  onLearn: (id: string, name: string, ack?: boolean) => void;
  onPlace: (entityId: string, entityName: string) => void;
}) {
  const local = queued[lead.url];
  // **Read is not learned.** Evidence is stored before the curator decides, so
  // a page read in a previous session and never acted on used to render as
  // finished work with nothing to click — a decision nobody made, shown as one
  // that was. Only the `describes` edge means learned.
  const isLearned = Boolean(lead.learnedEntityId);
  const isQueued =
    local === "done" ||
    lead.state === "queued" ||
    (lead.state === "read" && !isLearned);
  const readNotLearned = lead.state === "read" && !isLearned;
  /** A row in flight stops being a one-liner — the decision needs the space. */
  const active = isLearned || isQueued;

  const why = whyOpen && (
    <div className="border-border mt-2 border-l-2 pl-3">
      <p className="text-muted-foreground text-[11.5px] leading-snug">
        {lead.reason}
      </p>
      <p className={cn(MONO_META, "mt-2 text-[10px]")}>Could establish</p>
      <ul className="text-muted-foreground mt-1 space-y-0.5">
        {lead.couldEstablish.map((c) => (
          <li
            key={c}
            className="text-[11.5px] leading-snug before:mr-1.5 before:content-['—']"
          >
            {c}
          </li>
        ))}
      </ul>
    </div>
  );

  const actions = isLearned ? (
    <div>
      <p className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-emerald-700 dark:text-emerald-400">
        <Check className="h-3.5 w-3.5" />I read this and learned from it
      </p>
      <Link
        href={`/admin/entities/${lead.learnedEntityId}`}
        className={cn(GHOST, "mt-1 block text-[11.5px]")}
      >
        Open what it created
      </Link>
    </div>
  ) : isQueued ? (
    <ReadPanel
      state={reads[lead.url]}
      alreadyRead={readNotLearned}
      subject={report.name}
      regionName={regionName}
      // What else Atlas could still try for *this* subject. A refusal that
      // names the alternative keeps the curator on Oyama Lake instead of
      // sending them to the region's generic backlog.
      otherLeadsToTry={
        report.leads.filter(
          (l) =>
            l.url !== lead.url &&
            !l.learnedEntityId &&
            l.state !== "read" &&
            // Not one the curator already tried in this session. The report was
            // fetched before these reads happened, and a failed fetch writes
            // nothing, so server-side state cannot know — pointing at a source
            // that just failed in front of them is worse than saying there is
            // nothing left.
            !reads[l.url]?.result,
        ).length
      }
      candidateSourceId={reads[lead.url]?.id ?? lead.candidateSourceId}
      onRead={onRead}
      onLearn={onLearn}
      onPlace={onPlace}
    />
  ) : null;

  // ---- FEATURED -----------------------------------------------------------
  if (featured) {
    return (
      <div className="border-border border-b border-l-[3px] border-l-emerald-600 px-5 py-4">
        <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="rounded bg-emerald-700 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold tracking-[0.1em] text-white uppercase">
            Recommended
          </span>
          <span
            className={cn("text-[15px] font-extrabold tracking-[-0.01em]", INK)}
          >
            {lead.title ?? lead.publisher}
          </span>
          <span
            className={cn(
              MONO_META,
              "border-border rounded border px-1.5 font-mono text-[9.5px]",
            )}
          >
            {lead.basis === "constructed" ? "unverified" : lead.basis}
          </span>
          <a
            href={lead.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground ml-auto truncate font-mono text-[11px] transition-colors"
          >
            {lead.url.replace(/^https?:\/\//, "")}
          </a>
        </p>
        <p className="mt-1.5 max-w-5xl text-[12.5px] leading-snug">
          {lead.reason}
        </p>
        {active ? (
          <div className="mt-3">{actions}</div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={onQueue}
              disabled={local === "queuing"}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-[13px] font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-50",
                BG_INK,
              )}
            >
              {local === "queuing" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Queue &amp; read
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button onClick={onToggleWhy} className={cn(GHOST, "text-[12px]")}>
              Why this one?
            </button>
          </div>
        )}
        {why}
      </div>
    );
  }

  // ---- COMPACT ROW --------------------------------------------------------
  return (
    <div
      className={cn(
        "border-border border-b px-5",
        active ? "py-3" : "py-2",
        dimmed && "opacity-60 transition-opacity hover:opacity-100",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className={cn("text-[13px] font-bold", dimmed ? "" : INK)}>
          {lead.title ?? lead.publisher}
        </span>
        {!dimmed && (
          <span
            className={cn(
              MONO_META,
              "border-border rounded border px-1.5 font-mono text-[9.5px]",
            )}
          >
            {lead.basis === "constructed" ? "unverified" : lead.basis}
          </span>
        )}
        <span className="text-muted-foreground truncate text-[11.5px]">
          {dimmed && lead.standingReason
            ? lead.standingReason.split(".")[0]
            : lead.publisher}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-3">
          <button onClick={onToggleWhy} className={cn(GHOST, "text-[11.5px]")}>
            Why
          </button>
          {!active && (
            <button
              onClick={onQueue}
              disabled={local === "queuing"}
              className={cn(GHOST, "text-[11.5px] disabled:opacity-50")}
            >
              {local === "queuing" ? "Queuing…" : "Queue"}
            </button>
          )}
        </span>
      </div>
      {/* The full demotion sentence, verbatim, once asked for. */}
      {whyOpen && lead.standingReason && (
        <p className="border-muted-foreground/30 text-muted-foreground mt-2 border-l-2 pl-3 text-[11.5px] leading-snug">
          {lead.standingReason}
        </p>
      )}
      {why}
      {active && <div className="mt-2.5">{actions}</div>}
    </div>
  );
}

interface ReadResult {
  outcome:
    | "identified"
    | "unresolved"
    | "not-targetless"
    | "fetch-failed"
    | "extraction-failed";
  summary: string;
  claim?: { name: string };
  assessment?: { hasIdentity: boolean; signals: string[]; reason?: string };
  sourceRecordId?: string;
}

/**
 * **What happened when Atlas tried to learn it.**
 *
 * Every outcome except `learned` is a refusal, and each refusal names what
 * would resolve it. A refusal with no next step is where a curator gets
 * stuck, and the failure they blame is the product rather than the page.
 *
 * The two writes are shown separately because they are separate claims:
 * *this exists* and *this belongs to {region}*. A single "Add to Okanagan"
 * button would collapse them and quietly make membership a side effect of
 * creation — the inference ADR 025 exists to forbid.
 */
function LearnedPanel({
  learned,
  subject,
  regionName,
  placing,
  placed,
  onPlace,
  onRetryAsDistinct,
}: {
  learned: LearnResult;
  /** The name the curator typed, used when nothing was created and there is no entity to name. */
  subject: string;
  regionName: string;
  placing?: boolean;
  placed?: boolean;
  onPlace: (entityId: string, entityName: string) => void;
  onRetryAsDistinct?: () => void;
}) {
  const created = learned.outcome === "learned";

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-4",
        created
          ? "border-emerald-600/40 bg-emerald-500/[0.06]"
          : "border-amber-600/40 bg-amber-500/[0.05]",
      )}
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        {created ? (
          <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <CircleSlash className="text-muted-foreground h-4 w-4" />
        )}
        {created
          ? `I learned ${learned.entityName ?? "it"}`
          : `${learned.entityName ?? subject} was not created`}
      </p>
      <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
        {learned.summary}
      </p>

      {/* Every write, named. A write a curator cannot see is a hidden one. */}
      {learned.written.length > 0 && (
        <ul className="mt-2.5 space-y-1">
          {learned.written.map((w) => (
            <li
              key={w}
              className="text-xs leading-relaxed before:mr-1.5 before:content-['✓']"
            >
              {w}
            </li>
          ))}
        </ul>
      )}

      {learned.matchedEntityId && (
        <Link
          href={`/admin/entities/${learned.matchedEntityId}`}
          className="border-border hover:bg-muted mt-2.5 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm"
        >
          {learned.matchedEntityName}
        </Link>
      )}

      {onRetryAsDistinct && (
        <button
          onClick={onRetryAsDistinct}
          className="border-border hover:bg-muted mt-2.5 ml-2 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium"
        >
          This is a different place — create it anyway
        </button>
      )}

      {/* The second statement. Deliberately not automatic. */}
      {created && learned.entityId && (
        <div className="border-border/60 mt-4 border-t pt-4">
          {placed ? (
            <p className="flex items-center gap-2 text-sm font-medium">
              <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Placed in {regionName} — coverage counts it now
            </p>
          ) : (
            <>
              <p className="text-sm font-medium">It belongs to no region yet</p>
              <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                {learned.nextStep}
              </p>
              <button
                onClick={() =>
                  onPlace(learned.entityId!, learned.entityName ?? "it")
                }
                disabled={placing}
                className="border-border bg-background hover:bg-muted mt-2.5 inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Place it in {regionName}
              </button>
            </>
          )}
          {learned.entityId && (
            <Link
              href={`/admin/entities/${learned.entityId}`}
              className="text-muted-foreground hover:text-foreground mt-2.5 block text-xs underline underline-offset-2"
            >
              Open {learned.entityName}
            </Link>
          )}
        </div>
      )}

      {!created && learned.nextStep && (
        <p className="mt-2.5 text-xs leading-relaxed">{learned.nextStep}</p>
      )}
    </div>
  );
}

interface LearnResult {
  outcome:
    | "learned"
    | "already-known"
    | "possible-duplicate"
    | "subject-changed"
    | "no-identity"
    | "not-read"
    | "extraction-failed";
  entityId?: string;
  entityName?: string;
  placeType?: string;
  matchedEntityId?: string;
  matchedEntityName?: string;
  written: string[];
  summary: string;
  nextStep?: string;
}

interface ReadState {
  id: string;
  busy?: boolean;
  result?: ReadResult;
  learning?: boolean;
  learned?: LearnResult;
  placing?: boolean;
  placed?: boolean;
}

/**
 * **What each read outcome means, and what to do about it — for this subject.**
 *
 * Every entry keeps the curator on the name they typed. A refusal with no
 * next step is where an investigation dies quietly, leaving the region's
 * generic backlog as the only thing left to click — 126 other entities, none
 * of them the one they came for.
 */
const READ_OUTCOME: Record<
  ReadResult["outcome"],
  { title: string; nextStep: (subject: string, others: number) => string }
> = {
  identified: {
    title: "I read it — and I can tell what it is",
    nextStep: () => "",
  },
  unresolved: {
    title: "I read it, and it wasn't enough to identify it",
    nextStep: (subject, others) =>
      `The page didn't establish which ${subject} this is. ` +
      (others > 0
        ? `There ${others === 1 ? "is 1 other source" : `are ${others} other sources`} for it here — try one of those.`
        : "I need a source that publishes coordinates, an identifier or an address."),
  },
  "fetch-failed": {
    title: "I couldn't fetch the page",
    nextStep: (subject, others) =>
      `I built this URL from the name and it doesn't resolve. That's a fact about my guess, not about ${subject}. ` +
      (others > 0
        ? `There ${others === 1 ? "is 1 other source" : `are ${others} other sources`} for it here — try one of those.`
        : "I need a real source rather than another constructed one."),
  },
  "extraction-failed": {
    title: "I read it, but couldn't make sense of it",
    nextStep: (subject) =>
      `I fetched and stored the page for ${subject} but couldn't read meaning from it. The evidence is held, so trying again costs no fetch.`,
  },
  "not-targetless": {
    title: "This one already has a known subject",
    nextStep: () =>
      "It belongs to an entry I already hold, so the normal processing path handles it.",
  },
};

/**
 * **Queued is a waiting state, and reading it is a real action.**
 *
 * Nothing drains this queue on its own — the runner only reads pages whose
 * target entity is already known, and a discovered source is by definition
 * about something Atlas does not hold. So the panel offers the read rather
 * than implying one is scheduled.
 */
function ReadPanel({
  state,
  alreadyRead,
  subject,
  otherLeadsToTry,
  regionName,
  candidateSourceId,
  onRead,
  onLearn,
  onPlace,
}: {
  state?: ReadState;
  /** Atlas already stored evidence for this page and created nothing from it. */
  alreadyRead?: boolean;
  /** The name the curator typed. Every message here stays about this. */
  subject: string;
  /** How many other sources for this same subject remain untried. */
  otherLeadsToTry: number;
  regionName: string;
  candidateSourceId?: string;
  onRead: (id: string) => void;
  onLearn: (
    id: string,
    confirmedName: string,
    acknowledgeDuplicate?: boolean,
  ) => void;
  onPlace: (entityId: string, entityName: string) => void;
}) {
  const result = state?.result;

  // Once Atlas has learned it, the read result is history — the panel shows
  // what exists now and what is still undone.
  if (state?.learned) {
    return (
      <LearnedPanel
        learned={state.learned}
        subject={subject}
        regionName={regionName}
        placing={state.placing}
        placed={state.placed}
        onPlace={onPlace}
        onRetryAsDistinct={
          state.learned.outcome === "possible-duplicate" && candidateSourceId
            ? () => onLearn(candidateSourceId, result?.claim?.name ?? "", true)
            : undefined
        }
      />
    );
  }

  if (result) {
    const good = result.outcome === "identified";
    return (
      <div
        className={cn(
          "rounded-xl border px-4 py-3.5",
          good
            ? "border-emerald-600/40 bg-emerald-500/[0.05]"
            : "border-border bg-muted/30",
        )}
      >
        <p className="flex items-center gap-2 text-sm font-medium">
          {good ? (
            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <CircleSlash className="text-muted-foreground h-4 w-4" />
          )}
          {READ_OUTCOME[result.outcome]?.title ?? "I read it"}
        </p>
        {result.assessment && result.assessment.signals.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {result.assessment.signals.map((s) => (
              <li
                key={s}
                className="text-xs text-emerald-700 dark:text-emerald-400"
              >
                ✓ {s}
              </li>
            ))}
          </ul>
        )}
        <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
          {result.summary}
        </p>
        {/* The reasoning, one click away rather than in the way. */}
        {result.assessment?.reason && !good && (
          <details className="mt-2">
            <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs underline-offset-2 hover:underline">
              Why?
            </summary>
            <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
              {result.assessment.reason}
            </p>
          </details>
        )}

        {/* **No entity was created, so say why and what to do next.** The
            investigation is still about this subject; an unexplained refusal
            is what leaves the region's generic backlog as the only remaining
            thing to click. */}
        {!good && (
          <p className="border-border/60 mt-3 border-t pt-3 text-xs leading-relaxed">
            {READ_OUTCOME[result.outcome]?.nextStep(subject, otherLeadsToTry)}
          </p>
        )}

        {/* The decision. Atlas has said what it believes and stopped — this is
            the first click in the whole journey that writes. */}
        {good && result.claim?.name && candidateSourceId && (
          <div className="border-border mt-4 border-t pt-4">
            <p className="text-sm font-medium">I haven&apos;t learned it yet</p>
            <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
              I read the page and can tell which place it describes. Nothing
              exists in Atlas until you say so — and creating it says only that
              it exists, not that it belongs to {regionName}.
            </p>
            <button
              onClick={() => onLearn(candidateSourceId, result.claim!.name)}
              disabled={state?.learning}
              className="bg-foreground text-background mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {state?.learning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {state?.learning
                ? "Reading it properly…"
                : `Create ${result.claim.name}`}
            </button>
            {state?.learning && (
              <p className="text-muted-foreground/80 mt-2 text-xs leading-relaxed">
                Re-reading the stored page in full — the identity check was
                deliberately shallow, and this is the read worth paying for.
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-600/40 bg-amber-500/[0.05] px-4 py-3.5">
      <p className="text-sm font-medium">
        {alreadyRead
          ? "I read this, and nothing was created"
          : "Queued — nothing has read it"}
      </p>
      <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
        {alreadyRead
          ? "I fetched this page and stored the evidence, and no entry came of it — the decision is still yours. Reading it again brings back what I found."
          : "I won't pick this up on my own: the queue runner only reads pages whose subject I already hold."}
      </p>
      {candidateSourceId ? (
        <button
          onClick={() => onRead(candidateSourceId)}
          disabled={state?.busy}
          className="border-border bg-background hover:bg-muted mt-3 inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {state?.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {state?.busy
            ? "Reading…"
            : alreadyRead
              ? "Review it again"
              : "Read it now"}
        </button>
      ) : (
        <p className="text-muted-foreground/70 mt-2.5 text-xs">
          Investigate again to get a read action for this source.
        </p>
      )}
    </div>
  );
}
