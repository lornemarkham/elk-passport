# Go Have A Conference — Labs release candidate

> **Status 2026-10-12.** Branch `release/conference-labs-rc`. **Not merged, not
> deployed, migration not applied to any real Supabase project.** Everything
> below was verified against a local PostgreSQL + GoTrue + PostgREST
> (`scripts/conference-stack/`), never a real project.

## What is in it

| Piece                                                                                             | State in Labs                                                               |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Conference foundation: create, branding, access code, invite links, roles, visibility, expiry     | **On**, with `CONFERENCE_STORE=supabase`. Passport accounts only, no guests |
| Durable store (`supabaseStore`) running as the signed-in person under RLS, never a privileged key | **On**                                                                      |
| `discover` module (doors into Go Have A Day)                                                      | **On**                                                                      |
| `arrivals` module (live ADS-B map)                                                                | **Durable store built; closed until `CONFERENCE_ARRIVALS=on`** (below)      |

### Arrivals: durable store added (2026-10-14), still closed until you open it

Arrivals now has `supabaseArrivals` (`src/lib/conference-arrivals/supabaseStore.ts`)
and `supabase/migrations/20261014000000_passport_conference_arrivals.sql`:
one row per member, readable by its owner, and by other members only if
the flight is shared **and** the owner chose to be seen. Writes go through
`passport_conference_arrivals_save()`. Rows cascade away when the person
leaves or is removed, and with the conference. On `CONFERENCE_STORE=supabase`
Arrivals opens only with `CONFERENCE_ARRIVALS=on` (so forgetting the
migration cannot turn saves into 500s); until then it says "Arrivals isn't
open yet." and never calls ADS-B.

Trust note: any member of a conference can refresh the _tracking_ of a
colleague's shared flight (whoever has the board open does the lookup, from
public ADS-B). They cannot change the flight or the sharing choice, cannot
touch an unshared or hidden member's flight, and cannot write anything that
isn't shaped like tracking (known phase, trail of at most 240 positions,
under 16 KB; enforced in the database). What the database cannot do is check
it against ADS-B: a malicious colleague can still write _false but
well-formed_ tracking (say "landed") onto a colleague's shared flight. That
is accepted for Labs and costs one wrong status line, corrected by the next
honest lookup.

Security review (2026-10-14) found and fixed, in the migration: the tracking
path accepted any JSON object (now validated); the definer functions'
`search_path` did not end in `pg_temp`; the size cap used compressed size.
No path lets a member overwrite another member's flight, sharing choice or
identity: direct INSERT/UPDATE are revoked, and `_save` writes the caller's
own row only under the caller's own member id.

Checked: `scripts/conference-stack/arrivals-attack.mjs` 33/33 against the local
stack; `scripts/conference-arrivals/restart-check.mjs` (two real accounts, one
shared flight and one private, app stopped and started as a new process:
everything still there, privacy intact); conference acceptance run still
passes with Arrivals closed by default. A live three-person run through the
app is `ACCOUNTS=1 scripts/conference-arrivals/drive.mjs`.

**Owner steps to open it** (after the conference migration is applied):
paste `20261014000000_passport_conference_arrivals.sql` into the Supabase SQL
editor, check `select count(*) from pg_policies where tablename =
'passport_conference_arrivals'` is 2, set `CONFERENCE_ARRIVALS=on` on Vercel,
and contact ADSB.lol about production use (see ARRIVALS.md).

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
