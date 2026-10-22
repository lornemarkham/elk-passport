# Hockey Night — Our Seats & arena navigation (2026-10-22)

**Status:** built and tested on `feature/hockey`, on a local stack only.
**Not deployed. Not migrated.** It needs one new table in production
(`seats-migration.sql`) before seats can be saved. Until then the section
says "Seats aren't switched on for this night yet". The meeting point,
directions and arena guide work without the table.

Brief: _Our Seats & Arena Navigation_ — help friends get from their
restaurant to the right arena entrance and find their seats.

Doctrine fit: §2.7 (LIVE) lists "directions, parking, entrances, ticket
information" as live context, and this is that. §6 says less phone, more life,
so the walk is handed to the map app the phone already has, and Passport
claims no indoor routing it doesn't hold. No §15 question is resolved here.
The one product decision made (who may set the meeting point) is listed under
_Decisions to confirm_.

---

## What it does

Plan tab, directly under **The plan** and above the dinner vote:

| Part                          | What a person can do                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The group's block**         | The host enters the seats they bought for everybody (section, row, seats, gate, note). Everyone sees it.                                                                                                                                                                                                                                                                      |
| **Who's sitting where**       | One line per member. **Add my seat** for anyone. A guest edits only their own; the host edits anyone's ("Entered by Lorne"). Section, row, seat or range, gate (or _Not sure yet_), note, and **Share with everyone on this night** (on by default; off = only you and the host). **Clear.** **Chat it** posts "🎟️ I'm in Section 309 · Row 12 · Seat 4" to the night's chat. |
| **Who's sitting together**    | Built from what people entered: same section → together; same row with touching seat numbers → "side by side". Someone with no seat is listed as _not known yet_. They are **never** assumed to be in the block.                                                                                                                                                              |
| **Meet at the arena**         | The host sets a gate, a spot in their own words and a time ("Gate 10 · Outside, by the doors · 6:15pm"), with walking directions to it. Guests see it. This is separate from the existing "Where are we meeting?" vote, which is still there.                                                                                                                                 |
| **Getting there**             | **From**: where I am now / the dinner pick / any place near the arena. **To**: the arena, or a gate. An estimated walk time, then **Google Maps** and **Apple Maps** walking-directions buttons, with Apple first on iPhone.                                                                                                                                                  |
| **Gates, getting in, access** | The eight gates as the arena's map draws them, getting-in rules, accessibility, each from the arena's own pages with links.                                                                                                                                                                                                                                                   |

### Honesty rules the screen keeps

- **No gate is ever chosen for a seat.** The arena publishes no
  gate-to-section mapping. The form says what the arena's map _does_ show
  ("draws Gate 1, Gate 2 and Gate 8 on the Level 300 plan. It doesn't say
  which gate is best for a seat — your ticket might") and preselects nothing.
- **Unknown entrance is said in words**: an orange _Entrance not known_ pill
  on the seat, and under Getting there: _Entrance not chosen — directions end
  at Rogers Arena._
- **Directions end at the arena, not at a gate**, because no gate has a
  verified point. When a gate is chosen, the screen says so: _"Passport has no
  verified location for Gate 10, so directions end at Rogers Arena. Gate 10 is
  north side, on Expo Boulevard…"_. To make a gate's directions end at the gate,
  add a checked `at` to it in `src/domain/hockey/arena.ts`. Nothing else
  changes.
- **No indoor navigation.** _"Inside: Section 309 is on Level 300, by the
  arena's map. Passport has no indoor directions — the arena's map and the
  ushers do."_
- **Walk time**: Atlas's routed walking time (`GET /travel/legs`, through the
  existing `/api/travel/legs` and `useTravelLegs`) when the restaurant and
  the arena are both Atlas places. Otherwise the existing straight-line label
  ("350 m straight line · 5+ min walk (estimate)"). A routed reading with an
  access caution is not used. Provider credit is shown as elsewhere.

## What was verified, and where from

Read from **rogersarena.com** on 2026-10-22 (the site blocks the fetch tool,
but a plain browser user-agent works). Every fact in `arena.ts` cites one of these:

| Source                                                                                      | Used for                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Arena map](https://rogersarena.com/map/) (directory map image dated 2026-09-29, 4500×8000) | The eight gates (1, 2, 3, 6, 7, 8, 10, 16), where each is drawn, and which level's plan. Section numbering: Plaza Level 100 = 101–122, Level 300 = 301–330, WC311/WC317, suites on 500. North/East/South elevators. Gate 7 = "RBC Priority Entrance". Streets: Expo Blvd, Pat Quinn Way, Pacific Blvd, Griffiths Way. |
| [Fans with disabilities](https://rogersarena.com/disabilities/) (2025-12-16)                | All entrances accessible except Gates 3 and 7. Gate 16 on Pat Quinn Way is the accessible drop-off. Guest Services at 114, 311 and 104 (hockey, club). Fan Services 604.899.7440.                                                                                                                                     |
| [Parking and directions](https://rogersarena.com/parking-and-directions/)                   | Stadium–Chinatown SkyTrain, Stadium exit directly across from Gate 10. No public parking at Canucks games.                                                                                                                                                                                                            |
| [FAQ](https://rogersarena.com/frequently-asked-questions/)                                  | Bag limit 14″×14″×6″. No in-and-out.                                                                                                                                                                                                                                                                                  |
| [Ticket info](https://rogersarena.com/ticket-info/)                                         | Mobile-ticket venue. Ticket Centre at Gate 10.                                                                                                                                                                                                                                                                        |

Copies of the pages and the map are in `~/passport/scratch/seats-research/`
on Metatron (not committed: they're the arena's content).

## What remains uncertain

1. **The arena's pages disagree with each other** (kept in
   `arena.ts → CONFLICTS`; the screen follows the newer page):
   - inaccessible entrances: Gates 3 and 7 (accessibility page) vs Gate 3 only
     (FAQ);
   - Gate 16: Pat Quinn Way (accessibility page, map) vs "off Abbott Street"
     (FAQ);
   - elevators: Gates 2, 9, 10, 16 vs 1, 9, 10, 16. The 2026 map has no Gate 9
     at all;
   - Level 300 Guest Services: section 311 vs 310.
2. **Gate positions are read off a schematic map**, not surveyed. "North
   side, by the Dunsmuir Viaduct" is how the map draws Gates 1 and 2. It isn't
   a street address.
3. **No gate has coordinates.** OpenStreetMap's Overpass API was down from
   here on 2026-10-22, so no entrance nodes were checked. Even if they had
   been, OSM is community data, and confirming it against the arena's map is
   a human step.
4. **Doors-open time for Canucks games** isn't on any page read. It isn't
   shown.
5. **Routed walk times depend on Atlas.** `GET /travel/legs` is
   "release-candidate-not-deployed" (`contracts.ts`). Today, production Atlas
   answers 404, Passport reads that as _not served_, and every walk shows the
   labelled straight-line estimate. Atlas's provider quota is 50 requests a
   day for the whole key. Each different restaurant chosen costs one request
   (memoised five minutes per server instance).
6. **Rogers Arena's Atlas id** is found at runtime by name, within 300 m and
   observed (`venueInAtlas`). If Atlas renames or moves it, the walk falls
   back to a straight line rather than routing to the wrong place.

## Database migration requirements

New in this lane, **proposed** for `supabase/migrations/` (a shared
contract this lane doesn't change):

| File                  | What                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `seats-preflight.sql` | Read-only. PostgreSQL ≥ 15 (for `UNIQUE NULLS NOT DISTINCT`), Hockey Night tables and helpers present, no seats objects yet, host can update `details`. |
| `seats-migration.sql` | One table `passport_occasion_seats`, RLS on, four policies, explicit grants (production has no default grants), column-level UPDATE. Idempotent.        |
| `seats-rollback.sql`  | Drops the table. Refuses while seats exist unless confirmed in-session.                                                                                 |

- Requires `migration.sql` (Hockey Night) to be applied first. It is, in
  production, per the owner.
- The meeting point needs **no** schema change: it's `details.meetup` on
  `passport_occasions`, which only the host can already update.
- Apply by pasting into the Supabase SQL editor (supabase/README.md hazard 1),
  preflight first. **Not applied anywhere but the local stack.**
- Order is safe either way: code deployed before the migration shows "Seats
  aren't switched on". A migration applied before the code is unused.

### Who may do what (enforced by RLS, attacked in `verification/seats-attack.mjs`)

| Actor         | Read                                    | Write                                                         |
| ------------- | --------------------------------------- | ------------------------------------------------------------- |
| Signed out    | nothing                                 | nothing                                                       |
| Stranger      | nothing                                 | nothing                                                       |
| Guest         | shared seats, own seat, the group block | own seat only, stamped as themselves                          |
| Host          | everything on their night               | any member's seat, the group block, the meeting point         |
| Removed guest | nothing (not even their old seat)       | nothing                                                       |
| Anyone        | —                                       | can't move a row to another night or person (no column grant) |

## Tests

| What                                                                                                                     | Result                                      |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| `src/domain/hockey/{seats,arena,directions,nearby}.test.ts`                                                              | **pass** (hockey domain 112/112)            |
| `verification/seats-attack.mjs`: 35 attacks over PostgREST with real GoTrue sessions                                     | **35/35**                                   |
| `verification/rls-attack.mjs` (existing, with the seats table present)                                                   | **53/53**                                   |
| Seats migration applied twice                                                                                            | no change (4 policies, RLS on, rows intact) |
| `seats-preflight.sql` on the stack                                                                                       | runs; correctly says STOP once applied      |
| `verification/seats.spec.ts`: host 390 px + guest 320 px + stranger, real sign-up, Atlas stand-in `atlas-seats-stub.mjs` | **passes**                                  |

**seats.spec.ts covers:** the host adds the block and their own seat, edits it,
and both survive a reload. The host sets a meeting point. A guest joins on a
320 px phone, sees all of it, and gets no edit buttons for it. The guest adds
a seat with no gate and sees _Entrance not known_ and _Entrance not chosen_.
Side by side is computed. Six direct API attempts by the guest (host's seat,
block, meeting point; PUT and DELETE) all get **403**, and the data is
unchanged. A stranger gets **404**. The host edits the guest's seat and the
guest sees _Entered by Lorne_. A private seat shows its notice to the host.
**Chat it** reaches the host's chat. Directions: walking mode, destination is
the arena, no origin "from here", the origin is set from a restaurant, Apple
`saddr`/`dirflg=w`, a click opens a Google Maps directions tab, and Gate 10/16
say why they aren't the destination. The arena guide opens. At 390 and 320:
no sideways scroll, no tap under 40 px, no text under 12 px. Play, Group and
the dinner vote still render. Clear works.

Screenshots: `seats/seats-390-host.png`, `seats/seats-320-guest.png`. The
tab bar across the middle is the page's fixed bar caught by an element
screenshot; it isn't part of the section.

### The rest of Hockey Night, unchanged

All ten Hockey specs pass on the build with seats: acceptance (on its own
`atlas-stub.mjs`), mobile 320/375/390, modules, multi-night,
plan-and-results, polish, redesign and seats. Voting, nominations, picks,
reveal, chat, invitations, removal, Run it back and the Cup are all covered
by those.

**One regression found and fixed on the way:** redesign.spec's "Now go have
another." scrolls to Run it back. Our Seats finished loading above it and
pushed it off screen. Our Seats is now not shown in the `morning` and
`again` phases, when the game is over and Run it back leads Plan.

### Repository gates (2026-10-22, at this branch)

`tsc` clean · `eslint` 0 errors (40 pre-existing warnings, none in Hockey) ·
`prettier --check` clean · `vitest` 3527 pass / 30 skipped · `next build` ok ·
full `playwright test` (placeholder Supabase, critic Atlas fixture,
`E2E_ATLAS=1`): **250 pass / 4 fail / 5 skipped**. The four are the recorded
baseline: core-loop:26, october:554, october:570, conference-mobile:23.

### Before the migration, and the rollback

On a stack with the table dropped: the section says _"Seats aren't switched
on for this night yet. Everything else works."_ Getting there, the arena
guide, the dinner vote and the meeting point all work. A seat write answers
**503** with that sentence. `seats-rollback.sql` refuses while a seat
exists (_"Refusing: 1 seat row(s) exist"_), and drops the table when
confirmed.

### How to run

```
STACK=~/passport/scratch/hockey-stack node docs/product/hockey/verification/stack.mjs start
STACK=… node docs/product/hockey/verification/seats-attack.mjs
node docs/product/hockey/verification/atlas-seats-stub.mjs <atlas-real.json> 3135 &
set -a; . $STACK/env; set +a; npm run build
ATLAS_API_URL=http://127.0.0.1:3135 npx next start -p 3130 &
E2E_PORT=3130 npx playwright test -c docs/product/hockey/verification/playwright.config.ts seats
```

`HOCKEY_SEATS=0 stack.mjs start` gives a stack without the seats table, to
see the "not switched on" state. `LEGS=404` on the stub answers
`/travel/legs` as production Atlas does today.

## Decisions to confirm

- **The host alone sets the meeting point.** Guests see it. The alternative
  (anyone sets it, last one wins, with attribution) is a small change in
  `_server/seats.ts → setMeetup`. It's kept as one item, separate from the
  existing "Where are we meeting?" vote, which is about meeting before dinner.
- **Seats are shared by default.** An unshared seat is still visible to the
  host. A guest who wants it hidden from the host too would need a policy
  change.
- **A guest's seat can be overwritten by the host.** The brief asks that guests
  can't modify another's seat _without authorization_. The host is treated as
  authorized.

## Files

Lane: `src/domain/hockey/{arena,seats,directions}.ts` (+ tests),
`src/domain/hockey/nearby.ts` (adds `at` and `venueInAtlas`),
`src/app/hockey/_server/seats.ts`, `src/app/hockey/_server/night.ts`
(`placesNear` also returns the arena's Atlas id),
`src/app/hockey/api/occasions/[id]/{seats,meetup}/route.ts`,
`src/components/hockey/OurSeats.tsx`, `src/components/hockey/PlanTab.tsx`
(renders it; fetches nearby places whenever signed in, not only when the
dinner vote is on), `docs/product/hockey/seats-*.sql`,
`verification/{seats.spec.ts,seats-attack.mjs,atlas-seats-stub.mjs}`,
`verification/stack.mjs` (applies the seats migration),
`verification/playwright.config.ts` (matches `seats`).

Outside the lane: none.
