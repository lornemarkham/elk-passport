// Extract the mapped Discovery experiences from a saved production page:
//   curl -s https://gohaveaday.com/ -o home.html
//   node scripts/vancouver/pool.mjs home.html pool.json
// The array is what `src/lib/ai/ask/vancouver.eval` reads as VAN_POOL.
import { readFileSync, writeFileSync } from "node:fs";
const [inp, out] = process.argv.slice(2);
const html = readFileSync(inp, "utf8");
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
const key = '"experiences":[';
const at = rsc.indexOf(key);
let i = at + key.length - 1,
  depth = 0,
  s = false;
for (; i < rsc.length; i++) {
  const c = rsc[i];
  if (s) {
    if (c === "\\") i++;
    else if (c === '"') s = false;
  } else if (c === '"') s = true;
  else if (c === "[" || c === "{") depth++;
  else if ((c === "]" || c === "}") && --depth === 0) break;
}
const arr = JSON.parse(rsc.slice(at + key.length - 1, i + 1), (_, v) =>
  v === "$undefined" ? undefined : v,
);
writeFileSync(out, JSON.stringify(arr));
console.log(arr.length, "experiences");
