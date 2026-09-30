# The Passport-owned database

**Captured 2026-09-27**, from the live database, because until this commit it
existed in exactly one place: the running Supabase project. There were no
migrations, no DDL and no schema dump anywhere in this repository — eight
tables, fourteen row-level-security policies and four `SECURITY DEFINER`
functions that a person could read about in `docs/architecture/passport-core.md`
and could not recreate from it.

## What Passport owns

`migrations/20260927000000_passport_baseline.sql`, in full:

| Object                                            | What it holds                                                     |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| `passport_profiles`                               | display name, home area, timezone — what somebody **is**          |
| `passport_preferences`                            | key/value, `CHECK (source = 'explicit')` — what somebody **said** |
| `passport_october_things`                         | `ahead` / `lived`, one row per person per entity                  |
| `passport_movie_reactions`                        | `loved`/`good`/`meh`, felt fear, one word                         |
| `passport_board_members`                          | who else may reach a board, and as what role                      |
| `passport_board_invites`                          | share-link tokens, expiry, revocation                             |
| `passport_events`                                 | append-only change log, streamed by Supabase Realtime             |
| `passport_recently_viewed`                        | **created and never wired** — see below                           |
| `passport_board_role`, `passport_is_board_member` | policy helpers                                                    |
| `passport_describe_board_invite`                  | what a link says, readable while signed out                       |
| `passport_redeem_board_invite`                    | joining a board from a link, idempotent                           |

Every `user_id` references `auth.users(id) ON DELETE CASCADE`, so a deleted
account takes its own rows with it. RLS is enabled on all eight tables; `anon`
holds no DML on any of them.

## What Atlas owns, in the same database

`boards` and `board_items` are **Atlas's** tables and are deliberately absent
from this baseline. A board and its contents belong to the knowledge backend
that answers for their owner; only the sharing layer around them is Passport's,
which is why membership lives here and ownership does not
(`docs/architecture/passport-core.md`).

Atlas also owns every other table in that `public` schema — `entities`,
`source_records`, `relationships`, `temporal_claims` and the rest — and it owns
the project's **migration history**. Both products currently share one Supabase
project.

## Two hazards that follow from sharing a project

1. **Never run `supabase db push` from this repository against the shared
   project.** Its `supabase_migrations.schema_migrations` table is Atlas's
   history; pushing from here would insert a row Atlas does not know about and
   the next Atlas push would report a divergent history. Apply Passport changes
   to the shared project through the SQL editor, or from a repository that owns
   the history.
2. **`page_compositions` does not exist.** `src/lib/passport/composition.ts`
   reads it, and the live database has no such table in any schema (verified
   through PostgREST: `PGRST205 Could not find the table`). The curator
   composition feature therefore silently falls back to its defaults. This
   baseline does **not** invent the table: it records what is there.

## How this was captured

```
supabase db dump --linked --schema public      # run from ../atlas, which owns the link
```

then filtered to the Passport-owned objects. Every table definition, check
constraint, function body, policy expression and grant in the baseline is the
dump's own text. Two deliberate departures, both for portability:

- `passport_events.id` carries `GENERATED ALWAYS AS IDENTITY` inline rather than
  as a following `ALTER TABLE`, so that `CREATE TABLE IF NOT EXISTS` cannot
  leave the column without its identity.
- `ALTER ... OWNER TO "postgres"` lines are omitted, so the file can be applied
  by whatever role owns a fresh project.

## Why every statement is guarded

The objects already exist in production. A baseline that assumed otherwise
would be a file nobody could ever safely run. So each one is conditional —
`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE
FUNCTION`, and a `do $$ ... if not exists ... end $$` around every constraint
and every policy. Run against the live project it changes nothing. Run against
an empty database it creates the contract in full.

**Verified, not asserted** (2026-09-27): applied twice to an empty PostgreSQL
17 with a stubbed `auth` schema. The first run created 8 tables, 48 columns,
8 primary keys, 8 foreign keys, 9 check constraints, 6 indexes, 4
`SECURITY DEFINER` functions, RLS on all 8 tables and 14 policies — matching
the live capture object for object. The second run changed nothing and emitted
only _already exists, skipping_.

## Applying it to a fresh environment

```bash
supabase link --project-ref <new-ref>
supabase db push                # a project whose history this repository owns
```

Or, in a project Passport does not own the history of, paste
`migrations/20260927000000_passport_baseline.sql` into the SQL editor. It needs
Supabase's own `auth` schema (`auth.users`, `auth.uid()`) and the standard
`anon`, `authenticated` and `service_role` roles, which every Supabase project
has.

## Where the baseline is already out of date

`passport_october_things.entity_kind` has been rewritten twice since the
capture, both times by a migration in **Atlas's** chain, because that is the
repository that owns this project's history (hazard 1 above). The baseline
records the constraint as it stood on 2026-09-27 and must not be edited, so
the current list is here instead:

| When       | Migration                                      | `entity_kind` after it                                      |
| ---------- | ---------------------------------------------- | ----------------------------------------------------------- |
| 2026-09-27 | _(the baseline's capture)_                     | Place, Organization, Activity, Event, Movie                 |
| 2026-09-28 | `atlas 202609281400_october_things_experience` | Place, Organization, Activity, Event, **Experience**        |
| 2026-09-30 | `atlas 202609301000_october_things_movie`      | Place, Organization, Activity, Event, Experience, **Movie** |

The middle row is the hazard made real. `Movie` had been added to the live
check by hand, outside both chains; the Experience migration rebuilt the list
from the previous _migration_ rather than from `pg_get_constraintdef`, and
dropped it again without anyone noticing. Passport's own `OCTOBER_KINDS`
(`src/lib/october/types.ts`) is the other half of this contract and is tested
against this table's list — see `src/lib/october/types.test.ts`.

**Open:** these files say this table is Passport's and every statement that
has ever changed it lives in Atlas. One of those two things should move.

## How to add a Passport schema change from here on

A new file in `migrations/`, named `<UTC timestamp>_<what it does>.sql`, holding
only forward changes, and nothing that drops or rewrites a column somebody's
rows are in. Do not edit the baseline: it is a record of what was captured on
one day, and rewriting it would destroy the only evidence of what production
actually looked like.
