# Snow: one shared day, many phones

A snow day can now be **shared**: one day on the server that every phone in the
crew reads and writes, instead of a copy per phone. The no-account, one-phone
day still exists and is untouched (it is what works on a mountain with no
signal); "Plan it together, live" on the start screen makes the shared kind.

## What is shared, and where it lives

A shared day is an ordinary Passport **adventure of kind `snow-day`**
(ADR 009, `passport_adventures`). The core already does what a group needs and
Snow does not re-implement any of it:

| Need            | Where it lives                                                                              |
| --------------- | ------------------------------------------------------------------------------------------- |
| Crew membership | `passport_adventure_members` (owner = host, everyone else participant; random `member_id`s) |
| Invitations     | `passport_adventure_invites` (SHA-256 only, expiring, capped at 24 people, revocable)       |
| Title, date     | `passport_adventures`                                                                       |

Everything a snow day has that the core does not is a typed extension,
`docs/product/snow/shared-migration.sql`, sixteen `passport_snow_*` tables keyed
by adventure id: each person's level and gear, options and **one vote per person
per topic** (a primary key, not a promise), the host's decisions, **chat and
announcements**, crew challenges and completions (**points are derived on read,
never stored**), predictions and guesses, check-ins, packing, ideas for the next
day, the playlist, and shared moments and **photos**.

Reuse over invention: no new membership, invite, or permission code. Votes and
options are Snow's own tables rather than core `items`/`responses` because they
are not places on a plan: a vote has to be one per topic, and "Date: Saturday"
is not a stop. Chat, challenges and predictions have no core equivalent.

## How a change travels

```
phone ── Action ──▶ POST /snow/api/[id]   (parseAction: nothing a phone sends is believed)
                      │ loadDay (reads as the signed-in person; RLS decides what exists)
                      │ plan():  applyAction (the same function the screen ran)
                      │          + who may do it (host-only, "as yourself" only)
                      │ ops ──▶ inserts/updates/deletes, as the person, through PostgREST
                      ▼
phone ◀─ the day (assembled from rows; polled every 5 s while the page is visible)
```

`applyAction` is still the only place a change is _decided_. The screen runs
`plan()` too, so a refusal costs no round trip, and the server runs it again
because the server does not trust the screen. **Postgres has the last word**:
every refusal that is not a sentence from `plan()` is row-level security,
proven in the stack test.

No AI is involved anywhere in this path: a change is a pure function and some
inserts.

## Privacy

- **Only members read.** Every table is members-only, and "member" means
  _member of a `snow-day` adventure_: a Hockey Night member, a stranger and a
  signed-out visitor get nothing (tested by direct PostgREST calls, not just
  through the app).
- **You write as yourself.** Every row carries `user_id = auth.uid()`; the
  server also refuses any action naming someone else. Only the host decides
  (locks options, sets the date, posts "plan changed"). You can remove what you
  added; the host can remove anything in their day.
- **Nobody's account id leaves the server.** People are the core's random
  `member_id`.
- **Invite links** reveal only "this works, and it is for a snow day". A link
  made for a Hockey Night cannot be redeemed as a snow day.
- **Leaving** (or being removed) deletes that person's own data (level, votes,
  guesses, completions, check-in, packing, moments and photos) and leaves what
  they added to the shared plan, shown as "Someone".
- **Photos** are served to members only, by a route that asks Postgres as the
  caller; a guessed id is the same 404 as a missing one.
- Location sharing remains out of scope; if it arrives it follows ADR 011.

## What is still on one phone

- A day made without an account stays on that phone. There is no "upgrade this
  one to shared" yet (see the report).
- A shared day needs signal to change. The page keeps showing what the crew
  last had and says changes will not reach them; there is no offline queue.
- Every Snow action carries over to a shared day, except adding a person by
  hand: people join by invitation (a test fails if a new action has no rows).

## Proposals for the contracts lane (not made here)

This lane owns `src/*/snow` and `docs/product/snow`. It changed no shared file.

1. **Migration.** Copy `docs/product/snow/shared-migration.sql` to
   `supabase/migrations/<stamp>_passport_snow.sql`, unchanged below its header.
   Requires only `20261021000000_passport_adventures.sql`. Preflight and
   rollback sit beside it.
2. **Kind.** Add to `ADVENTURE_KINDS` in `src/lib/adventures/kinds.ts`:
   `{ id: "snow-day", label: "Snow Day", blurb: "A day on the mountain, with the crew.", joinVisibility: "members" }`.
   Nothing depends on it: the kind is an open string and Snow's code creates it
   directly. It only makes `/adventures` say "Snow Day" instead of "Adventure".
3. **Nav.** `{ href: "/snow", label: "Snow Day", testId: "snow" }` in
   `PassportNav`'s `EXPERIENCES`.
