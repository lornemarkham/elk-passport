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
| Announcements   | `passport_adventure_notices` (ADR 014): the host's, kinds `snow-update` / `snow-change`     |
| Photos, moments | `passport_adventure_moments` (ADR 014): kinds `photo` / `moment`                            |

Everything a snow day has that the core does not is a typed extension,
`supabase/migrations/20261103000000_passport_snow.sql`, fifteen `passport_snow_*` tables keyed
by adventure id: each person's level and gear, options and **one vote per person
per topic** (a primary key, not a promise), the host's decisions, **crew chat**, crew challenges and completions (**points are derived on read,
never stored**), predictions and guesses, check-ins, packing, ideas for the next
day, and the playlist. Announcements and shared photos are the core's (above),
not Snow's.

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
  (locks options, sets the date, announces "plan changed"; announcing is the
  core's rule for notices: the host's alone). You can remove what you
  added; the host can remove anything in their day.
- **Nobody's account id leaves the server.** People are the core's random
  `member_id`.
- **Invite links** reveal only "this works, and it is for a snow day". A link
  made for a Hockey Night cannot be redeemed as a snow day.
- **Leaving** (or being removed) deletes that person's own data (level, votes,
  guesses, completions, check-in, packing) and the photos and moments they
  shared, which live on the core's table (`passport_snow_member_gone`, snow
  days only: any other kind keeps the core's rule that shared moments stay),
  and leaves what they added to the shared plan, shown as "Someone".
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
  meeting time, announce "plan changed" as a core notice) either happen
  whole or not at all. Before, a refused notice left a plan moved and nobody
  told; proven now by a notice Postgres refuses rolling back the lock-in and
  the date. Both are `SECURITY INVOKER`: RLS still decides every row.
- **Photos are raster only** (`jpeg`, `png`, `webp`) — in Postgres (the
  `passport_snow_moment_guard` trigger on the core's moments table, which
  acts on snow days alone and returns every other kind's row untouched), the
  request parser and the photo route (which also refuses a non-raster row
  written some other way), which also sends
  `Content-Security-Policy: default-src 'none'; sandbox`. An SVG served
  from Passport's origin could run script.

Still separate requests, and safe to repeat: joining (redeem the link, then
your level — a retry redeems nothing twice and only fills a missing level)
and changing your name with your level (two rows, both yours).

## ADR 014 resolved: Snow uses the core's announcements and moments

Done in the final Powder Day integration (2026-11-02), following the owner's
decision in ADR 014. Snow stores neither itself any more.

| Was                                                               | Is                                                                                                                   |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Announcements and "plan changed" in `passport_snow_posts`         | `passport_adventure_notices` — kinds `snow-update`, `snow-change`; `passport_snow_posts` is chat                     |
| Any crew member could post an "announcement"                      | The host announces (the core's rule); everyone else uses chat                                                        |
| Photos and moments in `passport_snow_moments`                     | `passport_adventure_moments` — kinds `photo`, `moment`; no Snow table                                                |
| Raster-only, 16 photos a day, 6 adds a minute: a table constraint | The same rules, as `passport_snow_moment_guard` on the core table, for snow days only                                |
| Leaving a snow day took your photos                               | Unchanged for snow days (the member-gone trigger deletes them from the core table); other kinds keep the core's rule |

Consequences, stated rather than hidden:

- `20261103000000_passport_snow.sql` now **requires**
  `20261101000000_passport_adventure_together.sql` (preflight row 4 checks).
- **"Got it" is not asked** on Snow's notices (`ask_ack = false`): Snow's
  screens have no place to say it, and a notice that waits for an
  acknowledgement nobody can give would lead the page for ever. The core
  supports it when Snow's UI does.
- A "plan changed" notice has no flood limit of its own any more (the old one
  shared the chat's). Only the host can write one, and only by settling the
  plan; the headline is capped at 120 characters by the core.
- The one Snow object touching a core table is the guard trigger. Rollback
  drops it; a snow day's notices and photos then stay as ordinary core rows.
