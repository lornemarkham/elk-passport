import type { ArenaGate } from "./arena";

/**
 * **Walking directions, handed to the map app the person already trusts.**
 *
 * Passport does not route people itself. It hands the two ends to Google
 * Maps or Apple Maps, which do — outdoors. Inside the arena nobody routes:
 * Passport holds no indoor map, so it says which level a section is on (from
 * the arena's own map) and stops there.
 *
 * ## Where the directions end
 *
 * At a gate only when that gate has a verified point (`ArenaGate.at`). None
 * does yet, so today every link ends at the arena, and `destination.because`
 * says why in words the screen shows. Adding a verified point for a gate
 * changes where the link ends and nothing else.
 */

export interface Point {
  readonly latitude: number;
  readonly longitude: number;
}

export interface Destination {
  readonly name: string;
  readonly at: Point;
  /** The gate the links end at, when they do. */
  readonly gate?: string;
  /** Why the links do not end at the gate the person chose. */
  readonly because?: string;
}

export function destinationFor(
  venue: { readonly name: string; readonly at: readonly [number, number] },
  gate: ArenaGate | undefined,
): Destination {
  if (gate?.at) {
    return {
      name: `${venue.name}, ${gate.name}`,
      at: { latitude: gate.at[0], longitude: gate.at[1] },
      gate: gate.name,
    };
  }
  return {
    name: venue.name,
    at: { latitude: venue.at[0], longitude: venue.at[1] },
    ...(gate
      ? {
          because: `Passport has no verified location for ${gate.name}, so directions end at ${venue.name}. ${gate.name} is ${lower(gate.where)}.`,
        }
      : {}),
  };
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

const ll = (p: Point) => `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`;

export interface MapLink {
  readonly app: "google" | "apple";
  readonly label: string;
  readonly href: string;
}

/**
 * Walking directions in both apps. With no `from`, each app starts from
 * wherever the phone is, which is what "from here" means.
 */
export function walkingLinks(
  to: Destination,
  from?: { readonly name: string; readonly at: Point },
): MapLink[] {
  const google = new URLSearchParams({
    api: "1",
    destination: ll(to.at),
    travelmode: "walking",
  });
  if (from) google.set("origin", ll(from.at));
  const apple = new URLSearchParams({ daddr: ll(to.at), dirflg: "w" });
  if (from) apple.set("saddr", ll(from.at));
  return [
    {
      app: "google",
      label: "Google Maps",
      href: `https://www.google.com/maps/dir/?${google}`,
    },
    {
      app: "apple",
      label: "Apple Maps",
      href: `https://maps.apple.com/?${apple}`,
    },
  ];
}

/** Apple first on an iPhone or iPad, Google first everywhere else. */
export function preferredOrder(
  links: readonly MapLink[],
  userAgent: string,
): MapLink[] {
  const apple = /iPhone|iPad|iPod|Macintosh.*Mobile/.test(userAgent);
  return [...links].sort((a, b) =>
    apple
      ? Number(b.app === "apple") - Number(a.app === "apple")
      : Number(b.app === "google") - Number(a.app === "google"),
  );
}
