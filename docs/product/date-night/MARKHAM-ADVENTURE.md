# The Markham Adventure, rebuilt (mission 485)

Monday 2 November 2026, Lorne and Jess, leaving about 5 PM. Builds on
mission 484 (`LORNE-AND-JESS.md`, GitHub `main` 137def4). Same backend, same
adventure core, no new tables, no new migration.

## What changed

- **Front door** (`/datenight`): a full-screen dusk landscape, _THE MARKHAM
  ADVENTURE_, "Tomorrow, we disappear for a little while." / "Two people. One
  vehicle. No particular hurry.", _Monday, November 2 · Around 5 PM_ and one
  button, **Let's find some trouble**. It shows no names and no place. The
  date and time are the only new facts on it. The mission brief asked for
  them, so the old spec rule ("not Monday") now checks for no names and no
  place instead.
- **The board** (`/night/[id]`) opens on **Pick your trouble**: four big photo
  cards you swipe through, with tabs naming the three evenings so all of them
  are visible on the second phone screen. Each card has the drive time, the
  highlights and one button.
  - **Into the Wild**: last light at the Silver Star Foothills, backroad
    scouting, a camp-stove dinner, hot chocolate and stars.
  - **Crazy Creek Escape** (_Jess's Pick_): dinner to go, the drive past Mara
    and Shuswap lakes, Crazy Creek Hot Pools, home about 10:15.
  - **Cold Water, Warm Fire**: a Kal Beach dip before sunset, warming up as
    the sun goes, dinner at BNA Brewing, a fire at home if it's allowed.
  - **Surprise Us**: mission 484's composer with evening answers and random
    moods. Only real Atlas places.
- **The plan** is a short timeline: leave, food, the drive, the main event
  (with its photo), something warm, home. Times are laid out around sunset.
  Safety lives in one collapsed **Before you go** list per evening, with
  links.
- **Invite Jess**: one card with a campfire behind it. The join page for a
  Date Night now opens on the same dusk photo. Jess sees the plan, can answer
  each stop, and can press **Suggest this one** on another evening, which
  arrives as an idea for Lorne. Only the owner changes the plan (RLS).
- **Other trouble we could get into**: King Eddie, grouse and backroads,
  outdoor fire and food, snowmobile scouting, hot chocolate and the mystery
  are all kept, with drawn icons instead of emoji. Each has **Love it /
  Maybe / Pass**, plus suggesting something new and Passport's mystery pick.
- **Tucked away, not removed:** the shared journey (times, travel legs,
  directions, changes in words, the printable guide) sits under _Times,
  travel, changes & the printable guide_. Mission 484's five questions, mood
  buttons and **Another** sit under _Plan it yourself, stop by stop_ (owner
  only). Packing, memories, people and "next time" ideas are unchanged in
  behaviour.

## How a choice is stored (no new tables)

The owner's tap uses two existing calls:

1. `PATCH /api/adventures/[id]` with `startsOn`, `timeZone`,
   `destinationTownId` and `destinationLabel` set to the evening's title,
   which is how the page knows the choice.
2. `POST /api/adventures/[id]/days` (mode `propose`) with the evening's Atlas
   places as the day, plus `evening=<id>` in the kept ask. Crazy Creek isn't
   in Atlas, so it saves no stops and clears any earlier day.

The "plan it yourself" composer names its result _Our own plan_, so a
hand-made day never claims to be one of the evenings.

## Sunset: 5:33 pm, and why the tests disagreed

BC stopped changing its clocks. The last spring-forward was 8 March 2026.
From 1 November 2026 the province stays on UTC−7 (tzdata 2026c has this; see
the BC announcement coverage). Sunset in Coldstream on 2 November is about
00:33 UTC on the 3rd. That figure comes from NOAA's general solar-position
algorithm, worked separately from `daylight.ts`. So the wall clock says
**5:33 pm**. A runtime with an older tz database (a phone or a server
without 2026c) still applies PST and says 4:33. The old test took either
answer (`/^[45]:\d\d pm$/`), which is why the two numbers kept appearing.

Fix: `src/domain/date-night/conditions.ts` writes BC's rule down
(`legalOffset`). From 2026-11-01 09:00 UTC, America/Vancouver is −420 minutes
whatever the runtime says. `zonedInstant`, `clockTime` and the composer's
sunset all go through it. Tests assert 5:33 pm and simulate a stale runtime.
Other Passport surfaces that format Vancouver times through `Intl` directly
are not covered by this fix. Named, not fixed here.

## Facts checked on 2026-11-01

| Fact                                                                                     | Source                                                           |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Grouse (dusky, ruffed, spruce) open Sept 10 – Nov 30 in MUs 8-1–8-15, 8-21–8-26, 5/day   | 2026–2028 BC Hunting & Trapping Regulations Synopsis (gov.bc.ca) |
| No hunting of game from 1 hour after sunset (6:33 pm Monday)                             | same synopsis, general prohibitions #38                          |
| Crazy Creek: hot pools + cold plunge every day, 9 am–10 pm, adults only 9–10, dip $19.95 | crazycreekresort.com/hot-pools                                   |
| No food at Crazy Creek in November (food truck May long weekend – Thanksgiving)          | crazycreekresort.com                                             |
| Coldstream → Crazy Creek ≈ 112 km, ~1½ h                                                 | OSRM route                                                       |
| BNA Brewing Vernon, 1714 Kalamalka Lake Rd, opens 4 pm                                   | Atlas (Sun–Thu 4–10) + BNA's site                                |
| Kal Beach 2 min, Silver Star Foothills 15 min from Coldstream                            | OSRM                                                             |

The evening says to check fire restrictions (Kamloops Fire Centre), DriveBC
and forest-road access. It never promises a fire or an open road.

## Imagery

Every photograph is openly licensed from Wikimedia Commons and credited on
the page where it appears (`public/datenight/`, `PHOTOS` in `evenings.ts`):
Rose Valley dusk (Extemporalist, CC0), Monashee forest near Malakwa (Dietmar
Rabich, CC BY-SA 4.0, cropped to leave out the highway), Crazy Creek Falls
(Jack Borno, CC BY-SA 3.0), Kalamalka Lake in winter (Jack Borno, CC BY-SA
3.0), Coldstream sunset (Ian Spence, CC BY 3.0) and a campfire
(Marc-Lautenbacher, CC BY-SA 4.0). Atlas's Kal Beach picture was not used: it
shows houses in Armstrong.

## Release

No migration in this change. The page needs the four that mission 484
listed (`LORNE-AND-JESS.md`, _Release_). Packing and memories say "isn't
switched on yet" until theirs are applied.

## Verification

`docs/product/date-night/verification/markham.spec.ts` runs on two phones
(390×844) against a real local stack (GoTrue, PostgREST, Postgres, all four
migrations) and the 1 November production corpus stand-in. The run:

- the front door shows the date and no names;
- the three evenings are on the second screen;
- choosing each evening works (Into the Wild says when legal hunting ends;
  Crazy Creek saves no stops);
- the Surprise uses real places;
- Cold Water saves Kal Beach and BNA as the shared day and survives a reload;
- the journey is still under its fold;
- the invitation works, Jess joins, sees the plan, answers a stop and
  suggests her pick;
- a stranger and a second account are refused;
- votes, mystery pick and packing are seen by both.
