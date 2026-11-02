# Go Have a Christmas

**Status:** built on `feature/christmas` (lane christmas, owner brief M470,
2026-11-01). Not merged, not deployed. Product authority is
[the doctrine](../../PASSPORT-PRODUCT-DOCTRINE.md); this page records what
Christmas is, what it reuses, and what it does not decide.

```
/christmas                    the season: countdown, what's coming up, one-tap themes
/christmas/discover           Christmas Discovery: Atlas finds, evidence and confidence on every card
/christmas/plan               build a Christmas adventure (evening, family day, market day, weekend, 3–5 days)
/christmas/adventure/[id]     the adventure: plan + vote, people + invites, announcements,
                              challenges, memories, recap, go have another
```

## The journey, against the doctrine

The brief's journey and the doctrine's are the same loop said three ways.
Christmas follows the agreed Saved + Adventures wording
([`adventures/EXPERIENCE.md`](../adventures/EXPERIENCE.md)) and adds the
group's half.

| Brief (M470)    | Adventures (ADR 012) | Doctrine §2              | Where, in Christmas                                                     |
| --------------- | -------------------- | ------------------------ | ----------------------------------------------------------------------- |
| Discover        | Discover             | DISCOVER, REACT          | `/christmas`, `/christmas/discover`                                     |
| Save            | Save                 | COLLECT                  | **Save** on every card → the one Saved (Atlas board)                    |
| Plan            | Dream → Build        | SHAPE                    | `/christmas/plan` → a sketched adventure; change it in words or by hand |
| Share           | (invite links)       | §15.12 group             | invites, in / maybe / out, **announcements**                            |
| Experience      | Go                   | COMMIT → LIVE → ADAPT    | the core's _Today's adventure_; announcements when plans change         |
| Remember        | Remember             | REMEMBER                 | **challenges**, shared **memories**, the **recap**, the core's guide    |
| Go have another | Do it again          | LEARN → back to DISCOVER | _Plan another Christmas adventure_, seeded with this one's places       |

## What Christmas reuses (and does not rebuild)

| Capability                                     | Reused from                                                                                                                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atlas reads, caching, outage reporting         | `listDiscoveryCandidates` (with `childAge`/`on` only when said), `listDiscoveryDistances` (ADR 094), `candidateToExperience`                                                |
| Distance, age verdicts, where-lines, pictures  | Discovery's `distanceTo`/`distanceText`, `ageLine`/`ageBecause`/`excludesAge`, `whereLine`, `Picture` (`cardPictures` labels), `subjectHref`, `statedDay`/`formatEventWhen` |
| Saved                                          | `boards-repo` + `activeBoardStorage`, resolved exactly as `SaveButton` does                                                                                                 |
| Group membership, invites, roles, removal, RLS | `passport_adventures` (ADR 009) — a Christmas adventure is kind `christmas`                                                                                                 |
| Voting                                         | the core's in / maybe / out answers, in `AdventureJourney`                                                                                                                  |
| Planning                                       | the Day Builder's own engine through `sketchDays` (ADR 012) — still one planner                                                                                             |
| Shaping a plan, Today's adventure, travel legs | `AdventureJourney` (Keep · Replace · Move · Remove, the change box, Undo, `TodayPanel`)                                                                                     |
| Invitations and the roster                     | `AdventurePeople`, `/adventures/join/[token]`                                                                                                                               |
| Printable keepsake                             | `/adventures/[id]/guide` (Fishing With Emi skeleton)                                                                                                                        |
| Snow and the hearth                            | `/about/experiment-05-christmas` `SnowLayer` and `useFireplaceSound`                                                                                                        |
| Photo shrinking                                | Hockey Memories' recipe (copied: it is not exported there — see RELEASE.md)                                                                                                 |

## What Christmas adds

- **Evidence-based Christmas** (`src/domain/christmas/themes.ts`). Seven
  themes in a family's words — markets, lights, Santa, winter festivals, shows
  & traditions, festive food, winter fun — and a subject belongs only where
  Atlas holds a word for it in **its own** evidence (name, subtype,
  description, what you can do there, the organiser's stated facts). Holiday
  hours ("Closed on Christmas Day"), hotel names, an award or a ski school's
  "Christmas Break Camp" are not evidence; neither is a picture's caption.
  Winter fun (rinks, sleigh rides) counts only from what a thing _is_ and is
  never called Christmas. Measured on Atlas's corpus of 2026-10-24: 75 finds
  of 5,469 — 48 of them Christmas, 17 of those with this season's dates; run
  `themes.eval.test.ts` against any corpus to read the list.
- **Four confidence readings** (`when.ts`): _Dates from Atlas_ (this season,
  actionable), _Check the days_ (a window without days, or the organiser's
  own words — quoted, never parsed), _Dates not confirmed_, and _Not listed
  this year_ (Atlas's latest dates have gone: shelved apart, never
  recommended, still saveable).
- **Christmas Discovery** (`discover.ts`): location, distance, dates, who and
  how many, children's ages (the youngest asked of Atlas), interests, budget
  and time — each optional, each narrowing only where Atlas holds the fact,
  and the page says what each one set aside. Near / in your area / Atlas
  hasn't said where / further are four different shelves (`proximity.ts`'s
  rule: unplaced is not far).
- **Christmas planning** (`plans.ts`, `/christmas/api/start`): five shapes,
  one sentence the Day Builder already reads, and one Christmas-specific
  rule: a chosen event Atlas dates to one day of the plan goes on that day;
  one Atlas dates outside the plan stays an idea and the page says so before
  and after creating it.
- **Announcements** — the host's _Change of plans / New place / Meeting spot /
  New time / Heads up_, with an optional place and _Got it!_. They lead the
  page until each person has it; the host sees who has. Learned from the real
  Hockey Night of 2026-10-25 (brief M466). No push notifications (§6): the
  page checks every 30 s while open and visible.
- **Challenges** — twelve optional dares in Passport's own words, finished
  only by sharing proof (a photo, a line, or either). _Since 2026-11-01
  ([smarter adventures](../adventures/smarter/README.md)):_ at most three
  lead, chosen for who is going and for what Atlas holds near the adventure
  on its days, each with real places to do it; the rest wait under _More
  dares_. Finishing one _is_ a
  memory; a tally, not a leaderboard (§14 keeps elaborate games out).
- **Memories and the recap** — photos (shrunk to 1280 px in the browser),
  favourite moments, family traditions and finished challenges; a recap built
  only from what was shared (`recap.ts`) — no generated line fills a gap.
- **Personality** — the season in GHAD's own palette (forest, berry, sun,
  cream, candlelight), CSS night sky and fairy lights, snow that respects
  `prefers-reduced-motion` and remembers being turned off, an optional
  synthesized fire that never starts by itself, one celebration star when a
  challenge is done. No stock photography: every picture of a real thing is
  Atlas's, labelled.

## What Christmas does not decide

- **§10 Experience architecture stays open.** Christmas is one more data
  point: a composition of shared capabilities with its own pages, on the
  adventures core, unlike Hockey (its own tables) and October (a themed
  corpus). It does not make that the Experience contract.
- **D-9 (where memories live) is proposed, not taken.** Shared memories need
  the migration in [`20261101000000_passport_adventure_together.sql`](../../../supabase/migrations/20261101000000_passport_adventure_together.sql), which
  states its decision out loud. Until it is applied, Christmas says sharing
  isn't switched on and everything the core does keeps working (verified:
  `christmas-off.spec.ts`).
- **§15.14 (Want / Plan / Lived)** — untouched. Saving a Christmas find does
  not mark it wanted; adding it to a plan does not mark it planned.
- **Reachability (§10, decided 2026-10-15) lists three Experiences.** Adding
  Christmas to the Experiences menu is a shared-shell change this lane
  proposes rather than makes (RELEASE.md).

## Atlas: what it gave, and what is missing

Christmas consumes Atlas across the existing boundary and changes nothing in
it. On the 2026-10-24 corpus:

- **Geography.** Of 38 Christmas Events, 6 carry a place Atlas can measure;
  the rest are `unknown`. They stay, shelved under _Atlas hasn't said where_,
  rather than being placed by Passport.
- **Prices.** No structured price for any Christmas find; the organiser's
  words are held for 7 (Arc's "$169 per adult", Christmas Express's fares),
  some with an ingestion artefact Passport quotes as-is ("$$37.00"). _Free
  or by donation_ therefore keeps only the 4 stated free for everybody — not
  "infant free on lap".
- **Duration.** `visitDuration` is held for 1 of 38 Christmas Events, so
  _time you have_ rarely narrows.
- **Duplicates.** "Vancouver Christmas Market" is a Place and "Vancouver
  Christmas Market 2026" an Event, unlinked. Both show; merging is Atlas's.
- **Stale dates.** Eleven markets' latest dates are 2019–2025. They are shelved
  as _Not listed this year_ — a refresh is Atlas's.

## Verification

See RELEASE.md. In short: a real GoTrue + PostgREST + Postgres stack
(`verification/stack.mjs`, ports 557xx) with the proposed migration applied
twice, the Atlas stand-in serving Atlas's real 2026-10-24 corpus
(`verification/atlas-candidates-2026-10-24.json.gz`), a production build on
port 3131, and `verification/christmas.spec.ts` on a 390 px phone: three
people, one Christmas weekend, from the first tap to _Go have another_.
Screenshots are in [`screenshots/`](screenshots/).

## M487 — first two screens and the sentence (2026-11-01)

- **The first phone screen is a photograph.** The soonest Christmas find Atlas
  has a picture of fills the hero (never stock photography), captioned with
  what it is and how sure its dates are. Headline: _Let's make some Christmas
  memories._ The second screen is the sentence box.
- **Say it in a sentence** (`sentence.ts`, `SayIt.tsx`). "We have Saturday
  afternoon, two kids, and $100" is read into shape, day, party, children's
  ages and town; the planner opens already filled and the words go to the Day
  Builder untouched, which is what reads the budget and time of day. Anything
  not recognised is left unread — nothing is guessed. Signed out, the sentence
  survives sign-in.
- **Theme tiles are Atlas pictures**, not emoji; shape and challenge cards lost
  their emoji too.
- Not done: Christmas lights/market photography beyond what Atlas holds
  (no pictured find → a deep-green night sky); budget is read by the Day
  Builder but Atlas holds no structured prices, so a $100 plan is a plan
  around the stated budget, not a verified cost.
