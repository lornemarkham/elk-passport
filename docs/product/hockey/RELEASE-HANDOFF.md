# Hockey Night — handoff to the Passport release agent (mission 289)

> **Superseded by [`RELEASE-2026-10-23.md`](RELEASE-2026-10-23.md)** for the
> Friday 23 October release. Kept as the record of the 2026-10-13 pass.

Integration branch: `feature/hockey` (merge of `integration/release` e6d0b65,
which already carries Go Have a Day, Conference and durable Arrivals).
Verified 2026-10-13 on that merge: `tsc` clean, eslint 0 errors, vitest
2897 passed / 3 skipped, `npm run build` ok (/hockey routes present).
Not run here: playwright, and any test against a real Supabase project
(no credentials in this lane).

## What the release agent must do (nothing here has been applied or deployed)

1. Fetch and merge `feature/hockey` into the release line; it merges cleanly.
2. The Hockey migration is **not** in `supabase/migrations/` (shared
   contract). It is `docs/product/hockey/migration.sql`. Run `preflight.sql`,
   then `migration.sql`, then `verify.sql` (9 rows, all OK) in the SQL editor
   of the production project that matches `NEXT_PUBLIC_SUPABASE_URL`. Never
   `supabase db push`. Idempotent, additive; `rollback.sql`/`disable.sql` exist.
3. Supabase Auth redirect allow-list: add `https://<passport origin>/**`
   (plain Passport origin, not iamoctober.com). Decide Confirm email; if on,
   custom SMTP is needed.
4. Env: same Supabase project as step 2, `ATLAS_API_URL` without `/api`.
5. Deploy through the coordinated release, then run the smoke and
   two-account script in `PRODUCTION-READINESS.md` §6–7.

URL once live: `https://<passport origin>/hockey`.
See `OWNER-CHECKLIST.md` for the full list.
