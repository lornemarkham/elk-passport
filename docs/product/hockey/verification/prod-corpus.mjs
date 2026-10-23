#!/usr/bin/env node
/**
 * **Today's production corpus, as an Atlas candidates body — no credentials.**
 *
 * `/go` server-renders Passport's whole Discovery corpus into its RSC payload
 * (see `prod-nearby-check.mjs`). This reads that payload, pulls out every
 * candidate whole, and turns each one back from Passport's `Experience` shape
 * into Atlas's `/discovery/candidates` wire shape (the inverse of
 * `src/domain/experience/atlasMapper.ts`), so `atlas-seats-stub.mjs` can serve
 * it and the Hockey specs run on what Atlas holds today rather than an old
 * snapshot.
 *
 *   node docs/product/hockey/verification/prod-corpus.mjs <out.json> [origin]
 *   node docs/product/hockey/verification/atlas-seats-stub.mjs <out.json> 54340
 *
 * Limits, named: `schedule.onDate` is Atlas's reading for the day `/go` was
 * rendered, not for game day; `mediaCount` is only 1 or 0; React encodes a
 * missing value as the string `"$undefined"`, which is dropped here.
 */
import { writeFileSync } from "node:fs";

const [out, origin = "https://elk-passport.vercel.app"] = process.argv.slice(2);
if (!out) {
  console.error("usage: prod-corpus.mjs <out.json> [origin]");
  process.exit(2);
}
const res = await fetch(`${origin.replace(/\/$/, "")}/go`);
if (!res.ok) {
  console.error(`${origin}/go answered ${res.status}`);
  process.exit(1);
}
const html = await res.text();

// The RSC stream, joined from its `self.__next_f.push([1,"…"])` chunks.
let rsc = "";
const marker = "self.__next_f.push([1,";
for (let at = html.indexOf(marker); at !== -1; at = html.indexOf(marker, at)) {
  let i = at + marker.length + 1;
  for (; i < html.length; i++) {
    if (html[i] === "\\") i++;
    else if (html[i] === '"') break;
  }
  rsc += JSON.parse(html.slice(at + marker.length, i + 1));
  at = i;
}

// Every `{"id":"<uuid>","kind":"…` object, read whole by brace depth.
const found = new Map();
const start = /\{"id":"[0-9a-f-]{36}","kind":"/g;
for (let m; (m = start.exec(rsc));) {
  let depth = 0;
  let inString = false;
  let i = m.index;
  for (; i < rsc.length; i++) {
    const ch = rsc[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) break;
  }
  try {
    const o = JSON.parse(rsc.slice(m.index, i + 1), (_, v) =>
      v === "$undefined" ? undefined : v,
    );
    if (!o.title || !(o.geography || o.subtype)) continue;
    const prev = found.get(o.id);
    if (!prev || JSON.stringify(o).length > JSON.stringify(prev).length)
      found.set(o.id, o);
  } catch {
    // A fragment that is not a whole candidate.
  }
}

const CARRIED = [
  "context",
  "partOf",
  "availability",
  "geography",
  "knowledge",
  "environment",
  "suitability",
  "occurrence",
  "contextualMedia",
  "presentationImage",
  "schedule",
  "visitDuration",
  "startTime",
  "endTime",
  "timePrecision",
];
const candidates = [...found.values()].map((e) => {
  const c = {
    id: e.id,
    kind: e.kind,
    name: e.title,
    aliases: e.aliases ?? [],
    subtype: e.subtype,
    description: e.description ?? "",
    mediaCount: e.heroMedia ? 1 : 0,
    containsCount: e.containsCount ?? 0,
    regionIds: e.regionIds ?? [],
  };
  if (e.heroMedia?.src) c.heroUrl = e.heroMedia.src;
  if (e.location?.longitude != null)
    c.coordinates = [e.location.longitude, e.location.latitude];
  for (const k of CARRIED) if (e[k] !== undefined) c[k] = e[k];
  if (e.venue) c.location = e.venue;
  return c;
});
writeFileSync(out, JSON.stringify({ candidates }));
console.log(
  `${origin}: ${candidates.length} candidates, ` +
    `${candidates.filter((c) => c.presentationImage).length} with a presentationImage → ${out}`,
);
