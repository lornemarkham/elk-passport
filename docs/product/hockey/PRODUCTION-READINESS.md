# Hockey Night — production readiness

**Assessed 2026-10-11** on `feature/hockey` (`1db821f` + the uncommitted-then-committed
readiness change described below). The night is **Sunday 25 October 2026**.

> ## Recommendation: **NO-GO today, GO as soon as five owner actions are done and checked**
>
> I found **no code or security blocker**. The migration, the RLS, the invitation
> mechanism and the sign-in return path all held up under attack on a real
> PostgreSQL + GoTrue + PostgREST. What stands between this and a coworker's
> phone is **five things only the owner can do** (§1). None is risky; all are
> reversible except the deploy order, which is below. Nothing has been applied,
> deployed, merged or pushed.

---

## 1. Owner actions, in order

| #   | Action                                                                                                                                                                                                                             | Who                     | Reversible by                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------ |
| 1   | **Decide the origin** invitations are issued from (see §5). Recommended: the plain Passport origin (`elk-passport.vercel.app` unless there is a Passport custom domain), **not** `iamoctober.com`.                                 | owner                   | —                              |
| 2   | **Supabase dashboard → Authentication.** (a) Add `https://<origin>/**` to _Redirect URLs_. (b) Decide email confirmation on/off. (c) **If on, confirm custom SMTP is configured** (§5.2) or the coworker's email may never arrive. | owner                   | revert the setting             |
| 3   | **Run `preflight.sql`**, then **apply `migration.sql`** in the SQL editor of the production project (§2), then run `verify.sql`.                                                                                                   | owner (needs the human) | `disable.sql` / `rollback.sql` |
| 4   | **Fetch, merge and deploy** `feature/hockey` (§4). Env vars must be right _before_ the build (§5.1).                                                                                                                               | owner                   | Vercel "instant rollback"      |
| 5   | **Smoke test with two real accounts** (§6, §7) **before** sending any invitation.                                                                                                                                                  | owner + one other human | `disable.sql`                  |

Afterwards (not blocking): `passport-domain` lands `migration.sql` byte-for-byte as
`supabase/migrations/<timestamp>_passport_occasions.sql` and tells the Atlas owner
the objects now exist (§2.5).

---

## 2. Migration — exact instructions

Files, all in `docs/product/hockey/`:

| File            | What                                                                           | Writes?         |
| --------------- | ------------------------------------------------------------------------------ | --------------- |
| `preflight.sql` | 8 checks that the project is as the migration assumes. Every row must be `OK`. | **no**          |
| `migration.sql` | The proposal. 10 tables, 8 functions, 25 policies. Guarded; safe to re-run.    | yes             |
| `verify.sql`    | 9 checks that it landed as designed. Every row must be `OK`.                   | **no**          |
| `disable.sql`   | Kill switch: nobody can start a night or follow a link. Deletes nothing.       | grants only     |
| `enable.sql`    | Reverses `disable.sql`.                                                        | grants only     |
| `rollback.sql`  | Drops everything the migration added. **Refuses while any night exists.**      | **destructive** |

### 2.1 How

1. **Do not `supabase db push`.** `supabase/README.md` hazard 1: Atlas owns the
   project's migration history; pushing from here would write a row Atlas does not
   know about. Use the **SQL editor** of the production project.
2. Paste **`preflight.sql`** → run → **every row `OK`**. Any `STOP`: do not continue;
   send me the output (a pre-existing `passport_occasion*` object means this is not
   the first apply, or something else owns the name).
3. Paste **all of `migration.sql`** → run. It is one script; if the editor shows an
   error, nothing after it ran — re-running from the top is safe (everything is
   `IF NOT EXISTS` / `CREATE OR REPLACE` / guarded `do` blocks).
4. Paste **`verify.sql`** → run → **every row `OK`** (10 tables, RLS on 10, 25
   policies, 8 functions, `anon` has no table privilege and may execute only the
   link-validity function, no one can write `role`/`host_id`/`uses`, the 8 baseline
   tables untouched).
5. **Record it.** `passport-domain` adds the same bytes as
   `supabase/migrations/<timestamp>_passport_occasions.sql` (suggest
   `20261012000000_…`, matching the baseline's 14-digit form) so the repository
   describes the database. It is **never** pushed. Tell the Atlas owner that
   `passport_occasion*` objects now exist in the shared project (they will appear in
   any `db dump`/diff), and that no row was added to `supabase_migrations`.

### 2.2 Compatibility with current production

- **Purely additive.** It creates objects named `passport_occasion*` /
  `passport_*occasion*` and alters nothing that exists. Currently deployed code
  does not know these tables exist, so applying it _before_ deploying is invisible
  to production.
- **No name collision with Atlas's history.** I searched the 62 migrations of the
  read-only Atlas clone (`e5e9ed6`, 2026-10-11): nothing mentions `occasion`.
  _Caveat: that is the clone, not the live database_ — `preflight.sql` is what
  checks the live one.
- **Depends on `auth.users` / `auth.uid()` only.** No reference to any Atlas table,
  to `passport_events`, or to any baseline table. Boards are untouched.
- **PG features:** `gen_random_uuid()` (core since PG13), `sha256(bytea)` (PG11),
  `make_interval`, `WITH ORDINALITY`. Supabase runs 15+.
- **Grants posture — corrected 2026-10-19.** This said the migration could rely
  on Supabase's default privileges (`anon`/`authenticated` holding ALL on new
  `public` tables). The production project does **not** apply them: Conference,
  written the same way, crashed for every signed-in visitor on 2026-10-16 with
  `42501 permission denied`. Re-run on a stack without those defaults, this
  migration did the same (`permission denied for table passport_occasions`, 14
  attacks failing because nothing could be read). `migration.sql` now grants
  `authenticated` the same DML outright (no TRUNCATE/REFERENCES/TRIGGER — which
  also closes §2.4 finding 1), the stack mirrors production, `verify.sql` checks
  the grant, and `rls-attack.mjs` passes again under that posture. Earlier
  "tested under default grants" statements in this file (§2.3, §5.3, §11–§13)
  are superseded by §14.
- **I could not read the production database** (no credentials, by design). Anything
  about live state is therefore _verified by `preflight.sql` when you run it_, not
  asserted here.

### 2.3 What I verified about the migration

Review of all 600 lines, then the existing `rls-attack.mjs` (**48/48**), then my own
probes beyond it:

| Probe                                                           | Result                                  |
| --------------------------------------------------------------- | --------------------------------------- |
| Removed guest rewrites their own old answer / consent           | refused (0 rows / RLS violation)        |
| Host edits `max_uses` of an invite                              | `permission denied` (column grants)     |
| Bad token to redeem                                             | `null`, nothing joined                  |
| Migration → `rollback.sql` → migration → migration              | identical (10 / 8 / 25, RLS on 10)      |
| `rollback.sql` with a night present, without the confirm line   | **refuses**, nothing dropped            |
| `rollback.sql` with confirm; again on an already-clean database | drops 10 + 8 only; second run no-ops    |
| `disable.sql` / `enable.sql`                                    | `authenticated` loses / regains EXECUTE |

### 2.4 Findings that are **not** blockers (named, not hidden)

1. **`authenticated` holds `TRUNCATE`** on the new tables (Supabase's default
   privilege; RLS does not apply to TRUNCATE). It is unreachable through
   PostgREST/the app; it needs a raw Postgres connection as that role. Same posture
   as every existing Passport table. Hardening if wanted: `REVOKE TRUNCATE … FROM
anon, authenticated`. _Not done: it changes the proposal that was attacked; the
   owner/`passport-domain` should choose._
2. **Any signed-in user may start unlimited nights** (and could call
   `passport_create_occasion` directly with up to 8 KB of `details`). Bounded by
   column checks; no money, no outward effect. There is no rate limit. Acceptable
   for a private coworker night; a public launch would want one.
3. **A removed guest can rejoin with a multi-use link.** The app only ever mints
   `max_uses = 1`, so this needs a hand-made row. Not reachable.
4. **The host is trusted** with the start time (which moves every lock) — already
   documented in the README.
5. **Policy-existence guards match by name only, not by table.** Harmless unless a
   same-named policy exists elsewhere — which `preflight.sql` checks.

### 2.5 Invitation security and membership rules — summary

Holds: 24 random bytes, only `sha256` stored; single use; expires the morning after
the game; revocable; redeem requires a session (`auth.uid()` checked _inside_ the
function, as well as `401` in the route); a signed-out visitor learns only "valid /
not valid" (nothing about title, host or guests); a forwarded link is dead once
used; following your own link again spends nothing; nobody joins wearing someone
else's emoji; the host cannot be removed or demoted; a guest cannot self-promote,
rename others, or impersonate (`actor_id`/`user_id` forced to `auth.uid()`); sealed
answers are sealed in the database (PostgREST included); removal cuts every read and
write at once; the app uses the anon key + the caller's own session — **never the
service role**.

---

## 3. Rollback / recovery

Pick the **smallest** lever that solves the problem:

| Situation                                                    | Do this                                                                                                                                        | Loses data?            |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Site misbehaves after deploy                                 | Vercel dashboard → previous deployment → **Instant Rollback**. The tables are inert without the new code.                                      | no                     |
| Something wrong with who can get in / need to stop new joins | SQL editor: **`disable.sql`**. Existing nights keep working. Undo with `enable.sql`.                                                           | no                     |
| An invitation link leaked                                    | In the night's guest list, **revoke** it (host). Or SQL: `update passport_occasion_invites set revoked_at = now() where occasion_id = '<id>';` | no                     |
| One person must go                                           | Host removes them in the guest list.                                                                                                           | no                     |
| Migration half-applied / errored                             | Re-run `migration.sql` from the top (idempotent). If still wrong: `rollback.sql`, then re-apply.                                               | only if nights existed |
| Hockey must be removed from the database entirely            | 1. Export (below). 2. Uncomment the `set local hockey.confirm_destroy = 'yes';` line in `rollback.sql`. 3. Run it.                             | **yes — every night**  |

**Export before any destructive rollback** (SQL editor → run each → "Download CSV"):
`select * from passport_occasions;` `… passport_occasion_members;` `…_responses;` `…_moments;`
(the others as wanted). Invitation tokens are stored only as hashes — they cannot be
exported or recovered; make fresh links.

**Recovery of a deleted account:** `ON DELETE CASCADE` — deleting a user removes
their memberships, answers and comments, and **deletes any night they host**.

---

## 4. Deployment sequence

0. Get the commits: `git fetch metatron:passport/main feature/hockey` (a person, on
   the Mac; pushing is disabled in the lane on purpose).
1. **Origin decided** (§1 #1). **Supabase Auth settings done** (§1 #2).
2. **Migration applied and verified** (§2). _Order matters: migration before code._
3. **Environment variables** correct in Vercel for the `elk-passport` project (§5.1).
   They take effect **only on the next build** (`docs/RELEASE.md`).
4. Local gates on the merged result: `npx tsc --noEmit`, `npx eslint .`,
   `npx prettier --check .`, `npx vitest run`, `npm run build`, `npx playwright test`
   (expect the four known failures, §8).
5. Merge `feature/hockey` into `main` (human). Deploy: `npx vercel deploy --prod`
   (human; this lane never deploys).
6. **Smoke test** (§6) → **two-account acceptance** (§7). Only then send an invitation.
7. If anything in 6–7 fails: `disable.sql` first (seconds), diagnose, or Instant
   Rollback. Do not send invitations.

Rollback order is the reverse: Instant Rollback → `disable.sql` → (only if required)
`rollback.sql`.

---

## 5. Authentication, email confirmation, environment

### 5.1 Environment variables (production, Vercel project `elk-passport`)

| Variable                                                                           | Needed for Hockey?  | Must be                                                                                                                           |
| ---------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                                                         | **yes**             | The **same project the migration was applied to.** Inlined at build → set before the build.                                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                                    | **yes**             | That project's **anon** key. Inlined at build. **Never** put the service-role key here; Hockey never uses it.                     |
| `ATLAS_API_URL`                                                                    | for the food picker | `https://elk-atlas.vercel.app` — no trailing slash, **no `/api`** (RELEASE.md gotcha). Default `localhost:3000` is wrong in prod. |
| `ATLAS_SERVICE_TOKEN`                                                              | for the food picker | Already set for October; unchanged. If Atlas is down the picker says so (`outage`) and the night works.                           |
| `OPENAI_API_KEY`, `ADMIN_TOKEN`, `NEXT_PUBLIC_GOOGLE_SSO_ENABLED`, weather, region | no                  | Not used by Hockey. Leave as they are.                                                                                            |
| `DATABASE_URL`                                                                     | no                  | Hockey uses Supabase REST only.                                                                                                   |

No new variable is introduced by this release.

### 5.2 Supabase dashboard (not in this repo — I cannot see or verify it)

- **Redirect URLs** must allow `https://<origin>/auth/callback?next=…`. The app
  builds `emailRedirectTo = <origin>/auth/callback?next=<encoded /hockey/join/…>`
  exactly as password-reset and Google do. RELEASE.md: **a `redirectTo` not in the
  allow-list is silently replaced by Site URL** — the symptom is a confirmed coworker
  landing on the homepage with no invitation. RELEASE.md smoke step 6 proves
  `www.iamoctober.com` is allowed; **`elk-passport.vercel.app` is not evidenced
  anywhere I can read.** Use a wildcard entry `https://<origin>/**`.
- **Email confirmation on?** The app handles both. The local stack proved both
  modes (§5.3). If **on**: check **SMTP**. Supabase's built-in mailer is, to my
  knowledge of its documented behaviour, heavily rate-limited and on some project
  tiers only delivers to the project's team members — **verify against the current
  Supabase docs/dashboard**; if no custom SMTP is configured, a coworker's
  confirmation email may not arrive, which would be the single most likely
  night-of failure. Either configure SMTP or decide to turn confirmation off
  (a product/security decision I did not make).

### 5.3 What I tested, and the one fix

Local stack with GoTrue **requiring** confirmation and a local SMTP sink
(`CONFIRM_EMAIL=1`, `smtp-sink.mjs`, `email-confirmation.spec.ts`):

| Path                                                                                    | Before                                                                     | After                                                                  |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Sign up from invitation → "check your email" → open link **in the same browser** → join | works                                                                      | works                                                                  |
| Sign up on a laptop, open the email **on a phone** (PKCE verifier absent)               | "link expired", **`next` lost** → lands on Discovery, invitation forgotten | notice kept, **`next` kept** → sign in → back on the invitation → join |
| Hostile `next` (`//evil`, `https://evil`, `/\evil`) on a failed link                    | n/a                                                                        | dropped (5 unit tests)                                                 |

The second row is the realistic failure (sign up at a desk, read mail on the phone).
The account _is_ confirmed in that case; only the return trip was lost. The invitation
link itself was still good, so nobody was locked out — but they would not have known
to go back to it.

**The fix** is `src/app/auth/callback/route.ts` — **outside the lane** (shared auth,
unavoidable: the loss happens inside this route). It only appends the already-validated
`next` to the existing `/auth?notice=…` redirects. Success path unchanged.

Callback flow otherwise reviewed: PKCE `code` exchange in a route handler; `next`
validated by `safeNext` (same-site paths only); provider errors and missing codes are
a notice, never a 500; `url.origin` used for redirects.

---

## 6. Production smoke-test checklist (≈5 min, you alone, before any invitation)

Against `https://<origin>`. Use your own account and a second, throwaway email.

- [ ] `/hockey` signed out → redirected to `/auth?next=%2Fhockey`.
- [ ] `/hockey/join/not-a-real-token` signed out → "This link has done its job." (no 500).
- [ ] `GET /hockey/api/occasions` signed out → `401` JSON.
- [ ] Sign in → `/hockey` shows "Nothing on yet" and a name box.
- [ ] **Start it** → lands on `/hockey/<uuid>`; the curator's four taps appear (Skip is fine).
- [ ] Page says **Canucks vs Wild**, Rogers Arena, Sun 25 Oct, 7:00pm Pacific.
- [ ] **Make a link** → URL is on `<origin>`, shaped `/hockey/join/<32 chars>`.
- [ ] Vote once; reload; the vote is still there.
- [ ] "What's near the arena?" → either places or the honest "Passport doesn't know anywhere nearby" (expected today: places — production Atlas has 19 food and drink entities within 1.6 km; see §12).
- [ ] Browser devtools → Network: every `/rest/v1/…` call goes to **your** Supabase project; no `localhost`.
- [ ] Vercel logs show no `[hockey]` errors.
- [ ] SQL editor: `select count(*) from passport_occasions;` → ≥ 1 (the row exists).

## 7. Two-account acceptance script (the real one; ~10 min, two humans or two browsers)

**A** = host (you). **B** = a second real person/email, ideally on a **phone**, ideally
reading mail on a **different device** than the one they signed up on.

1. **A** starts the night (name: _Lorne_), skips the brief, and makes a link labelled _B_.
2. **A** pastes the link into a chat; **B** opens it **signed out**. B sees "Somebody wants you there." and **nothing** about the night, A, or the guests.
3. **B** → "Sign in to see it" → **Sign Up** with a brand-new email.
   - **Confirmation off:** B is back on the invitation immediately → step 5.
   - **Confirmation on:** B sees "Check your email…" → open the email **on another device** (the cross-device case) → B lands on the sign-in page ("expired" notice is expected there) → sign in → **B must land on the invitation, not Discovery** → step 5.
4. _(If confirmation is on and time allows, also repeat once with the email opened in the same browser.)_
5. **B** enters a name (_Maya_) → "I'm in" → lands on the night.
6. **Both** screens show **both** people on the roster (within ~5 s, no reload).
7. **Simultaneously**, both tap the pregame vote → each sees the other's vote arrive.
8. **B** suggests a place; **A** sees it appear without reloading.
9. **B** posts a comment; **A** reacts to it; B sees the reaction.
10. **Sealed pick:** A makes a score pick; B must **not** see it until B has made one (or it locks).
11. **Not the host:** B has no guest list; B cannot call results.
12. **Reload / new session:** A on a second device sees everything intact.
13. **Forwarded link:** open A's _same_ invitation URL in a third browser/incognito with a **third** account → "This link has done its job."
14. **Stranger:** that third account opens `/hockey/<night id>` → "not found"-class response, no content.
15. **Removal:** A removes B → B's open page leaves within one poll → B's comments vanish from A's page → B gets a not-found.
16. Optional: re-invite B with a new link; B's old picks return (documented behaviour).

**Pass = all of 2, 6–8, 10–11, 13–15.** Any failure: `disable.sql`, do not invite anyone.

---

## 8. The four pre-existing browser failures

`npx playwright test` against `next start` on a build with real local auth, 49 tests:
**45 pass, 4 fail** — and the same four are the recorded environmental baseline:

| Test                                                                  | Why it fails here                                                           |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `core-loop.spec.ts:26` plans/reveals/recaps an adventure              | needs the AI reveal ("going to love…") — no `OPENAI_API_KEY` in a lane      |
| `nfr.spec.ts:300` every control ≥44px at 375                          | `no box for "just me"` — that control renders from Atlas data, absent here  |
| `october.spec.ts:554` a label used for several rows is printed once   | page shows "There's nothing at this address" — an entity fetched from Atlas |
| `october.spec.ts:570` a five-month season is not one continuous event | same: no entity                                                             |

**None is caused by Hockey, by construction:** `git diff bd6f596..HEAD` (the base this
branch was cut from, on `origin/main`) restricted to everything outside
`src/{app,components,domain}/hockey`, `docs/`, and my one callback file is **empty**.
Run them against the real Atlas and a real `OPENAI_API_KEY` before the deploy gate if
you want them green; they are not Hockey's to fix, and they are not release blockers
_for Hockey_. (They may be for the October release, which is a separate decision.)

---

## 9. Genuine release blockers — the complete list

| #   | Blocker                                                             | Owner | Cleared when                 |
| --- | ------------------------------------------------------------------- | ----- | ---------------------------- |
| B1  | Migration not applied to production                                 | owner | `verify.sql` all `OK`        |
| B2  | Supabase redirect allow-list unverified for the issuing origin      | owner | §7 step 3 passes on prod     |
| B3  | Email-confirmation delivery unverified (SMTP) if confirmation is on | owner | B receives the email on prod |
| B4  | Code not merged/deployed; env vars unverified                       | owner | §6 smoke passes              |
| B5  | Two-account acceptance not yet run **on production**                | owner | §7 passes                    |

There is **no unresolved code or security defect** on `feature/hockey`. Everything in
§2.4 is named and accepted, not blocking.

## 10. Decisions that are the owner's, not mine

- **Doctrine.** §15.12 (how group experiences work) is still an open question and §14
  lists "elaborate social games" as not-now. This ships _one_ private multiplayer
  night; it answers neither. Shipping it to production is a product decision the
  doctrine does not yet make — **recorded, not resolved**. If you decide it is now
  canonical, update the doctrine in the same change (CLAUDE.md).
- **Email confirmation on/off**, and **SMTP**.
- **The issuing origin** (§1 #1).
- **`REVOKE TRUNCATE`** hardening (§2.4.1).
- ~~Atlas knowledge request for food near Rogers Arena~~ — superseded: production
  Atlas now has it (§12).

---

## 11. Re-verification — 2026-10-13, on `0493c06` (The plan)

Everything in §§1–10 stands; this adds what changed or was newly measured.
**Still NO-GO until the owner actions are done** — [`OWNER-CHECKLIST.md`](OWNER-CHECKLIST.md)
is the short version. No code or security defect found. Nothing applied,
deployed, merged or pushed.

| Check                                                       | Result                                                                                                                                                                          |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsc --noEmit`                                              | clean                                                                                                                                                                           |
| `eslint src docs/product/hockey`                            | 0 errors (39 pre-existing warnings, none in Hockey)                                                                                                                             |
| `prettier --check`                                          | clean                                                                                                                                                                           |
| `vitest run`                                                | 162 files, **2046/2046**                                                                                                                                                        |
| `npm run build`                                             | succeeds                                                                                                                                                                        |
| `rls-attack.mjs` (real PG + GoTrue + PostgREST)             | **49 checks, 0 failures** (was 48)                                                                                                                                              |
| `verify.sql` on the stack; `preflight.sql` on a migrated DB | all 9 `OK`; preflight lists the already-present objects (it detects a re-run)                                                                                                   |
| `acceptance.spec.ts` (host desktop, guest mobile, stranger) | **passes**, 3/3 consecutive runs                                                                                                                                                |
| **new** `plan-and-results.spec.ts`                          | **passes**, 3/3 (mutation-checked: a wrong expected score fails it)                                                                                                             |
| `email-confirmation.spec.ts` (both paths)                   | passes on a fresh stack, 6/6; see the caveat below                                                                                                                              |
| Full `npx playwright test` (`E2E_PORT=3130`, own server)    | **46 pass, 3 fail** — the documented environmental baseline (core-loop needs OpenAI; two `october.spec` tests need Atlas entities). `nfr.spec:300` passed this time (stub data) |

### What the new spec proves (the Plan panel and the result, which §7 could not reach)

Two real accounts: no plan before any vote → one vote makes "Eating: …· 1 vote"
on **both** screens → a nomination plus a vote for it reports **"Tied at 1
vote"** (never broken) → agreement reports "· 2 votes" → a sealed pick is
visible only to its author until its own question is answered by the viewer,
then only that question → a **guest cannot move the start time** (RLS returns
0 rows; the host's own PATCH moves it) → after lock the plan is still on the page
at the final horn → only the host sees "Call it", and a guest's `callIt` is
refused, before and after the host's → the host's calls produce the right
standings (8 and 3) on both screens without a reload.

### Caveat: the email-confirmation spec is not reliable on a busy machine

It passed 6/6 on a freshly started stack, but was intermittent (about 1 in 3)
during long repeated runs: Chromium "Target crashed", `ERR_INSUFFICIENT_RESOURCES`,
and 3 times a sign-in that stayed on `/auth?`. These coincided with another lane
running its own Playwright suite on the same machine and with hundreds of
accumulated sign-ups and mails in the local stack; restarting the stack removed
them. **I could not prove the cause of the `/auth?` stall.** One hypothesis,
not verified: a click that lands before React hydrates submits the form
natively (the inputs have no `name`, so nothing sensitive reaches the URL).
Consequence for the night: a guest whose sign-in seems to do nothing should
reload and sign in again; the invitation link remains valid. Re-run this spec
on a quiet machine before relying on it.

### Rogers Arena — what is and is not known

Known and in the product: Canucks vs Wild, Sun 25 Oct 2026, 7:00pm Pacific
(public ticket listings agree), 800 Griffiths Way, coordinates good to metres.
**Not known to Passport, and not asked of anyone:** entrance or meeting point,
seat sections, transit/parking plan, meeting time before puck drop, and any
food within walking distance as the group would know it (Atlas now lists 19 places within 1.6 km; §12).

---

## 12. Re-verification — 2026-10-13 (afternoon), on the Passport release line

**Verdict unchanged: NO-GO until the owner actions are done; no code or security
defect found.** Nothing applied, deployed, merged or pushed to any shared
branch. What this pass added, and what it corrected.

### Corrections to earlier sections

- **Atlas does know food near Rogers Arena (supersedes §11 and the README).**
  Measured from the public production `/go` payload with
  `verification/prod-nearby-check.mjs`: Rogers Arena is an entity (`arena`,
  observed coordinates, 0.01 km from the night's venue point) and 19 Eat & drink
  entities with observed coordinates sit within 1.6 km (nearest 0.26 km).
  Hockey's real `nearbyFood` accepted the production corpus. The 2026-10-11
  snapshot was simply older than production. Not verified: an authenticated
  Atlas call (no credentials in this lane, and production reads are not made
  from it) and the picker UI over real names (acceptance still uses the stub).
- **The "email spec is intermittent" caveat in §11 had a cause: a full `/tmp`.**
  `/tmp` is a quota-limited tmpfs shared with every lane; vitest failed with
  `Unknown system error -122` (EDQUOT) and Chromium crashed
  (`Target crashed`, `ERR_INSUFFICIENT_RESOURCES`, "sign-in stays on `/auth?`").
  With `TMPDIR` on the home disk and `--output` there, the **unmodified**
  `email-confirmation.spec.ts` passed 6 of 6, and 1 of 4 before. A
  hydration-race hypothesis (click before React attaches) was tried by making the
  specs wait for `networkidle`; it changed nothing once `/tmp` was fixed, so it
  is **not supported** and nothing was changed for it. (The mechanism exists —
  the server-rendered `<form>` has no method/action and unnamed inputs, so a
  pre-hydration submit is a `GET /auth?` — but no run showed it happen.)
  **To run the suite here: `TMPDIR=$HOME/... npx playwright test --output=$TMPDIR/pw`.**
- **A pid-file trap:** `next start` launched through `npx` writes the wrapper's
  pid, so "kill the server" leaves the old build listening and the new one dies
  with `EADDRINUSE`. For a while this pass was testing the previous build. Find
  the listener with `ss -ltnp`, check `/proc/<pid>/cwd`, and kill that.

### Base branch

`feature/hockey` (`bba1bd1`, cut from `bd6f596`) merges **cleanly, no conflicts**,
into `conference/live` (`4e55eaf`) and into `integration/release` (`6fd37dd`,
"gohaveaday.com opens Go Have a Day at /go", 2026-10-13 11:54). Outside Hockey's
own folders and `docs/` the merge changes exactly two files:
`src/app/auth/callback/route.ts` and its test. Production is a CLI deploy, so
git cannot say what it runs: `/labs/conference` was 404 on production while
`conference/live` contains it. **Merge into whatever the last production deploy
was built from.**

### Results on `integration/release` + `feature/hockey` (scratch, nothing shared)

| Check                                                            | Result                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsc --noEmit`                                                   | clean                                                                                                                                                                                                                                                                                                                                          |
| `eslint src docs/product/hockey`                                 | 0 errors (38 warnings, none in Hockey)                                                                                                                                                                                                                                                                                                         |
| `prettier --check`                                               | clean on Hockey; one other file's style issue came from the release line (`docs/product/group-adventures/verification/prod-isolation.mjs`)                                                                                                                                                                                                     |
| `vitest run`                                                     | 244 files, **2893 pass**, 3 skipped (before the `/tmp` fix: 18 files failed to load with `-122`)                                                                                                                                                                                                                                               |
| `npm run build`                                                  | succeeds                                                                                                                                                                                                                                                                                                                                       |
| `rls-attack.mjs` (real PG + GoTrue + PostgREST)                  | all checks passed                                                                                                                                                                                                                                                                                                                              |
| `acceptance.spec.ts` + `plan-and-results.spec.ts`                | pass, 3 of 3 runs                                                                                                                                                                                                                                                                                                                              |
| `email-confirmation.spec.ts` (confirmation required, both paths) | pass, 6 of 6                                                                                                                                                                                                                                                                                                                                   |
| full `npx playwright test` against that server                   | 119 pass, 21 fail, 38 skipped — every failure is an Atlas-data spec (Day Builder, Labs "follows whether Atlas is there" which my stub answers, two `october.spec` entities, `core-loop` needs OpenAI). Not run against a no-Hockey baseline here; Hockey changes nothing they touch except the auth callback, which still passes its own tests |

### gohaveaday.com

Domain registered 2026-10-13 and not yet resolving (nameservers pending). The
new front-door logic is compatible with Hockey:

- It rewrites only `/` (to `/go`); `/hockey/*` is served as on any host. Checked
  with `Host: gohaveaday.com` against the built server.
- `www.gohaveaday.com/hockey/join/<token>?…` answers `308` to
  `gohaveaday.com/hockey/join/<token>?…` (path, token and query kept).
- Hockey's `next` is explicit, so the callback's new default of `/go` on that
  host is never used for an invitation.
- But: **an invitation link carries whatever origin the host was on** (it is
  `window.location.origin`), and a session cookie is per origin. A night
  started on `gohaveaday.com` needs `https://gohaveaday.com/**` in Supabase
  Redirect URLs (§5.2) and the guests will sign up there. **Recommendation: run
  the night on `elk-passport.vercel.app`** (already step 1 of the owner
  checklist), and do not start it from the gohaveaday.com address.
- `iamoctober.com` still dresses `/auth` as October (host-decided). Don't start
  the night from there.

### Still the owner's, still blocking

B1–B5 in §9 are unchanged: the migration is not applied, the Supabase redirect
allow-list and SMTP are unseen, the code is not merged or deployed, and the
two-account run has not been done **on production**.

---

## 13. Pass of 2026-10-13 (afternoon): redemption races

`rls-attack.mjs` covered concurrent votes and comments but not concurrent
redemption of one single-use link, the one place where a lost race would put a
stranger inside a private night. Added four checks (real PostgreSQL + GoTrue +
PostgREST, throwaway stack): four accounts redeeming one `max_uses = 1` link at
the same instant admit **exactly one**, leave one guest row and `uses = 1`; one
person double-clicking never becomes two members. All pass; the row lock
(`for update` in `passport_redeem_occasion_invite`) is what holds. No migration
change. Not covered, and cosmetic only: two _different_ links to one night
redeemed at once can pick the same free emoji, as `(occasion_id, emoji)` has no
unique constraint. The blockers in §9 (B1 to B5) are unchanged and all the owner's.

---

## 14. Pass of 2026-10-20: strict grants (supersedes the grants claims above)

**What changed.** Took the three grants files from `integration/release`
(`migration.sql`, `verify.sql`, `verification/stack.mjs`) unchanged. The other
Hockey differences on that branch (curated Vancouver list, "Where are we
meeting?", their spec edits) are not in this branch and were deliberately not
taken. `playwright.config.ts` now honours `PW_OUT` (the default `/tmp` fills).
New: `verification/grants-check.sql` and `GRANTS-REGRESSION-CHECK.md`.

**Environment.** Disposable stack at `~/passport/scratch/hockey-stack`, rebuilt
from empty with production's posture (new `public` tables go to `service_role`
only; `anon`/`authenticated` get nothing by default). Before wiping, its data
was checked: one database, one synthetic `@example.test` user, zero occasions.
The old stack, running the old migration, reproduced the bug first:
`permission denied for table passport_occasion_members` in `next.log`.

| Check                                                                  | Result                                                                    |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `verify.sql`                                                           | 10 rows, all `OK` (incl. "authenticated can SELECT every occasion table") |
| `grants-check.sql` (Hockey scope)                                      | 4 rows, all `OK`; each of 4 deliberate breakages caught                   |
| `rls-attack.mjs`, real GoTrue + PostgREST, strict grants               | **53/53**, 0 failures                                                     |
| Browser: `acceptance` (host desktop + guest phone + strangers)         | pass                                                                      |
| Browser: `plan-and-results`                                            | pass                                                                      |
| Browser: `multi-night` (two concurrent nights, isolation, Run it back) | pass                                                                      |
| Browser: `mobile` 320 px and 375 px                                    | pass (0 px overflow, 0 small taps)                                        |
| Browser: `email-confirmation` ×2 (stack with `CONFIRM_EMAIL=1`)        | pass                                                                      |
| `tsc --noEmit`; `vitest run src/domain/hockey`                         | clean; 47/47                                                              |

Meaning, against what was asked: the Conference failure cannot recur _for this
migration_ (the grant is stated, `verify.sql` and `grants-check.sql` fail
without it); RLS still decides every row (anon refused, strangers refused, 53
attacks); single-use links admit exactly one of four simultaneous redeemers;
two concurrent nights stay separate.

**Not verified, and why.** Production itself (no credentials, by design — the
claim "production applies no default grants" is the Conference post-mortem's,
not re-measured here). The full Passport suite (`eslint .`, `next build`,
repo-wide vitest/playwright) was not re-run: only SQL, `.mjs` and a docs-lane
config changed, and the last full run is §12/`RELEASE-HANDOFF.md`. The
Atlas-backed places in the browser runs come from `atlas-stub.mjs` (synthetic).

**Found while building the check — not Hockey's, not touched.**
`grants-check.sql` with scope `%` reports on the **baseline** tables
(`passport_events`, `passport_profiles`, `passport_board_*`, …) in the
stack's baseline: policies that admit `anon`/`authenticated` for operations the
role holds no privilege for, and `anon`/`authenticated` holding
TRUNCATE/REFERENCES/TRIGGER. The baseline migration says its grants are "the
dump's own text", so this may be production's real state; I could not check.
PostgREST does not expose TRUNCATE, so this is hygiene, not a known hole.
Owner/`passport-domain` decision — run the check at scope `%` against
production (read-only) and look.

### Exact remaining steps (all the owner's; nothing below has been done)

The night is Sunday 25 October. In order:

1. **Fetch the commit**: `git fetch metatron:passport/main feature/hockey`, and
   review the diff. Merge into the release line with the rest of the release
   (it is not pushed from here).
2. **Supabase → Authentication → URL configuration**: add
   `https://gohaveaday.com/**` and `https://elk-passport.vercel.app/**`. Decide
   Confirm email; if on, custom SMTP (§5.2).
3. **Check the grant gap first** (project `frllwwxesxbmmaadzfaf`, SQL editor):
   `select has_table_privilege('authenticated','public.passport_conference_members','select');`
   `false` confirms production applies no default grants, and that the
   Conference grant migration (`20261016000000_…`) is also still owed.
4. **Run, in the SQL editor, never `supabase db push`**: `preflight.sql` (all
   OK) → `migration.sql` → `verify.sql` (10 rows, all OK). If the older
   migration was ever applied, run the new one anyway: it is guarded and only
   adds the grants.
5. **Run `verification/grants-check.sql`** in the same editor (read-only). Four
   rows, all `OK`. This is the check that would have caught Conference.
6. **Deploy** through the coordinated release. Env: same Supabase project as
   step 4; `ATLAS_API_URL` without `/api`.
7. **Smoke test with two real accounts before inviting anyone**: §6, then §7.
   Includes signing in as the second account and reading the night — a
   permission failure shows there first.
8. Decisions still open (§10): email confirmation, issuing origin, doctrine
   §15.12. Rollback: `disable.sql` / `rollback.sql` (§3).
