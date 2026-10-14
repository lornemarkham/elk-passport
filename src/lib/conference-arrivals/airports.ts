import "server-only";
import type { Airport } from "@/domain/conference-arrivals/matching";
import { distanceKm } from "@/domain/conference-arrivals/geo";
import { AIRPORTS } from "./airports-data";

/**
 * **Airports, by the code on a boarding pass.** OurAirports' large and medium
 * scheduled-service airports (public domain), baked by
 * `scripts/conference-arrivals/build-airports.mjs`.
 */

interface Row extends Airport {
  readonly large: boolean;
  readonly country: string;
}

let table: Row[] | null = null;
function rows(): Row[] {
  return (table ??= AIRPORTS.split("\n").map((line) => {
    const [iata, icao, lat, lon, size, country, city, name] = line.split("|");
    return {
      iata: iata!,
      icao: icao!,
      lat: Number(lat),
      lon: Number(lon),
      large: size === "L",
      country: country!,
      city: city || null,
      name: name!,
    };
  }));
}

const plain = ({ large: _l, country: _c, ...a }: Row): Airport => {
  void _l;
  void _c;
  return a;
};

/** `YYZ`, `yyz`, `CYYZ` → Toronto Pearson. `null` when not a known airport. */
export function airportByCode(typed: string): Airport | null {
  const code = typed.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,4}$/.test(code)) return null;
  const hit = rows().find((a) =>
    code.length === 3 ? a.iata === code : a.icao === code,
  );
  return hit ? plain(hit) : null;
}

/**
 * **The airport a conference's people fly into**, derived from where the
 * conference is rather than written down as `YVR`: the nearest large
 * scheduled airport within 75 km of the town, else the nearest medium one.
 * `null` when Passport can't place the conference, and the module says so.
 */
export function arrivalAirportNear(place: {
  lat: number;
  lon: number;
}): Airport | null {
  const near = rows()
    .map((a) => ({ a, km: distanceKm(place, a) }))
    .filter((x) => x.km <= 75)
    .sort((x, y) => Number(y.a.large) - Number(x.a.large) || x.km - y.km);
  return near[0] ? plain(near[0].a) : null;
}
