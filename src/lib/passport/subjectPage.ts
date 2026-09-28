import type {
  ComposedSubject,
  SubjectClaim,
  SubjectComposition,
  SubjectDayStatement,
  SubjectSource,
} from "@/lib/data/types";

/**
 * **Atlas composed it; this arranges it.**
 *
 * The traveller page used to build its own world: `/admin/entities` and
 * `/admin/relationships`, the whole corpus, joined by uuid in the page. It
 * could therefore show what a single record held and nothing about what that
 * record was *connected to* — Black Mountain rendered as an address, a generic
 * sentence and "Operation period: Every October", while Atlas held the eight
 * nights, the six afternoons, both price tables and the two modes.
 *
 * Atlas now answers that in one public read (`GET /organizations/:id/detail`).
 * This module turns that answer into what a page renders, and its whole
 * discipline is in what it refuses to do:
 *
 * - **Subject boundaries survive.** A price stays on the mode that charges it,
 *   with that mode's own id, name and source. Nothing is merged upward into an
 *   invented subject, and the UI composes visually without the data doing so.
 * - **Dates are read, never computed.** `days` is the `startsOn` values Atlas
 *   sent. There is no `claimCoversDay` here and there must never be one: the
 *   day question goes back to Atlas as `?on=`.
 * - **`stated: false` is not a closure.** Atlas sends the sentence that says
 *   so; this carries it through verbatim rather than translating it into
 *   "closed" — which is exactly the invention the whole temporal model exists
 *   to prevent.
 * - **Currency is Atlas's to decide or refuse.** An Experience's facts come
 *   back `not-decided`; nothing here upgrades that to "current".
 *
 * ## The one arrangement decision
 *
 * An Organization that offers an attraction *and* its two modes sends three
 * `offers` edges. Showing three peers would misrepresent a structure Atlas
 * already states: the attraction `includes` the other two. So an offering that
 * another offering includes is nested under it. That reads an asserted edge;
 * it invents nothing, and with no `includes` edge the offerings stay flat.
 */

export interface SubjectFactView {
  readonly label: string;
  readonly value: string;
  readonly category?: string;
  /** Where the publisher said it. Absent only if Atlas sent no matching record. */
  readonly source?: SubjectSource;
  /** When Atlas last saw the source say it (ADR 072). */
  readonly observedAt?: string;
  /** `not-decided` for an Experience — Atlas holds no rule for its currency and does not guess. */
  readonly currency?: string;
}

export interface SubjectClaimView {
  readonly id: string;
  readonly shape: string;
  /** The days Atlas stated, exactly as it stated them. */
  readonly days: readonly string[];
  readonly supportingPassage: string;
  readonly unresolved?: string;
  readonly source?: SubjectSource;
  readonly statesRequestedDay?: boolean;
}

export interface SubjectView {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly subtype?: string;
  readonly description: string;
  readonly address?: string;
  /**
   * An Event's own interval. Kept apart from `claims`, which are what sources
   * *said* about when something is on: an Event simply has a start and an end.
   */
  readonly startTime?: string;
  readonly endTime?: string;
  readonly timePrecision?: string;
  readonly facts: readonly SubjectFactView[];
  readonly claims: readonly SubjectClaimView[];
  /** Every day any of this subject's claims states, ascending and deduplicated. */
  readonly days: readonly string[];
  /** Atlas's answer for the day the caller asked about, verbatim. */
  readonly day?: SubjectDayStatement;
}

export interface OfferingView {
  readonly subject: SubjectView;
  /** What Atlas says this offering `includes`. Each keeps its own identity and its own facts. */
  readonly parts: readonly SubjectView[];
  /** The venue Atlas says hosts it. */
  readonly venue?: SubjectView;
}

export interface SubjectPageView {
  readonly subject: SubjectView;
  readonly offerings: readonly OfferingView[];
  /** For an Experience root: who offers it, and what it is part of. */
  readonly offeredBy?: SubjectView;
  readonly partOf?: SubjectView;
  readonly venue?: SubjectView;
  /**
   * **The root's own parts** — what Atlas says this thing `includes`.
   *
   * An attraction with modes is the common case: the Black Mountain Haunted
   * House includes its Evening Haunt and its Family Fun Hours, and each of
   * those is the record that actually carries the nights and the prices. The
   * view read `offers` and nothing else, so opening the attraction showed the
   * story and silently dropped both — $20 / $15 / $7.50, the door times and
   * the dates were all received from Atlas and thrown away here.
   *
   * Read from the same asserted edge the discovery feed groups on, so the
   * page and the card agree about what one thing is.
   */
  readonly parts: readonly SubjectView[];
  /**
   * The sources behind what this page actually prints — not every source
   * reachable through the composed graph. See `citedBy`.
   */
  readonly sources: readonly SubjectSource[];
  /** The day the caller asked Atlas about, if any. */
  readonly on?: string;
}

const edges = (
  subject: ComposedSubject,
  verb: string,
  direction: "outgoing" | "incoming",
) =>
  subject.related
    .filter((e) => e.verb === verb && e.direction === direction)
    .map((e) => e.subject);

const claimView = (
  claim: SubjectClaim,
  sources: readonly SubjectSource[],
): SubjectClaimView => ({
  id: claim.id,
  shape: claim.shape,
  days: claim.intervals.flatMap((interval) =>
    interval.startsOn === interval.endsOn
      ? [interval.startsOn]
      : [interval.startsOn, interval.endsOn],
  ),
  supportingPassage: claim.supportingPassage,
  ...(claim.unresolved ? { unresolved: claim.unresolved } : {}),
  ...(sources.find((s) => s.id === claim.sourceRecordId)
    ? { source: sources.find((s) => s.id === claim.sourceRecordId)! }
    : {}),
  ...(claim.statesRequestedDay === undefined
    ? {}
    : { statesRequestedDay: claim.statesRequestedDay }),
});

function subjectView(
  subject: ComposedSubject,
  sources: readonly SubjectSource[],
): SubjectView {
  const stateOf = (label: string) =>
    subject.temporal.claims.find(
      (c) => c.field === "keyFacts" && c.label === label,
    );
  const claims = subject.when.map((claim) => claimView(claim, sources));
  return {
    id: subject.id,
    kind: subject.kind,
    name: subject.name,
    ...(subject.subtype ? { subtype: subject.subtype } : {}),
    description: subject.description,
    ...(subject.address ? { address: subject.address } : {}),
    ...(subject.startTime ? { startTime: subject.startTime } : {}),
    ...(subject.endTime ? { endTime: subject.endTime } : {}),
    ...(subject.timePrecision ? { timePrecision: subject.timePrecision } : {}),
    facts: subject.keyFacts.map((fact) => {
      const state = stateOf(fact.label);
      return {
        label: fact.label,
        value: fact.value,
        ...(fact.category ? { category: fact.category } : {}),
        ...(sources.find((s) => s.id === fact.sourceRecordId)
          ? { source: sources.find((s) => s.id === fact.sourceRecordId)! }
          : {}),
        ...(state?.observedAt ? { observedAt: state.observedAt } : {}),
        ...(state?.currency ? { currency: state.currency } : {}),
      };
    }),
    claims,
    days: [...new Set(claims.flatMap((c) => c.days))].sort(),
    ...(subject.on ? { day: subject.on } : {}),
  };
}

/**
 * **The sources these subjects' own facts and claims cite.**
 *
 * Every fact and every claim Atlas sends carries a `sourceRecordId`, so which
 * source stands behind a rendered line is known exactly and needs no guessing.
 * Nothing here looks at a URL, a domain, a source type or a name — a tourism
 * blog is a perfectly good source for a fact it actually supports, and the
 * only question asked is whether the page printed something that cites it.
 */
function citedBy(views: readonly SubjectView[]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const view of views) {
    for (const fact of view.facts) if (fact.source) ids.add(fact.source.id);
    for (const claim of view.claims) if (claim.source) ids.add(claim.source.id);
  }
  return ids;
}

export function subjectPageView(
  composition: SubjectComposition,
): SubjectPageView {
  const { root, sources } = composition;
  const offered = edges(root, "offers", "outgoing");
  // An offering another offering includes belongs under it, because Atlas says
  // so with an `includes` edge. Read, not assumed.
  const includedByAnother = new Set(
    offered.flatMap((offering) =>
      edges(offering, "includes", "outgoing").map((part) => part.id),
    ),
  );

  const subject = subjectView(root, sources);
  const offerings: OfferingView[] = offered
    .filter((offering) => !includedByAnother.has(offering.id))
    .map((offering) => {
      const venue = edges(offering, "hosts", "incoming")[0];
      return {
        subject: subjectView(offering, sources),
        parts: edges(offering, "includes", "outgoing").map((part) =>
          subjectView(part, sources),
        ),
        ...(venue ? { venue: subjectView(venue, sources) } : {}),
      };
    });

  /**
   * **Which subjects the page prints facts for**, and therefore whose sources
   * belong under "Where this comes from".
   *
   * The root, the things it offers, and the parts of those. Deliberately not
   * `offeredBy`, `partOf` or a venue: those appear as a name and a link, so
   * none of their facts is on the page and none of their sources supports
   * anything a reader just read.
   *
   * That distinction is the whole defect. Opening *The Fall of the House of
   * Usher* pulled in its provider, Caravan Farm Theatre, whose own facts cite
   * a Tourism Kelowna business profile and three Tourism Vernon trip ideas
   * about summer, winter and romantic weekends. All four were listed as
   * sources for a page that printed not one word of Caravan's facts — seven
   * sources for content backed by one.
   *
   * A venue's address is printed, but an address carries no `sourceRecordId`
   * in the composition contract, so there is nothing to attribute and nothing
   * is claimed.
   */
  // What Atlas says the root itself includes. Excluded from `offerings` above
  // only because that list is built from `offers`; these are the same kind of
  // thing a person chooses between.
  const parts: SubjectView[] = edges(root, "includes", "outgoing").map((part) =>
    subjectView(part, sources),
  );

  const presented: SubjectView[] = [
    subject,
    ...parts,
    ...offerings.flatMap((offering) => [offering.subject, ...offering.parts]),
  ];
  const cited = citedBy(presented);

  return {
    subject,
    offerings,
    parts,
    ...(edges(root, "offers", "incoming")[0]
      ? {
          offeredBy: subjectView(
            edges(root, "offers", "incoming")[0]!,
            sources,
          ),
        }
      : {}),
    ...(edges(root, "includes", "incoming")[0]
      ? {
          partOf: subjectView(edges(root, "includes", "incoming")[0]!, sources),
        }
      : {}),
    ...(edges(root, "hosts", "incoming")[0]
      ? { venue: subjectView(edges(root, "hosts", "incoming")[0]!, sources) }
      : {}),
    // Atlas's own order, narrowed. Facts keep the provenance they always had;
    // only the page-level list stops over-claiming.
    sources: sources.filter((source) => cited.has(source.id)),
    ...(composition.on ? { on: composition.on } : {}),
  };
}

export function formatStatedDay(day: string): string {
  const parsed = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? day
    : parsed.toLocaleDateString("en-CA", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
}
