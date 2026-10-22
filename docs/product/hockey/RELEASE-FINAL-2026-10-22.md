# Final Hockey release integration — 2026-10-22

Candidate: `feature/hockey` = `ab123fc` (integration/release: board docs, admin
security, Hockey redesign `f3b1aa3`) **merged with** the Hockey polish
(`56d87fd`, `b5eb736`, `62e79fd`). Nothing pushed, deployed or migrated.

## What `62e79fd` is

One line in `docs/product/hockey/verification/mobile.spec.ts`:
`n.textContent.trim()` → `(n.textContent ?? "").trim()` (a typecheck fix).
It carries **no product change**. The polish itself is `56d87fd` + `b5eb736`,
neither of which was in `ab123fc`; integrating "62e79fd" means integrating all
three.

## Changelog (what a user or operator sees)

- Restaurant photographs survive: `http://` heroes are requested over https,
  logos and icons no longer pass as photographs.
- Real, photographed places lead the dinner vote; the concourse is the
  alternative underneath. First Atlas read gets a time budget (`maxDuration`)
  and a retry instead of an empty vote.
- Phones (320/375/390): 12px minimum text, 40px tap targets.
- Already in `ab123fc`, preserved: Hockey Night game-day redesign; admin
  workbench closed to administrators (`ADMIN_EMAILS` + verified email),
  `/passport/[id]` gated, `/api/admin/environment`; board-ownership repair
  package (unapplied SQL).

## Verification (this checkout, port 3130, local stack — no real keys)

| Gate                                                  | Result                                                  |
| ----------------------------------------------------- | ------------------------------------------------------- |
| `tsc --noEmit`                                        | pass                                                    |
| `eslint .`                                            | 0 errors, 40 warnings (unused `_` params, pre-existing) |
| `prettier --check .`                                  | pass                                                    |
| `vitest run`                                          | 277 files / 3499 tests passed, 30 skipped               |
| `npm run build`                                       | pass                                                    |
| Hockey browser suite (real GoTrue/PostgREST/Postgres) | 9 passed, 2 skipped (see below)                         |
| `rls-attack.mjs`                                      | 53/53                                                   |
| `grants-check.sql`                                    | 4/4 OK                                                  |
| board-ownership `test-repair.mjs`                     | all checks passed                                       |

Hockey browser suite needs two Atlas modes: `acceptance` etc. run against
`atlas-stub.mjs`; `polish` and `redesign` need `scripts/critic/atlas-mock.mjs`
serving the real candidates body, **and a restarted `next start`** (the corpus
is cached; the first run of both failed on stub data, passed after the swap).

**Not run:** the repository-wide `npx playwright test` (Discovery, Saved,
Adventures, Conference, October). The merge only joins branches that were each
gated; the whole-repo run on the merged tree has not been done.

## Production environment (read from code and docs; nothing changed or read)

Hockey needs no new variable. Required as before: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (same project the migration is applied to),
`ATLAS_API_URL` (no trailing `/`, no `/api`), `ATLAS_SERVICE_TOKEN`.
Admin workbench additionally needs `ADMIN_EMAILS`, `ADMIN_TOKEN`; and
`NEXT_PUBLIC_ADMIN_EMAILS` must be unset. **The live values were not checked**
(no Vercel/Supabase access from this lane, by rule).

**Doc conflict to decide:** `PRODUCTION-READINESS.md` §5.1 says `ADMIN_TOKEN` is
"not used by Hockey, leave as is"; `docs/admin-workbench.md` says setting
`ADMIN_TOKEN` in production switches Discovery's corpus scoping on. Setting it
for the admin workbench changes Discovery.

## Manual steps remaining

1. Supabase production: `preflight.sql` → `migration.sql` → `verify.sql` →
   `grants-check.sql` (Hockey tables; unconfirmed whether applied).
2. Supabase Auth redirect allow-list `https://<origin>/**`; decide email
   confirmation / custom SMTP.
3. Admin activation per `docs/admin-workbench.md`: set `ADMIN_EMAILS`,
   `ADMIN_TOKEN`, `ATLAS_SERVICE_TOKEN`; unset `NEXT_PUBLIC_ADMIN_EMAILS`;
   preview first; MFA for admins; rotate `ADMIN_TOKEN` if the earlier open
   proxy routes exposed it.
4. Board-ownership repair SQL (`docs/release/board-ownership-repair/`) and
   migration `20261021000000` are unapplied.
5. Deploy, then the two-account smoke test (`PRODUCTION-READINESS.md` §6–7).
6. Atlas data quality (non-photographs still pass; PiDGiN hero 404s) is
   Atlas's to fix.
