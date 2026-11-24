# Make GoHaveADay Christmas exceptional (M1064)

Owner brief: _P0 — Make GoHaveADay Christmas exceptional_, 2026-11-23.
Integration workspace. Atlas research belongs to missions 1063 (Holiday Train)
and 1065 (benchmark); nothing here repeats it.

## Live audit, 2026-11-23 (gohaveaday.com, 390 × 844 phone)

Production was GitHub `main` 7dba9cf. Every page below answered 200 and drew
its first content in about 1–2 s; none threw in the browser.

| Who                          | What they would hit       | Finding                                                                                                                               |
| ---------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Family, young kids           | `/christmas` → Family Fun | Works. Santa: **none placed within 30 km of Vernon** (Kelowna has one). Atlas gap, not a Passport filter.                             |
| Couple, date                 | Christmas Date            | Works; The Nutcracker, markets, lights ideas. No film help for a night in.                                                            |
| Grandparents + grandchildren | Family / Discover         | Works; long scroll on Discover (12,700 px for Vernon).                                                                                |
| Okanagan visitor             | Discover `?at=kelowna`    | 68 near, 6 _Worth the drive_. Good.                                                                                                   |
| Free activities              | —                         | Discover honours `budget=free` but no control offers it (it moved to Plan My Route in the UX repair). **Unreachable from the front.** |

Also found:

- **Advent Adventure 404** in production — M1053 never reached `main`.
- **My Christmas List named nothing a phone had added** — "1 thing added",
  no title, no way to remove one thing (still true after M1060).
- **No Holiday Train anywhere** in the live feed (Vernon, Kelowna, Salmon Arm,
  Kamloops, Revelstoke, 50 km). And had Atlas held one, Passport would have
  read "CPKC Holiday Train" as Christmas but put it under **no category**.
- **No Christmas movies.** Only idea text ("Christmas movie night") and the
  planner's cinema stop.
- **Pictures:** the front page drew 1 picture across 7 cards; Discover for
  Vernon 8 for its whole list. That is Atlas's media coverage (see the
  2026-10-16 image audit), not a broken image — none failed to load.
- **A plan can zig-zag the valley.** "christmas market then the lights with
  the kids saturday" around Vernon (live, 2026-11-23) planned Lake Country's
  German Christmas Market, then Armstrong's Downtown Light Up: 63.5 km
  between stops, 99.6 km in all, though Vernon has markets of its own. The
  planner chooses each stop greedily from the last one (`itinerary.ts`
  `score`: being dated that day outweighs distance) with no look-ahead to the
  next part. Not changed here; it is the next fix.
- Share on a plan works live: the link opens the same plan for a stranger.
  It holds the sentence, so "saturday" means the next Saturday when opened.
- The Christmas bar now holds six items and scrolls sideways on a phone;
  _Plan My Route_ starts off-screen.
- `gohaveaday.com/` (not Christmas) sends an 8 MB HTML page.

## What changed

- **Integrated** M1053 (holiday season + Advent, `9579490`), M1059
  (Silver Star fold + Atlas worklist, `cf0aa27`) and M1060 (My Christmas List
  as one place, `e554c0c`, cherry-picked without the unresolved M1000
  Suggest-a-Stop duplicate on `feature/christmas`). One conflict, in
  `src/app/christmas/plan/page.tsx`: M1061's folded _Customize my plan_ kept,
  M1060's _Do this again_ note placed inside it, and `?again=` opens it.
- **Advent is easy to find:** the Christmas bar, and the hero pill above the
  fold, now saying where the calendar is ("door 1 in 7 sleeps"). The duplicate
  Advent and New Year's cards M1053 put under the header are gone (the page
  was ~1,000 px longer with both).
- **The season's best** (`src/domain/christmas/best.ts`, under _Happening
  near you_): lights, Santa, markets, live shows & carols, festivals & the
  Holiday Train, winter fun, free — each counted from what Discovery places
  in the radius, _None listed within 30 km yet_ when none — plus Christmas
  movies and a night in. Free opens Discover with `budget=free`.
- **Holiday trains are winter festivals** (`themes.ts`), tested on an Atlas
  record shape (`holiday-train.test.ts`), so a stop counts the day Atlas
  lists it.
- **Christmas movies** (`/christmas/movies`, `src/domain/christmas/movies.ts`):
  28 well-known films on five shelves; Movie Night asks who's watching (and
  optionally a kind), offers three, three more, and makes a chosen film
  tonight's plan with a few at-home ideas and Share. Everything is in the
  address, so a shared link opens the same night, no account. No streaming
  service is named. October's catalogue entry supplies The Nightmare Before
  Christmas (its verified trailer too). Linked from Cozy, Family, Date and the
  season's best.
- **My Christmas List names what was added** (`components/christmas/names.ts`):
  an event's title and page, or a display's name, are kept on the phone
  when it is added, listed, linked and removable one at a time.

## Atlas integration gaps (for missions 1063 / 1065, not done here)

1. **CPKC Holiday Train**: zero records in the production feed on
   2026-11-23. Passport needs, per stop, an `Event` with a name containing
   "Holiday Train", `startTime`/`endTime` for the stop, and a placed
   geography (coordinates or a linked venue) — an unplaced event is never
   called near (doctrine §10, 2026-11-22).
2. **Santa near Vernon**: none placed within 30 km.
3. **125 season events unplaced** (M1053 count) and M1059's 16-event worklist
   in `ENRICHMENT-M1059.md`.
4. **Media**: most Christmas events carry no lead image.

## Not verified

- Signed-in save → reopen → share of a Christmas plan was not run here (no
  production account; the local run used placeholder auth). M1060's spec
  covers it on a local Supabase stack.
- Film facts are hand-written from public listings (year, rounded runtime,
  MPA code only where the MPA rated it); a person should check them once.
