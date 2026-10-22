# Hockey Night production release gates — 2026-10-22

Candidate: **`a7dbd5f`** (`feature/hockey`). Nothing here was pushed, deployed,
migrated, or read from a production system. No secret was read or created.
This document is the only change made while closing the gates (docs only, plus
one corrected row in `PRODUCTION-READINESS.md` §5.1).

## 1. Full Playwright regression (`npx playwright test`, 5.4 min)

Fresh `npm run build` of `a7dbd5f`, `next start -p 3130`, placeholder Supabase
env (`http://127.0.0.1:9`), Atlas stand-in `scripts/critic/atlas-mock.mjs`
(critic fixture), `E2E_ATLAS=1`, `TMPDIR` on the home disk, 2 workers.

**250 passed, 5 skipped, 4 failed.** All four failures are environmental and
none touch Hockey:

| Test                                     | Why it fails here                                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `conference-mobile.spec.ts:23` Labs door | Conference is closed (`CONFERENCE_STORE`, `CONFERENCE_SECRET` unset), so Labs renders no link. The test, unlike its siblings, never skips. |
| `october.spec.ts:554`, `:570`            | Assert dates of a fixture market whose 2026 season ended 2026-10-10.                                                                       |
| `core-loop.spec.ts:26`                   | Waits for copy that needs a fuller Atlas than the stand-in.                                                                                |

`core-loop:26`, `october:554` and `:570` are the baseline recorded since 2026-10-11.
`conference-mobile:23` is new to that list but is explained by the page itself
("Closed here, not broken: CONFERENCE_STORE, CONFERENCE_SECRET not set").
Skipped: Conference/Arrivals specs (closed), two Atlas-down specs (need an Atlas
answering 503). The run rewrote 13 tracked Discovery screenshots; they were
restored by name.

## 2. The two skipped Hockey tests

They are `email-confirmation.spec.ts` (both tests). They skip unless the stack
runs with `CONFIRM_EMAIL=1`, because every other spec signs up instantly.
**They matter:** they are the only coverage of a coworker who signs up from an
invitation, is told to check their email, and must come back to the invitation
from the link (same browser and a different device). That is exactly what
production does if Supabase has _Confirm email_ on.

Run for real (`CONFIRM_EMAIL=1` stack + `smtp-sink.mjs`): **2 passed**.

Full Hockey suite on the local real stack (GoTrue, PostgREST, Postgres with
production's no-default-grants posture): **11/11** — 7 auto-confirm specs, `polish`
and `redesign`, and the 2 email tests. Also `rls-attack.mjs` all checks passed,
`grants-check.sql` 4/4 OK, `verify.sql` 10/10 OK.

Atlas data modes matter for two specs (README "Atlas stand-in modes"):
`polish` passes against a production-shaped body (no `presentationImage`);
`redesign` needs the body **with** `presentationImage` (it asserts a "From
moxies.ca" credit). Production Atlas does not serve `presentationImage` today,
so that credit line will not appear in production; places and photographs still do.

## 3. `ADMIN_TOKEN` traced through the source

- **Hockey reads it nowhere.** `src/app/hockey`, `src/domain/hockey` and
  `src/components/hockey` contain no `ADMIN_TOKEN`; Hockey's only Atlas call
  (`night.ts`) uses `listDiscoveryCandidates`, which does not.
- Readers: every `src/app/api/admin/*` route, `src/lib/knowledge/*` (admin
  pages), `explorer-dossier-repo.ts`, and **one traveller-facing reader,
  `listRegions()` (`atlas-repo.ts:475`)**, reached only through `activeScope()`
  from `/discovery` and `/explorer/[id]`. With no token it returns `[]` and
  Discovery stays unscoped.
- `/passport/[id]` reads it only for an administrator (`adminVerdictForRequest`).

**The two documents do not conflict; they describe different surfaces.**
`PRODUCTION-READINESS.md` §5.1 is right that Hockey does not use it.
`admin-workbench.md` is right that setting it in production switches Discovery
region scoping on for every visitor.

**Recommendation: do not set `ADMIN_TOKEN` or `ADMIN_EMAILS` in this release.**
Setting `ADMIN_TOKEN` buys Hockey nothing and changes a live product (Discovery)
untested. The admin workbench stays closed without it: `adminVerdict` returns
`not-configured` for everyone when `ADMIN_EMAILS` is empty (fail-closed, covered
by `adminAccess.test.ts`; 163 admin tests re-run green). Activate the workbench
as a separate, previewed change per `docs/admin-workbench.md`, and then decide
region scoping deliberately. Before deploy, an owner should check by **name only**
that `NEXT_PUBLIC_ADMIN_EMAILS` and any `NEXT_PUBLIC_*TOKEN*` are absent, and
note whether `ADMIN_TOKEN` is already set (it was not on 2026-10-11): if it is,
region scoping is already on and this release changes nothing about it.

## 4. Migration audit

**Applied state of production could not be determined**: this lane has no
Supabase or Vercel access by rule, and none was attempted. Everything below is
from the repository and from dated notes (last known 2026-10-16 to 2026-10-22),
not from a live read. One read-only query settles it:
`docs/release/PRODUCTION-DATABASE-READINESS.md` §4 in the SQL editor.

| Migration                                                                                                                                  | Needed by this release                                                                             | Last known state                    | Depends on                         |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------- |
| `20260927000000_passport_baseline.sql`                                                                                                     | yes (Hockey pattern, boards)                                                                       | applied (production runs boards)    | —                                  |
| Board ownership repair `docs/release/board-ownership-repair/` (`boards-owner-claim-fix.sql`, ca20324)                                      | yes — two live holes                                                                               | **unapplied** (diagnostic `FAIL`)   | baseline                           |
| **Hockey** `docs/product/hockey/migration.sql` (10 tables, 25 policies, 8 functions)                                                       | **yes — `/hockey` fails without it**                                                               | **unconfirmed; believed unapplied** | baseline                           |
| `20261021000000_passport_adventures.sql` (Saved → Adventures; also holds `passport_adventure_hockey`, which Hockey Night does **not** use) | yes — this build ships Saved/Adventures; `store.ts` raises "Adventures are unavailable" without it | **unapplied**                       | none (sequence after board repair) |
| `20261012…conferences`, `20261014…arrivals`, `20261016…grants`                                                                             | only if Conference is opened; Arrivals table reported missing                                      | partially applied / unknown         | 12 → 14 → 16                       |

Hockey's `migration.sql` and the Adventures file share no object names and
neither depends on the other. The Hockey migration lives in `docs/`, not
`supabase/migrations/` (a shared contract); apply only through the SQL editor,
never `supabase db push` (the migration history belongs to Atlas).

## 5. Supabase redirect and email

**Not verifiable from here.** From code: every email and OAuth flow builds
`redirectTo = ${window.location.origin}/auth/callback?next=…`
(`auth/page.tsx:100`, `forgot/page.tsx:63`, `GoogleButton.tsx:34`);
`/auth/callback` validates `next` with `safeNext` (no open redirect) and returns a
notice, not a 500, on a bad or reused link; a confirmation opened on another
device still returns the person to the invitation (tested).

Consequence: **every origin that serves Passport must be in Supabase →
Authentication → URL configuration → Redirect URLs as `https://<origin>/**`**,
or Supabase silently replaces the redirect with _Site URL_ and a confirmed
coworker lands somewhere wrong. The project is shared with Atlas: **add, never
replace or remove** entries. Origins to add: `https://gohaveaday.com/**`,
`https://www.gohaveaday.com/**` (if www is served at all), and
`https://elk-passport.vercel.app/**`. Confirm email on/off is an owner decision;
if on, the stock Supabase mailer is rate-limited, so configure custom SMTP
before inviting anyone (`PRODUCTION-READINESS.md` §5.2).

## 6. The release contains the complete Hockey redesign and polish

`f3b1aa3` (redesign), `56d87fd`, `b5eb736`, `62e79fd` (polish), `ab123fc`,
`a85cfeb` (admin security) and `efabb9c` (board repair package) are all
ancestors of `a7dbd5f`. The working tree was clean (six untracked `night-*.png`
screenshots only; **do not deploy from a directory that contains them**).

## 7. Release runbook — owner steps, in order

Deploy exactly `a7dbd5f` from a clean checkout. Stop at the first step that does
not match its expectation.

1. **Restore point.** Supabase → Database → Backups: note the latest backup/PITR
   time. Restoring is project-wide and takes Atlas with it; it is a last resort.
2. **Diagnose.** Run the read-only diagnostic (`PRODUCTION-DATABASE-READINESS.md`
   §4). Export the CSV. This is where the unconfirmed rows of §4 become facts.
3. **Board ownership repair** (`board-ownership-repair/README.md`):
   `01-preflight.sql` → (`boards-ownership-audit.sql` only if an audit row says
   `ATTENTION`) → `boards-owner-claim-fix.sql` → `03-verify.sql`
   (`REPAIRED: 0 FAIL, 0 REVIEW, 17 PASS`).
4. **Hockey:** `preflight.sql` (all `OK`) → `migration.sql` → `verify.sql`
   (10 rows `OK`) → `verification/grants-check.sql` (4 rows `OK`). Quick grant
   probe first: `select has_table_privilege('authenticated','public.passport_board_members','select');`.
5. **Adventures:** `supabase/migrations/20261021000000_passport_adventures.sql`,
   then re-run step 2's diagnostic: 0 `FAIL`. Apply the Conference chain only if
   it still reports `FAIL` and Conference is to be opened.
6. **Auth:** add the redirect origins in §5; decide Confirm email and custom SMTP.
7. **Environment (Production), by name — no values in tickets:**
   `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the project the
   SQL was applied to; inlined at build), `ATLAS_API_URL` (no trailing `/`, no
   `/api`), `ATLAS_SERVICE_TOKEN`. **Do not add** `ADMIN_TOKEN`/`ADMIN_EMAILS`.
   **Confirm absent:** `NEXT_PUBLIC_ADMIN_EMAILS`, `NEXT_PUBLIC_*TOKEN*`.
8. **Preview first.** Deploy `a7dbd5f` as a Preview with the same variables and
   run the smoke test (step 10) against it. Record the previous production
   deployment URL now (it is the rollback target).
9. **Promote to production.** (Vercel Git-link state is unresolved in the notes;
   use whichever mechanism the project actually has, from the same SHA.)
10. **Smoke, two real accounts** (`PRODUCTION-READINESS.md` §6–7): signed out,
    `/hockey` → `/auth?next=%2Fhockey`; account A starts a night, invites B; B
    joins from the link on a phone (and, if Confirm email is on, via the emailed
    link); A and B see one night; a third account cannot read it (404);
    `curl -i https://<origin>/api/admin/duplicates` → 401/403 and
    `…/api/admin/environment` → 401/403; page source has no token or email.
11. **Then, separately:** re-run `prod-nearby-check.mjs` (real Atlas near Rogers
    Arena); schedule admin activation and the ownership-forgery review as their
    own changes.

## 8. Rollback

Fastest first; none needs a push.

- **Code:** promote the previous production deployment recorded in step 8
  (Vercel Instant Rollback / promote previous). Database changes are additive,
  so the old build keeps working against the new schema.
- **Hockey, stop growth, delete nothing:** `disable.sql` (immediate, no deploy;
  `enable.sql` reverses). Existing nights keep working.
- **Hockey, remove entirely:** `rollback.sql` — **destructive**, refuses while any
  night exists unless `hockey.confirm_destroy` is set. Export first.
- **Board repair:** `board-ownership-repair/rollback.sql` restores the baseline
  policies in one transaction, changes no rows, **re-opens both ownership holes**.
  Use only if genuine sharing is proven broken; re-apply afterwards.
- **Adventures:** no rollback script exists. Additive; leave in place. Dropping its
  tables is only safe before anyone has used Saved/Adventures.
- **Auth redirect entries:** remove only the entries you added.
- **Last resort:** point-in-time restore (project-wide, includes Atlas).

## 9. Blockers

1. Production state of every migration is unknown until the owner runs step 2.
2. Hockey migration, board repair and Adventures migration are, as last known,
   unapplied: **deploying before step 4 breaks `/hockey` and before step 5 breaks
   Saved/Adventures.**
3. Redirect allow-list and SMTP unseen.
4. Not Hockey's: Vercel Git-link state, and Atlas serving no `presentationImage`.
