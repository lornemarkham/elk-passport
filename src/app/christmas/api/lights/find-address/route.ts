import { NextResponse } from "next/server";
import { AREA, inArea } from "@/domain/christmas/lights/model";
import {
  clientKey,
  rateLimiter,
  tooManyRequests,
} from "@/lib/server/rateLimit";

export const dynamic = "force-dynamic";

/**
 * **Search an address** for step 1 of adding lights. The address only moves
 * the pin on the person's own map — they see it, drag it, and send the
 * point; nothing found here is stored or shown to anyone else. OpenStreetMap
 * Nominatim (the map's own data, no key), bounded to the map's towns, at its
 * usage policy's pace: one search a second for the whole server, results
 * remembered for a day. When it can't answer, the person moves the pin.
 */
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const UA =
  "GoHaveADay-ChristmasLights/1.0 (+https://gohaveaday.com/christmas/lights)";

const g = globalThis as unknown as {
  __lightsGeo?: {
    limit: ReturnType<typeof rateLimiter>;
    cache: Map<string, { at: number; found: Found[] }>;
    last: number;
  };
};
const state = () =>
  (g.__lightsGeo ??= {
    limit: rateLimiter({
      limits: [
        { max: 6, windowMs: 60_000 },
        { max: 40, windowMs: 3_600_000 },
      ],
    }),
    cache: new Map(),
    last: 0,
  });

interface Found {
  readonly label: string;
  readonly lat: number;
  readonly lng: number;
}

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  if (q.length < 3)
    return NextResponse.json({ found: [], error: "Type a street or place." });
  const s = state();
  const key = q.toLowerCase();
  const hit = s.cache.get(key);
  if (hit && Date.now() - hit.at < 86_400_000)
    return NextResponse.json({ found: hit.found });
  const decision = s.limit.take(clientKey(request.headers));
  if (!decision.ok) return tooManyRequests(decision.retryAfterSeconds);
  if (Date.now() - s.last < 1100)
    return NextResponse.json(
      { found: [], error: "Busy for a moment — try again." },
      { status: 503 },
    );
  s.last = Date.now();
  const url = new URL(NOMINATIM);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", q);
  url.searchParams.set("countrycodes", "ca");
  url.searchParams.set(
    "viewbox",
    `${AREA.west},${AREA.north},${AREA.east},${AREA.south}`,
  );
  url.searchParams.set("bounded", "1");
  url.searchParams.set("limit", "5");
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "en-CA" },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) throw new Error(String(r.status));
    const rows = (await r.json()) as {
      display_name?: string;
      lat?: string;
      lon?: string;
    }[];
    const found: Found[] = rows
      .map((x) => ({
        label: String(x.display_name ?? "")
          .split(",")
          .slice(0, 3)
          .join(",")
          .trim(),
        lat: Number(x.lat),
        lng: Number(x.lon),
      }))
      .filter(
        (x) =>
          x.label &&
          Number.isFinite(x.lat) &&
          Number.isFinite(x.lng) &&
          inArea(x),
      );
    if (s.cache.size > 500) s.cache.clear();
    s.cache.set(key, { at: Date.now(), found });
    return NextResponse.json({ found });
  } catch {
    return NextResponse.json(
      {
        found: [],
        error: "Address search isn't answering — move the pin instead.",
      },
      { status: 502 },
    );
  }
}
