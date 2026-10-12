# Go Have A Conference — Labs release candidate

> **Status 2026-10-12.** Branch `release/conference-labs-rc`. **Not merged, not
> deployed, migration not applied to any real Supabase project.** Everything
> below was verified against a local PostgreSQL + GoTrue + PostgREST
> (`scripts/conference-stack/`), never a real project.

## What is in it

| Piece                                                                                             | State in Labs                                                                   |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Conference foundation: create, branding, access code, invite links, roles, visibility, expiry     | **On**, with `CONFERENCE_STORE=supabase`. Passport accounts only, no guests     |
| Durable store (`supabaseStore`) running as the signed-in person under RLS, never a privileged key | **On**                                                                          |
| `discover` module (doors into Go Have A Day)                                                      | **On**                                                                          |
| `arrivals` module (live ADS-B map)                                                                | **Integrated, deliberately closed.** Its flights are per-process memory (below) |

### Why Arrivals is closed

Arrivals keeps each member's flight in `memoryArrivals()`. On Vercel every
instance has its own memory, so a durable, shared conference would show
different flights to different people and lose them on a cold start.
`src/lib/conference-arrivals/enabled.ts` therefore opens Arrivals only when
`ARRIVALS_STORE_DURABLE` is true (it is `false`, a constant, not an env var) **or**
in development on the memory conference store. In production, and on
`CONFERENCE_STORE=supabase` anywhere, the page says "Arrivals isn't open yet.",
the API answers 404 to everyone (organiser included), the home card says "Not
open yet", and ADS-B is never called. The 68-attack RLS script and the
two-browser acceptance run check this (acceptance asserts it as Alice, the
organiser).

**To open it:** a `passport_conference_arrivals` table keyed on
`(conference_id, member_id)` with `ON DELETE CASCADE` from
`passport_conferences`, RLS reusing `passport_conference_is_member`, a
`supabaseArrivalsStore`, the same attack script and acceptance treatment, then
flip `ARRIVALS_STORE_DURABLE`. Not done: it is a second migration and a second
round of owner steps, and the mission said to keep it closed rather than
rush it.

## Verified (2026-10-12)

| Check                                                                                      | Result                                                                                                                 |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `npx vitest run`                                                                           | 166 files, 2,104+ tests pass (includes the closed-Arrivals and `arrivalsEnabled` tests)                                |
| `rls-attack.mjs`, straight at PostgREST with real JWTs                                     | **68/68**, on a database built from the file in `supabase/migrations/`                                                 |
| Migration applied to an empty DB, then again                                               | Second run changes nothing (guarded statements)                                                                        |
| Two-browser acceptance on `CONFERENCE_STORE=supabase`, server killed by PID between phases | Phase 1 and phase 2 pass                                                                                               |
| `e2e/conference.spec.ts`, `e2e/conference-arrivals.spec.ts` on `next dev` (memory store)   | Pass                                                                                                                   |
| Full Playwright suite, `next start`, Supabase placeholders, no Atlas                       | 40 pass, 9 fail: exactly the known environmental baseline (core-loop:26, nfr:236/265/278/300/320/342, october:554/570) |

Covered by those runs: **authentication** (everything signed-out is 404/401;
no guest cookie is honoured), **invitations** (idempotent redemption; wrong,
expired, revoked and used-up links and wrong codes admit nobody; a one-use link
admits exactly one of two simultaneous people), **privacy** (hidden members
readable by themselves and organisers only; headcount names nobody; codes and
links organiser-only; no role escalation, no hand-edited `uses`) and
**expiry** (an expired conference is invisible, redeems nothing, and is
deleted with everything under it by anyone signed in).

## Exact steps to go live (owner)

None of these has been done.

1. **Merge** `release/conference-labs-rc` into `main` (a human decision; it
   adds one dependency, `maplibre-gl`, used only by the closed Arrivals page).
2. **Apply the migration, in the Supabase SQL editor** of the production
   project: paste `supabase/migrations/20261012000000_passport_conferences.sql`
   and run it. **Do not `supabase db push`** from this repository: the
   project's migration history is Atlas's (`supabase/README.md`, hazard 1).
   It is guarded, so a second run is harmless.
3. **Check it landed.** In the SQL editor:
   ```sql
   select count(*) from pg_policies where tablename like 'passport_conference%'; -- 9
   select relname, relrowsecurity from pg_class
     where relname like 'passport_conference%' and relkind = 'r';               -- 4 rows, all true
   ```
   Then, as the `anon` role, `select * from passport_conferences` must be
   denied, and the REST URL `/rest/v1/passport_conferences` with only the anon
   key must return 401/empty.
4. **Decide D2** (ROADMAP): in this mode all participants need a Passport
   account. If production Supabase requires email confirmation, they must also
   confirm it. Check Authentication settings and that the **Site URL** and
   **Redirect URLs** include the deployed origin, or sign-in-through-a-link
   will not return people to their invitation.
5. **Set the environment variable** `CONFERENCE_STORE=supabase` on the Vercel
   project (Production, and Preview if you want it there). Nothing else is
   needed: `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` already
   exist for Passport, and the service-role key is not used. Until step 5,
   conferences answer "Conferences aren't open here yet." in production.
6. **Deploy**, then smoke-test with two real accounts on two devices: create,
   code, link, join, choose to be seen, see each other without reload, leave,
   and confirm a third signed-in stranger gets 404 on every
   `/conferences/{id}/...`.
7. **Schedule expiry (recommended).** Expiry is otherwise purge-on-read, so a
   conference nobody opens lingers. With `pg_cron` enabled:
   ```sql
   select cron.schedule('conference-expiry', '0 * * * *',
     $$delete from public.passport_conferences where now() >= retain_until$$);
   ```
8. **Tell invitees what to expect:** a link or code, a Passport account, and
   that they are hidden until they choose otherwise.

**Rollback:** unset `CONFERENCE_STORE` (conferences close; nothing is
deleted). To remove the data, `drop table passport_conference_invites,
passport_conference_members, passport_conference_codes,
passport_conferences cascade;` and drop the `passport_conference_*` functions.

## Open and not decided here

- **Where "Labs" is.** There is no Labs entry for conferences: `/conferences`
  is unlisted and closed until step 5, and no navigation links to it. That is
  the only gate. If Labs should mean an allow-list or a `/labs/...` route, that
  is a product decision not made here.
- **D2 (accounts only)** is decided in code as a provisional default, not by a
  person. See REAL-PEOPLE.md gap 3.
- **Invite tokens are stored in plain text** (organiser-readable), and the
  wrong-code brake is per-instance memory (REAL-PEOPLE.md gaps 5 and 6). Fine
  for a handful of invited colleagues; revisit before a public launch.
- **Migration location.** The file now sits in `supabase/migrations/` as
  Passport's second Passport-owned migration; the baseline README says the
  history belongs to Atlas. Whichever repository owns the history should
  adopt it after step 2.
