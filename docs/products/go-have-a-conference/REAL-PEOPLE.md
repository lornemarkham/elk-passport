# Real people — two colleagues, one conference, shared and durable

> **Status: built on `feature/go-have-a-conference`, 2026-10-11 (committed
> locally).** Not merged, not deployed, **migration not applied to any real
> Supabase project**. Verified only against a local PostgreSQL + GoTrue +
> PostgREST.

## The milestone, and whether it is met

> Two real signed-in colleagues can join the same conference experience and
> see persistent shared state.

Met, locally. With `CONFERENCE_STORE=supabase`, conferences, memberships,
links and codes live in Postgres, and every query runs **as the signed-in
person under row level security**, never with a privileged key. A restarted
server loses nothing. The foundation was a good one: only the store, the
config and the join path needed to change; the service, views, pages and
module contract did not.

## What existed

- **The foundation** (`f8b13ee`): conference, branding, links, codes, two
  roles, visibility (hidden by default), leave-and-forget, expiry, the module
  contract and `ConferenceLifecycle`. All of it ran on a **per-process memory
  store with signed guest cookies**, so "shared" meant "shared inside one
  Node process". Two real people on Vercel would have seen different
  conferences.
- **Arrivals** (uncommitted, from an earlier session on this branch): live
  ADS-B map. Untouched here. Its store is also memory-only (see gaps).
- **Discover**: doors into Go Have A Day from the town. Untouched.

## Can Hockey Night's occasions support Conference?

Not yet, and not by stretching them. Read from `lane/hockey`
(`docs/product/hockey/migration.sql`, unmerged, unapplied), not modified.

| Hockey's `passport_occasion_*`                    | Conference needs                                               |
| ------------------------------------------------- | -------------------------------------------------------------- |
| One `host_id`                                     | Several organisers                                             |
| Invites: hashed, **single use** (`uses < max`)    | Many-use links with optional expiry, **and** typed access code |
| Members: `host` / `guest`, emoji, hue, vibe, edge | `organiser` / `member`, name + visibility choice               |
| Retention: none                                   | Erase 30 days after the last day, everywhere                   |
| `starts_at` is the night                          | Multi-day, in a named time zone                                |

**Reused:** the whole _security model_ (identity is `auth.uid()`; anon key +
the caller's session; RLS as what the server sees; `SECURITY DEFINER` helpers
to avoid policy recursion; `SECURITY DEFINER` redeem functions that require a
session; column-level `GRANT UPDATE` instead of triggers; the local
GoTrue/PostgREST stack and the PostgREST attack-script approach). `stack.mjs`
was adapted, on its own ports and data directory, so both lanes' stacks can
run at once.

**Not reused:** the tables. The right long-term shape is probably one generic
"gathering" membership that both products sit on, but that is a migration
across two unmerged lanes and a decision for a human (it is the same question
as ROADMAP D1). Until then, two sets of tables with the same shape and the
same rules is the honest state, not a hidden one. Authentication, membership
and invitation logic was **not** duplicated in code: sign-in is Passport's
`/auth` and `currentUser()`; the Conference service is unchanged.

## What was implemented

| Piece                                                                                                                                                                                                                                                                                                                                                   | Where                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Four tables, RLS, 10 functions (headcount, describe/redeem invite, redeem code, code-taken, remove, expired, role helpers). A hidden member's row is readable by themselves and organisers only; the access code and links are organiser-only; the founder is the only person who can insert a membership directly; everyone else enters via `redeem_*` | [`migration.sql`](migration.sql)                                |
| `supabaseStore`: the `ConferenceStore` over PostgREST as the signed-in user                                                                                                                                                                                                                                                                             | `src/lib/conference/supabaseStore.ts`                           |
| Store seam: `redeemInvite`, `redeemCode`, `describeInvite`, `headcount`, `codeTaken`. Joining is one atomic store step (a stranger holding a code cannot read the code table, so the service cannot "look up, then add")                                                                                                                                | `store.ts`, `service.ts` (memory store follows identical rules) |
| `CONFERENCE_STORE=supabase`: **no guests**, no guest cookie honoured, no `CONFERENCE_SECRET` needed. Unknown store names close the feature rather than fall back                                                                                                                                                                                        | `config.ts`, `request.ts`                                       |
| Sign in **through** a link or code and come back to it (`/auth?next=`); copy says accounts are needed in this mode                                                                                                                                                                                                                                      | invite page, `JoinWithCode`, `AcceptInvite`                     |
| The home page re-asks every 8 s while the tab is visible, so a colleague appearing in "Who's here" doesn't need a reload                                                                                                                                                                                                                                | `LiveRefresh.tsx`                                               |
| Local stack + attack script + two-browser acceptance                                                                                                                                                                                                                                                                                                    | `scripts/conference-stack/`                                     |

Memory mode is unchanged for development (guests, no Supabase needed).

## Real-user acceptance (`scripts/conference-stack/acceptance.spec.ts`)

Separate browser contexts, each signing up through Passport's own `/auth`
against a real GoTrue; Bob on a 390 px phone. **Passed**, phase 1, then the
Next server was killed by PID and restarted, then phase 2 **passed**.

1. Alice signs up, starts "Sycle Vancouver 2026", turns on a code, makes a link.
2. A signed-out visitor with the link sees the invitation and "you'll need an
   account", **no roster**; `/conferences/{id}` is 404; the API is not 200.
3. Bob signs up _through the link_, is returned to it, joins. Headcount 2.
4. Carol types the code (sloppily), is sent to sign up, comes back, joins.
   Headcount 3, and she saves a name while staying hidden.
5. Bob chooses to be seen. **Carol's open page shows "Bob" without a
   reload.** Alice and Bob both show 3; **nobody sees Carol's name.**
6. Alice's admin lists all 3; Bob opening `/admin` is turned away.
7. Eve (signed in, stranger): `/conferences/{id}`, `/admin`, `/arrivals`,
   `/discover` are all 404; a wrong code gets the ordinary wrong-code answer.
8. **After a server restart:** Alice and Bob log back in; everything is there.
   A used link takes Bob home. Alice removes Bob; Bob's next request is 404
   and the conference is gone from his list.

Also green: the existing memory-mode e2e (`conference.spec.ts`,
`conference-arrivals.spec.ts`), `tsc`, `eslint` on the touched code, and
vitest (165 files, 2,099 tests, including new config and headcount tests).

To rerun:

```
node scripts/conference-stack/stack.mjs start        # needs /tmp/conference-stack/{bin,node_modules}
node scripts/conference-stack/rls-attack.mjs         # 68 attacks at PostgREST
set -a; . /tmp/conference-stack/env; set +a
CONFERENCE_STORE=supabase ATLAS_API_URL=http://127.0.0.1:1 npm run build
CONFERENCE_STORE=supabase ATLAS_API_URL=http://127.0.0.1:1 npx next start -p 3150
E2E_PORT=3150 npx playwright test -c scripts/conference-stack
# restart the server by PID, then:
E2E_PHASE=after E2E_PORT=3150 npx playwright test -c scripts/conference-stack
```

(`NEXT_PUBLIC_*` is inlined at build, so build with that env. Always set
`ATLAS_API_URL`: its default is Lodge on Metatron.)

## Security verification

`rls-attack.mjs`: **68/68**, straight at PostgREST with real JWTs (the
authority a member has in production), repeatable on one database. Includes:

- signed-out: reads nothing from any table; cannot redeem; can ask only what a
  _good_ link is to, and learns nothing from a made-up or expired one
- stranger: reads nothing; no headcount; cannot edit, delete, remove, add
  themselves (as member, or as an organiser "founder"), found a conference in
  someone else's name, or make links/codes
- a founder cannot add other people to their conference by hand
- member: sees themselves and people who chose to be seen, **not hidden people,
  not even the organiser**; headcount still counts everyone; cannot read links
  or codes, promote themselves, take another's `member_id`, rename or remove
  others, edit or take over the conference, or reset a link's uses
- organiser: sees all; cannot hand-edit `uses` or roles
- redemption: idempotent and spends one use; wrong, expired, revoked links and
  wrong codes admit nobody; **a one-use link admits exactly one of two
  simultaneous people**; someone already in follows a dead link home
- expiry: an expired conference is found and removed by anyone signed in, and
  everything cascades

Two real defects were found by running it for real, not by reading: the
creator column had no `DEFAULT auth.uid()`, and the invite page crashed for
signed-out visitors because purge-on-read called an authenticated-only
function.

## Remaining gaps

1. **The migration has not been applied anywhere real.** A human pastes it
   into the SQL editor (supabase/README.md hazard 1), then `passport-domain`
   lands it in `supabase/migrations/`.
2. **Arrivals is still per-process memory.** With `supabase` in production the
   conference is shared but a member's flight is not, so it would look
   different on different instances. Keep `arrivals` off such a conference
   until it has a durable store with an FK to `passport_conferences`.
3. **No guests, therefore D2 is decided in code, not by a person**: in this
   mode all 160 colleagues need an account (and email confirmation, if
   production Supabase requires it — Hockey found the same). This is a
   provisional default, not the product decision.
4. **Expiry is on read**, for conferences the caller is in, plus the optional
   `pg_cron` line. A conference nobody opens again lingers until cron runs.
5. **Invite tokens are stored in plain text**, readable only by organisers
   (so the admin screen can show the link again). Hockey hashes them and shows
   once. Hash them if that trade is wrong.
6. `passport_conference_code_taken` tells any signed-in person whether a code
   exists (needed to avoid collisions; the code is 9 chars of a 31-letter
   alphabet). The brake on wrong codes is still per-instance memory.
7. Code changes are delete-then-insert (two calls, not atomic).
8. `ARCHITECTURE.md` §7 still describes the privileged-key plan below the new
   note; FEATURES/ROADMAP/ARCHITECTURE have one-line pointers only, because
   those files carry uncommitted arrivals edits that are not mine to commit.
9. Not built, deliberately: suggestions, meal/meeting-point plans, group
   decisions, schedule, playful moments. Those are `plans`, `schedule`,
   `community` (ROADMAP §2.2), and each needs this durable base first.

## Next recommended milestone

**"Anyone coming?"** (`plans`): a member proposes a meal or meeting point
(an Atlas place id, a time), others tap _I'm in_, and the proposer sees who.
It is the smallest feature that makes colleagues _do_ something together
rather than merely be listed, and it is the first real test of the module
contract on the durable store: a `passport_conference_plans` table keyed on
`(conference_id, member_id)` with `ON DELETE CASCADE`, RLS reusing
`passport_conference_is_member`, interest named only by choice (doctrine §2.2),
and the same attack-script and two-browser treatment. Before it: apply the
migration to a real project (human), decide D2, and give Arrivals a durable
store.
