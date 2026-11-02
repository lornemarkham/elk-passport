# Passport Product Alignment Report

**Written:** 2026-11-01, Lodge mission 467 (`passport-vision`), on `main` at
`bf397d3`. Read-only research: no source code, branch, database or deployment
was changed. This file is the only artefact.

**What this is.** A reconciliation of everything the repository, the lane
briefs and the mission archive say Passport is _for_, measured against what
is built. It exists so that a new agent can learn what Passport is, why it
exists, how the journey should work, and what it must never compromise,
without reconstructing it from chat again.

**What this is not.** It is not product authority.
[`PASSPORT-PRODUCT-DOCTRINE.md`](PASSPORT-PRODUCT-DOCTRINE.md) is. Where
this report recommends a change to the doctrine it says **Proposed**, and a
person decides. Nothing here approves building anything.

**Labels used throughout.** Every claim carries one of four:

- **Established** — a decision in the doctrine, an ADR, or an owner brief,
  with the path.
- **Implemented** — read from the code on `main`, with the path. "Implemented"
  does not mean "verified in production"; production state is recorded where
  known.
- **Proposed** — this report's own reading or recommendation. Nobody has
  decided it.
- **Open** — genuinely unresolved, usually a doctrine §15 question.

---

## 1. Executive summary

**The vision is not lost. It is scattered across six places that do not
cite each other, and the newest owner decisions are in mission briefs that
no document records.** The doctrine (2026-10-10) is sound and mostly still
true. The drift the owner describes is real, and it has three causes, none of
them a missing vision document:

1. **Four canonical journeys are in circulation.** Doctrine §2's nine-stage
   loop, doctrine §9 / ADR 012's _DISCOVER → SAVE → DREAM → BUILD → GO →
   REMEMBER → DO IT AGAIN_, the mission briefs' _Discover → Save → Organize →
   Build → Go → Remember → Go Have Another_ (M370, M372) and this mission's
   _Discover → Save → Plan → Share → Experience → Remember → Go Have Another_.
   They are the same loop at different zoom levels (§3 below reconciles them),
   but an agent reading one never sees the others, and the two stages the
   doctrine says "almost nobody builds" — REACT and ADAPT — fall out of every
   short form. Both are absent from the implementation.
2. **Doctrine reaches agents by instruction only, and nothing enforces it.**
   `CLAUDE.md` says "read it in full"; nothing checks. Three missions (M366,
   M370, M375) designed enforcement and none was wired in. The Forge context
   hook is not active for Passport lanes. The lane briefs are hand-written
   with no template, and the Hockey lane's still says "no route or domain code
   exists yet" after 89 Hockey commits.
3. **The shared experience infrastructure was decided (ADR 009) and then
   bypassed by both shipped Experiences.** `main` has four membership and
   invitation systems (boards, hockey occasions, conferences, adventures) and
   two chats, two photo tables, three vote models. Only Adventures uses the
   ADR 009 core. Hockey's ten migrations live under `docs/product/hockey/`,
   not `supabase/migrations/`. Christmas and Snow, provisioned empty on
   2026-11-01 with the instruction "do not duplicate", have nothing shared to
   reuse for announcements or chat, because no shared implementation exists.

**What is actually built, in one paragraph.** Generic Passport has a strong
Discovery (one sentence box, conversation in the URL, 58 activities on nine
shelves), a Day Builder (`/go`) that builds honest days from Atlas with Keep /
Swap / Move / Remove and change-in-words, a printable guide, a Go Offline step
(`/detox`), and Saved → Adventures (never a blank adventure, sketched days,
shareable). It has no reactions beyond Save, no live mode on a day, no
mid-day adapt, no generic memory capture, and no return path: the paper says
"come back and tell us what happened" and nothing receives it. Hockey Night is
the one Experience that has been used by real people (6/10, 2026-10-25, M466
brief) and the one with the richest social toolkit, all of it private to
Hockey. October is a real Experience with its own shell and its own saved
table. Christmas and Snow exist only as Labs fixtures and an idea wall.

**The five things a new agent must never compromise** (all Established, cited
in §2):

- The measure is _"That was one hell of a day."_ Not clicks, not time in app.
- Atlas understands; Passport inspires. Passport never invents a fact.
- Save is not the end. A saved list that becomes a graveyard is product failure.
- Less phone, more life. START is a mode change, not an exit.
- Signals are evidence, inference is inference, confirmed state is state.

**The highest-value recommendation** (§10): stop adding documents. Put a
twenty-line product contract block into the one file every agent already
loads (`CLAUDE.md`), generate lane briefs from a template that carries the
same block, and add one cheap repository test that fails when an Experience
route exists without a journey record. Then make Hockey Night's next cycle
(M466) build announcements, chat replies and phases as shared Passport
modules, so Christmas and Snow inherit them instead of copying them.

---

## 2. Product north star

### 2.1 What Passport is, in plain English

**Established.** Passport helps a person discover a day worth getting excited
about, and then helps them actually live it. It is not a directory, a search
engine, a bookmark manager, an itinerary app or an AI chatbot, although it can
do all of those (doctrine §1). The older statement of the same idea: _"Help
people create memorable real-world experiences. Travel is the medium. Living
well is the objective."_ (`docs/old-might-be-garbage/passport-vision.md`,
"What Passport is for", 2026-07-25). The original philosophy goes further:
Passport is a **Life Experience Engine** whose unit of success is _"the arc —
the pattern of days, the accumulation of memory"_, not one recommendation
(`archive/13-philosophy.md`, "The long-term vision").

**The problem it solves.** People know how they feel and what they miss better
than they know the best activity to address it. Most products answer "what do
you want?"; Passport answers _"What kind of day would make your life better
today?"_ (`archive/13-philosophy.md`, "Search is not the product"). A
request is a guess at a solution; _"I want kayaking"_ may mean family time,
fresh air, cooling off.

**What makes it different.** Three things, each Established:

- It owns the second half of the loop. Anyone can build Discover; _"Almost
  nobody builds LIVE and ADAPT"_ (doctrine §2). Adaptive replanning _"may
  ultimately be more valuable than initial itinerary creation"_ (§2.8).
- It is honest. Every stop is a real Atlas subject; where Atlas has nothing,
  Passport says _you pick_ rather than inventing (`src/domain/day/build.ts`
  header; `docs/product/originals/fishing-with-emi.md` §4).
- It wants you to put the phone away. _"Passport succeeds when people engage
  more deeply with their lives — not when they spend more time in Passport."_
  (§6).

**What every user experience should accomplish.** The person should end the
day saying _"Holy shit. That was one hell of a day."_ (doctrine §1;
`archive/13-philosophy.md`, "The measure of success"). At child scale, the
acceptance line is Emi's: _"A five-year-old who casts once, finds a weird stick
and asks to come back has had a perfect day."_
(`docs/product/originals/fishing-with-emi.md` §1).

### 2.2 The mission's thirteen principles, validated against sources

| #   | Principle (mission brief)                   | Verdict                                            | Evidence                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Go have a day. Now go have another.         | **Established** (name); return half **not built**  | Lineage in `docs/product/originals/go-have-a-day.md` §2: `archive/13-philosophy.md` → design lab `b32b87d` → wordmark `6950899` → `/go` `016854a`. "NOW GO HAVE ANOTHER" is **Stated** in brief M136; `git grep -i 'have another'` found nothing before `/detox/back` added the words. Doctrine §2.10: _"Nothing in the current architecture builds that return path yet."_ Still true. |
| 2   | Atlas understands. Passport inspires.       | **Established**                                    | Doctrine §17 "Atlas and Passport"; `docs/old-might-be-garbage/passport-vision.md` "Relationship to Atlas"; `docs/PROJECT-CONTINUITY.md` §2 _"Atlas owns what is true about the world. Passport owns what is safe to say about it."_ Christmas sandbox: _"Atlas provides truth. Passport provides meaning."_ (`experiment-05-christmas/ChristmasPassportExperience.tsx`).                |
| 3   | Discovery is the beginning                  | **Established**; inputs partly built               | Doctrine §2.1, §4, §7, §8; ADRs 005–007. Inputs read today: who (alone/child/group), child age if typed, hours/window/date, distance, free-only budget, indoor/outdoor, lens. **Not read:** cost beyond free, accessibility, equipment, energy, meals, reservations, crowds (`src/lib/ai/ask/read.ts`). Conversational and clickable share one state by design (ADR 006, 007).          |
| 4   | Saved is not a bookmark list                | **Established**; partly built                      | Doctrine §2.6, §9; ADR 010, 012; owner brief M366 _"Saved is NOT a bookmark collection."_ Built: Saved → Create an adventure → sketched days → kept stops → guide. Not built: Want / Plan / Lived states (§15.14), any state on a saved place beyond existence. Units named in M366 (Days, Weekends, Weeks, Months) appear in no file; `kinds.ts` has day / weekend / trip.             |
| 5   | Day Builder is central                      | **Established**; built without live/adapt          | Doctrine §2.5–2.8; `/go` (`src/domain/day/`). Editable (Keep/Swap/Move/Remove/minutes, words with Undo). No drag, no voice, no START, no adapt. `/go` is not in the nav (`PassportNav.tsx`), an open decision since 2026-10-11 (roadmap D-1).                                                                                                                                           |
| 6   | Go Offline                                  | **Established** (principle); built as a step       | Doctrine §6; `experiment-06-analog-adventures/content.ts` _"the best Passport session ends with the phone being put away"_; `src/lib/detox/README.md`. Built: `/go/print`, `/detox` with pact and pocket screen, guardrail test (no timers, badges, screen-time). Missing: map on paper, paper leads back, true offline load. Name conflict "Digital Detox" vs "Go offline" open (D-3). |
| 7   | Moments and memories                        | **Established** (idea); not built generically      | `archive/03-treasure-chest.md` _"Life is measured in moments"_; Emi page _"Four moments, not a list of directions"_; doctrine §2.9. Generic Passport has write-only paper prompts and device-only Done marks. Real photo tables exist only in Hockey and Conference. "Moment" means three different things in the repo (originals §3).                                                  |
| 8   | Now go have another                         | **Stated**; not built                              | See #1. `/detox/back` ends with "Now go have another" linking to `/go` carrying nothing. Adventures' "Do it again" copies places as ideas (ADR 012 §7): the nearest built thing.                                                                                                                                                                                                        |
| 9   | Experiences are personalities               | **Established as a question**, not an answer       | Doctrine §10 and §15.1 are explicitly open. The repo holds three answers: October's "Director" (bible §1), the idea wall's "same Atlas, infinite personalities", the Christmas sandbox's "Not personalities. Moods." The lab's engine proved "not secretly a hockey engine" (`src/experience-lab/README.md`, "Date Night").                                                             |
| 10  | Shared experience infrastructure            | **Established** (ADR 009); bypassed                | ADR 009 decided one core. Only Adventures uses it. See §4.3 and §5.                                                                                                                                                                                                                                                                                                                     |
| 11  | Christmas is a complete seasonal experience | **Stated** (briefs M464/M465/M467); prototype only | Vision lives in `src/app/about/experiment-05-christmas/content.ts` and the idea wall. No route, no domain, no doc. Doctrine names it once.                                                                                                                                                                                                                                              |
| 12  | Snow is a complete winter experience        | **Stated** (briefs); prototype only                | Doctrine §10 says "Skiing" and calls it the stress case. "Go Have A Snow Day" appears only in briefs. Built: a Winter shelf in Discovery and the Powder Day lab fixture.                                                                                                                                                                                                                |
| 13  | Hockey is the case study                    | **Established by use**                             | Real group, 2026-10-25, 6/10 (M466 brief). The only Experience with real-world feedback, and the feedback is recorded nowhere in the repository.                                                                                                                                                                                                                                        |

### 2.3 Principles in the archive that the doctrine dropped without saying so

**Open.** These are not contradictions; the doctrine simply does not carry
them, and §17 does not list them as superseded. A person should decide
whether each is still intent. All paths are quoted in the Christmas / Snow /
archive research (this mission); the sources are:

| Principle                                                                                             | Source                                                  |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Life Experience Engine: the arc, not the moment; memory as a relationship                             | `archive/13-philosophy.md`, "The long-term vision"      |
| Balance and anti-echo-chamber growth, _"intentional and explainable"_                                 | `archive/13-philosophy.md`, "Growth without becoming…"  |
| Every recommendation explainable: why this, why today, why me, why now                                | `archive/13-philosophy.md`, "Every recommendation…"     |
| Curiosity over certainty: ask rather than guess                                                       | `archive/13-philosophy.md`, "Curiosity over certainty"  |
| Trusted surrender of choice (a partner plans in secret; _"the surrender has to stay theirs to give"_) | `archive/13-philosophy.md`, "Discovery doesn't always…" |
| The Local Explorer hero; _"We are building for ourselves first"_                                      | `archive/06-heroes.md`                                  |
| Founder acceptance: _"use ELK Passport tonight to plan a real adventure tomorrow"_                    | `docs/old-might-be-garbage/build-contract.md`           |
| Curated over comprehensive: fifty unforgettable beats five thousand average                           | `archive/08-principles.md`                              |
| Badges and gamification are not required (a recorded reversal)                                        | `archive/04-decisions.md`; `build-contract.md`          |
| Decision hierarchy: emotional experience > usability > maintainability > elegance                     | `archive/prompts/00-foundation/passport-philosophy.md`  |
| Personality spec: bright, bold, playful, slightly rebellious; not beige, not purple-gradient AI       | `archive/12-mvp-experience-visual-contract.md`          |
| The science base (peak-end, anticipation as payoff, awe, giving)                                      | `archive/14-science-of-meaningful-experiences.md`       |

**Proposed.** Four of these bear directly on current work and should be
re-admitted or explicitly retired: explainability (Discovery cards already
say "because"), curiosity over certainty (ADR 005's one question under
results is this), trusted surrender (the group question, §15.12), and the
badges decision (Hockey's Cup and the §14 conflict, §9 below).

---

## 3. Canonical user journey

### 3.1 The sequences in circulation

| Where                                                   | Sequence                                                                                   | Status      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------- |
| Doctrine §2                                             | DISCOVER → REACT → COLLECT → SHAPE → COMMIT → LIVE → ADAPT → REMEMBER → LEARN → (DISCOVER) | Established |
| Doctrine §9                                             | DISCOVER → WANT → ORGANIZE → DO → REMEMBER                                                 | Established |
| Doctrine §9 / ADR 012 (owner brief M435)                | DISCOVER → SAVE → DREAM → BUILD → GO → REMEMBER → DO IT AGAIN                              | Established |
| Owner briefs M370, M372                                 | Discover → Save → Organize → Build → Go → Remember → Go Have Another                       | Stated      |
| `src/lib/detox/README.md`, `GO-HAVE-A-DAY-ROADMAP.md`   | SAY IT → BUILD IT → SHAPE IT → PRINT IT → GO OFFLINE → COME BACK → NOW GO HAVE ANOTHER     | Implemented |
| `archive/12`, `docs/old-might-be-garbage/experience.md` | Plan → Reveal → Experience → Track → Capture → Recap → Share                               | History     |
| Experience Lab README, "Lifecycle"                      | A fixed enum _"did not survive contact with the second fixture"_; phases are declared data | Finding     |
| This mission's brief                                    | Discover → Save → Plan → Share → Experience → Remember → Go Have Another                   | Proposed    |

### 3.2 Reconciliation

**Finding.** These are one loop at different zoom levels, not competing
visions. Mapping the mission's seven steps onto the doctrine's nine:

| Mission step    | Doctrine §2 stage(s) | What the short form loses                                                                                                                                                 |
| --------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discover        | DISCOVER             | —                                                                                                                                                                         |
| Save            | REACT + COLLECT      | **REACT.** "Fuck yes but not today" vs "not for me" vs "save for later" are different signals (§2.2). "Save" as one verb is exactly the boolean collapse §2.2 forbids.    |
| Plan            | SHAPE + COMMIT       | **COMMIT.** A plan and an intention are different states (§2.6). ADR 010 calls the intention "an adventure"; the state vocabulary is still open (§15.14).                 |
| Share           | (cross-cutting)      | Nothing in §2 has a Share stage; sharing is a property of adventures (ADR 010 #6), boards, and recaps. Placing it after Plan is one choice; Hockey shares after Remember. |
| Experience      | LIVE + ADAPT         | **ADAPT.** The stage the doctrine values most (§2.8) and the one with zero implementation.                                                                                |
| Remember        | REMEMBER             | —                                                                                                                                                                         |
| Go Have Another | LEARN → DISCOVER     | **LEARN.** Feedback with personality (§2.10) and the return path into Atlas (§15.11). "Another" is the invitation; LEARN is what makes the next day better than the last. |

**Verdict on the mission's question** ("Verify this against original
product doctrine. Do not replace established doctrine"): the seven-step
sequence is **compatible** with §2 and is the most human wording, matching
how the owner has said it in every brief since M370. It should **not replace**
§2, because every short form so far has dropped REACT and ADAPT, and those
are the stages where Passport is meant to be different.

**Proposed.** Record one canonical pair in the doctrine: the seven words as
_the journey said the way a person would_, and §2's nine stages as _what each
word contains_. Retire the §9 five-word form (it predates ADR 010) and point
`src/lib/detox/README.md`'s seven-step diagram at the same pair. This is a
doctrine edit for a person to make; it closes a conflict without changing a
decision.

### 3.3 The journey as implemented today, step by step

| Step            | Generic Passport (`main`)                                                                                                                                                                                                           | Where it stops                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Discover        | `/discovery`: sentence box, starters, conversation in URL, Refine line, nine shelves, editorial sections, one question under results (ADR 005–007; `src/lib/ai/ask/`, `src/domain/discovery/`)                                      | No reactions; location tap-only; model path never run with a key in any lane                         |
| Save            | One **Save** action on a card (`61a2853`); `/saved` opens on "Where to next?" with Create an adventure first (`src/app/saved/page.tsx`)                                                                                             | A saved place has no state beyond existing; Want/Plan/Lived open                                     |
| Plan            | `/adventures/new` asks where/when/who/kind and sketches every day with the Day Builder engine (ADR 012); `/go` shapes a day: Keep/Swap/Move/Remove, words with Undo, rain plan, clock times "about", Atlas routed legs where served | No drag; no multi-household party; `/go` not in nav; clock-times decision D-8 unconfirmed            |
| Share           | Adventure invite links (`/adventures/join/[token]`); `/go/print` as the "day interchange format" (ADR 010 #6); "Take it as text"                                                                                                    | Owner-only invites; what a link reveals differs by feature                                           |
| Experience      | Print (`/go/print`, `/adventures/[id]/guide`); Go Offline (`/detox` → `/detox/out`); adventure "Today's adventure" panel with device-only Done marks (ADR 012 §5)                                                                   | No START on a day; no live context; no adapt; no map on paper; no true offline                       |
| Remember        | Paper memory prompts; guide "Afterwards" page; `/detox/back` postcard (localStorage, never names a stop)                                                                                                                            | Nothing ingested; no photo capture reachable from Go Have a Day; legacy `momentSchema` flow unlinked |
| Go Have Another | `/detox/back` → "Now go have another" → `/go` (empty); Adventures "Do it again" (ideas copied)                                                                                                                                      | Nothing learned; Discovery does not read history (roadmap DSC-07)                                    |

Hockey Night implements every step for one night (§6). October implements
Discover, Save (its own table) and Remember (My October) in its own register.

---

## 4. Architecture boundaries

### 4.1 Atlas

**Established.** Atlas owns what is true about the world: places,
organisations, activities, events, media, the relationships between them and
the evidence behind every claim (`docs/old-might-be-garbage/passport-vision.md`
"Relationship to Atlas"; `docs/PROJECT-CONTINUITY.md` §2). Passport computes
no geographic, environmental or categorical truth of its own; where Atlas does
not know, Passport says nothing (continuity §5, decisions 1–4). Atlas does not
perform recommendation logic. Atlas never learns who is in a group: _"Passport
sends Atlas a situation, never a person"_ (`src/experience-lab/README.md`,
"Atlas contracts").

**What Passport needs from Atlas and does not have** (Established as
standing lists): age and child suitability (zero evidence), coordinates for
the 370 candidates with a town and no point, duration, price, conditions
(snowfall, lift status, sunset), candidate options for a group prompt,
contextual "what is open now, near here, for six people"
(`docs/product/atlas-requirements-from-discovery.md`; experience lab README
"Atlas contracts"; `docs/product/vancouver/verification/evidence/atlas-audit-2026-10-24.md`).

**Open.** The return path. What Passport learns about a day (duration was
wrong, place was closed, "this entity sucks") should flow back to Atlas under
provenance rules (§2.10, §15.11, §15.15). No contract exists.

### 4.2 Passport

**Established.** Passport reasons about the person in front of it: intent,
constraints, companions, mood, history, and turns Atlas's canonical words into
the person's own (doctrine §17; `passport-vision.md` "Human language vs
canonical reality"). It owns presentation, the loop (§2), the saved and lived
state, the planning engine, the paper, the memories, and all group data.

**Implemented boundary, by module** (`src/domain/`, `src/lib/`): `discovery`
(compose, activities, situation), `day` (brief, build, timeline, intent),
`lib/ai/ask` (the sentence reader; a model may fill closed sets only, never
name a place), `lib/adventures` (ADR 009/010/012 core), `lib/analog` and
`lib/detox` (paper and Go Offline), `lib/routing` and
`docs/architecture/travel-times.md` (Atlas routed legs), `environment`
(Environment Canada forecast), `collections` (ADR 008 curated places beside
Atlas).

### 4.3 Shared experience infrastructure

**Established.** ADR 009 (2026-10-12): _"One Passport-owned core,
`passport_adventures`. Every group thing uses it: membership, invitations,
removal, a shared plan of Atlas references, and answers. Kind-specific facts
go in typed extension tables keyed by the adventure id; the core never knows
what a game or a flight is."_ Owner briefs M464 and M465 restate it for
Christmas and Snow: _"Do not duplicate existing systems for: Invitations,
Voting, Challenges, Memories, Recaps."_ The Experience Lab found the
primitives (`src/experience-lab/README.md`, "Candidate primitives"):
`Prompt` (a question put to the group; four switches separate a decision from
a competition), `Phase` (declared by the experience, not an enum), `Moment`
(the feed and the memory are one list), derived standings, authored award
labels, `Voice` split into `observe()` (derived, domain-blind) and `phrase()`
(tone table; _"the seam a language model would eventually sit in — replacing
`phrase()`, never `observe()`"_).

**Implemented.** The core exists (`supabase/migrations/20261021000000_passport_adventures.sql`,
8 tables; `src/lib/adventures/`) and is consumed by Adventures, Saved and
`/go` only. It has **no** chat, announcements, photos, challenges, standings
or phases. Everything social that works today is inside Hockey
(`passport_occasion_*`, about 24 tables, SQL under `docs/product/hockey/`)
or Conference (`passport_conference_*`, 11 Together tables). Conference
reused Hockey **code** (photo schema, `shrinkPhoto`, directions, nearby
image, poll hook) by importing from `@/domain/hockey/*`
(`src/domain/conference-memories/memories.ts:2`,
`src/domain/conference-explore/explore.ts:10`,
`src/components/conference-together/Directions.tsx:9`), which is the right
instinct in the wrong place. The lab's generic `core/` (engine, scoring,
lineage, share) is on `main` and is what Hockey's voting and standings run on.

**Proposed shape of the shared layer** (what the evidence says it should
contain, not a design): membership and invitations (ADR 009 core, already
built); a `Phase` timeline declared by the experience; `Prompt` with its four
switches (vote, sealed pick, private, open to suggestions); `Moment` feed =
memory, with photos; **announcements** (M466 #1: important update, venue
change, time change, acknowledgement, visible until dismissed); **chat with
reply** (M466 #2); standings and authored awards; recap and lineage ("run it
back"); location sharing under one consent model (ADR 011 vs Hockey's GPS
hints are two models today); the `observe()`/`phrase()` voice seam. Each of
these exists somewhere on `main` in a Hockey- or Conference-shaped form.

### 4.4 Individual experiences

**Established.** An Experience may share capability without sharing UI
(doctrine §10, "Shared capability is not shared UI"). It keeps its own
register, shell, theme, music, authored content, kind-specific facts in a
typed extension, and its own primary loop (October's _here is October → also
tonight → while it lasts_ vs Skiing's _where should I ski today → conditions →
drive → mountain → live day → adapt_, §10). What is inherently an
Experience's: NHL data, team allegiance and the chirp library (Hockey); the
Fear Dial and Fear Profile (October bible §19, _"October/horror-specific"_);
moods, traditions, giving and the advent loop (Christmas, §7); conditions
panel and "is this happening?" (Snow, §8).

**Open (§15.1).** Whether an Experience is theme + filtered corpus or a
distinct composition. Hockey's README records itself as _"evidence for (b),
not a decision"_ (`docs/product/hockey/README.md`, "Doctrine — conflicts
named, not resolved"). October's bible says "Director". Context-decides-
presentation (ADR 004) was written and never merged (§9).

---

## 5. Shared capability map

Ownership column: **S** = should be shared Passport infrastructure, **E** =
inherently the Experience's, **G** = generic Passport product. "Intended"
cites the source; "Implemented" cites the code on `main`.

| Capability               | Intended behaviour (source)                                                                                                                    | Implemented today                                                                                                                                             | Missing                                                                                                                     | Own       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------- |
| Discovery                | Possibilities, not search results; sentence first; constraints progressive; time/place/weather core (§2.1, §4, §7, §8, §12; ADR 005–007)       | `/discovery`: sentence box, URL conversation, Refine, nine shelves, editorial sections, one question max two (`src/lib/ai/ask/`, `src/domain/discovery/`)     | Budget beyond free, accessibility, equipment, energy, meals; location derived without a tap; history-aware ranking (DSC-07) | G         |
| Reactions                | Several distinct signals; never one boolean (§2.2, §2.4)                                                                                       | One **Save**. Lab-only reject/shelf log (`src/domain/discovery/interactions.ts`, not on the live page)                                                        | All of it; blocked on §15.3 vocabulary                                                                                      | G         |
| Saved                    | Where planning starts; not a bookmark (§2.6, §9; ADR 010; M366)                                                                                | `/saved`: Create an adventure, next adventure, adventures, saved places (`src/app/saved/page.tsx`); October has its own `passport_october_things`             | Want/Plan/Lived state (§15.14); board interest and shared-day tables never migrated; two keep stores                        | G         |
| Adventures (organise)    | Never blank; sketched from real places; shaped in words; shareable; printable; do it again (ADR 010, 012)                                      | `/adventures/*`, `src/lib/adventures/`, 14 API routes; `origin` column (`20261023100000`) **not applied in prod**                                             | Weeks/Months units (M366); where memories live (D-9); chat on an adventure                                                  | G/S       |
| Day Builder              | Schedule with human control; words leave the rest alone (§2.5)                                                                                 | `/go`: `DayBrief` with ~20 fields, Keep/Swap/Move/Remove, words + Undo, rain plan, clock "about", routed legs (`src/domain/day/`, `src/components/go/`)       | Drag; voice; model read (`/api/go/read` never existed); Adventure Builder modules (Emi page only); `/go` in nav (D-1)       | G         |
| Commit                   | Intention differs from a save (§2.6)                                                                                                           | An adventure is the intention (ADR 010); "Keep this day" device-only                                                                                          | A commitment state; group commitment (§15.12)                                                                               | G/S       |
| Live mode (START)        | Mode change, not exit; what's next, timing, quiet (§2.7, §6, §15.10)                                                                           | Adventures "Today's adventure" panel, Done marks in localStorage (ADR 012 §5); Conference Home "Now / Up next" countdown (SUMMIT); Hockey phases              | On `/go`: nothing. No interruption model.                                                                                   | G/S       |
| Adapt                    | _"Lunch ran late. Are we still good for the museum?"_ (§2.8)                                                                                   | Nothing (grep `ran late                                                                                                                                       | adapt` in day/go/journey: none)                                                                                             | All of it | G   |
| Print / paper            | Fold it, put it in the truck; paper enough without a phone (originals §7; Emi A6)                                                              | `/go/print` (`src/lib/analog/printable.ts`), adventure guide on the Emi skeleton                                                                              | Map on paper (MAP-05); paper leads back (`RETURN_PATH` unused); pact on paper; one evidence legend (D-6)                    | G         |
| Go Offline               | Phone away; no metrics, no guilt (§6; M140 brief)                                                                                              | `/detox`, `/detox/out`, `/detox/back`; `guardrails.test.ts` (`src/lib/detox/`)                                                                                | True offline (service worker); return names stops; name (D-3)                                                               | G         |
| Moments / memories       | Photos, notes, what actually happened; WANTED/PLANNED/DID/LOVED kept apart (§2.9)                                                              | Hockey `passport_occasion_photos`; Conference `passport_conference_photos`; legacy `momentSchema` flow unlinked; paper prompts write-only                     | Any generic capture; any generic lived state                                                                                | S         |
| Learn / feedback         | Ask with personality; improve own and shared knowledge (§2.10)                                                                                 | Nothing                                                                                                                                                       | All of it; §15.11                                                                                                           | G/S       |
| Go Have Another          | The next day starts from what happened (originals §3)                                                                                          | `/detox/back` link carrying nothing; Adventures "Do it again" copies ideas; Hockey "Run it back" + series lineage (`src/domain/hockey/series.ts`)             | Generic return path; history into Discovery                                                                                 | G/S       |
| Invitations              | One core (ADR 009)                                                                                                                             | **Four**: boards, hockey occasions, conferences, adventures; three token policies                                                                             | Per-person invites; guest → account claim; co-owners                                                                        | S         |
| Groups / membership      | One core (ADR 009)                                                                                                                             | Four membership tables, four role-function sets; Fairview 3 uses none (anonymous UUID)                                                                        | Migration of Hockey and Conference onto the core ("isn't written yet", `group-adventures/RELEASE.md`)                       | S         |
| Shared planning          | Group decides; options start an argument (lab README "Atlas contracts")                                                                        | Adventures items/days; Conference plans with RSVP; Hockey game plan + pregame vote; Boards proposed shared days (no table)                                    | One model; "pick one before either migrates" (`group-adventures/README.md` §4)                                              | S         |
| Voting / decisions       | `Prompt` with four switches (lab)                                                                                                              | Lab engine (Hockey); Conference `_plan_votes`; Adventures in/maybe/out; Fairview Redis votes                                                                  | One primitive outside Hockey                                                                                                | S         |
| Chat                     | "Existing chat worked well. Preserve it. Add reply." (M466 #2)                                                                                 | Hockey `_moments` + reactions + Chirp Bot; Conference `_messages` + reactions (copied shape)                                                                  | Reply-to; shared implementation; realtime (polling everywhere)                                                              | S         |
| Announcements            | Important update / venue / meeting / time change, acknowledge, stays visible (M466 #1); "rare and actually important" (Conference VISION §5.6) | **None.** Nearest: Conference organiser `welcome`/`aside`; Hockey `_summons`, `_cues`                                                                         | All of it. M466 says do not build Hockey-only if a shared one is appropriate; no shared one exists                          | S         |
| Challenges / predictions | Picks lock at puck drop; deterministic, verifiable; never fabricate (M466 #5, #6; lab `reveal: onLock`)                                        | Hockey sealed picks, bets, jury, Cup (`src/domain/hockey/{challenges,sealed,cup}.ts`); Conference Bingo device-only                                           | Live in-game predictions; prediction orientation bug (M466 #5); generic challenge bank                                      | S/E       |
| Competition / standings  | Derived, never written; authored award labels; no points for their own sake (lab; October "NO POINTS"; `archive/04`)                           | Lab `core/scoring.ts`; Hockey Cup persists titles not points (`ORIGINAL-VISION.md` §4), later challenge points added (`MAYHEM.md` §11)                        | A decision on §14 "elaborate social games" (named in eight Hockey docs)                                                     | S         |
| Recap                    | "The one thing that leaves the night"; feed = memory                                                                                           | Hockey `recap.ts` + `RecapShare`; Adventures guide "Afterwards"; Conference "That's a wrap"                                                                   | One recap primitive                                                                                                         | S         |
| Sharing                  | Plain text survives Slack and a screenshot (lab)                                                                                               | `/go/print`, four join pages, `.ics`, `RecapShare`, `ShareBoard`                                                                                              | Consistent "what a link reveals" rule                                                                                       | S         |
| Location                 | Situational, stored nowhere (ADR 002); opt-in, time-boxed for one case (ADR 011)                                                               | Conference `_locations` (ADR 011); Hockey `_gps_hints` + check-ins (CREW, owner brief), after an approval that said "No live GPS" (`RELEASE-HOCKEY-ARENA.md`) | One consent model; §15.8                                                                                                    | S         |
| AI voice                 | Embedded, not a tab; observe derived, phrase worded (§3; lab "Voice")                                                                          | Hockey Chirp Bot (`chirp.ts`, 1,309 lines, storylines, `inventsFacts` filter); never run with the production key; Discovery model fills closed sets only      | Shared `observe()`/`phrase()` seam; verified real-model run                                                                 | S/E       |
| Experience theming       | Context decides presentation (ADR 004, 2026-10-16)                                                                                             | Only on `feature/experience-theme-isolation` `17ae892`; `decisions/` has no 004                                                                               | Merge or retire; the decision is unrecorded on `main`                                                                       | S         |
| Reachability             | Experiences menu on the bar (§10, 2026-10-15)                                                                                                  | `PassportNav.tsx`: Conference, Hockey Night, October                                                                                                          | Christmas, Snow entries (when they exist); `src/app/labs/experiments.ts` still says Hockey shared "not in this build"       | G         |

---

## 6. Hockey lessons

### 6.1 What happened

**Established (owner brief M466, `~/Drop/running/lodge-mission-466.md`,
2026-11-01).** A real group used Hockey Night at Canucks vs Wild on
2026-10-25 and rated it 6/10. They enjoyed group planning, restaurant voting,
chat, predictions, AI chirps, arena information, food discovery, competition
and coordination. The restaurant was too busy and the group moved from Shark
Club to Boston Pizza; the change got lost in chat. The night was created too
close to game day. The funniest moment was an AI question about how many
times Quinn Hughes would be booed. Score predictions were read in the wrong
team orientation.

**Finding.** None of this is recorded in the repository. `MAYHEM.md` §12 says
_"nobody has played it with real friends — that is the real test"_; the
release audit says signed-in paths were never exercised. The owner's brief is
the first and only written record of real use. It should be copied into
`docs/product/hockey/` verbatim as the first field report, because briefs
leave the Drop folder and the repository is the only thing that survives.

### 6.2 What the lab predicted, and what the build drifted toward

**Established.** The Experience Lab's finding: _"The escalation is almost
entirely made of questions the group answers about each other, not
information about the event. Nothing Passport could tell you about Rogers
Arena moves that needle. 'Nathan is the only person predicting a shutout'
does."_ (`src/experience-lab/README.md`, "Why this exists"). And: _"The single
most valuable affordance found in the lab is letting a person invent a
question."_

**Implemented.** Between 2026-10-16 and 2026-10-24 the build added seats,
gates, concourse maps, arena menus, GPS hints, summons and snack runs
(`SEATS-AND-ARENA.md`, `ARENA-MODE.md`, `CREW.md`), and re-laid out Plan four
times in three days (Release 1 → 2 → Recovery → Alive → Plan-Pregame).
`ORIGINAL-VISION.md` §5 lists lab ideas lost in adaptation. The owner's M438
brief said it plainly: _"We have built an impressive amount of Hockey Night
infrastructure. And somehow, PLAY still sucks."_

**The real-world result agrees with the lab.** What the group enjoyed is the
list of questions-about-each-other (voting, predictions, chirps, competition)
plus coordination. What failed was logistics communication (the venue change)
and timing (too little pregame). The arena information was liked, which the
lab did not predict; so the finding is "people first, venue second", not
"venue never".

### 6.3 What generalises to Passport

| Feedback (M466)                                | Generalises as                                                                                                                                                                                                                                        | Where it belongs                  |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Host announcements, visible until acknowledged | A shared **announcement** primitive on the group core: kind (update / venue / meeting point / time), optional ack, priority. Every group Experience needs it; Conference named it first ("rare, and actually important", VISION §5.6).                | Shared                            |
| Chat replies                                   | A shared chat with reply-to. Two chats exist with the same shape; build one.                                                                                                                                                                          | Shared                            |
| Longer pregame, progressive engagement         | The lab's `Phase` model already carries this (declared phases, `headline` per phase). The 7/5/3/1-day ladder is Hockey's phase list; Christmas (advent) and Snow ("is this happening?") have their own. _"Do not force daily engagement"_ matches §6. | Shared model, per-Experience data |
| Context-aware AI chirps                        | The lab's `observe()`/`phrase()` seam: derived observations about the group, a model only for wording, `inventsFacts` filtered. Hockey proves it; the seam should move out of `domain/hockey`.                                                        | Shared seam, Experience content   |
| Prediction orientation bug                     | Doctrine §5 at the data level: _"a prediction must mean the same thing everywhere."_ A sealed pick is confirmed state and must be stored in one canonical orientation with a regression test. Generic lesson for any scored prompt.                   | Shared                            |
| Live predictions, lock at the right time       | `Prompt.reveal: onLock` plus a clock. Snow's "run of the day" and Christmas's "who finds the brass band" are the same shape.                                                                                                                          | Shared                            |
| Lightweight fantasy                            | Hockey-specific (needs NHL player data). The owner's own rule applies: only if verified data exists.                                                                                                                                                  | Experience                        |
| Food run                                       | A coordination prompt ("I'm going; what do you want?") is a `Prompt` with `openToSuggestions`. Works at a ski lodge and a Christmas market.                                                                                                           | Shared                            |
| Accurate scoring, never fabricate              | Derived standings, host "Call it", NHL numbers as truth. The principle generalises; the data source is the Experience's.                                                                                                                              | Shared rule                       |
| Public, repeatable, not hardcoded              | The ADR 009 core with a `template`/kind, plus "run it back" lineage. `night.ts` hard-codes `sycle-hockey-night` and Rogers coordinates; `schedule.ts` is home games only; `HOME_ABBREV="VAN"`. Untangling these is the public-beta work.              | Shared core, Experience data      |

### 6.4 What should remain Hockey-specific

NHL schedule and live scores (`nhl.ts`), 32-team allegiance (`fans.ts`,
`teams.ts`), the chirp library (788 lines of NHL content), `pair` partial
credit scoring, arena bowl/concourse/menu data (which `ARENA-MODE.md` §6
proposes moving to Atlas), rowdy tone, award names. The lab's rule holds:
_"Nothing in `core/` names a sport, a season, a mood or a venue."_

### 6.5 What Christmas and Snow should learn, and not copy

- **Learn:** the night is made of questions about each other; the feed is the
  memory; "run it back" is where tradition comes from; a host's announcement
  must not be a chat line; start the experience a week out, not a day out;
  photos are the thing people keep.
- **Do not copy:** the toy box density (eight Hockey docs name the §14
  conflict); the four-relayout churn; the 24 private tables; GPS hints
  (Christmas has children; Snow has no cell service); forfeits (Powder Day:
  _"a forfeit needs a losing side, and a powder day has no opposing team"_;
  Light-Up: _"No dare, no consequence, no vault"_).

---

## 7. Christmas requirements

### 7.1 What is established

- **Owner direction (M464, M465, M467):** _"Go Have A Christmas"_, route
  `/christmas`; _"A complete Christmas discovery and group experience.
  Christmas markets, activities, adventures, challenges, shared planning,
  excitement and memories."_ _"Not merely Christmas event listings."_ Learn
  from Hockey Night and October; do not duplicate invitations, voting,
  challenges, memories, recaps.
- **Doctrine:** names Christmas as one of four Experiences (§10) and says
  nothing else. §15.1 open.
- **Atlas:** M118 brief (2026-10-11): _"Skiing and Christmas must be ready
  before their seasons"_, with research lists (markets, light displays, Santa
  visits, holiday trains). Whether that acquisition ran is outside this repo.

### 7.2 The original emotional vision (prototype, quotable)

All from `src/app/about/experiment-05-christmas/` (Labs, invented content,
`noindex`) and `src/app/about/idea-atlas/content.ts`. **Not authority**, but
the fullest statement of what Christmas was meant to feel like:

- _"This is not a Christmas website. Not shopping. Not Black Friday.
  Passport's emotional interpretation of the season."_
- _"Not personalities. Moods."_ Ten moods, each a four-slot day: Cozy,
  Romantic, Family, Magic, Adventure, Giving, Coffee & Book, Music, Dog,
  Movie Marathon.
- _"Passport remembers traditions."_ (_"You always make Nana's cookies."_)
  with the honest disclosure _"Passport has no real memory of you yet."_
- _"Christmas isn't only receiving."_ `GIVING_LINE`: _"Small acts matter.
  Passport should celebrate kindness as much as it celebrates a good day
  out."_ Giving chips: volunteer, toy drive, food bank, buy local, phone
  someone lonely, deliver cookies.
- _"Weather becomes magic."_ (_"Fog tonight — Christmas feels a little more
  magical when you can't see everything."_)
- A countdown as _"A Passport signature."_ The idea wall's **Advent
  Calendar**: _"A daily December return loop, December 1–24 … This gives
  people a reason to return every day"_ and _"Not manipulative streaks. They
  create anticipation and ideas."_
- Seventeen challenges (_"Find the biggest Christmas tree"_ … _"Perform one
  anonymous act of kindness"_), sound design (_"Optional. Soft. Warm. Nothing
  harsh — this should feel like home."_), movies as moods.
- _"The same Atlas. An entirely different emotional world."_ and
  _"Because Christmas is never just one day."_

The group Christmas is the lab fixture `christmasLightUp.ts`: nine people,
one evening, _"four things you cannot miss"_ (choir 5:20, the switch 6:00,
doughnut cart, fireworks); children-safe prompts (find, photograph, remember;
no dares, no sealed vaults); Gran's "don't miss" list; `runItBack: "Next
year"`. The lab recorded that many anchors inside one evening **strained** the
phase model (README, "Christmas Light-Up"; open question 2).

### 7.3 How Christmas should implement the Passport vision

**Proposed**, drawn only from the sources above and the journey in §3:

| Journey step    | Christmas composition                                                                                                                                                                                                                                | Reuses                                                             | Christmas-only                                          |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------- |
| Discover        | Discovery in a Christmas register: markets, light-ups, skating, choirs, tree farms, trains, as sentences and shelves. A **Christmas shelf** on the activity explorer is the smallest real seam (ADR 007 shelves are Passport's; membership Atlas's). | `/discovery` reader, shelves, editorial sections, Atlas candidates | Mood starters ("Cozy", "Giving", "Magic") as sentences  |
| Save            | Same Saved. A Christmas "want to do" is a saved place with a season.                                                                                                                                                                                 | `/saved`, ADR 010                                                  | —                                                       |
| Plan            | A Christmas adventure (`kind: "christmas"` on the ADR 009 core): a day, a weekend, or the whole season ("Christmas is never just one day"). Sketched from real places like any adventure.                                                            | Adventures, Day Builder engine                                     | Traditions as recurring ideas; giving as a planned stop |
| Share           | Invite the family; the Light-Up night is a group adventure with phases.                                                                                                                                                                              | ADR 009 invites; shared phases, prompts, announcements (§4.3)      | Children-safe prompt bank                               |
| Experience      | The Light-Up evening: "don't miss" anchors as phases, find-and-photograph challenges, host announcement ("the choir moved to 5:40"), quiet during the switch.                                                                                        | Phase, Prompt, chat, announcements, photos                         | Warm tone, music motif                                  |
| Remember        | Photos into the shared memory; the recap; _"Passport remembers traditions"_ as lineage, honestly labelled until it is real.                                                                                                                          | Moment feed, recap, lineage                                        | Tradition record                                        |
| Go Have Another | _"Next year"_ run-it-back; the advent loop as the December return path (one small idea a day, from Atlas, never a streak).                                                                                                                           | Lineage; `/detox`-style no-metrics guardrail                       | Advent calendar                                         |

**Hard requirements from the sources** (Established or Stated): not shopping;
no streaks or guilt (§6; idea wall "Not manipulative streaks"); children in
the room means no dares, no sealed contests a seven-year-old cannot see; every
place is an Atlas subject; giving is a first-class outcome, not a footer.

**Open before building:** whether a season-long adventure is a new adventure
kind or a new object (ADR 010 says day / weekend / trip); where Christmas's
memories live (D-9); whether the advent loop conflicts with §6 (a daily
return is engagement by design; the idea wall argues it is anticipation, not
a streak); the §14 fence on "elaborate social games" as applied to a family
scavenger hunt.

---

## 8. Snow requirements

### 8.1 What is established

- **Owner direction (M464, M465, M467):** _"Go Have A Snow Day"_, route
  `/snow`; _"Skiing, snowboarding and winter adventures. Group planning,
  competitions, challenges, hype, memories and recaps."_ _"Learn from Hockey
  Night's social experience."_ M467: _"Skiing and snowboarding are core
  activities, but the product should not be limited to them unless existing
  doctrine explicitly requires it."_
- **Doctrine §10:** calls the Experience **"Skiing"** and makes it _"the
  deliberate stress case"_ with its own primary loop: _"Where should I ski
  today? → conditions → drive → mountain → lifts/runs → live day → adapt."_
  §6: _"Skiing: 'Last run challenge. Who gets down fastest?'"_ §13 fences
  _"high-energy skiing media personalised to the person"_ as Inspiration.
- **Does the doctrine require skiing-only?** No. It names Skiing as the
  example and the stress case; it does not forbid snowshoeing, skating or
  sledding, all of which are already activities on the Winter shelf
  (`src/domain/discovery/activities.ts`). **Finding:** "Snow" is broader than
  the doctrine's "Skiing", and the doctrine should say which word is the
  product's (Open; a one-line doctrine edit).

### 8.2 The original vision (prototype, quotable)

- **Powder Day fixture** (`src/experience-lab/fixtures/powderDay.ts`): _"A
  powder day begins when the snow says so, so the anchor is 'first chair' and
  the interesting phase is the one before it, where the only question is
  whether this is happening at all."_ Phases: Is this happening? → Dawn
  patrol → First chair (quiet: _"Go ski. Come back when your legs quit."_) →
  On the chair (_"Seven minutes up. Gloves off, be quick."_) → Lapping it
  (_"Nobody is reading this."_) → Après (_"Boots off. Settle it."_) → Monday.
  _"Conditions are content"_: a panel of facts nobody in the group wrote
  (31 cm overnight, base, temperature, wind, lift holds, _"Road: Plowed,
  winter tires required"_), _"the shape Atlas will eventually fill."_
  Competitions: first run called now, runs before somebody quits, who eats it
  first ("The yard sale"), run of the day **by vote**. _"There is no
  consequence bank here: a forfeit needs a losing side."_ Awards: Called It,
  Last Chair, Went First. `runItBack: "Next storm"`.
- **Idea wall "Snow Passport"** (`idea-atlas/content.ts`): _"First-snow
  chasers and ski-season regulars"_; emotion _"Bright, crisp excitement"_;
  soundtrack _"Sparse, cold, a distant chairlift"_; core memory _"The first
  run of the season"_; interaction _"First-snow countdown, condition-aware
  suggestions"_; future ideas _"Real snow-report integration"_, _"A 'first
  snow of the year' celebratory moment."_
- **Atlas side:** `docs/product/knowledge-acquisition.md` queues Big White as
  an acquisition case (_"The core winter product · Winter beyond skiing ·
  Conditions and forecast"_). M118 names SilverStar, Big White, Apex, Sun
  Peaks.

### 8.3 How Snow should implement the Passport vision

**Proposed**, from the sources above:

| Journey step    | Snow composition                                                                                                                                                                                          | Reuses                                                        | Snow-only                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------- |
| Discover        | _"Where should I go today?"_ answered from conditions first: which hill, how much snow, what is open, how far, road state. The Winter shelf already lists the activities; the missing half is conditions. | Discovery reader, Winter shelf, Atlas candidates, routed legs | Conditions panel; first-snow countdown        |
| Save            | Hills and runs as saved places; "someday" (heli-skiing is the doctrine's own _fuck yes but not today_ example, §2.2).                                                                                     | `/saved`                                                      | —                                             |
| Plan            | A snow day is an adventure (`kind: "snow-day"`): meeting point, dawn patrol, who is in. The doctrine's loop puts drive and mountain before lifts; a plan here is light.                                   | Adventures core, Day Builder for the drive and après          | "Is this happening?" phase                    |
| Share           | Crew invites; _"Are you in?"_ as the first prompt.                                                                                                                                                        | ADR 009 invites, Prompt                                       | —                                             |
| Experience      | Quiet by design: bursts on the chair, silence while lapping (doctrine §6 and §15.10 exactly). Last-run challenge. Food-run at the lodge. Host announcement when the road closes or the group moves hills. | Phase, Prompt, chat, announcements, voice seam                | Conditions, lift status, safety facts (Atlas) |
| Remember        | Run of the day by vote; photos; _"The yard sale"_; recap.                                                                                                                                                 | Moment feed, standings, recap                                 | Award names                                   |
| Go Have Another | _"Next storm"_ lineage; the first-run-of-the-season memory year over year.                                                                                                                                | Lineage                                                       | Season opener moment                          |

**Hard requirements from the sources:** conditions must be Atlas evidence,
never Passport's guess (ADR-level principle, continuity §5); no phone during
the run (§6); no cell service is the normal case, so the paper and the kept
day matter more here than anywhere (Go Offline); safety facts (avalanche,
road, tires) are the Emi rule: _"A legal statement and a suggested activity
must not look alike. One of them can end a trip badly."_
(`fishing-with-emi.md` §4).

**Open before building:** Skiing vs Snow in the doctrine; whether Snow's
primary loop (conditions-first) is Discovery in a register or a different
front door (§15.1 at its sharpest); the Atlas conditions contract (none
exists); music and "hype" against §6 (the fixture has no music and says
_"Nobody is reading this"_ while skiing).

---

## 9. Product inconsistencies

Grouped as the mission asks. Each is **named, not resolved**.

### 9.1 Contradictory documents

1. **Four canonical journeys** (§3.1). Same loop, different words, no
   cross-reference.
2. **Authority order is inverted between the doctrine and the owner.**
   Doctrine §17: history is evidence; _"Where they conflict with this
   document, this document wins."_ Owner brief M376: _"1. Original vision and
   brand principles 2. Explicit subsequent operator decisions 3. Verified
   product specifications and ADRs 4. Implementation documentation 5. Agent
   proposals."_ Both cannot be true. The practical difference is small (the
   doctrine claims to be distilled from the originals) but an agent must know
   which wins when they differ.
3. **The originals the owner ranks first are not on this machine.**
   `future-passport-experience.md`, `brand-principles.md`, the Fishing With
   Emi PDF and page, and anything called a "Passport Manifesto" have zero hits
   under `/home/lorne-markham` (M376 report; re-verified this mission). The
   doctrine §17 cites two of them as Mac-only and untracked. Until they are
   committed into `docs/history/originals/`, every "original" in the repo is
   an agent reconstruction and says so.
4. **Experience architecture answered three ways** (§4.4): Director (October
   bible), personalities (idea wall), moods (Christmas sandbox). §15.1 stays
   open; none of the three is marked as the answer.
5. **Register.** Doctrine §16 wants irreverent; Conference docs choose calmer
   (_"a human should say whether"_, `EXECUTIVE.md` §12). Christmas wants
   _"soft, warm, nothing harsh"_. Register is per-Experience by §10, but the
   doctrine does not say so.

### 9.2 Missing decisions

6. **Reaction vocabulary** (§15.3) and **Want / Plan / Lived** (§15.14).
   Blocks reactions, lived state, the return path, and DSC-06/07.
7. **Commitment state** for a plan and for a group (§2.6, §15.12). Every
   group doc declares its answer vocabulary provisional.
8. **The §14 fence on "elaborate social games"** against Hockey's toy box,
   Cup and Chirp. Named in at least eight Hockey docs; `MAYHEM.md` §11: _"If
   this stays, §14's wording should say so."_ Christmas challenges and Snow
   competitions wait on the same answer.
9. **Hockey, Conference onto the ADR 009 core, or not.** `RELEASE-2026-10-23.md`
   §2 defers it to the owner; the migration _"isn't written yet"_.
10. **Where memories live** (adventures D-9; Conference retention
    "not decided"; Hockey photos in DB not bucket).
11. **`/go` in the nav** (D-1), **Digital Detox vs Go offline** (D-3), **clock
    times** (D-8 built narrowly, _"a person should confirm"_), **"Moment"
    means three things** (D-4).
12. **Location.** ADR 002 (store none) → ADR 011 (Conference opt-in) →
    Hockey Crew GPS hints on an owner brief, after a 2026-10-22 approval that
    said _"No live GPS"_. Three positions in nine days; §15.8 open.
13. **Skiing vs Snow** as the product's word (§8.1).
14. **The twelve archive principles** (§2.3): still intent, or retired?

### 9.3 Outdated specifications

15. `docs/PROJECT-CONTINUITY.md`: _"904 lines"_, _"two ADRs"_, prod domain
    `www.iamoctober.com`. Now 1,068 lines, twelve ADRs, gohaveaday.com.
16. `src/app/labs/experiments.ts` (`hockey-shared`): _"not in this build"_.
    Hockey shared is on `main` and in the Experiences menu (noted by M374 and
    the recovery audit; still there).
17. `docs/product/october-experience-bible.md` §0: the Experience Lab is
    _"Not on main; never merged."_ It is on `main`.
18. `docs/architecture/passport-core.md`: _"User-generated media: Not
    built."_ Two photo tables exist.
19. `docs/product/hockey/PRODUCTION-READINESS.md` §5.1: OpenAI _"not used by
    Hockey"_. Chirp Bot uses it (M463).
20. `~/passport/lanes/hockey/CLAUDE.local.md`: _"no route or domain code
    exists yet"_. 89 commits later.
21. `docs/product/GO-HAVE-A-DAY-ROADMAP.md` status column frozen at
    2026-10-11; `docs/history/concepts.md` says Digital Detox is missing
    (`/detox` now exists); `docs/domain/integration-contracts.md` cites
    `shared-adventures.md` as missing (it exists).
22. `docs/product/hockey/README.md` "Hockey Night · shared" and
    `docs/product/labs.md` "not merged" rows.

### 9.4 Implementations that violate product intent

23. **Four membership systems** against ADR 009's one. The ADR itself
    predicted it (_"Until Hockey and Conference migrate, Passport has more
    group tables, not fewer"_); the prediction is now the architecture.
24. **Hockey migrations outside `supabase/migrations/`.** The shared-contract
    rule (lane briefs) was honoured by the lane and never completed by
    integration; production runs SQL that the repository's migration
    directory does not contain.
25. **Save as a single boolean** (`61a2853`) against §2.2's _"Do not collapse
    desire and present feasibility into one boolean."_ Recorded as a decision
    in `PROJECT-CONTINUITY.md` §5; never reconciled with §2.2.
26. **October's own saved table** (`passport_october_things`) beside the
    generic board, against §9's one loop. Neither doc names it.
27. **Hockey's venue-and-logistics drift** against the lab's finding and the
    owner's M438 (_"We're not building a hockey questionnaire"_). Partially
    corrected by `RECOVERY.md`; the real-world 6/10 is the measure.
28. **Conference importing `@/domain/hockey/*`** (four files): shared
    capability living in an Experience's folder.
29. **ADR 004 absent from `main`.** A product decision dated 2026-10-16
    (context decides presentation) exists only on an unmerged branch;
    `decisions/` jumps 003 → 005. Either merge it or record its retirement.

### 9.5 Unresolved architectural questions

30. §15.1 Experience architecture. 31. The Atlas return path and conditions
    contracts (§4.1). 32. Realtime (polling everywhere; `passport_events` limited
    to `'board'`). 33. Guests without accounts (every join page requires
    sign-in; the lab's "just looking" state was never built). 34. How discovery
    hands off to a group experience (lab open question 3: _"Choosing 'Kalamalka
    lookout' does not actually make it the experience"_). 35. One or several
    "plan" models (adventures items, conference plans, hockey game plan, board
    shared days).

---

## 10. Recommended agent context system

### 10.1 What exists today

**Finding** (verified this mission; details in the agent-context research):

| Mechanism                                | Loads automatically?   | Carries doctrine?                                                                    | Enforced?                                                                                |
| ---------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `CLAUDE.md` (repo, versioned)            | Yes                    | An instruction to read it, and the list of when                                      | No                                                                                       |
| `CLAUDE.local.md` (per lane, untracked)  | Yes                    | "still apply in full"; owner's mission line; reuse rule                              | No. Hand-written by Lodge missions; **no template file exists**; the Hockey one is stale |
| `README.md`, `PROJECT-CONTINUITY.md`     | No                     | Yes                                                                                  | No                                                                                       |
| Forge mission-context hook               | Not for Passport       | An index with headlines, not the text                                                | Not wired into `lodge-dispatch` (Forge `CONTEXT-CONTINUITY.md` follow-ups)               |
| M366 canon draft + `MISSION-PREAMBLE.md` | No                     | Seven duties, required report headings                                               | Never committed, never pasted (`~/forge-dev/.wt/passport-canon/docs/passport-canon/`)    |
| Claude auto-memory                       | `passport/main` only   | Operational traps, not doctrine                                                      | —                                                                                        |
| Skills / agents                          | None Passport-specific | —                                                                                    | —                                                                                        |
| Tests                                    | Yes (CI gates)         | Three guard specific clauses (Labs coverage, archive, nav advertises nothing fenced) | Only those clauses                                                                       |

**The pattern.** Three missions (M366, M370, M375) each designed enforcement
and stopped before wiring it. Forge's own audit: _"What is loaded at mission
start? The brief, the workspace's `CLAUDE.md` (if it has one) and Claude
memory for that exact directory. Nothing else."_ Meanwhile the owner's newest
product decisions (Hockey feedback, Christmas and Snow definitions, the
authority order) exist only in briefs that the repository never sees.

### 10.2 Evaluation of the options the mission names

| Option                                      | Reach                                 | Cost                                         | Reliability                                                                                                          | Verdict                                                   |
| ------------------------------------------- | ------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `CLAUDE.md`                                 | Every agent in every checkout, always | Nil                                          | High for _presence_; zero for _compliance_. Already says "read in full"; a 1,068-line read is skipped under pressure | **Carrier.** Add a short contract block; keep the pointer |
| `CLAUDE.local.md`                           | Every lane agent                      | Low once templated                           | Today: stale and inconsistent because hand-written                                                                   | **Generate from a template** that embeds the same block   |
| Repository docs                             | Only when opened                      | Already exist                                | Low on their own; necessary as the source of truth                                                                   | Keep; add one index line; stop adding parallel canons     |
| Agent skills                                | Only when invoked or auto-triggered   | Medium; not version-controlled with the repo | A skill is advice; the mission forbids creating one here                                                             | Not now                                                   |
| Forge mission templates                     | Every dispatched mission              | Medium (Forge/Lodge change)                  | Would be reliable if wired; three attempts stalled                                                                   | Second step, after the repo-side block exists             |
| Shared product context (hook-injected pack) | Every mission                         | Medium                                       | Injects an index, not the doctrine; not active for Passport                                                          | Not sufficient alone                                      |
| A repository test                           | Every commit through the gates        | Low (one vitest file)                        | High: the only mechanism that cannot be skipped                                                                      | **Add one**                                               |

### 10.3 Recommendation: the smallest reliable mechanism

**Proposed.** Three pieces, in this order, none of them a new document:

1. **A product contract block in `CLAUDE.md`** (about twenty lines, directly
   under "Read the product doctrine first"). Contents: the seven-word journey
   with the §2 stages in brackets; the five never-compromise lines (§1 of
   this report); the rule _"name the journey step you are advancing, check
   what exists before building, preserve decisions, leave §15 open, report
   deviations under their own heading, never claim product acceptance from
   green gates"_ (the M366 preamble's seven duties, compressed); and a pointer
   to this report for the capability map. Because `CLAUDE.md` is loaded in
   every checkout, this is the one place that reaches every agent with no
   infrastructure change.
2. **A lane-brief template** (`docs/engineering/LANE-BRIEF-TEMPLATE.md`,
   versioned) that Lodge copies to `CLAUDE.local.md` with the lane-specific
   lines filled in, so every lane carries the same contract and the mission
   line cannot rot silently. The Hockey lane's "no route exists yet" is the
   cost of not having this.
3. **One repository test**, modelled on the existing Labs-coverage test: for
   every `src/app/<experience>/` route group that is reachable from the
   Experiences menu, a `docs/product/<experience>/JOURNEY.md` must exist and
   name which steps of the journey it implements. Cheap, runs in the existing
   `npx vitest run` gate, and makes "which journey is this advancing?" a
   question that fails the build when unanswered.

Then, as a second step for Lodge or Forge: paste the same contract block at
the top of every Passport mission brief (the M366 preamble, which already
exists and only needs committing), and copy each owner brief that contains a
product decision into `docs/product/decisions/` or the relevant
`docs/product/<experience>/` folder as part of the mission, so decisions stop
living only in the Drop folder.

**What this does not do.** It does not make an agent understand the product.
It makes the product's shape unavoidable, makes the lane brief truthful, and
makes the absence of a journey record a failing test. Understanding still
comes from reading the doctrine, which the block points at.

---

## 11. Prioritised next steps

**Proposed.** Ordered by "working user journeys over feature counts" and by
the calendar: today is 2026-11-01; Christmas needs to be usable by early
December and Snow by hill opening, which in the Okanagan is late November to
mid-December.

### Step 0 — Decisions only a person can make (this week)

Each unblocks a step below. None requires code.

- Adopt or reject the canonical journey pair (§3.2) and edit the doctrine once.
- Choose the authority order (§9.1 #2) and commit the Mac originals
  (`docs/history/originals/`), or declare the doctrine the distillation of record.
- Answer §14 for social games (§9.2 #8): the Cup, challenges and chirps stay,
  with §14's wording changed, or they do not.
- Decide Hockey and Conference's relationship to the ADR 009 core (§9.2 #9),
  because Christmas and Snow will be built on whatever is decided.
- Skiing or Snow (§8.1). Reaction and lived vocabulary (§9.2 #6) can wait one
  more cycle but blocks the return path.

### Step 1 — Make what is live actually work (owner, days)

From the release docs, in order: board owner-claim fix; adventure `origin`
column; Hockey `crew` and `plan` SQL or disable the features; set
`CONFERENCE_TOGETHER` or leave it dark on purpose; a two-account smoke of
Saved → adventure → share → join. All of this is in
`docs/release/AGENT-WORK-RECOVERY-AUDIT.md` Phase 0 and
`docs/release/PREFLIGHT-2026-10-26.sql`. Nothing below is honest until the
journeys that exist run in production.

### Step 2 — Hockey Night cycle (M466) as the vehicle for shared infrastructure

Build the M466 items, but build the generalisable ones as Passport modules
(§6.3) rather than more `passport_occasion_*` tables: **announcements**,
**chat with reply**, **phases** (the 7/5/3/1-day ladder as declared phase
data), the **prediction orientation** fix with its regression test, the
**food-run prompt**, and the public-beta untangling (`night.ts` template,
home-games-only, `HOME_ABBREV`). Move the four `@/domain/hockey/*` imports
Conference depends on into a shared folder in the same cycle. Record the
real-use feedback in `docs/product/hockey/` verbatim.

### Step 3 — Close the generic loop (Passport core)

The two stages every short journey drops. Smallest real seam for each:

- **Remember → Another:** let `/detox/back` and the adventure guide's
  "Afterwards" write a return record against the day's Atlas ids (what we did,
  skipped, found), and let "Now go have another" open `/go` seeded from it.
  This needs the §15.14 vocabulary decision first (DAY-07, DTX-04, DOM-05).
- **React:** replace the single Save with the smallest honest set (want /
  not today / not for me), stored apart (§2.2; DSC-06). This needs §15.3.
- Put `/go` in the nav or decide that Discovery's "Make a day of it" is the
  door (D-1), so the Day Builder stops being a side route.

### Step 4 — Christmas vertical slice (lane `passport-christmas`, by early December)

One working journey, not a theme: a **Christmas shelf and starters** on
Discovery (Atlas permitting; check M118's acquisition first), a **Christmas
adventure kind** on the core, and **one group evening** (the Light-Up) on the
shared phases, prompts, announcements and photos from Step 2, in the
Christmas register. Giving as a first-class stop. No advent calendar until
the §6 question is answered. Acceptance: a family can plan, share, live and
remember one December evening end to end.

### Step 5 — Snow vertical slice (lane `passport-snow`, by hill opening)

Depends on an Atlas **conditions contract** that does not exist; the lane
should ask for it in its first report and build the rest: a **snow-day
adventure kind**, _"Are you in?"_ and _"Where are we meeting?"_ prompts, the
quiet-on-the-hill phase model, run-of-the-day by vote, the paper for a day
with no signal. Acceptance: a crew can decide on a powder day the night
before, meet, ski without the phone, and settle it at après.

### Step 6 — Context system (with Step 2, cheap)

The three pieces in §10.3. They cost a day and prevent the next version of
this report.

### Not recommended now

Inspiration (§13), sensing (§14), cross-ELK context, a rewrite of the four
group stores into one in a single release (ADR 009's own advice is
incremental), fantasy hockey without verified data, a fifth vision document.

---

## Appendix A — Source index

Primary sources read in full for this report, in authority order as the
doctrine states it:

| Authority                           | Path                                                                                                                                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product authority                   | `docs/PASSPORT-PRODUCT-DOCTRINE.md` (1,068 lines, 41d1a6a → e922401)                                                                                                                                |
| Decisions                           | `docs/architecture/decisions/001–013` (004 absent)                                                                                                                                                  |
| Owner briefs (not in repo)          | `~/Drop/completed/lodge-mission-{136,140,366,370,372,375,376,435,438,464,465}.md`; `~/Drop/running/lodge-mission-466.md`                                                                            |
| Originals (reconstructed, labelled) | `docs/product/originals/{README,go-have-a-day,fishing-with-emi,idea-inventory}.md`; `docs/history/concepts.md`                                                                                      |
| Roadmap and continuity              | `docs/product/GO-HAVE-A-DAY-ROADMAP.md`; `docs/PROJECT-CONTINUITY.md`; `docs/release/AGENT-WORK-RECOVERY-AUDIT.md`                                                                                  |
| Discovery and Day Builder           | `docs/product/discover.md`; `docs/product/discovery-*/README.md`; `docs/product/daybuilder/REPORT.md`; `src/lib/detox/README.md`                                                                    |
| Groups and Saved                    | `docs/product/group-adventures/*`; `docs/product/adventures/EXPERIENCE.md`; `docs/product/shared-adventures.md`; `docs/products/go-have-a-conference/*`                                             |
| Hockey                              | `docs/product/hockey/*.md`; `src/experience-lab/README.md`; `src/domain/hockey/`                                                                                                                    |
| October                             | `docs/product/october-experience-bible.md`; `docs/passport/the-physics-of-passport.md`; `src/app/october/`                                                                                          |
| Christmas and Snow                  | `src/app/about/experiment-05-christmas/`; `src/experience-lab/fixtures/{christmasLightUp,powderDay}.ts`; `src/app/about/idea-atlas/content.ts`; `~/passport/lanes/{christmas,snow}/CLAUDE.local.md` |
| History                             | `archive/01–14`; `archive/prompts/00-foundation/`; `docs/old-might-be-garbage/`                                                                                                                     |
| Agent context                       | `CLAUDE.md`; `CLAUDE.local.md`; `~/forge-dev/.wt/passport-canon/docs/passport-canon/`; Forge `CONTEXT-CONTINUITY.md`                                                                                |

## Appendix B — Limits of this report

- Production was not probed (policy). Production state is quoted from the
  release documents of 2026-10-24 and 2026-10-26, which themselves say
  "re-measure before pasting".
- No lane worktree was read beyond its `CLAUDE.local.md` and `git status`;
  `feature/christmas` and `feature/snow` are at `main` with clean trees.
- The Mac-only originals were not available; nothing in them is cited.
- Line numbers from the research briefs were spot-checked, not exhaustively
  verified; citations use headings where a line number could not be confirmed.
- Five research agents produced the per-area briefs; their findings were
  cross-checked against the doctrine, the owner briefs and the code where
  this report relies on them.
