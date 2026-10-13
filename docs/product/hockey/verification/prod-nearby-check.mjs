#!/usr/bin/env node
/**
 * **What does production Atlas hold near Rogers Arena? — no credentials.**
 *
 * `/go` server-renders Passport's whole Discovery corpus into the page (it is
 * "all of it", see `src/app/go/page.tsx`), so the public page is a window onto
 * what Atlas answers to Passport. This reads that page and applies the same
 * rule as `src/domain/hockey/nearby.ts`: an Eat & drink subtype, observed
 * coordinates, within 1.6 km of the venue, nearest first.
 *
 *   node docs/product/hockey/verification/prod-nearby-check.mjs [origin]
 *
 * Default origin is https://elk-passport.vercel.app. Exits 1 when Rogers Arena
 * is missing or fewer than three places qualify, so it can gate the Friday
 * check. It is a coarse reader of an escaped RSC payload, not a parser of
 * Atlas's contract: trust the count and the names, not the field shapes.
 */
const origin = (process.argv[2] ?? "https://elk-passport.vercel.app").replace(
  /\/$/,
  "",
);
const VENUE = [49.2778, -123.1088]; // [lat, lng] — same as the night's `venueAt`
const WITHIN_KM = 1.6;
// A subset of Discovery's "Eat & drink" subtypes (src/domain/discovery/intents.ts).
const EAT = new Set([
  "restaurant",
  "bistro",
  "cafe",
  "café",
  "coffee shop",
  "coffee roaster",
  "bakery",
  "bar",
  "pub",
  "brewery",
]);

const res = await fetch(`${origin}/go`);
if (!res.ok) {
  console.error(`${origin}/go answered ${res.status}`);
  process.exit(1);
}
const html = (await res.text()).replace(/\\"/g, '"');

const km = ([lng, lat]) =>
  6371 *
  Math.hypot(
    (((lng - VENUE[1]) * Math.PI) / 180) * Math.cos((VENUE[0] * Math.PI) / 180),
    ((lat - VENUE[0]) * Math.PI) / 180,
  );

const entities = html
  .split(/(?=\{"id":"[0-9a-f-]{36}","kind":")/)
  .slice(1)
  .flatMap((p) => {
    const title = p.match(/"title":"([^"]*)"/)?.[1];
    const subtype = p.match(/"subtype":"([^"]*)"/)?.[1];
    const g = p.match(
      /"geography":\{[^}]*"coordinates":\[(-?[\d.]+),(-?[\d.]+)\][^}]*\}/,
    );
    if (!title || !subtype || !g) return [];
    return [
      {
        title,
        subtype,
        observed: /"coordinatesBasis":"observed"/.test(g[0]),
        km: km([Number(g[1]), Number(g[2])]),
      },
    ];
  });

const arena = entities.find((e) => e.title === "Rogers Arena");
const food = entities
  .filter(
    (e) => EAT.has(e.subtype.toLowerCase()) && e.observed && e.km <= WITHIN_KM,
  )
  .sort((a, b) => a.km - b.km);

console.log(`${origin}: ${entities.length} located entities`);
console.log(
  arena
    ? `Rogers Arena: present (${arena.subtype}), ${arena.km.toFixed(2)} km from the night's venue point`
    : "Rogers Arena: MISSING",
);
console.log(`Food & drink within ${WITHIN_KM} km: ${food.length}`);
for (const f of food.slice(0, 12)) {
  console.log(
    `  ${f.km.toFixed(2)} km  ${f.title.replace(/\\u0026/g, "&")}  (${f.subtype})`,
  );
}
process.exit(arena && food.length >= 3 ? 0 : 1);
