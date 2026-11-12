import { DISCOVERY_TOWNS, townById } from "@/domain/discovery/towns";
import type { DiscoveryTown } from "@/domain/discovery/towns";

/**
 * **One person's place, remembered once for every Passport experience.**
 *
 * Only town ids are kept — never a coordinate (ADR 002, `useHere`): a device
 * position is mapped to the nearest covered town and the town is what is
 * remembered. An id that is no longer a covered town is dropped on read, so a
 * stale device never produces an origin Passport cannot name.
 *
 * Three different things are kept apart, because collapsing them is how
 * "Explore Vancouver for a weekend" used to move somebody's home:
 *
 * ```
 * home          the place they said is theirs        (explicit, never implied)
 * exploring     the last place they chose to look at (what launch opens on)
 * destinations  a place chosen for one experience only ("Christmas, in Kelowna")
 * ```
 */
export interface LocationPrefs {
  readonly home?: string;
  readonly exploring?: string;
  readonly recent: readonly string[];
  readonly destinations: Readonly<Record<string, string>>;
}

export const EMPTY_PREFS: LocationPrefs = { recent: [], destinations: {} };

export const STORAGE_KEY = "ghad.location.v1";
const RECENT_LIMIT = 5;

/** What the place on screen rests on. Said out loud wherever it is shown. */
export type LocationSource =
  | "chosen" // they picked it (or an experience's destination)
  | "home" // their saved home
  | "device" // the browser's already-granted position, mapped to a town
  | "approximate" // a regional guess; never presented as precise
  | "default"; // nothing known: the region Passport launched in

/** Nothing is known about a visitor: the Okanagan, labelled as a guess. */
export const FALLBACK_TOWN_ID = "vernon";

/** How far a device or network position may be from a town and still map to it. */
export const DEVICE_MAX_KM = 80;
export const APPROXIMATE_MAX_KM = 150;

const known = (id: unknown): id is string =>
  typeof id === "string" && townById(id) !== undefined;

/** Read stored text, trusting nothing about it. */
export function parsePrefs(raw: string | null | undefined): LocationPrefs {
  if (!raw) return EMPTY_PREFS;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!value || typeof value !== "object") return EMPTY_PREFS;
    const destinations: Record<string, string> = {};
    const stored = value["destinations"];
    if (stored && typeof stored === "object") {
      for (const [scope, id] of Object.entries(stored)) {
        if (known(id) && /^[a-z0-9-]{1,32}$/.test(scope))
          destinations[scope] = id;
      }
    }
    const recent = Array.isArray(value["recent"])
      ? value["recent"].filter(known).slice(0, RECENT_LIMIT)
      : [];
    return {
      ...(known(value["home"]) ? { home: value["home"] } : {}),
      ...(known(value["exploring"]) ? { exploring: value["exploring"] } : {}),
      recent,
      destinations,
    };
  } catch {
    return EMPTY_PREFS;
  }
}

export const serialisePrefs = (prefs: LocationPrefs): string =>
  JSON.stringify(prefs);

const remember = (recent: readonly string[], id: string): readonly string[] =>
  [id, ...recent.filter((r) => r !== id)].slice(0, RECENT_LIMIT);

/**
 * They chose a place.
 *
 * Shared by default — it becomes what every experience opens on. With a
 * `scope` it is that experience's destination only, and **home and the shared
 * place are left exactly as they were**.
 */
export function choose(
  prefs: LocationPrefs,
  townId: string,
  scope?: string,
): LocationPrefs {
  if (!known(townId)) return prefs;
  const recent = remember(prefs.recent, townId);
  if (scope) {
    return {
      ...prefs,
      recent,
      destinations: { ...prefs.destinations, [scope]: townId },
    };
  }
  // A shared choice also ends any experience-only destinations: "Change"
  // on the Christmas bar means "I'm somewhere else now", and one place that
  // answers for every experience is the point of the shared state.
  return { ...prefs, exploring: townId, recent, destinations: {} };
}

export function setHome(prefs: LocationPrefs, townId: string): LocationPrefs {
  return known(townId) ? { ...prefs, home: townId } : prefs;
}

export function clearHome(prefs: LocationPrefs): LocationPrefs {
  const { home: _home, ...rest } = prefs;
  void _home;
  return rest;
}

/** Back to the shared place for one experience. */
export function clearDestination(
  prefs: LocationPrefs,
  scope: string,
): LocationPrefs {
  const { [scope]: _gone, ...destinations } = prefs.destinations;
  void _gone;
  return { ...prefs, destinations };
}

/**
 * What the visitor has said, in the order the brief gives: this experience's
 * destination, then the place they last chose, then their saved home.
 * `undefined` means they have said nothing and the caller must look further
 * (an already-granted browser position, then an approximate region).
 */
export function saved(
  prefs: LocationPrefs,
  scope?: string,
): { readonly townId: string; readonly source: "chosen" | "home" } | undefined {
  const destination = scope ? prefs.destinations[scope] : undefined;
  if (known(destination)) return { townId: destination, source: "chosen" };
  if (known(prefs.exploring))
    return { townId: prefs.exploring, source: "chosen" };
  if (known(prefs.home)) return { townId: prefs.home, source: "home" };
  return undefined;
}

// ── Searching and measuring ─────────────────────────────────────────────

const plain = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/,?\s*bc$/, "")
    .trim();

/**
 * Towns matching what somebody typed: name or alias starting with it first,
 * then containing it, then the area it is in ("okanagan"). Empty text matches
 * nothing — a list of every town is not an answer to a question not asked.
 */
export function searchTowns(
  query: string,
  limit = 8,
): readonly DiscoveryTown[] {
  const q = plain(query);
  if (!q) return [];
  const score = (town: DiscoveryTown): number => {
    const names = [plain(town.name), ...(town.aliases ?? []).map(plain)];
    if (names.some((n) => n.startsWith(q))) return 0;
    if (names.some((n) => n.split(/[\s-]+/).some((w) => w.startsWith(q))))
      return 1;
    if (names.some((n) => n.includes(q))) return 2;
    if (plain(town.area).includes(q)) return 3;
    return 4;
  };
  return DISCOVERY_TOWNS.map((town, order) => ({
    town,
    order,
    s: score(town),
  }))
    .filter((r) => r.s < 4)
    .sort((a, b) => a.s - b.s || a.order - b.order)
    .slice(0, limit)
    .map((r) => r.town);
}

interface Point {
  readonly latitude: number;
  readonly longitude: number;
}

/** The covered town nearest a point, if one is within `maxKm`. */
export function nearestCovered(
  point: Point,
  distance: (a: Point, b: Point) => number,
  maxKm: number,
): { readonly town: DiscoveryTown; readonly km: number } | undefined {
  let best: { town: DiscoveryTown; km: number } | undefined;
  for (const town of DISCOVERY_TOWNS) {
    const km = distance(point, town);
    if (!best || km < best.km) best = { town, km };
  }
  return best && best.km <= maxKm ? best : undefined;
}

/** "Vernon, BC" → "Vernon": the form a sentence wants. */
export const shortName = (town: Pick<DiscoveryTown, "name">): string =>
  town.name.replace(/,\s*BC$/, "");
