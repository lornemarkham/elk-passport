# Hockey Night — Arena Mode (2026-10-22)

**Status:** built and tested on branch `feature/hockey-arena`, cut from the
Our Seats release candidate `b4f9dfc`. It is a **separate release** from
Our Seats. It ran only against a local stack. **Not deployed, not pushed,
not migrated.** Before anyone can check in, it needs four new tables
(`arena-migration.sql`). Until then the map, the food guide and the arena
facts work, and checking in says "Arena Mode isn't switched on for this
night yet".

Brief: _Hockey Night — Arena Mode: turn Rogers Arena into a multiplayer
playground._

The arena is the world and the group are the characters. Stands, washrooms,
stores, seats and the meeting point are the destinations. Friends say where
they are by tapping the map. They ping each other ("Where you at?", "I'm
over here, genius", "Meet me", "Find the herd") and run small side quests in
the intermissions.

Screenshots: `arena-mode/*.png`, written by `verification/arena-mode.spec.ts`.

---

## 1. Doctrine fit, and where it presses on the doctrine

- **§2.7 LIVE / §6 "Live social and playful interaction".** The doctrine
  names hockey ("Who scores the first goal?") and _shared challenges_.
  Arena Mode is that, inside the building.
- **§6 Less phone, more life.** Arena Mode's job is to get friends **off**
  their phones and back together. A check-in is one tap. A ping shouts for
  30 seconds and then shrinks to a pill. Nothing is pushed to a locked phone.
  The door is on the night's **Plan** tab, which the night does not show
  during a period. Arena Mode itself still works then if it's already open.
- **§5 Signals vs truth.** A check-in is a person's statement, shown with its
  age, and never presented as a position. A price a friend types is "Reported,
  not verified". The press price is "Press, not official", with reporter and
  date.

**Conflicts named, not resolved:**

1. **§14 lists "elaborate social games" as not now.** The side quests are
   kept deliberately lightweight: six fixed kinds, no points, no leaderboard,
   no streaks, and they end with the night. Whether they count as
   "elaborate" is the owner's call. They are one panel and can be dropped
   without touching the rest.
2. **§15.10 "How live mode should interrupt — or stay silent" is open.**
   Arena Mode makes small local choices: in-page only, one at a time,
   shrinks after 30 s, a reply shows for 60 s, no push. They are listed
   under _Decisions to confirm_. They are not an answer to §15.10.
3. **§15.12 group experiences** is open. Pings and quests use the night's
   existing membership (ADR 009's group foundation) and add nothing to it.
4. **"Atlas owns venue knowledge"** (§17, workspace rules). The concourse
   catalogue is a Passport-held, cited stand-in, the same kind as the
   existing `arena.ts` (Our Seats). §6 below lists what should move to Atlas.

No §15 question is answered here, and the doctrine is unchanged. If this
ships as product, §6 deserves a line recording that Hockey's live play now
includes friend-finding and quests.

## 2. What it does

`/hockey/<night>/arena`, opened from an **Arena Mode** card above Our Seats
on the Plan tab (Rogers Arena nights only).

| Part                 | What a person can do                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **The world**        | An SVG drawing of Plaza Level 100 or Level 300 (sections in the map's order round the ice), with every stand, washroom, store, first aid, Guest Services, elevator, water fountain, charging zone and No Alcohol Seating symbol beside the section the map draws it by. Gates are drawn on their level. Filter: Eat / Drinks / Washrooms / Stores / Help. Tap to zoom (animated viewBox); tap a pin to open it. Your seat's section glows. |
| **Characters**       | Everyone who checked in stands at that place: their emoji in their colour, bobbing, with a pulse while the check-in is under 10 minutes old. It fades and gets a dashed ring after 30 minutes. People on the other level, outside, or not checked in are listed under the map.                                                                                                                                                             |
| **I'm here**         | First the rules ("Only the N other people on this night… never GPS… disappears when the night ends… Vanish any time"), then an optional status ("In line. Pray for me.", "Hiding from the kiss cam"…). Places: my seat, the meeting point, **pick it on the map**, the stands nearest my seat, any section, outside the arena, on my way.                                                                                                  |
| **Vanish**           | One tap. The check-in is deleted.                                                                                                                                                                                                                                                                                                                                                                                                          |
| **The herd**         | Per friend: where and when they checked in, their status and seat. **🔦 Find this legend** zooms the map to them and opens the place. If they haven't checked in, or it's old, it becomes **Where you at, Sam?** (a ping asking them). Also **👋 I'm over here, genius** and **🤝 Meet me** (one-tap meetup at my check-in). Plus "What you sent", with ✅/🙅 answers.                                                                     |
| **🐃 Find the herd** | Everyone, to the meeting point if the host set one, otherwise to my check-in. Each person answers **On my way** or **Can't**.                                                                                                                                                                                                                                                                                                              |
| **A place**          | What's there, beside which section, "N sections along from your section". Who's checked in there and who's seated there. The arena's dietary-guide items for that stand, with the source. Drink-stand rules (cashless, ID). Store and washroom facts. **I'm here** / **Meet here**.                                                                                                                                                        |
| **Eat & drink**      | Stands on my level, nearest my seat first (by section count), filterable by Vegan / Vegetarian / Dairy free / Gluten friendly. **Drinks** shows the one dated price report there is, with its caveats, and the arena's drinking rules.                                                                                                                                                                                                     |
| **Side quests**      | Beer Run!, Find the Cheapest Beer, Hot Dog Hero, Find the Herd, The Missing Legend, Merchandise Mission. Start, join (with an order or note), report a price you saw, leave, finish or drop. Suggestions are the nearest matching stands to your seat. A log of finished ones.                                                                                                                                                             |
| **The arena**        | Gates, getting in, washrooms / family / help facts, accessibility, each with its page. "Where the arena's own pages disagree". "Why there's no live location".                                                                                                                                                                                                                                                                             |

### Honesty rules the screen keeps

- **It's a schematic.** Under the map: _"Schematic drawn from the arena's
  directory map (read 2026-10-22). Not to scale; no indoor routes. Dots are
  check-ins people made, not GPS."_, with a link to the official map.
  Sections are equal slices of a rink-shaped ring; only their order is real.
  A pin on the ring is never drawn more than one section from where the map
  puts it, and no pin covers a gate or another pin (both tested). Pins the
  map draws in open areas sit together in their area.
- **Nearness is section counting**, on the same level only: "3 sections
  along". There are no metres, no minutes, and no cross-level numbers.
- **No invented menus.** A stand shows only what the arena's dietary guide
  lists there, under "What the arena lists here", with "A guide, not the
  whole menu. No prices published." Stands the guide doesn't cover say
  _"The arena publishes nothing about what's here."_
- **No invented prices.** The only prices shown are Daily Hive's
  (2026-09-25, preseason game, drinks only, "Press, not official; no stand
  named"). Friends' reports are "Reported, not verified".
- **Shaded areas stay shaded.** Stands drawn in the cross-hatched Shelter
  Point Club / RBC Landing areas say the map doesn't say who can go in.
- **Beer, sensibly.** Beer quests carry "Grab a water for the table" / "It's a
  price hunt, not a drinking game." No counts, no fastest, no most (tested).
  Drink stands and the Drinks panel show the ID rule, the code of conduct
  line on intoxication, and Fan Services' text line.

## 3. Verified Rogers Arena information

Read 2026-10-22. Copies of every page are in
`~/passport/scratch/arena-mode-research/` and `~/passport/scratch/seats-research/`
on Metatron. They are not committed, because they are the arena's content.

| Fact                                                                                                                                                                                                                                                                               | Source (date)                                                                                                                                            | Where in code                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Section numbering (101–122, 301–330), clockwise from the west. 22 food & beverage brands A–V, snack carts, team store and kiosks, washrooms, first aid, Guest Services, elevators, water, charging, No Alcohol Seating, entertainment 1–3, The Sportsbar — each beside its section | [Arena directory map](https://rogersarena.com/map/) (image updated 2026-09-29), read off the 4500×8000 image by eye                                      | `concourse.ts`                     |
| Gates 1, 2, 3, 6, 7, 8, 10, 16 and their sides                                                                                                                                                                                                                                     | Same map, plus the pages in `SEATS-AND-ARENA.md`                                                                                                         | `arena.ts`, `bowl.ts GATE_ANCHORS` |
| What each stand sells, by diet (vegan / vegetarian / dairy free / gluten friendly), with the guide's sections                                                                                                                                                                      | [Food & Beverage Options](https://rogersarena.com/food-and-beverage-options/) (2026-02-25)                                                               | `menus.ts STAND_MENUS, CART_MENU`  |
| Drink prices: Molson Canadian 12 oz $10, Coors Original 12 oz $11, Granville Island 12 oz $12, Molson Canadian 24 oz $19.50, water $6.25, Minute Maid $7.50, medium soft drink $8, Powerade $8.50                                                                                  | [Daily Hive](https://dailyhive.com/vancouver/beer-costs-canucks-games-rogers-arena), Daniel Wagner, 2026-09-25 (preseason game 2026-09-24). **Press.**   | `menus.ts PRICE_REPORTS`           |
| Cashless: debit, Visa, Mastercard, Amex, Google Pay, Apple Pay                                                                                                                                                                                                                     | Rogers Arena event page (2026-10-13)                                                                                                                     | `menus.ts DRINK_RULES`             |
| Look 30 or younger → two pieces of ID                                                                                                                                                                                                                                              | [FAQ](https://rogersarena.com/frequently-asked-questions/)                                                                                               | `DRINK_RULES`                      |
| Intoxication prohibited; "drinking responsibly"                                                                                                                                                                                                                                    | [Code of Conduct](https://rogersarena.com/code-of-conduct/) (2025-01-03)                                                                                 | `DRINK_RULES`                      |
| Fan Services text line 604-765-3267                                                                                                                                                                                                                                                | [Fan Text Service](https://rogersarena.com/fan-texting-service/) (2023-07-17)                                                                            | `DRINK_RULES`                      |
| Molson Canadian, Coors Light, Madrí at Molson Hockey House; Granville Island official craft beer                                                                                                                                                                                   | [Canucks — six big changes](https://www.nhl.com/canucks/news/six-big-changes-coming-to-rogers-arena) (2024-09-24)                                        | `BEER_ON_TAP`                      |
| Coke, Diet Coke, Sprite, Fanta, Canada Dry, iced tea, water                                                                                                                                                                                                                        | Canucks — Coke Canada Bottling partnership (2026-10-09)                                                                                                  | `SOFT_DRINKS`                      |
| Universal washrooms 103, 109, 319; family washrooms 103, 109, 309; quiet room 108; free noise-cancelling headphones; Guest Services 114, 311 (104 club, hockey); first aid near 104 and 306; fountains 102, 110, 113, 306; non-alcohol seats in 102, 311, 312, 317, 318            | [Disabilities](https://rogersarena.com/disabilities/) (2025-12-16), [Family Guide](https://rogersarena.com/children-and-family-guide/) (2026-01-06), FAQ | `guest-facts.ts`                   |
| Team Store street entrance at Gate 6, section 113; vanbase.ca                                                                                                                                                                                                                      | [Team Store](https://rogersarena.com/team-store/) (2025-01-24)                                                                                           | `guest-facts.ts`                   |

### Data gaps (nothing shown for these)

- **Full menus per stand.** Only the dietary guide exists, and it's older
  than the map.
- **Official prices: none.** No food prices from any source. Nothing on
  halal food, mobile or in-seat ordering, last call, or a current
  per-purchase alcohol limit (a 2013 two-beer limit exists in the press; it
  is obsolete and not shown).
- **Team Store game-day hours** and **doors-open time** for Canucks games.
- **With Glowing Hearts** has no description anywhere. **Legends Locker
  Room**'s only page is from 2020.
- **Who can use RBC Landing / Shelter Point Club** (shaded on the map).
- **Indoor walking routes.** None exist anywhere public. OpenStreetMap has
  no indoor data for the building.
- **Gate coordinates.** OSM has Gates 2, 6, 7, 8 and "Club Gate 10" as
  community-edited points (2016 / 2025-01-01). They are unverified against
  the arena, so they're not used (as in Our Seats).

### Where sources disagree (shown on the screen under "The arena")

The `arena.ts CONFLICTS` from Our Seats, plus: Team Store section 113 vs 114
vs the map's 114–115; family washroom 309 vs universal 319; Fins Family Zone
at 102 (guide) vs by 103 and 319–320 (map); Legends Locker Room at 317
(2020) vs 315 (map); drinking fountains by section numbers vs the map's
drawings; the food guide's stand sections are often one off the map's, and
it names stands the map no longer shows (Inniskillin, Uno Gelato).

## 4. Privacy, and live location

**Model.** A check-in is a place id from Passport's catalogue (`sec:309`,
`300:J:304`, `gate:10`, `meetup`, `out:outside`, `out:coming`). There are
never coordinates: the table's `place` column only accepts
`^[A-Za-z0-9:~._-]{1,48}$`. It is enforced in `arena-migration.sql`, not in
the app:

| Rule                   | How                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opt in                 | No row exists until the person checks in.                                                                                                                                                                                                                                                                                                             |
| Invited people only    | Every read needs the reader **and** the subject to be members of that night. A removed member vanishes from everyone's map at once.                                                                                                                                                                                                                   |
| Revocable              | `DELETE` own check-in, any time (Vanish).                                                                                                                                                                                                                                                                                                             |
| Expires with the event | Reads and writes only while `now()` is inside **starts_at − 3 h … starts_at + 5 h**, and only rows written inside the current window. Timestamps are stamped by a trigger, so nothing can be backdated in. `passport_arena_purge()` deletes expired rows. The page calls it when someone opens Arena Mode after the night. pg_cron can run it hourly. |
| Addressed pings        | Read only by sender and addressee. Broadcasts are read by members.                                                                                                                                                                                                                                                                                    |
| No impersonation       | Own `user_id` / `from_user` / `started_by` / `closed_by` only. Column grants stop re-homing a row.                                                                                                                                                                                                                                                    |
| Strangers / signed out | 404 / 401 at the API, and nothing by RLS or grant.                                                                                                                                                                                                                                                                                                    |
| Pestering              | The same ping to the same person within 20 s → 429 (app-level).                                                                                                                                                                                                                                                                                       |

**Live location — investigated, not built.** The brief asks for a separate
investigation and no continuous tracking without review. Findings:

- **Accuracy.** Inside a concrete bowl, phone positioning (GPS + Wi-Fi) is
  good to the building, not the section, and it has no notion of level.
  Section-level indoor positioning needs venue infrastructure (BLE beacons
  or the arena's Wi-Fi RTT), i.e. a partnership with the arena.
- **Platform.** A web page can't share location from a pocket. The
  Geolocation API stops when the tab is hidden, and iOS suspends background
  tabs. Continuous sharing means a native app with background-location
  permission, and the store review that comes with it.
- **Privacy.** Continuous position among friends is the most sensitive data
  Passport would hold: where somebody is, minute by minute. It needs the §15.8
  consent boundaries decided first, plus retention, who sees what, and an
  off switch that really is off.
- **Recommendation.** Keep check-ins. They are the right grain for "where's
  the herd" (a section, a stand), they are honest about their age, and they
  need no tracking. Revisit only with a privacy review and an arena
  positioning partner. The screen says this under "Why there's no live
  location".

## 5. Animation and rendering

**Sycle Insights could not be inspected.** It isn't on Metatron (only
`sycle-performance-monitor`, a perf overlay, exists), and `gh repo list`
shows no such repository. Its techniques are therefore not assessed. If it
lives on the Mac, a follow-up can compare.

| Option                           | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React Three Fiber / three        | No. A 3D bowl is spectacle. The data is a ring of sections and a list of pins, and WebGL costs battery, memory and a large bundle on ordinary phones in a crowded arena. Not installed; adding it changes `package.json` (shared contract).                                                                                                                                                                                                                                        |
| GSAP                             | No. Its timelines would be nice, but it duplicates what framer-motion already does here. Not installed.                                                                                                                                                                                                                                                                                                                                                                            |
| D3                               | Not needed. The geometry is ~150 lines of pure, unit-tested TypeScript (`bowl.ts`: a superellipse parameterised by arc length, circular means, a 1-D relaxation round the ring, a 2-D nudge for the clusters). Not installed.                                                                                                                                                                                                                                                      |
| **SVG + Motion (framer-motion)** | **Chosen.** Already a dependency (`framer-motion` 12), so no package change. SVG is crisp at any DPR, accessible to tests (`data-*` hooks), and cheap. Motion gives the zoom (animated `viewBox` spring), bobbing characters, fresh-check-in pulses, pins growing on selection, sheets springing up, cards entering. **Reduced motion:** `useReducedMotion` turns every spring into a cut, stops the bobbing and pulses, and makes sheets fade (tested on a reduced-motion phone). |

Lessons paid for in testing, now in the code: an `AnimatePresence` exit
racing a new key removed the newly opened quest form, so that form has no
exit animation and each sheet waits for the last (`mode="wait"`). A slow
server answer closed a form opened in the meantime, so `onDone` now closes
only its own form. A ping banner arriving inline pushed buttons out from
under a thumb, so pings float over the page at the bottom and shrink.

## 6. Atlas dependencies (separate work, not done here)

Atlas owns venue knowledge; today this lives in Passport as cited stand-ins
(`arena.ts`, `concourse.ts`, `menus.ts`, `guest-facts.ts`). Nothing here
changes Atlas or its data. Proposed, in order of value:

1. **Rogers Arena's amenities as Atlas entities, `contains`-linked to Rogers
   Arena.** Each concession (brand + letter), team store, washroom, first
   aid and Guest Services gets a Place (or the brand an Organization) with a
   `contains` relationship from the arena. Atlas already has `relationships`
   with an open `type`, `relationship_candidates` for `contains`, and source
   records for provenance. Each would carry a source record pointing at the
   2026-09-29 map.
2. **An indoor position on those entities: `level` + `near_sections`.**
   Atlas has no field for "Level 300, beside section 304". This is the one
   genuinely new modelling need. It's small (two attributes), and it's what
   makes "nearest to my seat" an Atlas fact instead of Passport's reading.
3. **Gates as entrance entities** with verified coordinates, accessibility
   and elevator flags. They feed `/travel/legs` so walks end at the gate (Our
   Seats already has the hook: `ArenaGate.at`).
4. **Facilities on Rogers Arena** (`places.facilities`, already exists):
   universal washroom, family washroom, quiet room, first aid, sensory kits,
   assistive listening, cashless.
5. **Menu items with diet tags, and price observations with provenance**
   (who, when, official or press). Atlas has no price or menu model. This is
   the largest ask and the least urgent. The dietary guide is stale and
   prices are press-only.
6. **Conflicts as first-class evidence.** The arena contradicts itself in ten
   places (§3). Atlas's evidence model is the right home for "two sources
   disagree".

When Atlas serves 1–2, `concourse.ts` becomes an adapter, like
`nearby.ts` is for places near the arena. The screen doesn't change.

## 7. Database migration requirements

New in this lane, **proposed** for `supabase/migrations/` (a shared contract
this lane does not change):

| File                  | What                                                                                                                                                                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `arena-preflight.sql` | Read-only. Hockey Night tables and helpers present, members can read their night, no arena tables/policies/functions yet, PostgreSQL ≥ 13, pg_cron (INFO).                                                                                                                                                                     |
| `arena-migration.sql` | Four tables (`passport_occasion_checkins`, `_pings`, `_quests`, `_quest_crew`), RLS on all, 15 policies, explicit grants including column-level (production has no default grants), three functions (`passport_arena_open` invoker, `passport_arena_stamp` trigger, `passport_arena_purge` definer, no arguments). Idempotent. |
| `arena-rollback.sql`  | Drops all of it. Refuses while any row exists unless confirmed in-session.                                                                                                                                                                                                                                                     |

- Requires `migration.sql` (Hockey Night), which is applied in production per
  the owner. **Does not require** `seats-migration.sql`: tested with and
  without it. Without seats, nobody has a seat section; "nearest your seat"
  asks for one and everything else works.
- Order is safe either way. Code before the migration shows "isn't switched
  on" (tested: `arena-off.spec.ts`, write → 503). A migration before the
  code is unused.
- **Optional:** where pg_cron exists,
  `select cron.schedule('passport-arena-purge', '17 * * * *', 'select public.passport_arena_purge()');`.
  Expired rows are already unreadable without it.
- Apply by pasting into the SQL editor, preflight first. **Applied nowhere but
  the local stack.**

## 8. Tests

| What                                                                                                                                                              | Result                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/hockey/arena-mode.test.ts` (catalogue, geometry, menus, prices, window, places, actions, quests)                                                      | **30/30**                                                                                                                             |
| `verification/arena-attack.mjs`: 78 attacks over PostgREST with real GoTrue sessions                                                                              | **78/78**, with and without the seats table                                                                                           |
| Migration applied twice; rollback refuses, then drops; preflight before/after; re-apply after rollback                                                            | as expected (`~/scratch/am/sqlcheck.mjs` on Metatron)                                                                                 |
| `verification/arena-mode.spec.ts`: host 390 px + guest 320 px + guest 375 px with reduced motion + a stranger, real sign-ups                                      | **passes** (55 s)                                                                                                                     |
| `verification/arena-off.spec.ts` on a stack without the arena tables                                                                                              | **passes**                                                                                                                            |
| The other Hockey specs on the Arena Mode build: acceptance (its own `atlas-stub.mjs`), mobile ×3, modules, multi-night, plan-and-results, polish, redesign, seats | **all pass** (11/11 with arena-mode). `email-confirmation.spec` **not run** (needs the mail stack; Arena Mode doesn't touch sign-up). |
| `rls-attack.mjs` (53 checks), `seats-attack.mjs` (35) with the arena tables present                                                                               | **all pass**                                                                                                                          |

**arena-mode.spec covers:** the door on Plan, and Our Seats still under it.
Before the window: explore only, write → 409. The night moves to an hour
from now. Maya (320 px) reads the rules, picks a status, checks in **by
tapping a pin on the map**. The host sees her character on the map, and in
the herd with her status and "just now". The host asks "Where you at, Sam?";
Sam (375 px, reduced motion) gets the ping and answers by checking in
"Outside the arena". Maya's one-tap **Meet me** reaches the host, who answers
**On my way**, and Maya sees ✅. **Find the herd** first asks the host where
they are, then summons. Sam answers On my way, Maya answers **Can't**, and
the host sees it. **Find this legend** switches level, zooms and opens Hot
Dogs (J) with "Maya checked in" and the dietary guide. Quests: Hot Dog Hero
(started, joined with an order, finished, logged for everyone), Cheapest
Beer (Daily Hive "to beat", Maya reports $10.50 at a stand → "Lowest seen
tonight… Reported, not verified"), Missing Legend (Sam, last seen outside).
A second open Cheapest Beer → 409. Eat & drink is sorted by the host's
section, with the diet filter and the dated press prices. The Arena tab's
facts. A stranger: API 404 for read and write, no map on the page.
Signed-out → 401. Unknown place → 400. A ping to a non-member → 404. A
repeat ping → 429. Sam never receives Maya's addressed ping. **Vanish** →
gone from the host's map and herd. 320 px and 375 px on every tab: no
sideways scroll, no HTML tap under 40 px, no HTML text under 12 px. The host
removes Sam → Sam's API 404, gone from the herd. The night page's four tabs
are intact. After the night: "The night's over", no check-ins, pings or
quests, and the map and food guide still work.

**Not covered by automation:** an actual game night with real phones on
arena Wi-Fi; the SVG pins' own tap size (they're small at the whole-level
zoom; every pin action is also available as a full-size button in the
lists, and tapping zooms first); screen-reader passes beyond roles and
labels.

### Repository gates (2026-10-22, at this branch)

`tsc` clean · `eslint` 0 errors (40 warnings, the same pre-existing 40 as
the Seats RC, none in Arena Mode) · `prettier --check` clean · `vitest`
3557 pass / 30 skipped (3527 at the Seats RC + 30 new) · `next build` ok.
The full repo `playwright test` was **not** run this mission. Arena Mode
touches only the Hockey route tree and one card in `PlanTab.tsx`, and the
Hockey suite was run in full.

## 9. Release readiness

**Ready to review, not ready to ship without the owner.** Separate from Our
Seats:

- `feature/hockey-arena` = Seats RC `b4f9dfc` + Arena Mode commits. It
  **includes** the seats code, because it was cut from that RC. Shipping
  Arena Mode first would ship seats code too: harmless before
  `seats-migration.sql` ("Seats aren't switched on"), but the owner should
  know. To ship Arena Mode alone, cherry-pick the Arena Mode commits onto
  whatever production is. They touch no seats file except
  `verification/stack.mjs` and `playwright.config.ts`, plus one hunk in
  `PlanTab.tsx` beside Our Seats.
- `feature/hockey` (the Seats RC) was **not touched**: it is still `b4f9dfc`.

**Steps, in order (a person does these; nothing here deploys):**

1. Fetch and review the branch (`git fetch metatron:passport/main feature/hockey-arena`).
2. Merge per RELEASE.md. Gates: as §8, plus the full repo e2e.
3. Deploy the code. The night is unchanged. Arena Mode's door appears; the map
   and guide work; check-ins say "isn't switched on".
4. In the Supabase SQL editor: `arena-preflight.sql` (all OK), then
   `arena-migration.sql`. Optional: the pg_cron purge.
5. Smoke test on a real night inside its window: two accounts check in, ping,
   vanish.
6. **Rollback:** the code can stay. `arena-rollback.sql` (confirm line)
   removes the tables, and the page returns to "isn't switched on".

**Risks:** the map is a by-eye transcription. A pin could be one section off
where the arena draws it; recheck against the official map before
publicising. The dietary guide (Feb 2026) predates the map. The arena may
reprint its map mid-season. Polling every 5 s per open phone (same rhythm as
the night page) adds one request per person per 5 s while Arena Mode is
visible.

## 10. Decisions to confirm

- **Window:** 3 h before puck drop to 5 h after. A long overtime plus a bar
  after might want more, or less.
- **Interruptions:** pings are in-page only, one at a time, loud for 30 s,
  then a pill; answers for 60 s; no push. (§15.10 stays open.)
- **Where the door is:** the Plan tab only, which isn't shown during a
  period (phones away). Arena Mode itself still works in a period if open.
- **Who may finish a quest:** the starter or anyone on its crew. The host
  can delete any quest (database) but the screen offers no button for it.
- **Find the herd** goes to the host's meeting point when there is one,
  otherwise to the summoner's check-in.
- **Side quests at all** (doctrine §14, see §1).
- **Seats are not assumed:** someone without their own seat isn't placed in
  the group block, the same rule as Our Seats.

## 11. How to run

```
STACK=~/scratch/am/stack node docs/product/hockey/verification/stack.mjs start      # HOCKEY_ARENA=0 for "before the migration"
STACK=… node docs/product/hockey/verification/arena-attack.mjs
node docs/product/hockey/verification/atlas-seats-stub.mjs <atlas-real.json> 3135 &
set -a; . $STACK/env; set +a; npm run build
ATLAS_API_URL=http://127.0.0.1:3135 npx next start -p 3130 &
STACK=$STACK E2E_PORT=3130 ARENA_SHOTS=docs/product/hockey/arena-mode \
  npx playwright test -c docs/product/hockey/verification/playwright.config.ts arena-mode
HOCKEY_ARENA=0 … playwright test … arena-off        # on a stack started with HOCKEY_ARENA=0
```

## 12. Files

Lane: `src/domain/hockey/{concourse,bowl,menus,guest-facts,arena-mode}.ts`
(+ `arena-mode.test.ts`), `src/app/hockey/_server/arena.ts`,
`src/app/hockey/api/occasions/[id]/arena/route.ts`,
`src/app/hockey/[id]/arena/page.tsx`,
`src/components/hockey/arena/{ArenaMode,ArenaMap,IncomingPings,sheets,panels,useArena,ArenaDoor}.tsx|ts`,
`src/components/hockey/PlanTab.tsx` (renders the door),
`docs/product/hockey/{ARENA-MODE.md,arena-preflight.sql,arena-migration.sql,arena-rollback.sql}`,
`docs/product/hockey/arena-mode/*.png`,
`verification/{arena-mode.spec.ts,arena-off.spec.ts,arena-attack.mjs}`,
`verification/stack.mjs` (applies the arena migration),
`verification/playwright.config.ts` (matches the two specs),
`docs/product/hockey/README.md` (pointer).

Outside the lane: **none.** No shared contract was changed: no
`package.json`, no `supabase/migrations/`, no `schemas.ts`, no shell.
