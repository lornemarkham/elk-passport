import { TOWNS, type LightsDoc, type TownId } from "./model";

export interface LaunchStats {
  /** Pins a family sent (researched seed pins are not submissions). */
  readonly submissions: number;
  readonly waiting: number;
  readonly published: number;
  readonly declined: number;
  readonly hidden: number;
  readonly withPhoto: number;
  readonly reports: number;
  readonly reactions: number;
  readonly seeded: number;
  /** Distinct families who submitted, by keyed hash — never who they are. */
  readonly families: number;
  readonly byTown: Readonly<
    Record<TownId, { published: number; waiting: number }>
  >;
}

/**
 * **The launch numbers a reviewer can read from the store itself.** Visitors
 * and page views are Vercel Web Analytics (path-only, cookieless); this is
 * the half only the store knows: what was sent, what is waiting, what is
 * published, what was reported.
 */
export function launchStats(doc: LightsDoc): LaunchStats {
  const family = doc.pins.filter((p) => !p.source);
  const byTown = Object.fromEntries(
    TOWNS.map((t) => [t, { published: 0, waiting: 0 }]),
  ) as Record<TownId, { published: number; waiting: number }>;
  for (const p of doc.pins) {
    if (p.status === "approved") byTown[p.town].published++;
    if (p.status === "pending") byTown[p.town].waiting++;
  }
  return {
    submissions: family.length,
    waiting: family.filter((p) => p.status === "pending").length,
    published: family.filter((p) => p.status === "approved").length,
    declined: family.filter((p) => p.status === "declined").length,
    hidden: family.filter((p) => p.status === "hidden").length,
    withPhoto: family.filter((p) => p.photo).length,
    reports: doc.pins.reduce(
      (n, p) => n + p.trail.filter((e) => e.kind === "report").length,
      0,
    ),
    reactions: doc.pins.reduce((n, p) => n + p.reactions.length, 0),
    seeded: doc.pins.length - family.length,
    families: new Set(family.map((p) => p.submittedBy)).size,
    byTown,
  };
}
