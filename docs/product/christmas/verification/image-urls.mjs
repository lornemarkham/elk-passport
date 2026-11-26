#!/usr/bin/env node
/**
 * **Does every Christmas picture load?** (mission 1126)
 *
 *   node docs/product/christmas/verification/image-urls.mjs images.json [out.json]
 *
 * Reads what `src/domain/christmas/images.eval.test.ts` wrote and fetches each
 * picture Christmas would show (and each one it withholds), recording status,
 * content type, bytes and, for JPEG/PNG/WebP, pixel size — so broken links,
 * thumbnails and oversized originals are named rather than guessed.
 */
import { readFileSync, writeFileSync } from "node:fs";

const [input, out = "image-urls.json"] = process.argv.slice(2);
const d = JSON.parse(readFileSync(input, "utf8"));
const urls = new Map();
for (const f of d.everyFind) {
  if (f.shown) urls.set(f.shown, { id: f.id, title: f.title, shown: true });
  for (const w of f.withheld)
    if (!urls.has(w.src))
      urls.set(w.src, { id: f.id, title: f.title, shown: false });
}

function size(buf) {
  const b = Buffer.from(buf);
  if (b[0] === 0x89 && b[1] === 0x50)
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b.slice(8, 12).toString() === "WEBP") {
    const t = b.slice(12, 16).toString();
    if (t === "VP8X")
      return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
    if (t === "VP8 ")
      return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (t === "VP8L") {
      const n = b.readUInt32LE(21);
      return { w: 1 + (n & 0x3fff), h: 1 + ((n >> 14) & 0x3fff) };
    }
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m))
        return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return undefined;
}

async function check(url) {
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(20000),
      redirect: "follow",
    });
    const buf = await r.arrayBuffer();
    return {
      status: r.status,
      type: r.headers.get("content-type"),
      bytes: buf.byteLength,
      ...(size(buf) ?? {}),
    };
  } catch (e) {
    return { status: 0, error: String(e.cause?.code ?? e.name) };
  }
}

const list = [...urls.entries()];
const results = [];
for (let i = 0; i < list.length; i += 8) {
  const batch = await Promise.all(
    list
      .slice(i, i + 8)
      .map(async ([url, meta]) => ({ url, ...meta, ...(await check(url)) })),
  );
  results.push(...batch);
}
writeFileSync(out, JSON.stringify(results, null, 1));
const shown = results.filter((r) => r.shown);
const broken = shown.filter(
  (r) => r.status !== 200 || !/^image\//.test(r.type ?? ""),
);
const small = shown.filter((r) => r.w && r.w < 600);
const heavy = shown.filter((r) => r.bytes > 1_000_000);
console.log(
  `shown ${shown.length}: broken ${broken.length}, under 600px wide ${small.length}, over 1 MB ${heavy.length}`,
);
for (const r of broken)
  console.log("BROKEN", r.status, r.type, r.id.slice(0, 8), r.title, r.url);
for (const r of small)
  console.log("SMALL", `${r.w}x${r.h}`, r.id.slice(0, 8), r.title);
for (const r of heavy)
  console.log(
    "HEAVY",
    `${(r.bytes / 1e6).toFixed(1)}MB`,
    `${r.w}x${r.h}`,
    r.id.slice(0, 8),
    r.title,
  );
