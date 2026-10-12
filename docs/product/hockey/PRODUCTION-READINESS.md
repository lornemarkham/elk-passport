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
- **Grants posture** is the one Supabase gives every project (`anon`/`authenticated`
  hold ALL on new `public` tables), which is exactly what the attack run used, so
  RLS — not a missing grant — is what was tested.
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
- [ ] "What's near the arena?" → either places or the honest "Passport doesn't know anywhere nearby" (expected today: Atlas has no food near Rogers Arena).
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
- **Atlas knowledge request** for food near Rogers Arena stands (README): the picker
  will honestly say "nowhere nearby" on production until Atlas has it.
