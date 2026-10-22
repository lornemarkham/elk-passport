# Hockey Night — visual overhaul (2026-10-21)

**Branch:** `feature/hockey`, on top of the Friday release candidate
(`c44b4f8`). Not pushed, not deployed. **No schema, RLS, auth, invitation or
multiplayer change** — the engine, the server and `useSharedNight` are
untouched except one additive read (§4).

Before/after pictures: [`visual-overhaul/`](visual-overhaul/). Every picture
is the same real night: three accounts on 375 px phones, real invitations,
real votes and picks through the night's own API, real Atlas places near
Rogers Arena (production `/discovery/candidates`, captured 2026-10-20), the
host moving puck drop to walk it through before → intermission → final →
the morning after (`verification/screenshots.mjs`).

---

## 1. Design diagnosis — what was wrong

Measured on the RC with the same three-person night:

| Problem                          | Evidence                                                                                                                                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **One very long column**         | Before the game a guest's page was **8,398 px** (≈ 10 phone screens); the host's **10,000 px**. Every block of every kind, in phase order: poster, running order, roster, plan, pregame vote, meeting vote, leaving vote, picks, chat, settings. |
| **The game was small**           | "Canucks vs Wild" was 20 px grey under a serif "Sycle Hockey Night". No team identity, no clock — "in 4 days" in 13 px.                                                                                                                          |
| **Tiny text**                    | Most supporting text 11.5–13.5 px at 40–50 % white: lock times, distances, hints, the guest list, the privacy line.                                                                                                                              |
| **Venues were text rows**        | "Chambar · 250 m straight line · 4+ min walk (estimate)" in a bordered box — while Atlas holds an exact, vouched photograph for 15 of the 19 places within 1.6 km, plus stated hours and things like happy hour. None of it reached the page.    |
| **The plan was buried**          | The group's actual decisions (eating, meeting, leaving) sat ~1,900 px down, below the commentary and the roster.                                                                                                                                 |
| **Repetitive cards**             | Every question was the same dark rounded box with the same 15 px rows: a pub vote, a meeting point, a score prediction and a dare all looked identical.                                                                                          |
| **Predictions felt like a form** | The deck helped, but each card was a 13 px stepper or a pair of outline buttons; nothing said "sealed"; after lock the picks simply vanished — the reveal the lab built the night around never happened on the page.                             |
| **Chat at the bottom**           | The conversation was below seven picks and the vote.                                                                                                                                                                                             |

What was right and is kept: the voice ("Make Sunday worse", "A hockey night
for one is a Tuesday", "Nobody can save you now"), the phases and quiet mode,
the sealed rules, the Cup, the receipts, Run it back.

## 2. The redesign

**The game first** (`GameDayHero.tsx`). Both sides in their colours, split
on a rink's centre line with the blue lines and faceoff circle laid over the
ice; three-letter codes in a condensed black face (Archivo, already loaded —
no new font); venue and puck drop under it. Then the board over centre ice:
a countdown to puck drop (seconds only in the last hour), the period and the
next break during the game, the **final** once the host has called it. Who's
in as faces and a count; "Your picks: 4/7 sealed"; Passport's line for right
now and its commentary ("Maya is the only person going with Shark Club. Bold
strategy."); Before · During · After with "Now: … Next: … in …". The whole
first screen answers _what game, when, who, what now_.

**Four rooms** (`NightTabs.tsx`, `domain/hockey/tabs.ts`) — **Plan, Play,
Chat, Group** — fixed at the thumb, each with a count of what's waiting
(votes you haven't cast, picks you haven't sealed, things said since you last
looked, kept on the device only). Every block the phase puts on the page is
in exactly one room; nothing was removed. The page opens on Plan before and
after the game, on Play in an intermission and the morning after; a reload or
a shared `#chat` link lands in the same room. In a period the page is still
only "Put your phone away" — plus the plan, so nobody digs for where we're
meeting after.

**Plan** (`PlanTab.tsx`):

- **The plan** leads, on a white card: Eating (with the leading place's
  photo), Meeting, Puck drop, Leaving — after the game, After — each the
  current leader of its vote, a tie said as a tie, "Nobody's voted yet" when
  nobody has, and a **Next:** line from the schedule ("Votes close at 5:30
  p.m. on game day. Picks seal at puck drop, 7:00 p.m.").
- **Where are we going before?** as photographic venue cards
  (`VenueCard.tsx`): the place's photo, its kind, the walk, game-day hours,
  what Atlas holds that matters (happy hour, trivia), Atlas's sentence, a link
  to the place in Passport, a big vote button, faces and a race bar.
- **More near Rogers Arena**: a swipeable shelf of everything Atlas knows
  within 1.6 km (24 here), All / Restaurants / Bars & pubs, **Add to vote**
  on each. Exploring is no longer behind a "What's near the arena?" link.
- Meeting and leaving as big one-tap rows that **fold to your answer and the
  group's** once you've voted, so a returning person isn't scrolling past
  four options they've dealt with.

**Play** (`PlayTab.tsx`, `PicksDeck.tsx`, `RevealBoard.tsx`):

- **Picks** one at a time on a white card: the score as two big counters in
  the teams' colours, Yes/No as two buttons you can't miss, a team as a tile in
  its colours, a person as their face. One tap is the answer (the lab's rule —
  no submit), the card stamps **SEALED**, and the deck moves to the next
  unanswered pick. A row of pucks shows progress; "All sealed. 🔒 Now you
  wait — insufferably." lists your picks. A forfeit you must opt into still
  uses the lab's own card, so its consent gate is unchanged.
- **The reveal.** Once picks lock, everybody's answers arrive face down —
  _Tap to reveal_, or **Flip them all** — and once the host calls a result
  each card says _Called it +5_, _Half right +2_ or _Nope_, by the engine's
  own scoring. The morning after it's "Who called it".
- Intermission games, the receipts, the Cup and the recap, as before, with
  the receipts first (the lab's "most anticipated block").

**Chat** — the night's conversation, on its own. **Group** — who's in (names
never cut off), you tonight, your limit, and for the host the guest list and
What's in tonight. The hero's **Invite** goes straight to the guest list.

**After.** The hero turns into the final — VAN **4 – 2** MIN — and the
morning after adds **Now go have another.**, which goes to Run it back.

## 3. Venue discovery — what is shown, and what is not

Reused, not rebuilt: Discovery's candidates and its Eat & drink meaning
(`nearby.ts`, unchanged), Passport's picture precedence (`PossibilityCard`:
own photo → Atlas's labelled `presentationImage` → nothing), Passport's
destination rule (`subjectHref`: a Place to `/places/{id}`, anything else to
`/passport/{id}`), the shared straight-line walk.

Measured against the real corpus near Rogers Arena (19 food & drink within
1.6 km on the RC's limit, 24 with places up to 1.6 km now offered):

| Atlas has                                                                  | The card shows                                                                                   |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| An exact photo (Chambar, Shark Club, Boston Pizza, Library Square…)        | The photo, unlabelled                                                                            |
| A photo from the business's own site, not verified (Moxies)                | The photo, labelled **From moxies.ca**, Atlas's attribution on hover/long-press                  |
| Only a category stock photo (Tokyo In April: a resort dining room in Laos) | **No photo** — a designed card in the home team's colours: "No photo Passport can vouch for yet" |
| Stated hours tagged for game day's weekday                                 | Quoted verbatim: "Game day: Sunday: 9:30am - 11pm" — never parsed into times or tidied           |
| `?on=` verdict that stated hours don't cover game day                      | Said in red, in Atlas's terms                                                                    |
| Practical facts (happy hour, trivia, karaoke, patio, specials)             | At most two, quoted                                                                              |
| A description Atlas says adds nothing (`descriptionAddsKnowledge: false`)  | Nothing                                                                                          |

No ratings, prices, opening-hours inference, "popular" or invented walk
times. The walk is "4+ min walk · 250 m straight line (estimate)" every time.

## 4. What changed underneath (additive only)

- `GET /hockey/api/occasions/[id]/nearby` asks Atlas for **game day**
  (`?on=YYYY-MM-DD`, Vancouver time) — the same read Discovery makes for a
  picked day — and returns, per place, `kind`, `image`, `gameDay` and
  `facts` beside the existing fields. If that read fails, the plain corpus
  read decides whether Atlas is out, exactly as before. The list now goes to
  24 places (was 16); a nomination is still looked up and measured by the
  server from the same list.
- New pure modules with tests: `teams.ts` (colours and codes for every
  opponent), `countdown.ts`, `tabs.ts`, `reveal.ts`, `planItems` in
  `plan.ts`.
- Removed: `NearbyPicker.tsx` (replaced by the shelf and the cards) and
  `RunningOrder.tsx` (now the hero's Before · During · After).
- `screenshots.mjs` and `redesign.spec.ts` added to `verification/`; the six
  existing specs updated to open the right room before they look. **No
  assertion was dropped**; three are stronger (the plan is checked by its
  row, not by a text fragment; mobile audits every room; the plan panel is
  checked for leaking a pick).

## 5. Decisions a human may want to revisit — named, not resolved

1. **Stock photos.** Discovery shows a category stand-in labelled
   _Illustrative photo_; the Hockey ballot shows none, because on a vote
   between specific places a picture reads as _this_ place. Two surfaces now
   apply ADR 106 differently. If that should be one rule, it's a Discovery
   decision too.
2. **The plan is always on.** Before, _The plan_ appeared only after the
   first vote; now it leads Plan from the start and says "Nobody's voted yet".
   `plan-and-results.spec.ts` was changed to match.
3. **Badges and less phone.** Doctrine §6 — Passport succeeds when people
   spend _less_ time in it. The tab counts are only things waiting for you,
   chat unread is per device, and nothing counts or pulses during a period.
   Still, a badge is an invitation to look; worth watching on the night.
4. **Team colours.** Colours and three-letter codes only — no logos, crests,
   wordmarks or photographs of players or jerseys. Whether even that is fine
   for a company event is a human call.
5. **Doctrine §10 (Experience architecture) stays open.** This composes a
   Hockey-specific page over shared capabilities (Atlas candidates, the
   picture rule, place pages, the lab engine) — consistent with "shared
   capability is not shared UI", and not an answer to (a) vs (b).

## 6. Verification

See [`RELEASE-2026-10-23.md`](RELEASE-2026-10-23.md) §6–7 for the full release
steps; this section records what was run for this change.

On `feature/hockey` at this commit, 2026-10-21, on Metatron, against a real
local Postgres + GoTrue + PostgREST (`verification/stack.mjs`, production's
grant posture):

| Gate                                                           | Result                                                                                                                                                                                                                                     |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npx tsc --noEmit`                                             | clean                                                                                                                                                                                                                                      |
| `npx eslint .`                                                 | 0 errors, 40 warnings — the RC's count; **none** in Hockey files                                                                                                                                                                           |
| `npx prettier --check .`                                       | clean                                                                                                                                                                                                                                      |
| `npx vitest run`                                               | **3,340 passed**, 30 skipped (RC: 3,318). Hockey domain 79/79 (RC: 57) incl. 22 new: team kits, countdown, rooms, reveal verdicts vs the Cup, the live plan, hours quoting, picture rule                                                   |
| `npm run build`                                                | ok                                                                                                                                                                                                                                         |
| `npx playwright test` (whole repo, `next start`, critic Atlas) | **250 passed, 4 failed** — exactly the recorded baseline: core-loop:26, october:554, october:570, conference-mobile:23. (One earlier run also timed out `nfr:223` under load; it passed 3/3 alone and in the final run.)                   |
| Hockey browser suite, real sign-ins                            | **9/9**: acceptance (synthetic Atlas stub, as designed), email-confirmation ×2 (confirm-email stack + SMTP sink), plan-and-results, modules (three phones), multi-night, mobile 320 + 375 (now every room), **redesign (new, real Atlas)** |
| `rls-attack.mjs`                                               | **53/53**                                                                                                                                                                                                                                  |

`redesign.spec.ts` is the multiplayer check for this change: two phones, real
sign-ins and real Atlas places. Maya sees Chambar's own photograph, Moxies'
labelled "From moxies.ca", no picture for Tokyo In April, Shark Club's
game-day hours quoted. She adds Chambar from the shelf; it lands on Lorne's
phone as a photo card; his vote moves _her_ plan to "Chambar · 1 vote" with
no reload. She seals three picks by thumb (counter, team tile, Yes) and the
API holds exactly `[3, 2]`, `canucks`, `true`. After the horn, both picks are
face down, flip, and hers says _Called it +5_; the hero says VAN 3 – 2 MIN;
the morning after, **Now go have another.** lands on Run it back.

**Not verified here:** an iPhone or Android device in the hand (Chromium phone
emulation at 320/375 px only), and production Atlas's answer to `?on=` for
game day (the stand-in does not hold `onDate`; when Atlas does, the card says
it, and when it fails the plain read is used).

## 7. Deployment — exact steps (yours; nothing here was pushed or deployed)

This is **code only**: no migration, no new environment variable, no Supabase
change. The night that is live keeps every vote, pick, message and member —
they are rendered by the new page as they are.

1. **Fetch** (on the Mac):
   ```
   git fetch metatron:passport/main feature/hockey
   git log --oneline -1 origin/main
   ```
   If `origin/main` is `c44b4f8` (the RC), fast-forward:
   `git checkout main && git merge --ff-only FETCH_HEAD`. If `main` has moved,
   `git merge FETCH_HEAD` and re-run the gates in §6 before going on.
2. **Check how production deploys right now** — Vercel → `elk-passport` →
   Settings → Git. The record disagrees with itself: the RC's release doc says
   production is Git-connected (push `main` = deploy); a later check found no
   Git link, so a push deployed nothing.
   - Connected: `git push origin main`.
   - Not connected: from that checkout at that commit, `vercel deploy --prod`.
3. **Check it on your phone** (5 minutes, on the real night):
   - [ ] The top is the game: VAN vs MIN in colours, the countdown, "N in".
   - [ ] **Plan** opens first. _The plan_ shows what the group already voted —
         the coworker's existing votes are there.
   - [ ] The dinner vote is photographs. **More near Rogers Arena** fills within
         a few seconds. The first load after a deploy asks Atlas for game day,
         a fresh corpus read of up to ~7 s; a shimmer shows meanwhile.
   - [ ] **Play**: the picks already made show as sealed (the pucks are yellow).
   - [ ] **Chat**: the existing messages. **Group**: the guest list, _What's in
         tonight_.
   - [ ] Second phone votes → yours changes within ~5 s without a reload.
4. **Undo:** Vercel Instant Rollback to the previous deployment. Nothing in the
   database depends on this version.
