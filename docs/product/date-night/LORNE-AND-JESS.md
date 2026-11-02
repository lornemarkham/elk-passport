# Lorne & Jess: Monday, 2 November 2026

Lodge mission 484 (lane `lane/daybuilder`). This builds on the Markham
Adventure (mission 481, `5da3ee3`), which went public as `/datenight` in
mission 483 (`c12c8d5`, GitHub `main`).

## What changed

The Markham Adventure was a board of ideas you voted on. It had no day: no
date, no places in order, no times, no way there. Now it has one.

- **Five quick answers make a day.** When are we free, how far will we drive,
  budget, the mood (up to two), a cold plunge?, drinks? Then **Make our day**.
- **One checked Atlas place per beat:** START → EXPLORE → EXPERIENCE →
  UNWIND, plus REMEMBER, the fire at home, which is ours rather than a
  place. The order follows what each beat is for. Outdoors only while it's
  light (sunset is calculated). Somewhere with stated hours only while it's
  open. Dinner at dinner time, with any gap said out loud ("An hour free
  before The Edge. Go home, warm up, change").
- **It's an ordinary adventure day.** The result is written as a normal `/go`
  day query (stops in order, minutes per stop, the sentence, town, date) and
  saved through the shared `POST /api/adventures/[id]/days` as Passport's
  suggestions. From there the **shared journey** takes over:
  `AdventureJourney`, with routed or labelled legs, the clock, hours,
  directions, Keep / Replace / Move / Remove, _I'm in / Maybe / Out_,
  change-in-words with preview and Undo, the printable guide, and Today mode
  on the day. No new planner, no new tables.
- **Change it naturally.** Each story card has **Another**, which swaps that
  beat for the next one that fits at that time and leaves the rest alone.
  Mood buttons (_More adventurous, More romantic, Cozier, More playful,
  Shorten the evening, Start later_) re-choose the whole day. The details
  section takes anything else in words ("one more stop", "home by 9").
- **Jess** opens the invitation, joins with her own account (the core's
  single-use link), and lands on the day. She can answer each stop, suggest
  changes (they arrive as ideas for Lorne), vote on the wild ideas, tick the
  packing list and share memories. Only the owner changes the day itself.
  That is the core's rule (RLS), not a Date Night one.
- **It looks like a date, not a database.** The page opens full-bleed on a
  real photograph of where the day goes, with a countdown, sunset time and the
  forecast when one is configured. The day is a swipeable strip of big
  photo cards. The REMEMBER card plays ELK's own generated campfire loop,
  labelled "Illustration" and hidden for reduced motion. Wild ideas, packing,
  memories and **Next time** follow.
- **Next time** offers eight themes (cold plunge and hot chocolate, fire and
  marshmallows, snowshoes and dinner, hot springs, stargazing, a winter drive,
  a hidden restaurant, a weekend away). Each opens Discovery with the sentence
  already said (`/discovery?ask=…&at=coldstream`), so Atlas finds the real
  places, and anything good is hearted into the one Saved.
- **The front door** (`/datenight`) shows a landscape, the title and one
  button. It doesn't say when, where or with whom.

## The day it makes by default

Romantic + adventurous, all day, 30 minutes, any budget, plunge yes, drinks
yes. The times are the shared timeline's:

| When        | Beat       | Place                                                          | Hours                                                                                  |
| ----------- | ---------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 11:45–12:30 | Start      | Allan Brooks Nature Centre (ridge)                             | Trail outdoors. Atlas has no hours for the building.                                   |
| ~12:45–2:45 | Explore    | Kalamalka Lake Park: Cosens Bay, Rattlesnake Point, a cold dip | Daylight. Done before the 5:33 pm sunset.                                              |
| ~3:05–3:50  | Experience | Okanagan Spirits Craft Distillery                              | Atlas: tasting $5. **No hours in Atlas.**                                              |
| 5:00–6:45   | Unwind     | The Edge Restaurant, above Okanagan Lake                       | **No hours in Atlas.** The page pairs it with BNA (Mon 4–10 pm, stated), one tap away. |
| after       | Remember   | Fire, marshmallows, home                                       | Fire restrictions and cloud are named, not promised.                                   |

Alternatives per beat: Planet Bee Honey Farm (Mon–Fri 8:30–5:30, stated);
Ellison Park and Kal Beach; Lincoln Lanes (noon–10, stated) and Cotton's
Chocolates; BNA Brewing (4–10, stated) and Eatology.

Environment Canada for Vernon, issued the evening of 1 November: _"Cloudy
except sunny above the valley cloud in the morning. Clearing near noon. Fog
patches dissipating in the morning. High 8."_ Evening: _"Increasing
cloudiness."_ That's why the outdoor beat sits at midday.

## Evidence and what's still weak

- **The shared engine on its own fails this occasion.** On the live corpus
  (5,469 candidates, 2026-11-01), the Day Builder's answer to "a romantic
  date day, cozy food and drinks" from Coldstream was _Polson Park →
  McDonald's → Hurlburt Park (dog park)_. Mission 482's in-progress engine
  (uncommitted when this was written) answered _Heidi Thompson Art Gallery →
  Silver Star Foothills → Pallino's_, which is better but still three
  galleries in a row in another run, a viewpoint at 6 pm after dark, and a
  winery 60 km away. That's why this night chooses its own beats from checked
  places.
- **Kept stops are ordered by geography, not time of day.** The engine put
  dinner at 11:15 and the lake at 8 pm when it was given the same places
  unordered. A saved day keeps its order, so this night sets it. But a
  change asked in words ("swap the second") re-runs the shared builder and
  can reorder. **Proposed for the shared engine (mission 482's area):**
  daylight-only stops before sunset, meals in meal windows, stated hours
  respected when ordering.
- **Hours:** Atlas states Monday hours for 3 of the 11 places this day uses.
  The Edge, Okanagan Spirits, Cotton's and Eatology have none. Each card says
  so, and the finish is always paired with a sure-open alternative. Checked by
  hand on 1 Nov: BNA's own site agrees with Atlas (Sun–Thu 4–10 pm). The
  Edge's sites didn't answer; one undated listing says 11–9 daily. **Call
  The Edge before going.**
- **Atlas defect:** The Edge Restaurant (`77938aa1-…`) is placed in
  Coldstream. It's at The Rise above Okanagan Lake, about 20 minutes away.
  The leg on the map will be short until Atlas fixes it.
- **Imagery:** 10 of the 11 places have a real photo of themselves in Atlas
  (mostly Tourism Vernon, rights "not-stated", as Discovery already shows
  them), and Kal Beach has a labelled venue photo. Rattlesnake Point and Cosens Bay have only illustrative category
  photos, which is why the hike lives under Kalamalka Lake Park. Atlas media
  acquisition wasn't run from this lane (no Atlas workspace here).
- **No hot springs within reach** in Atlas (the reader says so honestly). The
  nearest real ones are hours away. They're a _Next time_ theme.
- **The tomorrow pool is one night's data** (`tomorrow.ts`), checked by
  hand. A "make your own Date Night" for anyone needs the beat chooser to read
  candidates from Atlas by role rather than from a list. The chooser
  (`compose.ts`) already takes any `NightDay`.

## AI video

No OpenArt or Wan integration, credentials or workflow exists in this
repository, this machine's environment, or the inbox. Nothing was generated
and no paid generation was started. The REMEMBER card reuses ELK's existing
generated `public/video/discovery/campfire-summer.mp4` as mood, labelled as an
illustration. Worth making later, with approval: a cold-lake jump (two
people, not Kalamalka), snow outside a cabin window, marshmallows close up,
and a personalised trailer for the invitation. Each should be labelled as an
illustration and never shown as a real place.

## Mission 482, integrated

Mission 482 ("Make adventures smarter") committed `24c45da` and `b027be6` on
`main` while this was being built. Its `main` was based on `5da3ee3`, not on
GitHub's `c12c8d5`. `lane/daybuilder` merges it cleanly, so the release
holds both and stays a fast-forward of GitHub `main`. The night now gets
482's reading for free: saved places that fit this day first (`savedFor`),
and its occasion-aware engine behind change-in-words in the details. The one
integration edit was the journey's `saved` prop, now `SavedForAdventure`.

## Release

No new migration. The page needs these, already in `supabase/migrations`.
Each is guarded and safe to re-run. Check production before pasting:

1. `20261021000000_passport_adventures.sql` (adventures and days)
2. `20261023100000_passport_adventure_item_origin.sql`
3. `20261101000000_passport_adventure_together.sql` (memories; without it the page says sharing is off)
4. `20261102100000_passport_adventure_packing.sql` (packing; same)

Optional: `WEATHER_PROVIDER=msc` in Vercel turns on the forecast chip.

An existing Markham Adventure keeps its ideas, votes, packing and members.
Lorne answers the five questions once and the day joins it.

## Verification

`docs/product/date-night/verification/markham.spec.ts`: two phones against
a real local Supabase stack (GoTrue + PostgREST + Postgres, all four
migrations) and an Atlas stand-in serving the production corpus of 1
November, re-read for Monday from Atlas's own hour statements.
