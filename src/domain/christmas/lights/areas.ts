import { metres } from "./actions";
import { TOWN_LABEL, type LatLng, type PinView } from "./model";
import { placeById } from "@/domain/environment/places";

/**
 * **The places a family says "around here" about** — the map's row of
 * places and Build My Lights Tour's _Where?_. Towns are October's own
 * Wikidata-checked centres (`domain/environment/places.ts`), reused by id
 * rather than copied; the Vernon neighbourhoods are points checked for this
 * page (sources beside each). A circle round a centre is deliberately rough:
 * it says "about East Hill", it doesn't draw East Hill's boundary, and it
 * is never a fact stored on a pin. Atlas owns places; this only groups
 * Passport's lights pins for a family to choose between.
 */
export interface Area {
  readonly id: string;
  readonly label: string;
  readonly at: LatLng;
  /** How far from the centre counts as "in" it. */
  readonly km: number;
  /** A neighbourhood inside a town, rather than a town. */
  readonly within?: string;
  /** Offered in the map's row of places. */
  readonly onMap: boolean;
}

const town = (id: string, km: number, onMap = true): Area => {
  const p = placeById(id);
  if (!p) throw new Error(`no such place: ${id}`);
  return {
    id,
    label: p.name.replace(/, BC$/, ""),
    at: { lat: p.latitude, lng: p.longitude },
    km,
    onMap,
  };
};

const hood = (
  id: string,
  label: string,
  lat: number,
  lng: number,
  within: string,
  km = 1.3,
  onMap = false,
): Area => ({ id, label, at: { lat, lng }, km, within, onMap });

/**
 * Vernon's neighbourhoods and Lavington: OpenStreetMap `place` nodes, read
 * 2026-11-14 (node id on each line). BX / Swan Lake has no node and is left
 * out rather than guessed.
 */
const NEIGHBOURHOODS: readonly Area[] = [
  hood("east-hill", "East Hill", 50.26506, -119.25493, "vernon", 1.4, true), // 12102711359
  hood("downtown-vernon", "Downtown", 50.26672, -119.2683, "vernon", 0.9), // 12102711365
  hood("mission-hill", "Mission Hill", 50.25492, -119.28418, "vernon"), // 12102711356
  hood("harwood", "Harwood", 50.27546, -119.25184, "vernon", 0.9), // 12102711360
  hood("middleton", "Middleton Mountain", 50.24327, -119.25527, "vernon"), // 12102711358
  hood("foothills", "Foothills", 50.30489, -119.21847, "vernon", 1.8), // 12102711362
  hood(
    "okanagan-landing",
    "Okanagan Landing",
    50.25188,
    -119.31465,
    "vernon",
    2,
  ), // 1385445631
  hood("lavington", "Lavington", 50.23323, -119.10769, "coldstream", 2), // 1387990909
];

export const AREAS: readonly Area[] = [
  town("vernon", 7),
  town("coldstream", 6),
  ...NEIGHBOURHOODS,
  town("lumby", 5),
  town("armstrong", 5),
  town("enderby", 4, false),
  town("lake-country", 7, false),
  town("kelowna", 9),
];

export type AreaId = string;

export const areaById = (id: string | null | undefined): Area | undefined =>
  id ? AREAS.find((a) => a.id === id) : undefined;

export const inAreaOf = (area: Area, at: LatLng): boolean =>
  metres(area.at, at) <= area.km * 1000;

/** The neighbourhood a point is about, if it's close to one. */
export function neighbourhoodOf(at: LatLng): Area | undefined {
  return NEIGHBOURHOODS.filter((n) => inAreaOf(n, at)).sort(
    (a, b) => metres(a.at, at) - metres(b.at, at),
  )[0];
}

/** "East Hill, Vernon", or the pin's town when it's near no neighbourhood. */
export function placeLabel(pin: Pick<PinView, "at" | "town">): string {
  const n = neighbourhoodOf(pin.at);
  const town = TOWN_LABEL[pin.town];
  return n
    ? `${n.label}, ${n.within === pin.town ? town : (areaById(n.within)?.label ?? town)}`
    : town;
}
