# Project continuity

**Written:** 2026-10-10, at commit `f157689`.

This document exists so the next person or agent can pick Passport up without
reconstructing it from conversation. It records **where things are**, **what
has been decided**, and **what is broken or unfinished** — from repository
evidence, not from memory.

Every claim below is one of three kinds, and they are labelled:

- **Verified** — read from the repository, the live API, or a deployed page.
- **Reported** — stated by a human who tested it; not independently confirmed.
- **Unknown** — genuinely not established. Left as a question.

It is a snapshot, not an authority. **The doctrine is the authority.** If this
file and the code disagree, the code is right and this file is stale.

---

## RESUME HERE

Read these, in this order, before doing anything:

1. **`../CLAUDE.md`** (workspace root) — how the two repositories relate and
   the engineering principles that govern work here. Not version controlled.
2. **`CLAUDE.md`** (this repository) — Passport's own agent instructions.
3. **`docs/PASSPORT-PRODUCT-DOCTRINE.md`** — **product authority**, 904 lines.
   Read it in full before touching Discovery, saved state, Experiences,
   planning, or AI UX. §15 lists fifteen questions that are _honestly
   unresolved_; do not quietly answer one.
4. **`docs/architecture/decisions/`** — two ADRs, both still in force.
5. **This file** — current state and open work.
6. **`docs/product/atlas-requirements-from-discovery.md`** — the standing list
   of what Discovery needs from Atlas, with measured coverage numbers. **Treat
   its figures as approximate**: it is headed _"measured 2026-10-11"_, which is
   a date that had not happened when it was written, and its duplicate count
   (57 names / 114 records over 2,684 candidates) does not reproduce — the same
   measurement on 2026-10-10 gives **60 / 120 over 2,683**. The categories it
   records are sound; the numbers have drifted. Re-measure before citing.

Then, before writing code: **look at the deployed product**. Nearly every
defect fixed on 2026-10-10 was found by using https://www.iamoctober.com or
`https://elk-passport.vercel.app/discovery` and measuring the live corpus — not
by reading code, and not by running the test suite, which was green throughout.

---

## 1 · What Passport is, and where its vision lives

**Verified.** The product authority is
[`docs/PASSPORT-PRODUCT-DOCTRINE.md`](PASSPORT-PRODUCT-DOCTRINE.md), committed
2026-10-10 in `41d1a6a`. Both `CLAUDE.md` files require reading it before
product work.

Its core, in its own terms: Passport helps a person **discover, react to,
collect, shape, commit to, live and remember** real things to do. The canonical
loop is **Discover → React → Collect → Shape → Commit → Live → Adapt →
Remember → Learn** (§2). AI is explicitly _not a tab_ (§3). "Search" is
explicitly suspected of being the wrong mental model (§8).

Four older vision documents survive in `docs/old-might-be-garbage/`. They are
**history, not authority** — the doctrine says so itself (§17), and so does
`CLAUDE.md`.

---

## 2 · Passport and Atlas

**Verified.** Two independent git repositories under a workspace root that is
**not itself version controlled** (`git rev-parse` fails there). So anything
that must survive has to be committed inside `app/` or `atlas/`.

|                       |                                                               |
| --------------------- | ------------------------------------------------------------- |
| `app/`                | **Passport** — the traveller-facing product. This repository. |
| `atlas/`              | **Atlas** — travel knowledge and reasoning.                   |
| `project-management/` | Shared operational docs. **Not version controlled.**          |

**Atlas owns what is true about the world. Passport owns what is safe to say
about it.** Passport reads Atlas over HTTP (`ATLAS_API_URL` +
`ATLAS_SERVICE_TOKEN`) and **computes no geographic, environmental or
categorical truth of its own**. Where Atlas does not know, Passport says
nothing — it does not infer, reverse-geocode, or keep lookup tables.

**Verified 2026-10-10** — `GET /discovery/candidates` on production Atlas
announces its contracts in a `grounding` block:

```
geography        candidate-geography/2
identity         candidate-identity/1
occurrence       candidate-occurrence/1
knowledge        candidate-knowledge/1
environment      candidate-environment/1
contextualMedia  candidate-media/1
```

**Verified** corpus size and coverage on that date — **2,683 candidates**:

| Evidence                       | Coverage                                                       | Notes                            |
| ------------------------------ | -------------------------------------------------------------- | -------------------------------- |
| `geography.state`              | observed 763 · derived 104 · conflicting 3 · **unknown 1,813** | 68% unplaced                     |
| `geography.coordinates`        | **496**                                                        | the only basis for a distance    |
| a locality but no coordinates  | 370                                                            | the cheapest Atlas win available |
| `knowledge.affordances`        | **224** candidates, 682 rows                                   | the verbs                        |
| `environment.rain` non-unknown | **122**                                                        | shelter evidence                 |
| `knowledge.practical`          | 968 candidates, 1,876 free-text facts                          | mostly `Location`                |
| duration facts                 | **17 candidates**                                              | free text, all hiking            |
| **age / child suitability**    | **0**                                                          | nothing, anywhere                |

**Atlas repository state (local):** HEAD `2ada130`, with uncommitted untracked
files. **Unknown:** which Atlas commit is deployed. Passport's knowledge of
Atlas is by _observed contract_, not by SHA.

> **Trap, verified the hard way:** `app/.env.local` points `ATLAS_API_URL` at
> **`http://localhost:3001`**. Production Atlas is `https://elk-atlas.vercel.app`.
> Measurements taken against a stale local Atlas were reported as production
> facts earlier in this project and were wrong. Always confirm which Atlas you
> are measuring.

---

## 3 · Development and deployment status

**Verified 2026-10-10.**

- Branch `main`, HEAD **`f157689`**, in sync with `origin/main`.
- Working tree clean **except** three untracked image files under `public/`
  (`october-vhs-assets/`, two `october/*.jpg|webp`). They predate today's work
  and were deliberately left unstaged. **Unknown:** whether they are wanted.
- Deployed to Vercel project `elk-passport`, scope `lornemarkhams-projects`,
  production domain **`www.iamoctober.com`**, also `elk-passport.vercel.app`.
- Every commit listed in §4 is deployed and was verified on production.

**Gates** (from `CLAUDE.md`, all run and green at `f157689`):
`npx tsc --noEmit` · `npx eslint .` (0 errors, 37 warnings) · `npx prettier --check .`
· `npx vitest run` (**1,793 tests, 141 files**) · `npx playwright test` (**38**)
· `npm run build`.

Dev server is port **3100**, deliberately not 3000. `playwright.config.ts`
reuses whatever is listening — set `E2E_PORT` to a port whose provenance you
know. A stale dev server has silently served the suite before.

**Measured timings**, local `next start` against production Atlas, and
production itself:

|                     | local  | production |
| ------------------- | ------ | ---------- |
| `/discovery` cold   | 6.3 s  | 7.5 s      |
| `/discovery` repeat | 0.32 s | 6.9 s      |
| `/saved` signed out | 11 ms  | 1.06 s     |

The candidate feed is the cost; it is cached (`cached("discovery/candidates")`)
and shared by `/discovery`, `/saved` and `/boards/:id`. **Unknown:** why
production's repeat read stays near 7 s when local's drops to 0.3 s. Not
investigated. `project-management/decisions/2026-10-01-atlas-cold-reads.md`
exists and may be relevant.

---

## 4 · What shipped on 2026-10-10

**Verified** — eighteen commits, `41d1a6a` → `f157689`, all deployed.

| SHA                               | What it did                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| `41d1a6a`                         | The product doctrine, written down                                                       |
| `f432d8c`                         | Discovery composed into sections instead of 2,248 rows                                   |
| `1dd2d8e` · `9e14f97` · `289c7f3` | Loading state, picture-first ordering, the Passport nav                                  |
| `2f1db51` · `cf2ca56` · `ff20d48` | `candidate-geography/2` consumed; a card can no longer read local by saying nothing      |
| `b026d8a`                         | **Situational context** — the Today panel: date, real forecast, who's with you, how long |
| `04bd753`                         | `directionsFor` — answering in verbs. Built and tested, **not wired until `f157689`**    |
| `c2b499b`                         | Location became the _person's_, not the corpus's                                         |
| `5e73158`                         | Geographic honesty — near / far / **unplaced**, "Near you"                               |
| `2ef6b64`                         | Invitations — verbs above the list                                                       |
| `b123bdf`                         | Atlas `candidate-environment/1` replaced Passport's weather word-list                    |
| `82e2e19`                         | Exploration in the URL; sign-in carries the pending action                               |
| `fe2d543`                         | Board resolved 393 Places where the sidebar resolved 2,683 subjects                      |
| `61a2853`                         | One **Save** action; `/saved`; distance ordering in sections                             |
| `f157689`                         | Verbs in Today; nearest-first; the time window controls breadth                          |

---

## 5 · Decisions already made

**Recorded as ADRs** (`docs/architecture/decisions/`):

- **001 — Devices are instruments, not mirrors.**
- **002 — A person's location is situational, and Passport stores none of it.**
  Browser coordinates are blunted to ~1 km _before leaving the browser_, sent
  in a request body (never a URL), used to ask Environment Canada one question
  and to compute distance in the browser, and written to **no** column, cookie,
  `localStorage`, session or log. A reload forgets it. Asked once per visit.

**Decided in code and comments, not yet in an ADR** — all verified in the
source, each with its reasoning recorded at the site:

1. **Passport never computes geographic truth.** No reverse-geocoding, no
   town-position tables, no inferring locality from names. Where Atlas does not
   know, the card says nothing.
2. **`unknown` is not `far`, and not `unsuitable`.** 68% of the corpus is
   unplaced; ordering treats unplaced _above_ known-far, never below.
3. **Only `exposed` argues against a wet day.** `weather-dependent` is its own
   answer; `unknown` is 95% of the corpus and means nothing.
4. **Atlas's words, unrewritten.** Affordance labels are shown in Atlas's own
   spelling — `mountain biking` stays lowercase, `Playground` is not
   translated. No Passport taxonomy.
5. **Discovery has one action: Save.** Deciding happens in `/saved`.
6. **"Want to do" collects first, then records.** A stronger intention must
   never make an item leave the visible collection.
7. **An exploration lives in the URL** (`?intent=&q=&kind=&who=&how=&doing=`),
   written with `history.replaceState`, so refresh, navigation and sign-in all
   restore it. A pending action rides as `?do=save:<id>` and replays once.
8. **The board resolves against both corpora** — candidates _and_ `/places` —
   because 70 Places exist outside the candidate feed.
9. **Nothing saved is ever silently dropped.** Unresolvable items are counted
   and surfaced.
10. **The time window controls breadth, not duration** — one / two / four
    ideas. Labelled on screen as a judgement, because Atlas states duration for
    17 candidates.

---

## 6 · Known problems and unfinished work

### Blocked or deliberately not built

- **"Let's do it" does not exist.** The level above _want to do_ is a thing
  with a day on it, and `planThing` writes that day into `starts_at` — the
  same column a dated Event's real start time occupies. Shipping it would
  overwrite the date of every committed Event. **Needs a decision about where a
  chosen day belongs.**
- **Child suitability is a Passport guess.** `CHILD_DOABLE` in
  `src/domain/discovery/situation.ts` is a hardcoded word list deciding what
  suits a five-year-old from affordance names. Atlas states **zero** age
  evidence. This is the same pattern as the `PLAINLY_OUTDOOR` list that
  `b123bdf` deleted for being wrong. **Highest-value Atlas gap.**
- **Board-level Passport / itinerary composition** — recorded as debt in
  `docs/product/discover.md`.

### Verified defects and limits still present

- The Today panel answers from the **whole corpus**, not the near set, so a
  distant place can appear — labelled with its distance. Scoping it would hide
  Memorial Arena, which Atlas has not placed.
- The wet shortlist is **not distance-ordered** across directions.
- The intent chip says **119** and the result count says **120** for the same
  category — different pools.
- `unresolved` saved items surface a **count, not a name**.
- Atlas affordance vocabulary mixes activities with rules and facilities
  (`Pets on leash`, `Winter recreation` beside `Swimming`). Handled by taking
  only the best-evidenced few; not solved.
- Near-synonyms unresolved by design: `Hiking` 64 / `walking/hiking` 7 /
  `Hike` 3; `Cycling` 20 / `Biking` 13 / `mountain biking` 13.
- Locality field contains parsed address fragments — `Sparkling Pl Vernon`,
  `OTTAWA`. One Place is titled `Publisher-stated location`.
- **60 names held more than once** in Atlas, across 120 records (verified
  2026-10-10). Passport hides repeats for presentation only.

### Reported by a human, not independently verified

- **The entire signed-in experience.** I could not sign in. The `/saved` list,
  the intention controls, the sidebar link, duplicate prevention and board
  consistency are covered by tests against the real components — **not by a
  browser.** This is the single largest verification gap.
- The two board discrepancies that drove `fe2d543` were **reported from
  production screenshots**; the fix is verified by tests using the real
  production ids and kinds, not by a signed-in browser.

---

## 7 · Active missions and known conflicts

**Verified.** `project-management/prompts/active/` holds four `IMP-00x`
specifications, all last modified **2026-07-29** — roughly ten weeks before
this snapshot. `prompts/pending/` holds three more, same vintage.

**None of 2026-10-10's work went through those folders.** Today's missions
arrived as pasted briefs and were executed directly. So:

> **Conflict, stated rather than tidied:** the workspace constitution points at
> `project-management/prompts/` as the mechanism, and the actual mechanism in
> use is a conversation. The folders are not a reliable picture of what is
> active. **Unknown** whether the July specifications are still wanted,
> superseded, or abandoned — that is a question for Lorne, not something to
> decide by reading them.

`project-management/` is also **not version controlled**, so nothing in it is
recoverable if lost.

---

## 8 · Immediate next priorities

In the order I would take them, with the reasoning:

1. **Get a signed-in browser pass done** — by Lorne, or with a test account.
   Everything in §6's "reported, not verified" block depends on it, and no
   amount of test-writing substitutes.
2. **Atlas: age / child-suitability evidence.** It is the one gap that makes
   the primary scenario — _a five-year-old for eight hours_ — rest on a
   Passport word list. Nothing Passport can build removes that.
3. **Atlas: populate `coordinates` from the `happens_at` Place** for the 370
   candidates that state a town and no coordinates. Same join as the locality
   gap, and it roughly doubles what Discovery can place.
4. **Decide where a chosen day belongs**, so "Let's do it" can exist without
   overwriting Event start times.
5. **Investigate production's 7-second repeat read** of the candidate feed.

**Not a priority, and recorded so nobody re-derives it:** the doctrine's §15
open questions are open _on purpose_. Resolving one requires Lorne, not a
reading of the code.

---

## 9 · How to keep this file honest

Update it when something in §3, §5, §6 or §8 stops being true — in the same
change that makes it stop being true. If it drifts, trust the repository and
fix the file. A visible inconsistency is more honest than a hidden one; a stale
continuity document that nobody corrected is the hidden kind.
