# GO HAVE A DAY — master product roadmap

> **What this is.** GO HAVE A DAY is the flagship consumer product. This
> roadmap orders the work on it into one backlog for the eight Passport
> workspaces. It records what is built and where, what is missing, what blocks
> what, and what can start today.
>
> **What this is not.** It is not product authority:
> [`docs/PASSPORT-PRODUCT-DOCTRINE.md`](../PASSPORT-PRODUCT-DOCTRINE.md) is.
> It also does not answer any open question. Every requirement that sits on a
> doctrine §15 question, or on a decision nobody has made, says so and is
> marked **Decision**, not **Ready**. Putting something on this backlog does
> not approve building it. §13 (Inspiration) and §14 (the not-now list) stay
> fenced.
>
> **Not organised around October.** No requirement here depends on October
> branding, October routes or the October domain. Where October code is the
> only existing implementation of a capability (for example the
> wanted/lived store `passport_october_things`), that is named as a fact, not
> as a direction.

**Taken:** 2026-10-11, Lodge mission 164, on `lane/vision` at `76b564e`, with
`main` and `origin/main` at `016854a`.
**Keep it current.** When a requirement moves, edit its row in the same change
that moves it. When a decision in §4 is made, record the answer there and
update the doctrine (and `docs/architecture/decisions/` if it is
architectural). Do not let this file become the fifth vision document in
`archive/`.

---

## 0. How to read a requirement

Each requirement has an id (`DAY-03`), and the workstream section it sits in
is its **assigned workspace**. Every entry has these fields:

| Field          | Meaning                                                                                 |
| -------------- | --------------------------------------------------------------------------------------- |
| **Experience** | What the person sees, does or holds. Not the implementation.                            |
| **Why**        | The doctrine section, original idea or brief it serves.                                 |
| **Accept**     | What has to be true to call it done. Written to be checked, not admired.                |
| **Status**     | One of the status words below, with the branch, commit and Lodge mission (M###) if any. |
| **Depends**    | Requirements, integration steps (`INT-n`), decisions (`D-n`) or external work.          |
| **P**          | Priority, P1–P7, from the brief (below).                                                |
| **Ready**      | Whether a mission could start on it today, and if not, what it waits for.               |

**Status words.** These are measured, not hoped:

- **On main.** In `016854a` or earlier.
- **On branch.** Committed on a lane branch, with gates reported by that lane.
  _Not on main and not deployed._ Lane gates were run without Atlas, Supabase
  or OpenAI, so "on branch" never means "verified against real Atlas".
- **In flight.** A Lodge mission is running or queued on it right now.
- **Partial.** Some of it exists. The entry says which part.
- **Proposed.** It has been described, but there is no code.
- **Absent.** There is nothing yet.

**Ready words:**

- **Ready.** A mission could start today without stepping on anyone.
- **Integrate.** The work is done. It needs merging (§3).
- **After INT-n / after XXX-nn.** It waits on that step or requirement.
- **Decision D-n.** A person has to decide something first (§4).
- **External.** It waits on Atlas, a key, or a person outside the repository.

**Priorities, from the 2026-10-11 brief, in its order:**

| P      | Means                                             |
| ------ | ------------------------------------------------- |
| **P1** | Complete the core GO HAVE A DAY experience.       |
| **P2** | Integrate existing completed work.                |
| **P3** | Verify against real Atlas data.                   |
| **P4** | Improve discovery and recommendations.            |
| **P5** | Make adventures realistic and enjoyable.          |
| **P6** | Support sharing and group adventures.             |
| **P7** | Build GO HAVE A CONFERENCE as a reusable feature. |

Priority says how much something matters. It is not the order the work
happens in. Most P1 gaps can only be built once P2 integration has landed,
because they sit on files that four branches have already changed. §3 and §6
give the order.

---

## 1. The core experience, defined

The doctrine's loop is DISCOVER → REACT → COLLECT → SHAPE → COMMIT → LIVE →
ADAPT → REMEMBER → LEARN (§2). GO HAVE A DAY is one path round it:

```
 SAY IT ──► BUILD IT ──► SHAPE IT ──► PRINT IT ──► GO OFFLINE ──► COME BACK ──► NOW GO HAVE ANOTHER
 a sentence   real Atlas    keep, swap,   the paper      phones away    what actually    the next day starts
 or a door    subjects,     more time,    is enough      (the pact is   happened         from what happened
 (or from     honest about  in words or   without a      optional)
 Discovery,   what it       by hand       phone
 or a board)  doesn't know
```

**P1 means a person can go round that whole path once, on main, against real
Atlas.** Today, counting the branches as well as main:

| Step                | Where it stands                                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Front door          | **Absent.** `/go` is not in `PassportNav`, and nothing links to it except the printed guide's wordmark (D-1)                                                          |
| Say it              | **On main** (`016854a`). Deterministic; no model                                                                                                                      |
| From Discovery      | **On branch** `lane/discovery` `ce1c92a`: "Plan a day around this →", `/go?with=`                                                                                     |
| From a board        | **Absent.** The link would be a small seam once `with=` lands (BRD-02)                                                                                                |
| Build it            | **On main**. Verified against production Atlas in `016854a` for the Vernon four-hour sentence                                                                         |
| Shape it            | **On branch** `lane/daybuilder` `dcdabbf`: keep, swap, more or less time, move, remove, revise in words, rain plans                                                   |
| Print it            | **On main** (`AnalogGuide`). A richer layout is **on branch** `lane/analog` `eafbd8f`, and M166 is extending it                                                       |
| Go offline          | `/go`'s "Go offline" doors are **on main**. `/detox`, with the pact, phones away and the pocket screen, is **on branch** `lane/detox` `3462548`                       |
| Come back           | **On branch, local only.** `/detox/back` takes cards, who cracked and the best unplanned thing, and makes a postcard. `/go` and the paper have nowhere to send anyone |
| Now go have another | **Partial.** The postcard says it. Nothing opens the next day from what came back                                                                                     |

So the core is mostly built, mostly unmerged, and never yet driven end to end
against real Atlas. That is why **P2 integration and P3 verification are the
critical path for P1**, even though they rank below it.

---

## 2. What was inspected

| Source                                                                        | What it contributed                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/PASSPORT-PRODUCT-DOCTRINE.md`                                           | Authority. Read in full                                                                                                                                                                                                                                                                                                                                                                |
| `docs/product/originals/` (M136) and `docs/history/concepts.md` (M134)        | The GHAD vision, Fishing With Emi and the acceptance bar A1–A8, the idea inventory, and the conflicts already named                                                                                                                                                                                                                                                                    |
| **Raw Idea Vault**: `RAW_IDEA_VAULT` in `src/app/about/vision/content.ts:405` | 16 raw entries from `76dde5e` (2026-08-14). Gold Bank imports them word for word as GB-2026-08-14-001…016. They are mostly film shots and copy for Inspiration (fenced). The few that bear on GHAD are cited where they apply: #4, #7, #12, #14, #15 and #16                                                                                                                           |
| **Gold Bank** (`~/gold-bank`, Forge branch `gold-bank` `d4fe8d9`)             | Every Passport entry is still `inbox`, so none is triaged or approved. The requirements are all conference ones: GB-2026-10-11-010…027. GB-011 says _"Do not lose or simplify the product vision just to meet the initial deadline."_ GB-025 says _"Reuse Passport and Atlas capabilities. Do not build a second discovery engine."_ **Gold Bank holds no requirement for core GHAD.** |
| Lane reports (Lodge reports and commit messages)                              | M134–140 and M152–158, below                                                                                                                                                                                                                                                                                                                                                           |
| Lodge missions in flight (`~/Drop/running`, `~/Drop/queued`)                  | M163 (Atlas integration and `/travel/legs`), M165 (discovery quality), M166 (field guide), M167 (Go Offline), M168 (shared adventures), M169 (integration contracts), M170 (routing quality), M171 (autonomous quality loops), M172 (Atlas entity quality)                                                                                                                             |
| `docs/domain/current-model.md` (`lane/domain` `69f2493`, M135)                | The 13 overlaps in today's types                                                                                                                                                                                                                                                                                                                                                       |
| `docs/products/go-have-a-conference/*` (`feature/go-have-a-conference`, M158) | The conference's own vision, features, roadmap and decisions D1–D9                                                                                                                                                                                                                                                                                                                     |

**Not found anywhere:**

- a prioritised idea list (M136 looked as well);
- any artifact for "Digital Detox" or "NOW GO HAVE ANOTHER" that predates the
  2026-10-11 briefs;
- the two Fishing With Emi originals, which are still in the ChatGPT Library;
- any record of what actually happened on the Emi outing.

### 2.1 Branches as they stand

Every branch below was cut from `016854a`. **None is merged.**

| Branch                         | Head      | Mission    | What it adds                                                                                                                                                    | Gates reported by the lane                                            |
| ------------------------------ | --------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `lane/vision`                  | `76b564e` | M134, M136 | `docs/history/`, `docs/product/originals/`, and this roadmap                                                                                                    | docs only                                                             |
| `lane/domain`                  | `8a01ddd` | M135, M137 | `docs/domain/current-model.md`; `src/lib/domains/adventure/` (Adventure v1, Moment, Reading<T>, feasibility, `adventureFromDay`, print codec), wired to nothing | 39 tests                                                              |
| `lane/daybuilder`              | `dcdabbf` | M152       | Shaping the day by hand and in words; party and windows; avoid; weather and rain plans; a 15-minute move buffer; print replays the exact day (`carry.ts`)       | vitest 2033/2033, build OK, Playwright not run                        |
| `lane/discovery`               | `ce1c92a` | M153       | Ask Discovery a question (`?ask=`); an answer shelf with reasons; `/go?with=`; `/api/discovery/ask` (OpenAI optional)                                           | vitest 2030/2030, build OK, Playwright not run                        |
| `lane/maps`                    | `d62ba73` | M139, M154 | `src/lib/routing/`; straight line or routed leg, never km→minutes; a driving/walking switch; totals that say _at least_; about 1 km origin privacy; attribution | vitest 2069/2069, build OK, Playwright not run                        |
| `lane/analog`                  | `eafbd8f` | M138       | `PrintableAdventure` and `lib/analog/printable`; `/adventure/sample`; `/go/print` switched to the new layout                                                    | vitest 2002/2002; Playwright 48/57, with the 9 failures environmental |
| `lane/detox`                   | `3462548` | M140       | `/detox`, `/detox/out` and `/detox/back`; pact, cards, postcards in localStorage                                                                                | vitest 2001/2001, build OK, Playwright not run                        |
| `lane/boards`                  | `62e9900` | M156       | A gathering board, "awaiting confirmation" facts, interest marks, `/boards/conference/[slug]`                                                                   | its own tests, Playwright not run                                     |
| `feature/go-have-a-conference` | `f8b13ee` | M158       | Conference foundation; memory store only                                                                                                                        | vitest 2008/2008; Playwright 41 passed, 9 environmental failures      |

**Uncommitted.** M155's `/sycle` prototype is about 4,200 lines in
`~/passport/main`'s working tree: `src/app/sycle/`,
`src/{components,domain,lib}/sycle/`, `src/app/api/sycle/`, `docs/sycle/` and
`scripts/sycle/`. One `git clean` deletes it. See D-14.

### 2.2 Overlaps found while building this inventory

These were measured on 2026-10-11 with `git merge-tree` and by reading the
diffs. Nobody had recorded them before.

1. **Textual conflicts.** Three pairs of branches conflict:
   - `lane/daybuilder` + `lane/discovery`: `src/app/go/page.tsx`,
     `src/components/go/GoHaveADay.tsx`, `src/domain/day/build.ts`.
   - `lane/daybuilder` + `lane/maps`: `src/app/go/print/page.tsx`,
     `src/components/go/DayItinerary.tsx`, `GoHaveADay.tsx`, `build.ts`.
   - `lane/analog` + `lane/maps`: `src/app/go/print/page.tsx`.

   Every other pair merges cleanly.

2. **The same option, built twice.** `lane/daybuilder` and `lane/discovery`
   each added `keep?: readonly string[]` to `BuildInput` in `build.ts`.
   - Daybuilder's is "ids the person kept or picked".
   - Discovery's is "taken first and past the planning circle".

   The integration has to end with one `keep` that means one thing.

3. **The print surface: a regression no conflict will flag.** `lane/analog`
   swaps `AnalogGuide` out of `/go/print` for `PrintableAdventure`, and M138
   recommends deleting `AnalogGuide`. But `lane/daybuilder` put the rain plans
   and the replayed day into `AnalogGuide`, and `lane/maps` put the travel legs
   and mode there. `lane/analog` and `lane/daybuilder` merge without a textual
   conflict. If they are merged naively, the paper silently loses the rain
   plans, the hand-set minutes and the routed legs. See D-7 and INT-5.
4. **A stale print codec.** `lane/domain`'s `print.ts` is _"byte-for-byte what
   GoHaveADay writes today"_, and "today" was `016854a`. Since then
   `lane/daybuilder`'s `carry.ts` has added order, minutes, rain plans and the
   carried brief to the query, and `lane/maps` has added the mode. `print.ts`
   and `adventureFromDay` need reconciling after INT-2–5.
5. **The `/travel/legs` contract.** `lane/maps` built against a `POST
/travel/legs` that Passport proposed itself, because elk-atlas `main` on
   GitHub has none. Atlas does have a `GET /travel/legs`: Atlas M144,
   `32da743`, merged into local Atlas main by M145. It is not deployed. Atlas
   M147 also found that Passport misreads "temporarily unavailable" and "no
   point", and that ORS allows 50 requests a day. M163, M169 and M170 are all
   on this.
6. **One group, modelled three ways.** The Sycle gathering exists as
   `/sycle` (uncommitted), as a Board (`lane/boards`), and as a conference
   (`feature/go-have-a-conference`). M158 names this as its D1, and M168's
   brief says the conference _"must reuse these capabilities rather than invent
   another system"_. See D-10.
7. **Three evidence vocabularies.**
   - The Emi page: verified / live-check / prototype.
   - `lane/analog`: published / check first / suggestion.
   - `lane/daybuilder`: ✓ stated / ✦ Passport's suggestion.

   On one day, the screen and the paper would use different words. See D-6.

8. **The `adventure` name is taken twice.**
   - `/adventure/[id]` on main is the legacy `/plan → /reveal → /adventure →
/summary` flow. Its zod `Adventure` and `Moment` are in
     `src/lib/schemas.ts`.
   - `lane/analog` adds `/adventure/sample` beside it.
   - `lane/domain` adds a second `Adventure` and `Moment` in
     `src/lib/domains/adventure/`.

   See D-4.

9. **Nobody is integrating.** M166, M167 and M170 are each told to stay clear
   of _"active Day Builder integration"_ or _"the active Passport integration
   mission"_. **No such mission is running or queued.**
   `elk-engineering-os/projects/factory-missions/passport-integrate-wave1.md`
   (merge vision and domain) was written but never queued. See §6.

---

## 3. Integration plan (P2)

The workspace is **`passport`** (`~/passport/main`). It is the only workspace
allowed to change the shared contracts: `src/lib/schemas.ts`,
`src/lib/domains/`, `supabase/migrations/`, `src/app/layout.tsx`,
`src/components/shell/` and `package*.json`.

The rules for the run:

- **Merge pinned SHAs, not moving branches.** M165 and M166 are adding
  commits to `lane/discovery` and `lane/analog` as this is written. The
  commits in §2.1 are what has been reported. Later commits form a second
  wave.
- **Use merges, not rebases.** Lanes must not have their branches rewritten.
- **Run every gate after each step:** `npx tsc --noEmit`, `npx eslint .`,
  `npx prettier --check .`, `npx vitest run`, `npm run build`, and
  `E2E_PORT=<a port you started> npx playwright test`.
  - Use Supabase placeholders.
  - The 9 known environmental Playwright failures are the baseline. Any
    tenth failure is real.
  - `vitest` needs `../atlas` present.
- **One integration mission, serial.** Each step below needs the previous
  one's result.

| Step      | Merge                                                                                                        | Expected trouble                                                                                                                                                                                                                                                                                         | Waits for                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **INT-0** | Nothing to merge: **commit the untracked `/sycle` tree to its own branch** in `~/passport/main`              | None. It protects 4,200 lines                                                                                                                                                                                                                                                                            | D-14 (a person says yes)                                                                |
| **INT-1** | `lane/vision` `76b564e`+, `lane/domain` `8a01ddd`, `lane/detox` `3462548`, `lane/boards` `62e9900`           | No conflicts.<br>• Domain is additive and wired to nothing.<br>• Boards' interest route answers "can't record interest here yet" without its table, so it ships safely without the migration.<br>• Detox adds routes that are not in the nav                                                             | nothing. **Can start today**                                                            |
| **INT-2** | `lane/daybuilder` `dcdabbf`                                                                                  | None on its own. It is the largest `/go` change, so it goes first and the other branches are resolved against it                                                                                                                                                                                         | INT-1                                                                                   |
| **INT-3** | `lane/discovery` `ce1c92a`                                                                                   | Conflicts in `go/page.tsx`, `GoHaveADay.tsx` and `build.ts`. **Unify the two `keep`s** (§2.2-2). `with=` and the revision/keep state must both survive                                                                                                                                                   | INT-2. Ideally after M165 reports, so the conflicts are resolved once                   |
| **INT-4** | `lane/maps` `d62ba73`                                                                                        | Conflicts in `print/page.tsx`, `DayItinerary.tsx`, `GoHaveADay.tsx` and `build.ts`. Merge as built, with straight lines until Atlas serves. The contract change (§2.2-5) is MAP-02, not this step                                                                                                        | INT-3                                                                                   |
| **INT-5** | `lane/analog` `eafbd8f`                                                                                      | Conflict in `print/page.tsx`. **The semantic regression in §2.2-3**: `PrintableAdventure` must carry the rain plans, the replayed order and minutes, and the travel legs and mode, before `AnalogGuide` is retired. If it can't yet, `/go/print` stays on `AnalogGuide` and the sample route ships alone | INT-4, D-7. Ideally after M166 reports                                                  |
| **INT-6** | Reconcile `lane/domain`'s `print.ts` and `adventureFromDay` with the integrated `DayPlanned` and print query | Tests fail where the codec no longer matches what `/go` writes                                                                                                                                                                                                                                           | INT-5. Overlaps M169's scope, so hand it to M169's successor rather than doing it twice |
| **INT-7** | `feature/go-have-a-conference` `f8b13ee`                                                                     | File-disjoint from GHAD except for one pointer line in doctrine §15.12. Production stays closed until a durable store exists                                                                                                                                                                             | D-10, and conference D2/D3. Its own Oct 17 target (§5.9)                                |

INT-1 to INT-5 complete P2 for everything reported so far. **Nothing is
deployed by any step.** Deployment is a separate human decision.

---

## 4. Decisions only a person can make

Each of these blocks at least one requirement below. None is answered here.
The workspace that drafts the decision memo is in brackets; the person who
decides is Lorne.

| #        | Decision                                                                                                                                                                                                                                                                                         | Blocks                                    | Doctrine    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- | ----------- |
| **D-1**  | **Is GO HAVE A DAY the front door?** Is `/go` the home page, a nav item, or a side route? Where do Discovery, Saved and `/detox` sit relative to it? (The shell is a shared contract.) [vision]                                                                                                  | VIS-04, DAY-01's reach, DTX-02            | §10, §12    |
| **D-2**  | **Want / Plan / Did / Loved: the words and the set.** It decides what a saved day's status is called, what a return records per stop, and whether "make a day from my board" changes any state                                                                                                   | DOM-03, DOM-05, DTX-04, BRD-05, DSC-06    | §15 Q3, Q14 |
| **D-3**  | **Go Offline vs Digital Detox.** Does a person ever read "detox"? Should `/detox` be renamed `/offline`? Do `/go`'s "Go offline" eyebrow and `/detox` merge? M167's brief says Go Offline is _"part of GO HAVE A DAY, not a separate product"_; that is stated, and the surfaces are not decided | DTX-02, DTX-03                            | §6          |
| **D-4**  | **"Adventure" and "Moment".** Retire or re-base the legacy `/plan → /reveal → /adventure → /summary` flow and its `schemas.ts` types? Which of the three meanings of Moment is canonical?                                                                                                        | DOM-02, DOM-07, ANA-01's route            | §15 Q14     |
| **D-5**  | **Accept, change or replace the Fishing With Emi bar (A1–A8)** as GHAD's acceptance test                                                                                                                                                                                                         | VIS-03, VER-1's pass/fail, DAY-05, DAY-06 | §1          |
| **D-6**  | **One evidence legend:** three tiers, with one set of words on screen and on paper (§2.2-7)                                                                                                                                                                                                      | ANA-02, DAY-05                            | §5          |
| **D-7**  | **The print surface.** Does `PrintableAdventure` replace `AnalogGuide`, and on what condition? (Proposed: only once it carries everything in §2.2-3)                                                                                                                                             | INT-5, ANA-01                             | —           |
| **D-8**  | **Clock times.** Doctrine §2.5 sketches _"Leave at 8:40. You'll be home around 12:50."_ `/go` refuses to give minutes. Once legs are routed, may `/go` state times built only from routed legs plus the person's stated window?                                                                  | DAY-08, MAP-04                            | §2.5, §7    |
| **D-9**  | **Where a person's GHAD data lives.** Browser only (detox and the legacy flow today) or an account (Supabase, migrations, auth)? And what may flow back to Atlas?                                                                                                                                | DOM-03, DTX-04, DAY-07, BRD-06            | §15 Q8, Q11 |
| **D-10** | **Is a gathering a Board, a conference, or both?** (Conference D1.) Mission 168's brief says the conference must reuse the Boards capabilities. The conference foundation built its own membership. These disagree                                                                               | BRD-01, BRD-07, CNF-01, INT-7             | §15 Q12     |
| **D-11** | **Who owns `src/domain/`.** It is the real domain layer, and it is not listed as a shared contract (current-model §0, §6.11)                                                                                                                                                                     | every lane editing `src/domain/day/`      | —           |
| **D-12** | **Models.** One model-assisted reader for `/go` and Discovery? Which environment gets an `OPENAI_API_KEY`? Lanes have none                                                                                                                                                                       | DAY-04, DSC-03                            | §3, §15 Q13 |
| **D-13** | **The real priority list.** The idea inventory's tiers are Proposed, and the real list (if it exists) is in conversation or the ChatGPT Library                                                                                                                                                  | the order inside P4/P5                    | —           |
| **D-14** | **Commit `/sycle` now** (conference D9). Recommended: commit it today, to its own branch                                                                                                                                                                                                         | INT-0                                     | —           |
| **D-15** | **The conference date against the brief's order.** The brief ranks GO HAVE A CONFERENCE 7th. Its pilot is **Saturday 2026-10-24**, with integration targeted for Oct 17. Which wins when they compete for the integration slot?                                                                  | INT-7's place in the queue                | —           |

Doctrine follow-up that is not a decision: M172 is building _"This entity
sucks"_ in Atlas. Doctrine §15 Q15 still says _"Not scoped. Not approved."_
When M172 lands, §15 Q15 needs updating (VIS-05).

---

## 5. Backlog by workspace

### 5.1 `passport-vision`: docs only

| ID     | Requirement                        | P   | Status                                      | Ready                            |
| ------ | ---------------------------------- | --- | ------------------------------------------- | -------------------------------- |
| VIS-01 | Keep this roadmap true             | P1  | This commit                                 | Ready (ongoing)                  |
| VIS-02 | Decision memos for D-1 to D-15     | P1  | Absent                                      | **Ready**                        |
| VIS-03 | GHAD acceptance script             | P3  | Partial (A1–A8 exist; critic harness, M173) | **Ready** (extend); D-5 to adopt |
| VIS-04 | Doctrine updates as decisions land | P1  | Absent                                      | After each D-n                   |
| VIS-05 | Recover the originals              | P5  | Absent                                      | External (Lorne)                 |
| VIS-06 | Record Raw Idea Vault GHAD lines   | P5  | Absent                                      | Ready                            |

**VIS-01 · Keep this roadmap true**

- **Experience:** Anyone starting work on GHAD (person or agent) finds one
  place that says what exists, what is next, and what is waiting on whom.
- **Why:** The doctrine was written because the product kept being
  reconstructed from conversation (doctrine header, §17).
- **Accept:** Every merged or abandoned item updates its row in the same
  change. After each integration step, §2.1 and the status column match
  `git log main`.
- **Status:** This file. **Depends:** none. **P1.** **Ready:** ongoing.

**VIS-02 · Decision memos**

- **Experience:** Lorne gets each §4 decision as one page: the question, the
  evidence (with file:line), the options, and what each option unblocks. Every
  page can be answered in a sentence.
- **Why:** Fifteen decisions block most of P1. The workspace rule is _never
  silently resolve an open question_. That only works if asking is cheap.
- **Accept:** `docs/product/decisions/D-n.md` for each, with no recommendation
  presented as a decision. Answered memos move into the doctrine or an ADR.
- **Status:** Absent. **Depends:** none. **P1.** **Ready: yes.** Docs only.

**VIS-03 · GHAD acceptance script**

- **Experience:** A fixed set of sentences, run against real Atlas, says
  whether GHAD works this week. It replaces "the tests were green", which they
  were throughout the 2026-10-10 defects (PROJECT-CONTINUITY).
- **Why:** P3. Also the Emi bar (`fishing-with-emi.md` §5).
- **Accept:** A versioned list. Each sentence has the expected properties (not
  the expected places), the A-criteria it tests, and the surfaces it covers
  (screen, 375 px, print on A4 and Letter, JS off). It must cover at least:
  - the Vernon four-hour sentence, with the `016854a` result as baseline;
  - Emi's sentence;
  - the doctrine's shellfish / home-by-9 revision;
  - each of the six doors;
  - Discovery's four questions, in Vernon and Vancouver;
  - a wet-day forecast;
  - "two hours between sessions" from Vancouver;
  - a day with routed legs, once Atlas serves them.
- **Status:** Partial. **Harness built:** `scripts/critic/run.sh` (M173,
  `lane/vision`, [`critic/`](critic/README.md)), with a ten-sentence Vernon and
  Vancouver cohort, screen, 390 px, print and PDF (Letter). It is baselined
  on an Atlas snapshot, **not yet on live Atlas**
  ([`BASELINE-2026-10-11.md`](critic/BASELINE-2026-10-11.md)). **Not yet in
  the cohort:** the `016854a` sentence, Emi's sentence, the six doors, the
  shellfish / home-by-9 revision, A4, JS off and routed legs. Add them as
  scenarios; don't edit existing ones. **Depends:** D-5 to adopt A1–A8 as
  pass/fail. **P3.** **Ready:** extend now. M171's _"GO HAVE A DAY LIVE
  TESTER"_ should call this command rather than keep a second list.

**VIS-04 · Doctrine updates as decisions land.** Each answered D-n becomes an
edit to the doctrine (and an ADR where it is architectural), in the change
that implements it. That includes §15 Q15 once M172 lands. **P1.** **Ready:**
after each decision.

**VIS-05 · Recover the originals.**

- `Fishing_with_Emi_First_Adventure.pdf` and
  `001-fishing-with-emi-passport-adventure-page.md`, exported to
  `docs/history/originals/`.
- What actually happened on the Emi outing.
- Any priority list (D-13).

**P5.** **External:** only Lorne has them.

**VIS-06 · The Raw Idea Vault lines that bear on GHAD.** Record them against
the requirements they inform, without promoting them to requirements. The
vault's own rule is _"sanitizing this list is the one thing not to do to it"_.
The lines:

- #14, _"tell when you have 2 free hours and just... doesn't say anything
  unless you ask"_, against doctrine §6 and §15 Q10;
- #16, _"phone battery dies mid-adventure and nobody cares"_, against Go
  Offline;
- #12, _"We didn't plan this. That's the whole point."_, against the
  return's "best thing that wasn't on the paper";
- #4, _"You checked the weather three times"_ (a signal, §5);
- #7, the sunset page;
- #15, the line _"Go see. Stay a little longer. Take the wrong turn."_

**P5.** **Ready.**

---

### 5.2 `passport-domain`: contracts, migrations (with `passport`)

| ID     | Requirement                                 | P   | Status                                        | Ready               |
| ------ | ------------------------------------------- | --- | --------------------------------------------- | ------------------- |
| DOM-01 | Adventure v1 contract                       | P2  | On branch `8a01ddd`                           | Integrate (INT-1)   |
| DOM-02 | One "day" model, not three                  | P2  | Proposed (current-model §5.1)                 | Decision D-4        |
| DOM-03 | A saved day                                 | P1  | Absent                                        | Decision D-2, D-9   |
| DOM-04 | Print codec matches what `/go` writes       | P2  | Stale (§2.2-4)                                | After INT-5 (INT-6) |
| DOM-05 | The return record (what came back)          | P1  | Partial (detox outing)                        | Decision D-2, D-9   |
| DOM-06 | Integration contracts and risk register     | P2  | **In flight: M169 (queued)**                  | In flight           |
| DOM-07 | Resolve the `Adventure`/`Moment` name clash | P2  | Absent                                        | Decision D-4        |
| DOM-08 | `passport_board_interest` migration         | P6  | Proposed (M156 report SQL)                    | Decision D-10       |
| DOM-09 | One coordinate type (`Point`)               | P5  | Proposed (current-model §6.1)                 | After INT-4         |
| DOM-10 | A party of several people                   | P6  | Partial (`Party`/`Companion` in Adventure v1) | After DOM-01, D-2   |

**DOM-01 · Adventure v1.**

- **Experience:** None directly. A built day gets one form when it leaves the
  screen, so it can be saved, printed and remixed.
- **Why:** Doctrine §5. `Reading<T>` keeps a signal, an inference and a stated
  fact apart. Every unknown is spelled `unknown`.
- **Accept:** It is on main, wired to nothing, with its 39 tests passing.
- **Status:** On branch `lane/domain` `8a01ddd` (M137).
- **Depends:** INT-1. **P2.** **Ready:** integrate.

**DOM-02 · One day model.** There are three "day made of stops" shapes today:
`Recommendation`/`AdventureBlock`, `DayPlanned`/`DayStop` and `DayPlan`, and
they share no code.

- **Accept:** One model of a day of stops, which is `DayPlanned`. The other
  two are retired or explicitly adapted to it.
- **Depends:** D-4. **P2.** **Ready:** after the decision.

**DOM-03 · A saved day.**

- **Experience:** "Keep this day." Tomorrow, or next month, it is still there,
  printable, and it opens to the same stops.
- **Why:** §2.6, _"SAVE IS NOT THE END"_. A day you can only build and never
  keep cannot become a commitment.
- **Accept:**
  - It persists brief, order, minutes, rain plans and mode (the full
    `carry.ts` set).
  - Its status words are whatever D-2 says. Until then it has **no status
    field**, as Adventure v1 already does.
  - It reopens into `/go` and `/go/print` unchanged.
- **Status:** Absent.
- **Depends:** DOM-01, INT-5, D-2, D-9. **P1.** **Ready:** after the
  decisions.

**DOM-04 · Print codec.** `src/lib/domains/adventure/print.ts` and
`adventureFromDay` must match the print query and `DayStop` fields as they
stand after INT-2–5.

- **Accept:** A round-trip test: build → query → `/go/print` gives the same
  stops, order, minutes, rain plans and mode.
- **Depends:** INT-5. **P2.** **Ready:** after INT-5.

**DOM-05 · The return record.**

- **Experience:** What a person brings back is kept as what it is: per outing
  (cards, who cracked, the unplanned thing), and per stop if D-2 says so (did,
  skipped, loved). It never collapses into one "done" flag.
- **Why:** §2.9 and §2.10. It is ANOTHER's input.
- **Accept:** One contract that DTX-01's postcard and ANA-05's paper return
  both write to. The person's own words are kept apart from any model
  reading. Nothing leaves the device until D-9 says it may.
- **Status:** Partial. `lib/detox/outing.ts` is outing-only, with no stops.
- **Depends:** D-2, D-9. **P1.** **Ready:** after the decisions.

**DOM-06 · Integration contracts and risk register.**

- **Accept:** As M169's brief states. Feed it §2.2 so it starts from those
  findings instead of rediscovering them.
- **Status:** **In flight, M169 (queued).** Do not duplicate.

**DOM-07 · Adventure/Moment name clash.** `schemas.ts` and
`src/lib/domains/adventure/` both export `Adventure` and `Moment`.

- **Depends:** D-4. **P2.**

**DOM-08 · The interest table.** `passport_board_interest` is proposed in
M156's report. Until the table exists, the board says "can't record interest
here yet".

- **Depends:** D-10, then a migration through `passport`. **P6.**
  **Never run it against a real project from a lane.**

**DOM-09 · One coordinate type.** There are four coordinate conventions today
(current-model §5.10).

- **Accept:** `Point {latitude, longitude}` crosses every boundary, and tuples
  stop at `atlasMapper`.
- **Depends:** INT-4. **P5.** **Ready:** after INT-4.

**DOM-10 · A party of several people.** Several households in one day:
needs, ages and who confirmed.

- **Depends:** DOM-01, D-2, doctrine §15 Q12. **P6.**

---

### 5.3 `passport-daybuilder`: `/go` and `src/domain/day/`

| ID     | Requirement                                                | P   | Status                                | Ready                |
| ------ | ---------------------------------------------------------- | --- | ------------------------------------- | -------------------- |
| DAY-01 | Say it, get a day                                          | P1  | **On main** `016854a`                 | Done                 |
| DAY-02 | Shape it: keep, swap, time, move, remove, in words         | P1  | On branch `dcdabbf` (M152)            | Integrate (INT-2)    |
| DAY-03 | Weather and a rain plan                                    | P5  | On branch `dcdabbf`                   | Integrate (INT-2)    |
| DAY-04 | Model-assisted reading of unusual sentences                | P4  | Absent (`/api/go/read` never existed) | Decision D-12        |
| DAY-05 | Each stop says why it is worth making (A1)                 | P1  | Partial (`DayStop.because`)           | After INT-3; D-6     |
| DAY-06 | Adventure Builder: what to do there, for these people (A5) | P5  | Prototype (Emi page only)             | Decision D-5, §15 Q1 |
| DAY-07 | Open the next day from what came back (ANOTHER)            | P1  | Absent                                | After DOM-05         |
| DAY-08 | Clock times from routed legs                               | P5  | Absent; conflict with §2.5            | Decision D-8; MAP-02 |
| DAY-09 | Everyday sentences ("I'm hungover", "Kids are bored")      | P4  | Partial                               | After INT-3          |
| DAY-10 | Adapt mid-day ("lunch ran late")                           | P5  | Absent                                | Decision §15 Q10     |
| DAY-11 | A day for a group                                          | P6  | Absent                                | After DOM-10         |

**DAY-01 · Say it, get a day.**

- **Experience:** One box: _"Five hours, $100, with a five-year-old, near
  Vernon."_ Or one of six doors. The answer is 2–5 real places, with what is
  known and what is not.
- **Accept:** Met by `016854a`. Production Atlas gave Civic Memorial Park →
  Polson Park → Greater Vernon Athletics Park.
- **Status:** On main. **P1.** Done.

**DAY-02 · Shape it.**

- **Experience:**
  - Every stop can be kept, swapped (from alternatives you can see), given
    more or less time, moved, or removed.
  - Each has a sentence that does the same ("swap the second", "home by 5").
  - What you kept survives every revision.
  - The doctrine's _"allergic to shellfish … home by 9 PM … just adjust those
    two things"_ adjusts the time, keeps the allergy as something to ask about,
    and leaves the rest alone.
- **Why:** §2.5, _"The human remains in control"_. §3, mixed controls.
- **Accept:** As reported in M152, and on main after INT-2 with
  `lane/discovery`'s `with=` intact. VIS-03's revision sentences pass against
  real Atlas.
- **Status:** On branch `lane/daybuilder` `dcdabbf`. Fixture data only.
- **Depends:** INT-2, INT-3. **P1.** **Ready:** integrate.

**DAY-03 · Weather and a rain plan.**

- **Experience:** On a wet day, every unsheltered stop gets the nearest
  sheltered place Atlas knows of, printed too. Rain reorders the day. It never
  removes a stop.
- **Why:** §7, _"weather … not decorative filters"_.
- **Accept:** A real Environment Canada forecast for the named town, labelled
  with its city. `?sim=` works in development only and is labelled SIMULATED.
- **Status:** On branch `dcdabbf`.
- **Depends:** INT-2. **P5.** **Ready:** integrate, then verify (VER-1).

**DAY-04 · Reading unusual sentences.** A model fills the same `DayBrief`. It
never chooses a place and never overrules a stated number, town or day.

- **Accept:** Reuse `lane/discovery`'s `src/lib/ai/ask/` reader (closed-set
  validation, falls back to the words) rather than building a second one. It
  works with no key.
- **Depends:** INT-3, D-12. **P4.**

**DAY-05 · A stop with a reason (Emi A1).**

- **Experience:** Each stop reads as a moment, with why it is worth making,
  not only where it is: _"The drive is not the gap between the fun parts."_
- **Why:** Fishing With Emi, and the Moments idea.
- **Accept:** Every stop's reason is drawn from stated Atlas evidence or
  marked as Passport's suggestion under D-6's legend. A1 passes in VIS-03.
- **Status:** Partial. `DayStop.because` exists as a selection reason.
- **Depends:** INT-3, D-6. **P1.** **Ready:** after INT-3.

**DAY-06 · Adventure Builder (Emi A5).**

- **Experience:** For these particular people, choose what you do and learn
  there. Unchosen options stay visible with their reasons. A module with no
  sourced content produces nothing.
- **Why:** `fishing-with-emi.md` §3.
- **Accept:** Emi A5. An unchosen module never reaches the paper.
- **Status:** Prototype on `/about/experiment-07-fishing-with-emi`, with
  hand-written modules.
- **Depends:** D-5, doctrine §15 Q1 (generic or Experience), and a source of
  modules (Atlas features and affordances). **P5.** **Ready:** after the
  decisions.

**DAY-07 · NOW GO HAVE ANOTHER.**

- **Experience:** Coming back from a day, "go have another" opens `/go`
  already knowing what was loved, skipped and found. It starts from that
  rather than from nothing.
- **Why:** §2 (_LEARN → back into DISCOVER_); the GHAD name pair.
- **Accept:**
  - It reads only what the person stated in DOM-05.
  - It says in words what it took from last time, and that can be turned off.
  - It is not counted as "engagement" (§6).
- **Status:** Absent.
- **Depends:** DOM-05, DTX-04. **P1.** **Ready:** after DOM-05.

**DAY-08 · Clock times.** _"Leave at 8:40. Home around 12:50."_ Built only from
routed legs plus the person's stated window, and never from km.

- **Depends:** D-8, MAP-02. **P5.**

**DAY-09 · Everyday sentences.** The Idea Atlas list is the coverage target:
_"I've got 2 hours." "It's raining." "Kids are bored." "I have $40." "I'm
hungover." "I've already done everything."_ Each is either read or answered
honestly as not understood.

- **Depends:** INT-3. **P4.** **Ready:** after INT-3.

**DAY-10 · Adapt mid-day.** _"We spent two hours here instead of one."_ This is
§2.8. It conflicts in spirit with phones away.

- **Depends:** doctrine §15 Q10 (how live mode interrupts) and D-3. **P5.**

**DAY-11 · A day for a group.** This is the group adventure in the conference's
idea 21.

- **Depends:** DOM-10, BRD-04. **P6.**

---

### 5.4 `passport-analog`: paper

| ID     | Requirement                              | P   | Status                                                           | Ready                          |
| ------ | ---------------------------------------- | --- | ---------------------------------------------------------------- | ------------------------------ |
| ANA-01 | A printable adventure worth taking       | P1  | On main (`AnalogGuide`); on branch `eafbd8f`; **in flight M166** | In flight; integrate after D-7 |
| ANA-02 | One three-tier legend on paper           | P5  | On branch (published / check first / suggestion)                 | Decision D-6                   |
| ANA-03 | The print chrome never prints            | P2  | Fixed for `PrintableAdventure`; latent in `AnalogGuide`          | After INT-5                    |
| ANA-04 | A map on paper                           | P5  | Absent                                                           | After MAP-05                   |
| ANA-05 | The paper leads back (come-back address) | P1  | Absent                                                           | Decision D-3                   |
| ANA-06 | The pact on paper                        | P5  | Proposed (detox README §2)                                       | After INT-5, D-3               |
| ANA-07 | Print a saved day                        | P1  | Proposed (second adapter)                                        | After DOM-03                   |
| ANA-08 | Builder modules on paper                 | P5  | Prototype (Emi packet)                                           | After DAY-06                   |

**ANA-01 · A printable adventure.**

- **Experience:** A guide people want to take with them: before-you-go
  checklist, time and money at a glance, stops, side quests, notes, memory
  prompts, and a box to draw in when a child is coming.
- **Why:** `ANALOG_PHILOSOPHY`. Emi A6.
- **Accept:**
  - It prints on A4 and Letter, with JS on and off.
  - No total cost and no unpublished hours.
  - It carries everything `AnalogGuide` carries after INT-4 (rain plans,
    replayed minutes, legs). See D-7.
- **Status:** `AnalogGuide` is on main. `PrintableAdventure` is on branch
  `eafbd8f` (M138). **M166 (running) is extending it.**
- **Depends:** D-7, INT-5. **P1.** **Ready:** in flight. Do not start a second
  mission.

**ANA-02 · One legend.** Every line on paper is one of three tiers, with the
same words as the screen.

- **Depends:** D-6. **P5.**

**ANA-03 · Print chrome.** styled-jsx injected on hydration printed the
toolbar on page 1. That is fixed in `PrintableAdventure`, and the same defect
is latent in `AnalogGuide`.

- **Accept:** The e2e test with JS off passes for whichever print surface
  ships.
- **Depends:** INT-5. **P2.**

**ANA-04 · A map on paper.** Emi A6 currently passes only by saying _"no
offline map here"_.

- **Accept:** A static map of the stops with OSM attribution, and no route
  line unless the legs were routed.
- **Depends:** MAP-05. **P5.**

**ANA-05 · The paper leads back.**

- **Experience:** The closing _"Come back and tell us what actually
  happened"_ prints a short address (and, optionally, a QR code) for the
  return.
- **Why:** It closes the loop on paper (detox README integration point 1).
- **Accept:** The address is typeable off paper, like the existing "name,
  town" rule.
- **Depends:** D-3 (which route), DTX-01. **P1.** **Ready:** after D-3.

**ANA-06 · The pact on paper.** `?pact=<phone>.<stake>.<ids>`, using the
stable ids in `pact.ts`.

- **Depends:** INT-5, D-3. **P5.**

**ANA-07 · Print a saved day.** A second adapter beside `printableFromDay`, as
M138 planned.

- **Depends:** DOM-03. **P1.**

**ANA-08 · Builder modules on paper.** _"An unchosen module never reaches the
packet."_

- **Depends:** DAY-06. **P5.**

---

### 5.5 `passport-detox`: Go Offline

| ID     | Requirement                                        | P   | Status                                      | Ready                        |
| ------ | -------------------------------------------------- | --- | ------------------------------------------- | ---------------------------- |
| DTX-01 | Plan it, print it, go; phones away; come back      | P1  | On branch `3462548` (M140); **M167 queued** | Integrate (INT-1); in flight |
| DTX-02 | One name and one place for Go Offline              | P1  | Conflict named                              | Decision D-3, D-1            |
| DTX-03 | `/go` hands off to going offline                   | P1  | Proposed (detox README §3)                  | After INT-2, D-3             |
| DTX-04 | The return asks about the stops by name            | P1  | Proposed (detox README §4)                  | After DOM-03, D-2            |
| DTX-05 | Guardrail: no screen-time metrics, streaks or nags | P1  | Holds on branch                             | Standing rule                |

**DTX-01 · Go Offline.**

- **Experience:** _"Plan it. Print it. Go."_
  - An optional pact: where the phones go, and what the first to crack owes.
  - Three dealt cards to pull off.
  - "Phones away": a pocket screen with one button and no ticking timer.
  - Welcome back: which cards, who cracked, the best thing that wasn't on the
    paper. Then a postcard and _"Now go have another."_
- **Why:** §6, _"Less phone, more life"_; ANALOG_PHILOSOPHY; Raw Idea Vault
  #16.
- **Accept:**
  - It does not plan or print anything itself, so there is no second planner.
  - The cards never name a place.
  - Nothing is sent over the network.
  - It is seen rendered on a phone at least once. **M140 never saw it
    rendered**: without Supabase env it returns 500.
- **Status:** On branch `lane/detox` `3462548`. **M167 (queued)** continues
  it.
- **Depends:** INT-1. **P1.** **Ready:** integrate. M167 is the next step; do
  not duplicate it.

**DTX-02 · One name and place.** "Detox" appears only in the URL. `/go`'s
eyebrow and `/detox` are two surfaces under one label.

- **Accept:** One route and one label, as D-3 decides, and in the nav only if
  D-1 says so.
- **Depends:** D-3, D-1. **P1.**

**DTX-03 · Hand-off from `/go`.** After printing, offer _"Make it
interesting →"_ (the pact).

- **Accept:** It is optional, and skipping it costs nothing.
- **Depends:** INT-2, D-3. **P1.**

**DTX-04 · The return names the stops.** The outing carries the saved day's
id, so the return asks about each stop by name.

- **Depends:** DOM-03, DOM-05, D-2. **P1.**

**DTX-05 · Guardrail.** No screen-time figures, streaks, scores, unnecessary
notifications or forced sharing (M167's brief; `modes.ts`).

- **Accept:** Holds in review for every GHAD change. **Standing rule.**

---

### 5.6 `passport-discovery`: possibilities, into a day

| ID     | Requirement                                     | P   | Status                                                                                | Ready                        |
| ------ | ----------------------------------------------- | --- | ------------------------------------------------------------------------------------- | ---------------------------- |
| DSC-01 | Ask Discovery a question, get reasons           | P4  | On branch `ce1c92a` (M153)                                                            | Integrate (INT-3)            |
| DSC-02 | Plan a day around this                          | P1  | On branch `ce1c92a`                                                                   | Integrate (INT-3)            |
| DSC-03 | Model fills the gaps (`/api/discovery/ask`)     | P4  | On branch; never run with a key                                                       | External (key), D-12         |
| DSC-04 | Recommendation quality on real examples         | P4  | **In flight: M165 (running)**                                                         | In flight                    |
| DSC-05 | What Discovery needs from Atlas                 | P3  | Documented (`atlas-requirements-from-discovery.md`); Atlas M163 integrating Vancouver | External (Atlas)             |
| DSC-06 | Reactions beyond Save                           | P4  | Absent (single Save, `61a2853`)                                                       | Decision D-2 (§15 Q3)        |
| DSC-07 | Learn from what you did and loved               | P4  | Absent                                                                                | After DOM-05, D-9            |
| DSC-08 | "This entity sucks" button in Passport          | P4  | Atlas side in M172 (queued)                                                           | After M172; doctrine §15 Q15 |
| DSC-09 | Discovery on a conference's dates and free gaps | P7  | Partial (location door built on the conference branch)                                | After INT-7                  |

**DSC-01 · Ask a question.**

- **Experience:** _"What can we do with three hours?" "Something unusual
  nearby?" "Where can I take my kid this afternoon?" "Worth driving an hour
  for?"_
  - One box under the page's question.
  - The rows visibly change, and any of it can be corrected with a tap.
  - A few varied picks, each with up to three checkable facts and at most one
    caveat.
  - No minutes, no popularity, no place chosen by a model.
- **Why:** §4 (both directions); §8 (possibilities, not search).
- **Accept:** As reported, and against real Atlas in Vernon and Vancouver
  (VIS-03).
- **Status:** On branch `ce1c92a`. It was tested against a stand-in Atlas
  only.
- **Depends:** INT-3. **P4.** **Ready:** integrate.

**DSC-02 · Plan a day around this.**

- **Experience:** Every card has _"Plan a day around this →"_, and an answer
  has _"Make a day of it →"_. `/go?with=<ids>` builds around them.
- **Accept:** A stated age rule or a stated not-on-that-day still removes a
  place, and says so out loud.
- **Status:** On branch.
- **Depends:** INT-3. **P1**, because it is how Discovery reaches the core
  path. **Ready:** integrate.

**DSC-03 · Model fills the gaps.** Closed-set validation; it never overrules a
stated value and has no field for a place.

- **Accept:** One run with a real key, with outputs recorded.
- **Depends:** D-12. **P4.**

**DSC-04 · Quality on real examples.** Hidden gems, things on today, party
types, weather, nearby against worth-the-drive, and no repetition.

- **Status:** **M165 running.** Do not duplicate.

**DSC-05 · What Discovery needs from Atlas.** Locality, duplicate identities,
descriptions that restate their title, affordances, media, temporal facts,
and the 370 coordinates that state only a town.

- **Accept:** Re-measured against real Atlas (the doc's own numbers have
  drifted, per PROJECT-CONTINUITY).
- **External:** Atlas, M163. **P3.**

**DSC-06 · Reactions beyond Save.** _"Fuck yes, but not today"_ is a different
fact from "not for me" (§2.2). Desire and feasibility are never one boolean.

- **Depends:** D-2 / §15 Q3. **P4.**

**DSC-07 · Learn from what you did.** Discovery reflects stated history only.
An inference stays an inference (§5).

- **Depends:** DOM-05, D-9. **P4.**

**DSC-08 · "This entity sucks."** A Passport-side flag, with a reason, into
Atlas's quality system.

- **Depends:** M172 (Atlas), and doctrine §15 Q15. Who may flag, and what it
  is called, are still open. **P4.**

**DSC-09 · Conference dates and gaps.** Conference ideas 22 and 23.

- **Depends:** INT-7, and the conference schedule module. **P7.**

---

### 5.7 `passport-maps`: travel between stops

| ID     | Requirement                                        | P   | Status                                           | Ready                                  |
| ------ | -------------------------------------------------- | --- | ------------------------------------------------ | -------------------------------------- |
| MAP-01 | A straight line that says so, or a routed estimate | P2  | On branch `d62ba73`, `da6f007` (M139, M154)      | Integrate (INT-4)                      |
| MAP-02 | Speak Atlas's real `/travel/legs`                  | P3  | Conflict (§2.2-5); **M170 queued, M163 running** | In flight                              |
| MAP-03 | Park entrances, not park centroids                 | P5  | Atlas M163 investigating                         | External (Atlas)                       |
| MAP-04 | The day's total and the way home                   | P5  | On branch `d62ba73`                              | Integrate (INT-4); D-8 for clock times |
| MAP-05 | A static map of the day (screen and paper)         | P5  | Absent (`PlaceMap` is an OSM iframe)             | After INT-4, DOM-09                    |
| MAP-06 | Quota and outage behaviour                         | P3  | Partial (5-minute cache, no retry)               | In flight (M170)                       |

**MAP-01 · Honest travel.**

- **Experience:** Between stops you see either the routed estimate, with its
  provider and attribution, or a straight line labelled as a straight line.
  Never km turned into minutes.
- **Why:** §7. The `016854a` rule _"travel: straight-line km — there is no
  routing and no minutes"_. Atlas measured road/straight ratios of 1.12–2.75.
- **Accept:**
  - Unrouted legs make the total _at least_, and name the leg.
  - The origin leaves Passport rounded to about 1 km.
- **Status:** On branch `d62ba73`.
- **Depends:** INT-4. **P2.** **Ready:** integrate.

**MAP-02 · Atlas's real contract.** Replace the proposed `POST` in
`atlasLegs.ts` with whatever Atlas actually serves (Atlas M144 `GET
/travel/legs`). Read "temporarily unavailable" and "no point" correctly
(Atlas M147).

- **Accept:** One file changes, and a recorded call against local Atlas
  passes.
- **Status:** **M170 queued; Atlas M163 is documenting the contract.**
- **Depends:** M163's report. **P3.**

**MAP-03 · Park entrances.** A route to a park's internal point is not a route
to the park.

- **External:** Atlas, M163 item 8. **P5.**

**MAP-04 · Total and way home.** _"Plan's hours + routed travel = in all."_
Clock times are D-8.

- **Depends:** INT-4. **P5.**

**MAP-05 · Static map.** The stops on one image, usable on paper (ANA-04),
with OSM attribution.

- **Depends:** INT-4, DOM-09. **P5.**

**MAP-06 · Quotas.** ORS allows 50 requests a day (M147). Atlas's cache is the
defence.

- **Status:** **M170.** **P3.**

---

### 5.8 `passport-boards`: collecting, sharing, groups

| ID     | Requirement                                         | P   | Status                                  | Ready                   |
| ------ | --------------------------------------------------- | --- | --------------------------------------- | ----------------------- |
| BRD-01 | A gathering board: honest facts, voluntary interest | P6  | On branch `62e9900` (M156)              | Integrate (INT-1); D-10 |
| BRD-02 | Make a day out of my board                          | P1  | Absent; seam exists on branch (`with=`) | After INT-3             |
| BRD-03 | Saved and Boards are one place                      | P4  | Fuzzy (current-model §5.8)              | Decision D-1            |
| BRD-04 | Shared adventures: invite, join, interest, leave    | P6  | **In flight: M168 (queued)**            | In flight               |
| BRD-05 | "You've saved six things. Want an afternoon?"       | P4  | Absent                                  | Decision §15 Q5, D-2    |
| BRD-06 | Share a day                                         | P6  | Absent                                  | After DOM-03            |
| BRD-07 | The conference reuses Boards capabilities           | P7  | Conflict (§2.2-6)                       | Decision D-10           |
| BRD-08 | One item-reference type for kept things             | P4  | Proposed (current-model §6.5)           | After INT-1             |

**BRD-01 · Gathering board.**

- **Experience:** A staff board for a gathering. Every unconfirmed fact reads
  _"Awaiting confirmation"_ until someone named confirms it. "I'm interested"
  is voluntary and visible to members only. Names appear only by choice.
- **Why:** §6; GB-026 privacy.
- **Accept:**
  - No user id ever reaches the browser.
  - It degrades honestly without its table (DOM-08).
  - **People can leave a shared board.** M156 reports that today they cannot.
- **Status:** On branch `62e9900`.
- **Depends:** INT-1, D-10, DOM-08. **P6.**

**BRD-02 · Make a day out of my board.**

- **Experience:** On a board, _"Make a day out of these →"_ opens
  `/go?with=<board item ids>`.
- **Why:** §9 and §2.6, _"Saving must lead somewhere"_. It is the most direct
  version of the seam `go-have-a-day.md` §8 names as missing.
- **Accept:** The board's own items seed the day, with the same honesty rules
  as DSC-02. It writes no state.
- **Proposed reading, for Lorne to confirm:** because the link writes nothing,
  it does not settle §15 Q14. A version that marks items "planned" would.
- **Status:** Absent. The seam is on `lane/discovery`.
- **Depends:** INT-3. **P1.** **Ready:** after INT-3. It is a small change in
  `src/app/boards/[id]/` only.

**BRD-03 · Saved and Boards.** The nav's Saved goes to `/saved`, which treats
`boards[0]` as "Saved". `activeBoardStorage` may point elsewhere.

- **Accept:** A person can tell which collection they are adding to.
- **Depends:** D-1. **P4.**

**BRD-04 · Shared adventures.** Invite, join, express interest, coordinate,
shared plans, voluntary participation, privacy, and leaving.

- **Status:** **M168 queued.** Its brief requires the conference to reuse
  this. **P6.**

**BRD-05 · The offer.** Doctrine §4's sentence, timed by the board's growth
stages (10 items: _"This is becoming a day"_).

- **Depends:** §15 Q5 (when to ask), D-2. **P4.**

**BRD-06 · Share a day.** Send a saved day to someone, who sees the same stops
and the same unknowns.

- **Depends:** DOM-03, D-9. **P6.**

**BRD-07 · The conference reuses Boards.** Members, invites and interest come
from one system.

- **Depends:** D-10. **P7.**

**BRD-08 · One item reference.** `{entityId, entityKind, source}`, used by
board items and kept rows, replacing the string matching in `SavedReview`. It
does not decide states.

- **Depends:** INT-1. **P4.**

---

### 5.9 GO HAVE A CONFERENCE (P7): pointer, not a second roadmap

The conference has its own plan, with its own deadline:
`docs/products/go-have-a-conference/ROADMAP.md` and `FEATURES.md`, on
`feature/go-have-a-conference`. **This file does not restate it.** It records
only where it meets the eight workspaces.

| ID     | Meets                 | What                                                                                                                                                     |
| ------ | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CNF-01 | boards, domain        | Membership and interest: D-10 / conference D1. GB-013 calls it _"a reusable feature within Passport / GO HAVE A DAY"_                                    |
| CNF-02 | discovery, daybuilder | Doors into `/go` from the conference town are built. "Two hours between sessions" needs the schedule. GB-025: _"Do not build a second discovery engine"_ |
| CNF-03 | daybuilder, domain    | Group adventures (idea 21) are DAY-11 and DOM-10                                                                                                         |
| CNF-04 | domain                | Keep your adventures afterwards (idea 26) is DOM-03, before the 30-day expiry                                                                            |
| CNF-05 | maps                  | Shared map of recommended places (idea 17) is MAP-05                                                                                                     |
| CNF-06 | `passport`            | Durable store, which is a migration and a privileged key (conference D3). D-14 (`/sycle`). D-15 (the slot)                                               |

Atlas M157 raised Vancouver's usable places from 1 to 23, and found Canucks
home games on Oct 20, 22 and 25. That is the knowledge the pilot's discovery
door depends on. M163 is integrating it.

---

## 6. What can run in parallel, starting now

Here is the state on 2026-10-11:

- **Running:** M162, M163 (Atlas), M164 (this mission), M165 (discovery) and
  M166 (analog).
- **Queued:** M167 (detox), M168 (boards), M169 (domain), M170 (maps),
  M171 and M172.
- Lodge caps Passport workspaces as a group (`passport:3`). M141 raised a
  concurrency cap from 3 to 8. **Check which cap M141 raised** before queuing
  more.

### Safe to start immediately

These are file-disjoint from each other and from the running missions:

| #   | Mission                                                                                                                                                                     | Workspace                    | Why it is safe                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **D-14: commit `/sycle` to a branch** (a person, or `passport` with approval)                                                                                               | `passport`                   | Adds a branch and touches no tracked file. Every day it waits, one `git clean` could lose it                                                                                     |
| 2   | **Integration wave 1 (INT-1)**, then **INT-2** (daybuilder)                                                                                                                 | `passport`                   | INT-1's merges are conflict-free. No mission is running on daybuilder, so INT-2 resolves against a still branch                                                                  |
| 3   | **VIS-02 decision memos** and the **VIS-03 acceptance script**                                                                                                              | `passport-vision`            | Docs only                                                                                                                                                                        |
| 4   | **Measure what main already does against real Atlas**: the `016854a` sentence, Emi's sentence (is Hidden Lake a subject? does the planning circle reach it?), the six doors | the Mac checkout (has Atlas) | Read-only. It needs credentials no lane has. It gives P3 a baseline before integration changes anything. Now one command: `CRITIC_LIVE=1 CRITIC_SCREENS=1 scripts/critic/run.sh` |
| 5   | M167, M168, M169, M170, as already queued                                                                                                                                   | detox, boards, domain, maps  | Their briefs already confine them to their own folders. Feed M169 §2.2, and feed M170 M163's contract report                                                                     |

### Do not start yet

- **Any new mission that edits `/go` files**: `src/app/go/**`,
  `src/components/go/**`, `src/domain/day/**`, `src/components/adventure/**`.
  Four branches already change them, and two running missions are adding more.
  Every new edit is another three-way conflict for INT-3 to INT-5.
  - **Wait for:** INT-5.
  - **This covers:** DAY-05, DAY-09, DTX-03, ANA-05 and the rest.
- **INT-3 and INT-5** until M165 and M166 report, so each conflict is
  resolved once.
- **Anything in the shell or nav** (D-1), **migrations** (DOM-08, CNF-06) and
  **INT-7**, until their decisions are made.
- **Deploying anything.** No step here deploys.

### Proposed order after that

1. INT-3, INT-4 and INT-5 with the second-wave commits.
2. VER-1: run VIS-03 against real Atlas on the integrated main.
3. The P1 gaps (D-1 → DTX-02, BRD-02, DAY-05, ANA-05), then D-2 and D-9 →
   DOM-03 and DOM-05 → DAY-07 and DTX-04 → ANA-07.
4. Then P4–P6 in priority order, with P7 on the conference's own calendar if
   D-15 says so.

**VER-1** is the verification run. It belongs to the `passport` workspace,
uses a checkout with Atlas access, and runs the VIS-03 script on the
integrated main. **P3.** It is ready after INT-5. The baseline (row 4 above)
is ready now.
