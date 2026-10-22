# Atlas Curator Workbench — access, configuration, activation

The workbench is Passport's operator surface for Atlas: Duplicate Review
(`/admin/duplicates`), Content Explorer (`/admin/explorer`, plus the unfiltered
`/explorer` dossiers), Entity Workspace (`/admin/entities`), Ingestion
Observatory (`/admin/runs`), the Curator Queue (`/admin/review`), and the
Regions and Knowledge Domain pages. Everything under `/admin`, `/explorer` and
`/api/admin/*` is **administrator-only**.

## The security model

Two separate claims, neither substituting for the other:

| Claim                                   | Mechanism                                                                 | Where it lives                 |
| --------------------------------------- | ------------------------------------------------------------------------- | ------------------------------ |
| _This person may operate the workbench_ | Supabase sign-in + verified email in `ADMIN_EMAILS`                       | `src/lib/admin/adminPolicy.ts` |
| _Passport may change Atlas's corpus_    | `ADMIN_TOKEN` (`x-admin-token`) + `ATLAS_SERVICE_TOKEN` (`Authorization`) | server only, `atlasAuth.ts`    |

- **Fail closed.** `ADMIN_EMAILS` unset or empty admits nobody. An unverified
  address is refused even when listed.
- **Every layer checks for itself** (`src/lib/admin/requireAdmin.ts`): each
  `/api/admin/*` handler, each admin/explorer page, each admin server action
  and the page metadata that reads Atlas. A layout is not relied on (Next may
  skip a layout on a partial render), and `middleware.ts` is **not** relied on
  (see _Known issue_ below). `ADMIN_TOKEN` is attached to the outgoing Atlas
  request only after the check passes.
- **Refusals:** signed out → page redirects to `/auth?next=…`, API `401`;
  signed in but not approved/unverified/unconfigured → page `404`, API `403`.
- **No public mutations.** Every POST proxy (`merge`, `duplicates/distinct`,
  `candidate-sources/*`, `relationships*`, `relationship-candidates/*/confirm|reject`,
  `entities/*/set-type`, `regions/*/grow|members`) sits behind the same gate.
- **Secrets stay on the server.** `ADMIN_TOKEN`, `ADMIN_EMAILS` and
  `ATLAS_SERVICE_TOKEN` are not `NEXT_PUBLIC_*`. The nav entry asks
  `GET /api/session/admin` (`{admin: boolean}`, about the caller only) instead
  of reading a public allowlist. `NEXT_PUBLIC_ADMIN_EMAILS` is no longer read;
  **unset it** — it would publish addresses to every visitor.
- **Atlas location** is `ATLAS_API_URL` everywhere (`ATLAS_BASE_URL` in
  `atlasAuth.ts`). The 26 proxy routes and `regions.ts` used to hardcode
  `http://localhost:3000`.

## Production environment variables

| Variable                        | Required | Notes                                                                                 |
| ------------------------------- | -------- | ------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | yes      | Sign-in. Public by design.                                                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes      | Public by design.                                                                     |
| `ADMIN_EMAILS`                  | yes      | Comma-separated administrator emails. Server-only.                                    |
| `ADMIN_TOKEN`                   | yes      | Must equal the value **Atlas** expects. Server-only. Never `NEXT_PUBLIC_`.            |
| `ATLAS_SERVICE_TOKEN`           | yes      | Must equal Atlas's service token. Server-only.                                        |
| `ATLAS_API_URL`                 | yes      | Reachable Atlas origin, e.g. `https://atlas.example.com`. No trailing `/`, no `/api`. |

`GET /api/admin/environment` (administrators only) reports which of these are
missing **by name, never value**, and warns about a localhost Atlas in
production or a stray public admin variable.

## Production activation checklist

Nothing below has been done. This candidate was not deployed and no secret was
read, set or changed.

1. **Atlas first.** Confirm Atlas production is reachable from Passport's
   region and answers `/admin/*` to `Authorization: Bearer $ATLAS_SERVICE_TOKEN`
   **and** `x-admin-token: $ADMIN_TOKEN`. (Per project notes, prod Passport
   previously could not reach Atlas: settle where Atlas runs and its URL.)
2. **Choose administrators.** Decide the exact list for `ADMIN_EMAILS`. Each
   must already have a Supabase account with a **confirmed** email.
3. **Set the variables** in the Passport Vercel project (Production), values
   from Atlas's own environment: `ATLAS_API_URL`, `ATLAS_SERVICE_TOKEN`,
   `ADMIN_TOKEN`, `ADMIN_EMAILS`. Confirm `NEXT_PUBLIC_ADMIN_EMAILS` and any
   `NEXT_PUBLIC_*TOKEN*` are **absent**.
4. **Deploy a preview first** with the same variables. Then verify, in order:
   - signed out: `/admin`, `/explorer` redirect to sign-in; `curl -i
https://<preview>/api/admin/duplicates` → `401` (and
     `-X POST …/api/admin/merge` → `401`);
   - signed in as a **non-listed** account: pages `404`, API `403`;
   - signed in as an **administrator**: `/api/admin/environment` →
     `{"ready":true,"missing":[],"warnings":[]}`; each of Duplicate Review,
     Content Explorer, Entity Workspace, Ingestion Observatory, Curator Queue
     loads real data;
   - view source of any public page and of `/admin`: neither `ADMIN_TOKEN`
     nor an admin email appears.
5. **Promote** the preview. Re-run the unauthenticated `curl` checks on the
   production host.
6. **Rollback** is promoting the previous deployment; with `ADMIN_EMAILS`
   removed the whole workbench closes without a deploy.
7. Recommended, not done here: require MFA for administrator accounts in
   Supabase; rotate `ADMIN_TOKEN` if it was ever exposed by the earlier open
   proxy routes.

## Known issue found while restoring (decision needed)

`middleware.ts` sits at the repository root while the app lives under `src/`.
Next only loads `src/middleware.ts` (or `proxy.ts`) in that layout, so the file
**does not execute** (verified: a probe response added to it never fires). The
session-cookie refresh and host rewrites it describes are therefore dormant in
this build. This work deliberately does not depend on it and does not move it:
activating it would switch on behaviour nobody has tested here. Whoever owns it
should decide whether to move it to `src/`.

_Update, 2026-10-21 (admin security repair):_ the `integration/release` build
now lists `ƒ Proxy (Middleware)` and emits `.next/server/middleware-manifest.json`,
and production's experience domains depend on its rewrites, so the claim above
looks out of date. Nothing here depends on it either way: every gate is in
the page, handler or action itself.

## Also noted, deliberately unchanged

- `listRegions()` (Discovery scoping) reads Atlas's `/admin/regions` with
  `ADMIN_TOKEN` server-side for every visitor. It is read-only, cached, and
  keeps only each region's id and name, which Discovery shows anyway. Note for
  activation: setting `ADMIN_TOKEN` in production is what switches Discovery
  scoping on (one region scopes the feed; more than one scopes nothing unless
  `ACTIVE_REGION_ID` picks one).
- `/passport/[id]` used to read the whole admin corpus bundle with
  `ADMIN_TOKEN` (archived records and sources included) for anyone who added
  `?curator=1`, and for any id Atlas could not compose. Since the admin
  security repair (2026-10-21) the curator instruments and that bundle are for
  administrators only (`adminVerdictForRequest`). A traveller gets the composed
  read or the Discovery candidate, as production already does without
  `ADMIN_TOKEN`. `adminAccess.test.ts` keeps every other `ADMIN_TOKEN` reader
  outside the workbench behind the same gate.
- `/conferences/[id]/admin` is a separate, conference-owner surface.

## Testing

- `npx vitest run src/lib/admin src/app/api/admin` — policy unit tests; every
  `/api/admin/*` handler (discovered by glob) driven as a stranger, a signed-in
  non-administrator, an unverified listed address, and with `ADMIN_EMAILS`
  unset (must be `401/403` with **zero** Atlas calls); an administrator reaches
  Atlas with `x-admin-token` and `Authorization` attached server-side;
  structural checks (no localhost Atlas, every handler/page/action gated, no
  client code reads a secret).
- `scripts/admin/e2e-check.mjs` — end to end against a running dev server with
  stub Supabase and stub Atlas (`scripts/admin/e2e-stubs.mjs`):
  ```
  NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3188 NEXT_PUBLIC_SUPABASE_ANON_KEY=anon \
  ADMIN_TOKEN=live-secret-xyz ADMIN_EMAILS=curator@example.com \
  ATLAS_API_URL=http://127.0.0.1:3189 ATLAS_SERVICE_TOKEN=svc-token \
  npx next dev -p 3187
  node scripts/admin/e2e-check.mjs
  ```
