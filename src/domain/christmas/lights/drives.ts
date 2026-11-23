import { areaById } from "./areas";
import { onThatDay, type LatLng, type PinView } from "./model";
import { priorMean } from "./rank";
import {
  buildTour,
  clockText,
  tourQuery,
  toStop,
  type Stop,
  type TourStyle,
} from "./tour";

/**
 * **Suggested drives** — ready-made routes for somebody who has not said how
 * long they have or where they are starting. Each is an ordinary
 * `buildTour` over *published* pins confirmed lit this season and on the
 * night it is offered for: the same rule as Build My Lights Tour, so a
 * display nobody has confirmed this year is never put on a drive. A drive
 * with fewer than two such stops is not offered, rather than padded; the
 * page counts the displays left out and says why.
 */
export interface Drive {
  readonly id: string;
  readonly title: string;
  /** Where it starts: the town's centre — an estimate, never your position. */
  readonly area: string;
  readonly night: string;
  readonly minutes: number;
  readonly km: number;
  readonly stops: readonly { id: string; name: string; kind: Stop["kind"] }[];
  /** The page's own tour for these stops, shareable and editable. */
  readonly tourHref: string;
  /** Google Maps from wherever the person is to the last stop, via the rest. */
  readonly mapsHref: string;
}

interface Recipe {
  readonly id: string;
  readonly title: string;
  readonly area: string;
  readonly minutes: number;
  readonly style: TourStyle;
}

const RECIPES: readonly Recipe[] = [
  {
    id: "vernon",
    title: "Vernon at night",
    area: "vernon",
    minutes: 90,
    style: "best",
  },
  {
    id: "east-hill",
    title: "East Hill & downtown",
    area: "east-hill",
    minutes: 60,
    style: "most",
  },
  {
    id: "coldstream",
    title: "Coldstream and back",
    area: "coldstream",
    minutes: 75,
    style: "best",
  },
  {
    id: "armstrong",
    title: "Worth the drive: Armstrong",
    area: "armstrong",
    minutes: 90,
    style: "family",
  },
  {
    id: "lumby",
    title: "Worth the drive: Lumby",
    area: "lumby",
    minutes: 75,
    style: "best",
  },
  {
    id: "silverstar",
    title: "Silver Star village lights",
    area: "silverstar",
    minutes: 60,
    style: "best",
  },
  {
    id: "lake-country",
    title: "Lake Country lights",
    area: "lake-country",
    minutes: 75,
    style: "best",
  },
  {
    id: "kelowna",
    title: "Kelowna lights",
    area: "kelowna",
    minutes: 90,
    style: "best",
  },
];

const addDay = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Google Maps directions: no origin, so the phone starts from where it is. */
export function drivingFromHere(points: readonly LatLng[]): string {
  const pts = points.slice(0, 10);
  const fmt = (p: LatLng) => `${p.lat},${p.lng}`;
  const u = new URL("https://www.google.com/maps/dir/");
  u.searchParams.set("api", "1");
  u.searchParams.set("destination", fmt(pts[pts.length - 1]!));
  if (pts.length > 1)
    u.searchParams.set("waypoints", pts.slice(0, -1).map(fmt).join("|"));
  u.searchParams.set("travelmode", "driving");
  return u.toString();
}

export function suggestedDrives(
  published: readonly PinView[],
  today: string,
): readonly Drive[] {
  const prior = priorMean([...published]);
  const out: Drive[] = [];
  const seen = new Set<string>();
  for (const r of RECIPES) {
    const area = areaById(r.area);
    if (!area) continue;
    // The first night in the next four weeks with two or more lit stops.
    for (let i = 0; i < 28; i++) {
      const night = addDay(today, i);
      const stops = published
        .filter(
          (p) =>
            p.status === "approved" &&
            p.season === "lit" &&
            onThatDay(p, night),
        )
        .map(toStop);
      const tour = buildTour(
        {
          from: area.at,
          mode: "drive",
          minutes: r.minutes,
          stops: 5,
          prefer: [],
          festive: true,
          style: r.style,
          prior,
        },
        stops,
      );
      if (tour.stops.length < 2) continue;
      const key = tour.stops
        .map((t) => t.stop.id)
        .sort()
        .join("|");
      if (seen.has(key)) break;
      seen.add(key);
      const points = tour.stops.map((t) => t.stop.at);
      out.push({
        id: r.id,
        title: `Around ${area.label}`,
        area: area.label,
        night,
        minutes: tour.minutes,
        km: Math.round(tour.km),
        stops: tour.stops.map((t) => ({
          id: t.stop.id,
          name: t.stop.name,
          kind: t.stop.kind,
        })),
        tourHref: `/christmas/lights/tour?${tourQuery({
          from: area.at,
          mode: "drive",
          stops: tour.stops.map((t) => t.stop.id),
          minutes: r.minutes,
        })}`,
        mapsHref: drivingFromHere(points),
      });
      break;
    }
  }
  return out;
}

export const driveLength = (d: Drive) => clockText(d.minutes);
