# Date Night — make the adventure feel magical (mission 495)

Monday 2 November 2026. Builds on mission 487 (`FINISH-THE-EXPERIENCE.md`,
`7863c44`). The structure is unchanged — **choose an adventure → customise
it → invite someone → enjoy it → remember it** — and so is the model: one
adventure, one itinerary stored as the adventure's own day, the same
`PUT /api/night/[id]/plan`. No new table, no new planner. This mission is
presentation, the sentence reader's gaps, honesty about what isn't switched
on, and the release of packing and memories.

## What changed, by the brief's numbers

**1. The cards.** Before anything is chosen, each adventure is one tall
photograph (4:5 on a phone, 5:4 two-up on a desktop), the same shape every
time: drive and times, the name, one short line (`Evening.teaser`, new — the
long `line` stays for reference), and one button. Highlights chips are gone
from the card. Photo credits sit under each card. Once one is chosen the
grid disappears: the chosen adventure becomes the hero (its photograph, its
name and line under the title) and the others wait behind **Change
adventure** as a short list with thumbnails. Choosing another over a plan
you've made your own still previews first, now at the top of that list.

**2. The itinerary as a journey** (`EveningPlan.tsx`). A Leave · Sunset ·
Home strip; the forecast under it when the server can read one; _How it
ends_. Then the stops on a timeline whose dots and times move from day
(amber) through golden hour (ember) to night (blue-black), a **Sunset 5:35
pm** marker where it falls, drive pills between stops, and a photograph only
on the moments that have one of their own — the sunset, the fire, an Atlas
place with a real picture — never the hero's photo again. The main stop says
_The big one_. Change · Earlier · Later · Remove and Add something are
unchanged. What the last change touched is marked _Just changed_.

**3. Just say it** (`say.ts`, `say.test.ts`). The brief's six sentences were
run against every adventure. Fixed:

| Sentence                         | Was                                    | Now                                                                                                                      |
| -------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| "Let's leave later" (King Eddie) | "Leave at 2:45" — silently 32 min less | says the grouse gives the 32 minutes back so you still catch the sunset                                                  |
| "Find somewhere warm…" (Crazy)   | nothing understood                     | dinner to go becomes a sit-down dinner at BNA (Atlas, open 4–10); the pools now end by their 10 pm close, and it says so |
| "Make it more romantic" (Crazy)  | nothing understood                     | later, for the adults-only hour 9–10 (crazycreekresort.com), leave 6:05                                                  |
| "More time at the lake" (Cold)   | **the cold dip went to 48 minutes**    | the warm-up by the water; a cold dip is never lengthened, and it says why                                                |
| "More time at the lake" (Crazy)  | generic "didn't catch"                 | "There's no lake on Crazy Creek Escape"                                                                                  |
| "Skip the swim" (Crazy)          | removed the pools — the whole night    | the pools are the heart of it: choose another adventure                                                                  |
| "Find us a sushi place"          | generic "didn't catch"                 | Passport only uses places Atlas checked for the night, none fits, it won't make one up                                   |
| "Somewhere warm" (Cold Water)    | a no-op offered as a change            | "Dinner's already somewhere warm: BNA Brewing", no change                                                                |

Places in sentences keep their names ("dinner at BNA Brewing", "King Edward
Lake"). A stop with a closing time (`StopTemplate.closesAt`) is laid out to
end by it and warns if it can't. After **Make it so** the box keeps _What
changed_ beside **Undo the last change** until the next change. _How
Passport reads this_ says plainly: by rules, not AI; what it understands;
places only from Atlas's checked list.

**4. Together.** Before anyone has joined, the owner sees one card: _For
Jess — Come on an adventure with me._, the exact message that will be sent
(including the chosen adventure and leave time), what Jess will be able to
do and that only the owner changes the plan, and **Send it to Jess**. After,
a card with both names and the permission boundary said for each side.
Suggestions are quoted notes _From Jess_. Packing (_What we're bringing_,
with a progress bar), memories and people share one panel style.

**5. Packing and memories.** See _Release_ below. A panel whose table isn't
there now says **Not switched on yet** on its own line and doesn't open
(`shared-off.spec.ts`). A night started while packing was off has no list;
its owner gets **Start with our list** (one tap, the night's own seven
items) — nothing is written behind anyone's back.

**6. The title.** No family name anywhere public. New nights are stored as
`Just us ❤️`; nights stored as `The Markham Adventure ❤️` are still found
(`NightConfig.formerTitles`). The page title is `heading.ts`: _This
afternoon, just us_ for King Eddie (leaves 2:15), _Tonight, just us_ for a 5
pm start, _Tomorrow night_, _Monday afternoon_, _That night_ afterwards — an
afternoon is never called a night. Names are shown beside it from the
adventure's members ("Lorne ♥ Jess"); the invitation text is universal
("Come on an adventure with me. ❤️").

**Not changed:** the evenings, their stops, times and facts; the Atlas
places; the adventure core, its RLS and routes; any other Experience.

## Verification

All on a production build against a real local stack (GoTrue, PostgREST,
Postgres with every adventure migration) and the 2 November corpus
stand-in — two phones (390×844) and a desktop (1440×900):

- `markham.spec.ts` — choosing; the folded chooser; the warm ending; a
  sentence, _What changed_, **Undo**, the same sentence again; the sushi
  refusal; Add · Earlier · Remove through reloads; the replace preview;
  the invitation card and its exact text; Jess joins, sees the same plan,
  can't change the ending or Lorne's stops, adds her own, suggests; a
  second account is refused; Lorne sees her name on her stop and her
  suggestion and applies it; packing ticks cross; nothing scrolls sideways;
  every plan button ≥ 44 px; the plan starts on the first screen; the
  same night on a desktop. Second test: all four cards the same height,
  phone and desktop.
- `shared-off.spec.ts` (`SHARED_OFF=1`) — on a stack without the two
  migrations.
- `night.stack.test.ts` — real RLS for plan, packing and memories (a stranger
  and anon see nothing); plus a night under the old title is found, not
  duplicated.
- Unit: `say.test.ts` (18), `heading.test.ts`, `adventures.test.ts`.

Screenshots: `verification/screenshots/markham-*.png` (01a/01b cards, 02
the journey, 02b change adventure, 04a what changed, 06b invitation, 07
Jess, 11/12 desktop, 13 off, 14 after the migration).

## Release

### Code

Merges as a fast-forward of `main`; no environment variable. Deploying the
code alone is safe: packing and memories say they're off until the SQL runs.

### Packing and memories — the two migrations

Production was last measured on 2026-11-01 (anon existence probe,
`docs/release/RELEASE-2026-11-01-HOCKEY-CHRISTMAS.md` §4): **the together
tables did not exist**. The packing migration was written after that probe.
Nothing on Metatron can read production's schema today without credentials,
so **whether either has been applied since is unknown here** — block A of
`PREFLIGHT-SHARED.sql` answers it in ten seconds.

Dependencies: both need only the adventure core (`20261021000000`:
`passport_adventures`, `passport_adventure_members`,
`passport_is_adventure_member/owner`), which production has. Neither depends
on the other. Both are guarded (safe twice), additive, RLS on, no anon
grants, explicit grants to `authenticated` only.

Rehearsed on the local stack **with data in it**: preflight (applied) →
rollback of both → preflight (A false, B 7 / 10 / 37) → the app with them
missing (`shared-off.spec`: night starts and plans, panels say off) → apply
both twice each, no errors → preflight (A true; B 8 / 11 / 45, the
difference being exactly the one night the off-spec created; C and D no
rows; E packing 4, moments 3, notices 4, acks 3) → the night made while
off gets its list from **Start with our list**; the full two-phone spec
green.

Operator, in the Supabase SQL editor of the Passport project:

1. Run `docs/product/date-night/PREFLIGHT-SHARED.sql` blocks A–D. Note B.
2. If A says memories false: run
   `supabase/migrations/20261101000000_passport_adventure_together.sql`.
3. If A says packing false: run
   `supabase/migrations/20261102100000_passport_adventure_packing.sql`.
4. Run A–F again: A all true, B unchanged, C and D no rows, E and F as
   commented.
5. Push `main`. On `/datenight`, the owner opens Together: _What we're
   bringing_ and _Our memories_ open. If the night already existed, tap
   **Start with our list**.

Rollback: `docs/product/christmas/together-rollback.sql`;
`DROP TABLE public.passport_adventure_packing;`. The app falls back to
"Not switched on yet".

## Named, not resolved

- The adventure's stored title in production stays whatever it was made
  with; Saved and adventure lists show that stored title. Renaming a
  person's existing adventure is theirs to do, not a migration's.
- Photographs on the timeline are real places credited by name (the sunset
  is Coldstream's, the fire is a campfire), not King Edward Lake itself —
  nobody has a licensed photo of it. Said under each photo.
- The Crazy Creek "romantic" answer moves the night later (home about 11:35
  pm) and warns that it's a long night; whether that's romantic or just late
  is a person's call.
- Doctrine §15.4 and §15.12 stay open; this is one more narrow answer.
