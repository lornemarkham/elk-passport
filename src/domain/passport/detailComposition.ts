import type {
  SubjectPageView,
  SubjectView,
  SubjectFactView,
} from "@/lib/passport/subjectPage";

/**
 * **Turning what Atlas knows into what a person is deciding.**
 *
 * The detail page printed every fact at one weight under a single heading, so
 * Field of Screams — about which Atlas knows a great deal — arrived as
 * twenty-three rows a reader had to sort themselves. Nothing was missing. It
 * was simply never composed into the order somebody actually asks in: *what is
 * this, when can I go, where is it, what do I need to know, what do I do next.*
 *
 * ## Capability detection, not a taxonomy
 *
 * Nothing here branches on entity kind, title, publisher or id. Each section
 * appears because the evidence for it is present:
 *
 * ```
 * a claim with dates            → When
 * an address or a venue         → Where and a directions link
 * a source typed official       → the official site
 * a URL inside a fact's value   → that publisher's own link, under its own label
 * facts carrying a category     → sections titled with the publisher's headings
 * ```
 *
 * A subject with none of those renders a shorter page rather than a padded one.
 *
 * ## The publisher's headings are the only headings
 *
 * `KeyFact.category` is *"the section heading the source text itself placed
 * this fact under, copied exactly"*. Where it survives, Atlas already holds a
 * structure a person can read — Black Mountain arrives pre-grouped under
 * "Eight nights only", "Sold out online? Come anyway." and "Why we do this" —
 * and Passport has only to stop flattening it. Where it does not, the facts
 * stay in one honest list rather than being sorted into categories Passport
 * invented.
 */

export interface DetailAction {
  /** What the button says. The publisher's own word where there is one. */
  readonly label: string;
  readonly href: string;
  /** Ordered by how likely a decided person is to want it. */
  readonly kind: "tickets" | "official" | "directions";
}

export interface FactSection {
  /** The publisher's heading, or absent when the source marked none. */
  readonly title?: string;
  readonly facts: readonly SubjectFactView[];
}

/** The first URL a fact's value contains, if any. */
export function urlIn(value: string): string | undefined {
  const match = value.match(/https?:\/\/[^\s<>"')]+/);
  if (!match) return undefined;
  // Trailing punctuation belongs to the sentence, not to the address.
  return match[0].replace(/[.,;:]+$/, "");
}

/**
 * The shortest official URL Atlas holds for this subject.
 *
 * Shortest because a publisher's several pages arrive as several records —
 * `/buy`, `/contact`, `/schedule` and the root — and the root is the one that
 * means "their website". The deeper ones are not discarded: a fact that quotes
 * one becomes its own action below, under the publisher's own label.
 */
export function officialSite(view: SubjectPageView): string | undefined {
  const official = view.sources
    .filter((s) => s.sourceType === "official-website" && s.url)
    .map((s) => s.url)
    .sort((a, b) => a.length - b.length);
  return official[0];
}

/**
 * Where a person would be going, in words good enough to search for.
 *
 * A venue Atlas resolved beats the subject's own address line, because the
 * venue is the door and the address may be the operator's office.
 */
export function whereLine(view: SubjectPageView): string | undefined {
  const venue = view.venue ?? view.offerings.find((o) => o.venue)?.venue;
  // A resolved venue answers alone. Falling back to the subject's own address
  // here would print the operator's office under the venue's name — ADR 019's
  // trap, and the one place this could quietly lie about where to go.
  const parts = venue ? [venue.name, venue.address] : [view.subject.address];
  const stated = parts.filter((p): p is string => Boolean(p && p.trim()));
  const unique = stated.filter((p, i) => stated.indexOf(p) === i);
  return unique.length > 0 ? unique.join(", ") : undefined;
}

/**
 * What a decided person can do next.
 *
 * A link is only ever one a publisher actually published — quoted inside a
 * fact, or typed by Atlas as this subject's official site. Nothing is
 * constructed except the directions search, and that only from an address a
 * source stated.
 */
export function actionsFor(view: SubjectPageView): DetailAction[] {
  const actions: DetailAction[] = [];
  const official = officialSite(view);

  // A URL a publisher printed inside a fact carries that fact's own label —
  // "Tickets" on Field of Screams, because that is what the page called it.
  const quoted = new Map<string, string>();
  for (const fact of view.subject.facts) {
    const href = urlIn(fact.value);
    if (href && href !== official && !quoted.has(href)) {
      quoted.set(href, fact.label);
    }
  }
  for (const [href, label] of quoted) {
    actions.push({ label, href, kind: "tickets" });
  }

  if (official) {
    actions.push({ label: "Official site", href: official, kind: "official" });
  }

  // **A coordinate is a door; a name is a guess at one.** A Place Atlas holds
  // a point for sends a person to that point, which is the difference between
  // arriving and searching a map for a name two businesses share.
  const venue = view.venue ?? view.offerings.find((o) => o.venue)?.venue;
  const point = venue?.coordinates;
  const where = whereLine(view);
  if (point) {
    actions.push({
      label: "Directions",
      href: `https://www.google.com/maps/search/?api=1&query=${point[1]},${point[0]}`,
      kind: "directions",
    });
  } else if (where) {
    actions.push({
      label: "Directions",
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where)}`,
      kind: "directions",
    });
  }
  return actions;
}

/** Facts whose whole content is a link already offered as an action. */
function spentOnAnAction(
  fact: SubjectFactView,
  actions: readonly DetailAction[],
): boolean {
  const href = urlIn(fact.value);
  if (!href) return false;
  const action = actions.find((a) => a.href === href);
  if (!action) return false;
  // Kept when the sentence says something besides the address.
  return fact.value.replace(href, "").replace(/[^a-z0-9]/gi, "").length < 24;
}

/**
 * The facts, under the publisher's own headings where the source had any.
 *
 * Order is the order Atlas holds, which is the order the page was read in.
 * Nothing is dropped except a fact that was nothing but a link already shown
 * as a button.
 */
export function factSections(
  view: SubjectPageView,
  actions: readonly DetailAction[] = [],
): FactSection[] {
  const facts = view.subject.facts.filter((f) => !spentOnAnAction(f, actions));
  if (facts.length === 0) return [];

  const anyCategorised = facts.some((f) => f.category?.trim());
  if (!anyCategorised) return [{ facts }];

  const sections: FactSection[] = [];
  for (const fact of facts) {
    const title = fact.category?.trim() || undefined;
    const last = sections[sections.length - 1];
    if (last && last.title === title) {
      (last.facts as SubjectFactView[]).push(fact);
    } else {
      sections.push({ title, facts: [fact] });
    }
  }
  return sections;
}

/**
 * When this is on, said once and from the claims rather than from prose.
 *
 * A subject whose own dates live on its parts — an attraction with modes —
 * answers with theirs, because a person asking "when can I go" does not care
 * which record holds the calendar.
 */
export function whenSummary(view: SubjectPageView): {
  readonly days: readonly string[];
  readonly edition?: string;
  /**
   * True when the dates are the ends of a continuous run rather than a list
   * of nights. A fixed window states two days and *means* every day between
   * them, so counting them as "2 dates" would be a smaller claim than the
   * source made; a discrete-date claim genuinely is a list and counting it is
   * the whole point.
   */
  readonly isRange: boolean;
} {
  const own = view.subject.days;
  const fromParts = [
    ...view.parts.flatMap((p) => p.days),
    ...view.offerings.flatMap((o) => [
      ...o.subject.days,
      ...o.parts.flatMap((p) => p.days),
    ]),
  ];
  const usingOwn = own.length > 0;
  const days = [...new Set(usingOwn ? own : fromParts)].sort();
  const claims = usingOwn
    ? view.subject.claims
    : [
        ...view.parts.flatMap((p) => p.claims),
        ...view.offerings.flatMap((o) => [
          ...o.subject.claims,
          ...o.parts.flatMap((p) => p.claims),
        ]),
      ];
  const edition = claims
    .map((c) => (c as { editionLabel?: string }).editionLabel)
    .find((e): e is string => Boolean(e));
  const isRange =
    claims.length > 0 && claims.every((c) => c.shape === "fixed-window");
  return { days, edition, isRange };
}

/** Whether this subject can say anything at all about where it is. */
export const knowsWhere = (view: SubjectPageView): boolean =>
  whereLine(view) !== undefined;

/** Every part a person could actually attend, across offerings. */
export function attendableParts(view: SubjectPageView): readonly SubjectView[] {
  return [...view.parts, ...view.offerings.flatMap((o) => o.parts)];
}
