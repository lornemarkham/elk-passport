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

## Integrated (Powder Day release, 2026-11-02)

The three proposals were made, by the release mission, with two review fixes:

1. **Migration** — `supabase/migrations/20261103000000_passport_snow.sql`.
   Requires only `20261021000000_passport_adventures.sql`. Preflight and
   rollback stay here (`shared-preflight.sql`, `shared-rollback.sql`).
2. **Kind** — `snow-day` in `ADVENTURE_KINDS`, `home: "/snow/day"` (so
   `/adventures/<id>` opens the snow day) and `startable: false` (a snow day
   starts on `/snow`, where the host's level is written with the adventure).
3. **Nav** — "Snow Day" is the fifth entry in the Experiences menu.

Review fixes, both in the migration and the server:

- **Changes that go together are one transaction.** Starting a shared day
  (`passport_snow_start`: adventure, day row, host's level) and the host
  settling the plan (`passport_snow_decide`: lock a choice, set the date and
  meeting time, post "plan changed") either happen whole or not at all.
  Before, a refused notice (the chat flood limit) left a plan moved and
  nobody told. Both are `SECURITY INVOKER`: RLS still decides every row.
- **Photos are raster only** (`jpeg`, `png`, `webp`) — in Postgres, the
  request parser and the photo route, which also sends
  `Content-Security-Policy: default-src 'none'; sandbox`. An SVG served
  from Passport's origin could run script.

Still separate requests, and safe to repeat: joining (redeem the link, then
your level — a retry redeems nothing twice and only fills a missing level)
and changing your name with your level (two rows, both yours).

## Named, for an owner decision: ADR 014 overlap

ADR 014 (accepted 2026-11-01, after this lane branched) puts announcements
and shared moments on the core (`passport_adventure_notices`,
`passport_adventure_moments`) and names Snow as an adopter. Snow ships its
own: announcements and "plan changed" notices share `passport_snow_posts`
with chat, and moments and photos live in `passport_snow_moments`. They
differ on purpose today: any crew member may post a Snow update (core:
owner only, with _Got it_), and leaving a snow day takes your photos with
you (core: they stay). Not changed in this release. Moving them before real
photos accumulate is the cheaper time; see the release record.
