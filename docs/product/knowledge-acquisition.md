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

---

## 10. The domain page is a sequence (2026-08-21)

> A Knowledge Domain is operated as an ordered sequence of finite missions. The current mission is
> the working surface. Completed missions collapse, and the next unfinished mission becomes current
> from derived Atlas facts.

### The problem was six true answers

The page carried a current mission, a work queue, a mission roster, health, Passport readiness and
Reference. Every one of them was accurate. None of them was _the_ answer, and working out what to
do next meant holding all six in your head at once and reconciling them.

There is now one spine: an ordered list of missions, worked top to bottom.

```text
✓ 1. Sweep Ellison Provincial Park                        COMPLETE   collapsed
✓ 2. Resolve the duplicates the sweep created             COMPLETE   collapsed
○ 3. Place the new Recreation entities in the Okanagan    CURRENT    open
      12 ready to place · 5 need more evidence
○ 4. Ingest Ellison Park and Kalamalka Lake Park          NEXT       collapsed
○ 5. Make every provincial park presentable               NEXT       collapsed
— 6. Acquire trails and trailheads                        BLOCKED    collapsed
```

### Nothing new decides which panel is open

`evaluateDomain` had already chosen the current mission — the first that is neither complete nor
blocked. The accordion sets `open` from that and from nothing else. There is no stored open-state,
no click that advances a mission, and no second answer to _which mission is current_; that second
answer is precisely the defect that once made a page say **Mission complete** and **NOW** in the
same breath.

So the loop is unchanged and now visible:

```text
Operation changes Atlas → Refresh → conditions re-evaluate →
mission completes → it collapses → the next one opens
```

### Each state shows a different thing, deliberately

**Complete** shows the conditions that make it true, read from Atlas just now rather than recorded
when it happened — and **no controls at all**. In a page worked top to bottom, a stale control is
worse than a missing one: it pulls attention backwards past the mission that actually needs it.

**Current** is the only panel with controls: Execute · Review · Complete, with the Refresh button
inside Execute, where the instruction to press it belongs.

**Next** shows the objective, the reasons, the conditions it will be graded on, and what it is
waiting for. No controls, because starting it now would be working out of order against a page
whose whole purpose is order.

**Blocked** shows the blocker and, where no command exists, says **operation not built yet**. That
is a truthful blocker. Drawing a button for an operation nobody has written would be the more
expensive mistake.

### Order guides, but facts still win

The authored order is the intended path. A later mission whose conditions are already true renders
complete anyway, out of sequence and without argument. Nothing invents a dependency to keep the
list tidy — derived reality outranks expected sequence.

### Work sits inside the mission that owns it

`Mission.owns` names which kinds of outstanding work a mission is responsible for, declared in the
catalogue beside `surface`. Placement work and its needs-more-evidence half now live inside the
placement mission; enrichment lives inside the Passport mission.

What no mission claims stays on the page as **Not tied to a mission**, secondary, and says why: a
failed fetch belongs to a run and a queued page belongs to a source. Inventing a mission to house
them would assert a relationship Atlas cannot see.

### Passport readiness is not a gate

It is the done-condition of exactly one mission — _make every provincial park presentable_ — and
no earlier mission is held up because a park has no photograph. Elsewhere on the page it is
Reference.

### A blocked capability is not unfinished work

When everything actionable is complete, the page shows **✓ CURRENT KNOWLEDGE COMPLETE**, and blocked
missions are listed below it under **Future capability** with their blockers. They are not in the
tally. _5 of 6 missions_ against a mission nobody can start would make a finished body of work read
as unfinished forever, which is a different and false statement.

---

## 11. Atlas proposes the merge (2026-08-21)

> The mission is not _resolve the duplicates_. It is **review Atlas's merge recommendations**.

That wording is the product decision, and the old wording is what let the surface get away with
showing a curator six near-identical cards and no opinion.

### The surface was asking the curator to do Atlas's job

A duplicate group arrived as a list of records and a yes/no. The surviving record was
`group.entities[0]` — whichever the scan happened to return first. Nothing on the page answered:
which record already exists, which one Atlas recommends keeping, why it believes they are the same
thing, what information would be lost, or what each extra record actually contributes.

Every one of those is a question Atlas can answer from facts it already holds. It simply was not
being asked to.

### Choosing a survivor without inventing a score

A weighted score would be a confidence number wearing a different word. Instead the survivor is
chosen by a **lexicographic order over observable facts**, and the first criterion on which the
records genuinely differ becomes the reason shown:

1. **Already placed in the region.** A curator has already asserted this record belongs here.
   Merging into it keeps that decision; merging the other way discards it and asks again.
2. **Most relationships** — merging into the best-connected record repoints the fewest edges.
3. **Most describing sources.**
4. **Most external identifiers.**
5. **Most facts recorded.**
6. **Lowest id** — and this one is labelled as a tie-break, not a reason.

Where the mock-up said _confidence: high_, the page says what the scan actually checked: name and
position, or name alone. That is the honest version of the same information, and it is a value
`DuplicateGroupFinder` already produces.

### The detail view shows differences and nothing else

Repeating the shared name six times is what made the old list unreadable. Expanding a candidate now
shows only **new information** (fields the survivor lacks), **disagreements** (where the survivor's
value is kept and nothing is settled), and the name that becomes an alias. A record that adds
nothing says so in one line.

### The loss statement had to be earned, not asserted

`MergeService.merge` writes `{...survivor}` plus accumulated aliases and external identifiers. It
does **not** carry the absorbed record's own field values across — so before this change, merging
two records genuinely stranded the loser's description, picture and hours on an archived row, and a
page promising "nothing is lost" would have been lying.

The recommendation now computes those gaps and sends them as `fieldOverrides`, which `merge`
already accepts. Gaps are filled; a value the survivor holds is never overwritten; identity fields
never move. That is `mergeEntityKnowledge`'s rule, applied to a merge instead of an ingestion.

Live, on the real corpus, that is not hypothetical: the surviving
`recreational boating on Kalamalka Lake` was missing a picture the absorbed record had. It is now
carried across and named in the recommendation.

### Decisions are scoped more widely than measurements

`alsoHolds` keeps Activities out of a domain's category scope, because an Activity has no
coordinates and no image and never will — counting them as categories made Passport readiness
report a domain full of unpresentable places.

That separation is right for measurement and wrong for decisions. Recreation's two live duplicate
groups are both Activities, so scoping the review queue by category alone meant they belonged to no
domain and were shown to nobody. Measurement and decisions are different questions and now get
different sets rather than one compromise.

---

## 12. Recreation, operable end to end (2026-08-21)

Three things stood between the sequence and a truthful _caught up_. None of them was that the work
was hard; all three were missions that could not be **finished**.

### A current mission with no work and no instruction

The duplicate scan timed out, `noOpenDuplicates` graded `unverifiable` — which never completes a
mission — and the panel said _"Nothing in this mission is waiting on a judgement."_ Every word of
that was true, and the operator was stranded with no action and no way forward.

Two fixes, because there were two faults. The decision reads now get a **12-second budget** instead
of the 4 seconds set when they were cheap lookups; measured alone the scan answers in 0.4–1.4s, but
it runs beside the workspace bundle, the region list and a throttled sweep of run events against the
same Atlas process, and under that contention it intermittently passed 4s.

And the current mission now always says what is stopping it. When a mission has no countable work of
its own, the unsatisfied conditions **are** the work, each rendered with the missing fact and the
next thing to press. `unverifiable` gets its own instruction — _Atlas could not read this, so the
figure is unknown rather than zero_ — because "could not read" and "not done yet" are opposite
problems with opposite remedies, and an unticked box reads as the second when it is the first.

### Select all, restored

```text
☑ Select all      Clear selection            [Place selected (17)]
```

With an indeterminate state when only some rows are picked. Bulk placement is safe to _write_ — the
service takes an array — but no route removes a `contains` edge, so selection and commit stay two
separate deliberate acts. There is deliberately no one-click "place everything": the operator
selects, sees the count they are about to commit, and presses a button that names it.

### Enrichment is a blocked capability, not waiting work

Measured against the live corpus rather than assumed: every one of the twelve entities short of
Passport readiness is short of exactly one thing — **a picture**. Nothing Atlas can run acquires
one. No queued candidate source targets any of them (the queue is Big White pages and lakes), and no
wired publisher supplies park imagery. Running the queue would read pages about other entities and
change nothing here.

So the mission says exactly **"No enrichment operation exists yet."** and is blocked. Inventing a
task would have been the more expensive mistake. It can still complete on its own if the corpus
comes to satisfy it — BC Parks ingestion may carry images for the two parks in its own batch.

### Caught up, with capabilities still missing

Recreation now has **four actionable missions and two blocked capabilities**, and the completion
banner keeps those apart:

```text
✓ CURRENT KNOWLEDGE COMPLETE
All currently actionable Recreation work is finished.
Missions complete   4 of 4 actionable

Future capability
  Make every provincial park presentable to a traveller
  Blocked: No enrichment operation exists yet…
  Acquire trails and trailheads
  Blocked: no trail tag in the POI allow list…
```

A capability Atlas does not have yet is not unfinished work, and `4 of 6` would have made a finished
body of work read as unfinished forever.

---

## 13. Curators work on entities (2026-08-21)

> **Atlas performs work on sources. Curators perform work on entities.** The operator interface
> organises ingestion work around the entity being learned, with sources beneath it as evidence and
> inputs.
>
> A source queue is implementation detail. The operator's goal is to teach Atlas about an entity.

### The queue view had leaked into the operator experience

Thirteen discovered pages about Big White Ski Resort rendered as thirteen work items, each headed
_Big White Ski Resort_:

```text
Needs more evidence
  Big White Ski Resort   Summer operation      bigwhite.com/summer
  Big White Ski Resort   Lodging categories    bigwhite.com/plan-your-trip/accommodation
  Big White Ski Resort   Driving and parking   bigwhite.com/explore/transport/…
  …
```

Every row was true. The list was still wrong, because it left the curator asking whether those were
thirteen decisions, why the same name appeared thirteen times, and when Big White would be finished.
Atlas already knew all thirteen pages were about one entity — `expectedTargets` says so, and it is
the same field the reversibility gate reads. The interface had no business making a person infer it.

It now reads:

```text
Big White Ski Resort            MORE TO LEARN
Atlas already knows this entity. 13 discovered pages are waiting to be read.
Queued 13

WHAT ATLAS CAN LEARN
· Summer operation      · Lodging categories    · Driving and parking
· The core winter product · Winter beyond skiing · Core resort facts
· The dining directory  · Trail and village maps · Conditions and forecast
…
bigwhite.com
▸ Sources — 13
```

### More to learn is not needs evidence

| State              | Means                                                          | Remedy                     |
| ------------------ | -------------------------------------------------------------- | -------------------------- |
| **Needs evidence** | Atlas does not know enough to trust the entity or the decision | a different kind of source |
| **More to learn**  | Atlas already trusts the entity and has sources waiting        | read the queue             |

Big White is a valid entity with identity, location and provenance. Its queued pages are not proving
it exists; they are teaching Atlas about it. Filing that under _needs evidence_ told the curator
their corpus was weaker than it is, and buried the one thing they could act on.

### Four source states, from the two places Atlas records them

`ingested` → read. `rejected` → rejected. A broken fetch leaves the row **queued** in the database
and reports itself as a failed event, so `failed` is derived by joining on
`IngestionEvent.candidateSourceId` — never on name or URL.

A pass is complete only when nothing is queued **and** nothing failed. Seven of eight processed is
not done, and folding a failure into "complete" would report a finish on the strength of a broken
fetch.

### Completion is deliberately narrow

_No actionable source remains in this pass._ Not _Atlas knows everything about Big White_. Discovery
finding more pages tomorrow makes this work again, and today's completion will not have been wrong.

### Grouping is hierarchy, not deletion

Every URL, publisher, candidate status, reason and failure is one disclosure down, available
whenever provenance is the question. The curator should not need to open it.

### Pages that name no entity stay separate

Seventeen of them. They are not folded into any group, because Atlas refuses to process them for
exactly one reason — it does not know who they are about — and the app guessing a target would be
inventing the attribution the engine declined to invent. The page says **"No operator workflow
exists yet."** That is a real gap, and stating it is better than drawing a button for it.

---

## 14. Operations measure attempts, learning measures gains (2026-08-21)

> **Running an operation and learning nothing is still a completed operation.** Operations measure
> what Atlas attempted. Learning measures what Atlas gained. Those are different facts.

### The page lied, and the engine taught it to

Recreation said **13 pages waiting to be read** for Big White Ski Resort. Atlas had already read ten
of them. The operator ran `npm run run-queue`, Atlas fetched, extracted, recorded the run and
finished — and the page reported the same 13 pages still waiting.

`ProcessCandidateSourceService` moves a candidate to `ingested` on exactly three paths:
already-current, proposed, enriched. **Every other outcome returns early**, so a page that was
fetched, extracted, and could not be attributed keeps `status: "queued"` — and `queued` comes to
mean two opposite things:

```text
queued  ⟸  Atlas has never tried this page
queued  ⟸  Atlas read it and could apply nothing
```

Measured on the live corpus: thirteen Big White candidates, all `queued`, none with `resolvedAt`,
and **ten of them already had a SourceRecord**.

### Attempted is derived from evidence, not from status

A `SourceRecord` exists _because Atlas fetched that URL_. It is written before extraction runs, it is
durable, and it cannot be falsified by a status field nobody updated. Joining candidate to source
record on canonical URL makes _attempted_ true today, with no schema change.

| State              | Meaning                                         |
| ------------------ | ----------------------------------------------- |
| `unread`           | Atlas has not fetched this page                 |
| `applied`          | knowledge reached the entity                    |
| `read-not-applied` | fetched and extracted; nothing could be applied |
| `failed`           | the fetch itself broke                          |
| `rejected`         | a curator refused it                            |

### The completion rule now grades attempts

It was effectively `queued pages == 0`, which was wrong twice: it counted already-read pages as
unread, and it demanded an operation that would do nothing.

The mission asks **did Atlas process the discovered pages** — not _did Atlas learn anything_. A page
read without result no longer holds it open. It becomes its own piece of work with an honest next
action: _re-running the queue will not change these; this needs a pipeline change or a different
publisher._ A broken fetch does hold the mission open, because re-running genuinely acts on one.

Big White now reads:

```text
Big White Ski Resort                         MORE TO LEARN
Atlas already knows this entity. 3 of 13 discovered pages have not been attempted yet.

Discovered 13 · Processed 10 · Not attempted 3 · Read, nothing applied 10

WHAT ATLAS CAN LEARN
· Driving and parking   · Named properties…   · Airport, shuttles, transport
```

Only the three pages a run would actually reach are offered — listing what an already-read page
"can teach" is a promise the operation cannot keep.

### Failures are not hidden

When every page has been attempted and none applied, the entity reads **Read · nothing applied**,
with the result stated: Atlas kept every page it fetched and linked it as evidence, but could not
attribute what it extracted to the entity itself. That is not a tick and not a warning. It is a
completed operation with an unmet outcome.

### What Atlas should still add

The URL join is correct but indirect. Atlas should stamp the attempt on the candidate itself — a
`lastAttemptedAt`, or carrying `candidateSourceId` on the needs-attention events, which today record
only `sourceRecordId` and `entityId`.
