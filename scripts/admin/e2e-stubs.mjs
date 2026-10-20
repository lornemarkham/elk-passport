// Local-only stand-ins so the curator workbench's gate can be exercised end to
// end without Supabase or Atlas credentials: a GoTrue stub that knows two
// users, and an Atlas stub that records what Passport sent it.
//
//   node scripts/admin/e2e-stubs.mjs   # prints the ports and cookie values
import http from "node:http";

const USERS = {
  "tok-admin": {
    id: "u1",
    email: "curator@example.com",
    email_confirmed_at: "2026-01-01T00:00:00Z",
  },
  "tok-visitor": {
    id: "u2",
    email: "visitor@example.com",
    email_confirmed_at: "2026-01-01T00:00:00Z",
  },
  "tok-unverified": {
    id: "u3",
    email: "curator@example.com",
    email_confirmed_at: null,
  },
};
const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

export const atlasCalls = [];

export function start({ supabasePort, atlasPort }) {
  const supabase = http
    .createServer((req, res) => {
      if (req.url.startsWith("/auth/v1/user")) {
        const token = (req.headers.authorization ?? "").replace("Bearer ", "");
        const u = USERS[token];
        return u
          ? json(res, 200, {
              ...u,
              aud: "authenticated",
              role: "authenticated",
              app_metadata: {},
              user_metadata: {},
              created_at: "2026-01-01T00:00:00Z",
            })
          : json(res, 401, { message: "invalid" });
      }
      json(res, 404, {});
    })
    .listen(supabasePort);
  const atlas = http
    .createServer((req, res) => {
      atlasCalls.push({
        method: req.method,
        url: req.url,
        adminToken: req.headers["x-admin-token"],
        auth: req.headers.authorization,
      });
      if (req.url.startsWith("/admin/duplicates"))
        return json(res, 200, {
          groups: [],
          scannedAt: "2026-10-20T00:00:00Z",
          countsByKind: { Place: 0, Organization: 0, Activity: 0, Event: 0 },
        });
      if (req.url.startsWith("/admin/merge"))
        return json(res, 200, { merged: true });
      if (req.url.startsWith("/admin/runs"))
        return json(res, 200, { runs: [] });
      const path = req.url.split("?")[0];
      if (
        [
          "/admin/entities",
          "/admin/source-records",
          "/admin/relationships",
          "/admin/relationship-candidates",
          "/admin/research-missions",
          "/admin/candidate-sources",
          "/admin/merge-records",
        ].includes(path)
      )
        return json(res, 200, []);
      if (path === "/admin/regions")
        return json(res, 200, { regions: [], unassignedIds: [] });
      if (req.url.startsWith("/admin/")) return json(res, 200, {});
      json(res, 200, {});
    })
    .listen(atlasPort);
  return { supabase, atlas };
}

export function sessionCookie(token, supabasePort) {
  const session = {
    access_token: token,
    refresh_token: "r",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: USERS[token],
  };
  const name = "sb-127-auth-token"; // @supabase/ssr: first label of the project host
  void supabasePort;
  return `${name}=base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start({ supabasePort: 3188, atlasPort: 3189 });
  console.log("supabase stub :3188, atlas stub :3189");
}
