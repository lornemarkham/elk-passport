// Drives a LOCAL dev server through the access matrix as four people. See docs/admin-workbench.md.
// Start the app with the env shown there (stub Supabase :3188, stub Atlas :3189), then: node scripts/admin/e2e-check.mjs
import { start, sessionCookie, atlasCalls } from "./e2e-stubs.mjs";
start({ supabasePort: 3188, atlasPort: 3189 });
const BASE = process.env.BASE ?? "http://localhost:3187";
const who = {
  stranger: undefined,
  visitor: sessionCookie("tok-visitor"),
  unverified: sessionCookie("tok-unverified"),
  admin: sessionCookie("tok-admin"),
};
const get = async (path, cookie, init = {}) => {
  const r = await fetch(BASE + path, {
    redirect: "manual",
    ...init,
    headers: { ...(cookie ? { cookie } : {}), ...(init.headers ?? {}) },
  });
  return {
    status: r.status,
    loc: r.headers.get("location"),
    text: await r.text(),
  };
};
const rows = [];
for (const [name, cookie] of Object.entries(who)) {
  for (const p of [
    "/admin",
    "/admin/entities",
    "/admin/review",
    "/admin/regions",
    "/admin/knowledge",
    "/admin/runs",
    "/admin/entities/abc",
    "/explorer",
  ]) {
    const before = atlasCalls.length;
    const r = await get(p, cookie);
    rows.push(
      `${name.padEnd(10)} ${p.padEnd(24)} ${r.status} ${r.loc ?? ""}${p === "/api/session/admin" ? " " + r.text : ""} atlasCalls+${atlasCalls.length - before}`,
    );
  }
  const before = atlasCalls.length;
  const m = await get("/api/admin/merge", cookie, {
    method: "POST",
    body: JSON.stringify({ survivingId: "a", absorbedIds: ["b"] }),
    headers: { "content-type": "application/json" },
  });
  rows.push(
    `${name.padEnd(10)} POST /api/admin/merge      ${m.status} atlasCalls+${atlasCalls.length - before}`,
  );
}
console.log(rows.join("\n"));
const merge = atlasCalls.find((c) => c.url.startsWith("/admin/merge"));
console.log("\nAtlas saw merge:", JSON.stringify(merge));
const leaks = [];
for (const [name, cookie] of Object.entries(who)) {
  const r = await get("/admin", cookie);
  if (r.text.includes("live-secret-xyz")) leaks.push(name + " /admin");
}
const home = await get("/discovery");
if (
  home.text.includes("live-secret-xyz") ||
  home.text.includes("curator@example.com")
)
  leaks.push("discovery");
console.log("secret/email in any HTML:", leaks.length ? leaks : "none");
process.exit(0);
