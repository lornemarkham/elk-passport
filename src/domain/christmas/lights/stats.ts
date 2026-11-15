import {
  TOWNS,
  isLightDisplay,
  type LightsDoc,
  type PinView,
  type TownId,
} from "./model";

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
  readonly ratings: number;
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
    ratings: doc.pins.reduce((n, p) => n + (p.ratings?.length ?? 0), 0),
    seeded: doc.pins.length - family.length,
    families: new Set(family.map((p) => p.submittedBy)).size,
    byTown,
  };
}

/**
 * **"Help us light up Vernon!"** — what the community has put on the map,
 * from published displays only (a private pin is never counted where a
 * visitor can see it): confirmed this season, community favourites, and
 * how many displays each part of the valley has.
 */
export interface LightUp {
  readonly confirmed: number;
  readonly favourites: number;
  readonly rated: number;
  readonly places: readonly { readonly label: string; readonly n: number }[];
}

export function lightUp(
  views: readonly PinView[],
  placeOf: (v: PinView) => string,
  favourite: (v: PinView) => boolean,
): LightUp {
  const lights = views.filter(
    (v) => v.status === "approved" && isLightDisplay(v.kind),
  );
  const lit = lights.filter((v) => v.season === "lit");
  const places = new Map<string, number>();
  for (const v of lit)
    places.set(placeOf(v), (places.get(placeOf(v)) ?? 0) + 1);
  return {
    confirmed: lit.length,
    favourites: lit.filter(favourite).length,
    rated: lights.filter((v) => v.rating).length,
    places: [...places]
      .map(([label, n]) => ({ label, n }))
      .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)),
  };
}
