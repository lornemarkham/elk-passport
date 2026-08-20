# Knowledge Acquisition

How Atlas comes to know a region, who decides what it learns, and how a person operates it today.

**Lives at** `/admin/knowledge` · **Source** `app/src/lib/knowledge/missions.ts`,
`app/src/components/atlas/missions.tsx`, `app/src/app/admin/knowledge/`
**Decision records** ADR 041 — _A Mission page is an operator's cockpit_ · ADR 042 — _Health measures
Atlas, not the world_

---

## 1. Product philosophy

### Missions are durable. Expeditions are finite.

A **Mission** is a standing responsibility for a kind of knowledge. An **Expedition** is a concrete
job inside one — _establish the named features of the Okanagan_, not _know geography_. Every mission
page leads with today's expedition, then the single step inside it, then the remaining steps as
`NOW → NEXT → THEN`.

Expeditions are a planning concept. Nothing persists one, and no model was added for them.

### Atlas acquires knowledge through Missions, not publishers

A **Mission** is a long-lived responsibility for an area of knowledge. It is not a source, not a job,
and not a run. Publishers come and go beneath a mission; the mission is a standing commitment.

Organising this area by publisher would mean rewriting it every time a source changed, and would
leave nowhere to record a responsibility Atlas has accepted but cannot yet meet — which is most of
them. Two of the six missions have no usable publisher at all. That is the most useful thing this
area says, and a publisher-shaped page could not say it.

### The page is for operating Atlas, not for reading about it

The five-second test: open a mission with coffee in hand and know the objective, the duration and
where to click, without scrolling.

Page order is operational first, reference last:

```
PART 1  Mission overview   Health → What it knows → Opportunities → Blockers
PART 2  Current expedition Today's target (command inline) → Remaining steps
        → All operations → After the run → Reference
```

Part 1 belongs entirely to the mission: how healthy it is, what it knows, what
would improve it. Part 2 is today's work, and never competes with the mission
title — a target is not the mission.

**The plan** is a three-or-four item queue — `next`, `then`, `blocked`,
`deferred` — with blockers beneath it. **Evidence waiting** reports what Atlas
refused to decide, read live from the run log via `buildMissionControl` so it
can never disagree with Mission Control.

**Today** carries the objective in the largest type on the page, with reason bullets, duration,
possible outcomes including the negative one, a button, and what comes next. **Reference** —
publishers, pipeline, troubleshooting, history, open questions — collapses into `<details>`:
complete, one keystroke away, never competing.

### Nothing is invented, including numbers that look derived

- **No coverage percentage.** Atlas has no denominator — nobody knows how many trails a region holds.
  The two progress meters measure _capability_ against Atlas's own asserted lists (publishers
  identified, subjects named), which is a real denominator and a different claim. The panel says so.
- **No approximated history.** Runs carry no mission tag, so no history is shown rather than a
  plausible one.
- **No publisher shown as working that has not been run.** Four tiers exist precisely to keep that
  line visible.

Every command printed is verified against `atlas/package.json` and the files it references. Every
implementation path resolves. Every failure behaviour was read out of the code that produces it.

### Health measures Atlas, not the world

Three instruments per mission — what it knows, evidence strength, publishers wired — **all counted
over that mission's own entities**, scoped through `CATEGORY_RULES`. Each states its rule, its data
source and what moves it, behind a disclosure. A cross-cutting mission reports _Not scopeable_ rather
than borrowing corpus numbers. There is no overall score: any
weighting across them would be invented.

`unknown` is a legitimate reading. Per-publisher uptime and backlog growth rate are both unknown
because Atlas records neither, and the instruments say so rather than approximating.

### Human review is split by cause

The distinction that matters more than the count:

- **Genuine curator judgement** — Atlas narrowed the problem and stopped because deciding is
  irreversible. Identity, source conflict, relationship uncertainty.
- **Missing evidence** — Atlas raised a decision because it could not gather enough. Ambiguous
  extraction, failed source, unsupported field.

A backlog of the second kind is a source problem wearing a curator's clothes. Measured on the live
corpus: **7 genuine judgement, 64 missing evidence, 48 unclassified.**

### Honest absence beats a confident blank

A section that does not exist says _not built yet_, names what it will hold, and gives the real
reason it is absent. It never shows a greyed-out chart, a skeleton row, or a disabled button — those
teach an operator that the thing exists and is merely slow.

---

## 2. Mission architecture

### The six missions

| #   | Mission                      | Status      | Creates             | Next step today                                      |
| --- | ---------------------------- | ----------- | ------------------- | ---------------------------------------------------- |
| I   | Geography & Natural Features | Operational | Place               | Investigate a named feature the corpus does not hold |
| II  | Recreation                   | Ready       | Place, Activity     | Run the OpenStreetMap sweep — it has never been run  |
| III | Food & Drink                 | Operational | Place, Organization | Drain the queue before adding more sources           |
| IV  | Accommodation                | Planning    | Place, Organization | Decide what Atlas may say about a place to sleep     |
| V   | Events                       | Planning    | Event, Organization | Nothing, until a fact can expire                     |
| VI  | Organizations & Communities  | Operational | Organization        | Find an enumerating source                           |

### Mission status

| Status        | Means                                                                          |
| ------------- | ------------------------------------------------------------------------------ |
| `operational` | This mission has produced real entities from at least one publisher            |
| `ready`       | Publishers are aimed at this mission and nothing has been run through them yet |
| `planning`    | No source has been chosen for this mission. Nothing has run                    |

Worded so no combination on a mission row contradicts itself. A `planning` mission may still count a
_usable_ publisher — `WebsiteSourceLoader` exists and would work for hotels — because usable is a
statement about the loader and planning is a statement about whether anyone has aimed it.

### Publisher tiers

| Tier                 | Means                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------- |
| `operational`        | A loader exists and this mission has actually been run through it                      |
| `ready`              | A loader exists in the codebase; this mission has not been run through it yet          |
| `planned`            | Deliberately identified as valuable. No loader exists and none is being written        |
| `research-candidate` | Possibly valuable. Access, licensing and API suitability **have not been established** |

The fourth tier holds a hard line: a source whose terms nobody has read is a candidate for research,
never a capability. Trailforks and AllTrails appear on the Recreation page and each says so in its
own entry.

### Subjects, and honest gaps

Each mission lists the kinds of thing it is trying to learn, and whether Atlas can currently reach
each one. Recreation reaches 8 of 12. **Trails and trailheads are among the four it cannot** — there
is no trail tag in `osmPoiAllowList.ts` and no trail publisher is wired. Listing trails without
saying so would present an ambition as a capability; omitting them would make the mission look
smaller than it is.

---

## 3. Operator workflow

### The pipeline, in Atlas's own vocabulary

The ten stages are the curator-facing labels in `runData.ts` (`STAGE_LABEL`), which map to event
names `RunRecorder` writes. No friendlier pipeline was invented for the page, because a second
vocabulary would mean translating when reading a run log.

```
1  Discovered    source-discovered      you choose a page or a bbox
2  Fetched       source-fetched         the loader retrieves it
3  Verified      source-verified        real content region, or whole-body
4  Understood    knowledge-extracted    OpenAI + Nominatim — the only stage that costs money
5  Reviewed      review-completed       autoApproveReviewGate: approval is automatic
6  Recognised    entity-matched         duplicate guard merges rather than duplicating
7  Created       entity-created         a new entity in the corpus
8  Connected     relationship-created   a separate batch job, run afterwards
9  Placed        (records no event)     region membership is asserted, never inferred
10 Finished      run-completed          — except batch-ingest, which records nothing
```

### The four separate workflows

The most common misunderstanding in the system. These do not chain automatically:

1. **Discovery** finds sources. It writes candidate sources and, at most, an identity awaiting
   confirmation. It never creates entities (ADR 031 §2).
2. **Identity confirmation** resolves what a thing is called. It is irreversible and belongs to a
   human.
3. **Ingestion** creates entities — `batch-ingest`, or reading the queue.
4. **Region placement** asserts membership — `define-region --assign` or `grow-region`. Atlas never
   infers it from coordinates.

Completing the first does not begin the second.

### Publisher failure behaviour

`ProviderOutcome` is three values, and the rule in `DiscoveryProvider.ts` is load-bearing:

> `failed` may never be reported as `none-found`. One is a fact about the request; the other is a
> fact about the world.

Bounds are 15 seconds for every Discovery publisher, and 30 seconds for Overpass — longer because
Atlas's own query asks the server for up to 25, and a client bound shorter than a server budget Atlas
itself requested would report Atlas contradicting itself as a transport failure.

**BC Freshwater Atlas has a second-order failure worth knowing.** It is the only publisher returning
a published area, and `proposeIdentity` tests geographic agreement by containment in a published area
rather than by a radius. Its failure removes the geographic test entirely, and the run reports
_no-convergence_ rather than _failed_ — a degraded run that reads like a confident negative unless
you know.

### Terminal-assisted operation

Nothing executes from the browser. Each operation prints purpose, when to use it, prerequisites, the
exact command with a copy button, the expected result, what to check, and its known failures with
recoveries.

Real operations available today, by mission:

| Mission               | Operations                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Geography             | `discover`, `batch-ingest` (Wikipedia)                                                                              |
| Recreation            | `batch-ingest` (OSM sweep, BC Parks, operator sites), `probe-source`, `compute-near-relationships`, `define-region` |
| Food & Drink          | `expand-directory`, `run-queue`                                                                                     |
| Organizations         | `expand-directory`                                                                                                  |
| Accommodation, Events | none — and the page says so rather than offering a button that does nothing                                         |

---

## 4. Engineering decisions

Recorded in full in **ADR 041**. In summary:

1. A Mission page answers _what should I do next?_; everything else supports it.
2. A publisher must state how it fails and what the operator does about it.
3. Four publisher tiers — listing only the wired ones is a lie of omission.
4. The pipeline is described in the vocabulary Atlas already records.
5. Troubleshooting states the wrong reading beside the right one.
6. No invented numbers, including ones that merely look derived.
7. `Operation` is the execution seam, and it is already the right shape.

### Design language

Rows not cards — with exactly one exception, the operation card, because an operation genuinely is a
discrete object and the border is the boundary of _everything you need for this step_. One type
scale. Space and thin rules carry hierarchy; colour means status and nothing else. Fraunces on
mission names and section headings, which is the app's existing heading voice rather than a new
typeface. No icons anywhere in Knowledge Acquisition: six missions would have meant six decisions
about what a mountain looks like, each worse than the word.

### Accessibility

- `--muted-foreground` darkened `oklch(0.48 0.03 60)` → `oklch(0.44 0.03 60)`: 4.5:1 → 5.2:1 against
  the ivory background. Same hue, same chroma.
- Opacity variants of that token removed — a token at 70% opacity was failing AA outright.
- Operational body copy at 13.5–15px. Status encoded three ways: glyph, word, then colour.
- A section index under every mission header, so a keyboard user is not obliged to tab through a
  runbook.

---

## 5. Roadmap

### Next milestone — mission-aware run recording

Two changes, both in the Atlas repository, that together make Recent activity real on all six
missions at once:

1. A `mission` field on `IngestionRun` (`application/observability/IngestionRun.ts`).
2. `RunRecorder` wired into `batchIngestCli` — today it is wired into the queue, region-growth and
   discovery commands but not into batch ingestion, so a batch run leaves no entry at all.

Until then, the only evidence a batch ran is the entities it created. The page says exactly that.

### After that

- **Region Health.** `computeRegionHealth` is the foundation; the eventual shape is a set of
  instruments per region, not one percentage. Blocked on mission-tagged runs, a per-region evidence
  join, and a freshness signal. See ADR 042.
- **Structured review reasons.** Categories are currently assigned by regex over event messages.
  Emitting a typed reason where a decision is raised would remove the heuristic entirely.
- **Publisher health, observed rather than described.** Every failure behaviour on the page today is
  documented, not measured. Recording publisher outcomes over time turns the Publishers section from
  a manual into a status board.
- **Browser execution.** Binds to `Operation.id`. Blocked on policy, not architecture: who may start
  a run, what happens when two run at once, how a curator stops one.
- **Coverage with a denominator and a source.** "BCGNIS lists 412 named lakes in this region; Atlas
  holds 168" is honest. A percentage is not, until a publisher can be asked for a complete count.

### Mission-specific work

- **Recreation** — add trail and trailhead tags to `osmPoiAllowList.ts` and widen the sweep to ways
  and relations. That single change moves three subjects from _Not yet_ to _Reachable_. Then evaluate
  Recreation Sites & Trails BC.
- **Geography** — a write path from a structured record, so an OSM relation or a Freshwater Atlas
  polygon can become an entity.
- **Accommodation** — an ADR drawing the line between describing a place and quoting its price.
- **Events** — a temporal model. Nothing else in that mission should move first.

---

## 6. Lessons learned

**Accuracy is not usefulness.** The first two versions of this page were factually impeccable and
operationally useless. Nothing on them was wrong; they simply did not contain the things a person
needs at the moment they are doing the work.

**The acceptance test was one real run.** Running `npm run discover -- "Hidden Lake" --region
"Okanagan"` and reading the output raised four questions the page could not answer. That single
observation produced the publisher failure fields, the troubleshooting section and the enriched
recommendation. A page for operating something should be tested by operating it, not by reading it.

**The most expensive error in this system is a misread outcome, not a bug.** `failed` and
`none-found` are correctly distinguished all the way through the code and then handed to a human with
no reason to know the distinction exists. An operator who records a timeout as an absence has created
a false negative nothing downstream will correct. The fix was interface, not code.

**Second-order failures need stating explicitly.** BC Freshwater Atlas failing does not just lose one
publisher — it removes the geographic test from identity reconciliation entirely, and the run then
reports _no-convergence_. Nobody would derive that from the publisher list.

**Listing only what is built makes a mission look smaller than it is.** Recreation read as a
two-source problem for two versions. It is a ten-source problem with two sources built, and the
difference changes what you plan.

**Render every page, not the exemplar.** Two copy defects — "the rest are shown" when there was one
publisher, and a Recreation-specific sentence appearing on Events — were only visible on the pages
nobody was designing.

---

## 7. Finishing a mission (V8)

The page could start work and could not finish it. Everything it showed described; the only thing
that acted was a command block, and everything the command produced was reported on another screen.
A mission an operator cannot finish is documentation.

### The ingestion lifecycle has four states, and all four are on the page

Everything Atlas produces lands in one of these, and the mission page shows every one of them,
scoped to that mission:

| Bucket                  | Meaning                                     | The operator           |
| ----------------------- | ------------------------------------------- | ---------------------- |
| **Added automatically** | Atlas had enough evidence and wrote.        | Does nothing.          |
| **Needs your decision** | One irreversible question, narrowed.        | Answers it, here.      |
| **Needs more evidence** | Atlas cannot responsibly ask a yes/no yet.  | Acquires, or abandons. |
| **Failed or refused**   | A machine failure, or a deliberate refusal. | Retries, or leaves it. |

_Failed_ and _refused_ are separated on purpose. A page that could not be read and a page Atlas read
and declined to write from are opposite events, and they used to render identically.

### Decisions are answered here

Duplicate groups and relationship candidates that touch this mission's entities are answered on the
page, yes or no, through the same functions `/admin/duplicates` and the region workflows already
call. Nothing is reimplemented. Mission Control is unchanged and remains the Atlas-wide view.

Every question states what _yes_ does, what _no_ does, and why Atlas refused to decide alone — the
gate is reversibility, never confidence, so a question is here precisely because it cannot be undone.

Saying _no_ to a duplicate group is not persisted, and the page says so: Atlas has nowhere to record
"these are two different things", so the group returns on the next scan.

### Work is attributed by entity, never by run

Runs still carry no mission tag. Events carry an `entityId`, and entities group into missions — so a
mission's post-run work is found by that join. Three bases, each stated on the item that used it:
`entity` (exact, the only basis a decision is offered on), `subject-name` (failures create nothing,
so an exact case-insensitive name match groups them for display only), and unattributed — counted
and stated, never folded in.

_The most recent Recreation run_ means **the most recent run that recorded an event against an
entity in Recreation's scope**, and the page prints that definition.

### Passport Ready is not Atlas completeness

Atlas can hold a corroborated, canonically identified lake with no picture and no sentence. Passport
Ready asks a narrower question: does the entity have the fields a traveller-facing section actually
renders — a name, a description, a picture, and for a Place a location?

No percentage. An entity is _Passport Ready_ or _Needs enrichment_ followed by the names of what is
missing, because "72% ready" is not actionable and "needs a picture" is. It is kept out of the health
grades deliberately: combining "is Atlas working" with "is this presentable" is a weighted score, and
it would hide which of the two is wrong.

### Every opportunity and blocker ends in an action

Publisher · what it adds · **why it matters** · **next action**. The next action is derived from the
publisher's status by one shared rule rather than authored per publisher. `Blocker.action` is a
required field — a blocker cannot be added without saying what to do about it.

### Done is three conditions, not a score

Atlas has run against this mission · no decision is waiting · every queued page is read or abandoned.

There is deliberately no condition about coverage. _"Recreation is complete"_ has no denominator.
_"Today's work is complete"_ does, and it is the question an operator actually has.

**Abandon exists so the queue can reach empty.** Without it condition three is unreachable.
`CandidateSourceStatus` already carried `'rejected'` and nothing could set it; a thin route now does,
keeping the row and its provenance rather than deleting it.

---

## 8. The first mission performed on the page (2026-08-20)

Recreation's _"Place the new Recreation entities in the Okanagan"_ is now done on the Recreation
page. The operator sees every unplaced entity, places them one at a time or several at once, and the
count comes back from Atlas.

**It needed no new backend.** The button calls `POST /api/admin/regions/:id/members`, which reaches
`RegionMembershipService.assert()` — the same service `npm run define-region` calls, and the same
route the region workspace already used. The page gained a caller, not a capability.

### What the operator sees

Each row carries **name · category · coordinates**. OpenStreetMap names POIs "Viewpoint" and "Boat
Launch", so two rows can share a name and still be two different places; the category and the
coordinates are what make them distinguishable. **Nothing is hidden because a source named it
badly** — an unnamed place is still work, and still placeable.

### Why the numbers cannot lie

`unplacedEntities()` is one exported filter used by both the row list and the `allPlacedInRegion()`
condition. The list empties for exactly the reason the mission turns complete.

A row is marked placed only when Atlas's own response names it; anything Atlas did not confirm stays
in the list with the reason attached. `router.refresh()` then re-reads membership and re-evaluates
every mission — the row disappearing and the count dropping are two readings of one fact, not a
local counter.

### The command did not go away

Where the page can do the work, the command moves behind _"Or run it from the terminal"_. It is
still verified, still correct, still there for an engineer. It is no longer the instruction.

### What is deliberately not offered

**No "Place all".** The service takes an array, so bulk placement is trivial — but no route removes
a `contains` edge, so it would be an irreversible one-click action. Atlas automates reversible work
and reviews irreversible work. Per-row and explicit multi-select are both deliberate acts;
`DELETE /admin/regions/:id/members` is the prerequisite for the third.

---

## 9. The MVP loop, and how a mission finishes (2026-08-20)

The definition of done for this stage was one sentence: **I can stay on the Recreation page until
Atlas truthfully tells me there is no current Recreation work left to do.** Not _the CLI is gone_ —
that was a deliberate change of direction. A CLI command is an **Operation**, Operations change
reality, and running one in a terminal is an accepted shape. What was missing was not automation.
It was the page telling the truth about what happened.

### Run the Operation, come back, Refresh

Everything on a domain page is derived from facts Atlas already holds, so **re-reading is the whole
mechanism**. There is no job system, no websocket, nothing to poll — those would be infrastructure
built to avoid pressing a button.

So the button is first-class. `RefreshStatus` sits in the page header next to the status line and
calls `router.refresh()`. The server component re-reads Atlas, re-evaluates every mission, the work
queue, health and Passport readiness, and re-renders. A mission that needs a command shows the
command; the operator runs it, comes back, and presses Refresh.

### Every mission has a visible finish

Derived progression has one honest cost. The instant a mission's conditions turn true the _next_
mission becomes current — and a server render has no memory of a previous state. So an operator who
ran a command and refreshed saw a different mission and no acknowledgement that the old one
finished. **The work succeeded and the page said nothing.**

`MissionTransition` fixes that with browser memory of the last visit, deliberately not a stored
status. A stored status is the asserted pointer we removed; it can disagree with the corpus. What
was actually missing is not a fact about Atlas but a fact about **this operator's last visit** — so
that is what is stored, in `localStorage`, and every message is worded _since you last looked_.

- **✓ Mission complete** — names the mission that finished and what became current in its place.
- **Update available** — the domain was complete when last seen and is not now. Worded as _update
  available_ rather than _no longer complete_, because the earlier completion was correct against
  the evidence that existed then. New evidence created new work. **Nothing that was done becomes
  undone.**

Clear the browser and you lose the greeting, not the truth. The mission roster still shows exactly
which missions are complete, because that is derived.

### The page tells one story, top to bottom

Status → what finished since you last looked → **Current Mission** and its work surface → what needs
you (or CURRENT KNOWLEDGE COMPLETE) → the mission roster → what the domain knows → Passport
readiness → Reference.

Health moved into Reference. It answers _is Atlas working_, which is a real question and not
today's question.

### What "complete" is allowed to mean

**✓ CURRENT KNOWLEDGE COMPLETE**, and never more than that. Not _Atlas knows every recreation place
in the Okanagan_ — that claim has no denominator and never will. The claim being made is narrower
and entirely true: everything Atlas currently knows about has been processed, and every mission that
could be started has finished.

Which is precisely why it can stop being true without anything having been wrong.

### One thing that looked right and was not

The transition banners were first rendered `hidden` and revealed by `removeAttribute` in an effect,
to satisfy a lint rule about setting state in effects. It typechecked, it linted, and it never
showed a banner: React Strict Mode double-invokes effects, the remount restored `hidden`, and the
second run read its own `localStorage` write and found nothing to announce.

No static check could have caught it. **A lint workaround that changes the rendering strategy is a
design change — test it live.**
