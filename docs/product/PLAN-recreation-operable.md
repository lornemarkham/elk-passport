# Implementation plan — make Recreation completable from its own page

**Status:** proposed, awaiting approval · 2026-08-19
**Would become:** ADR 045, amending ADR 041 §7 (which this plan proves was over-cautious)

---

## 0. Reconciliation — seven places where the repository contradicts the brief

Read this first. Three of these make the work **much smaller** than the brief assumes; one makes a
central part of it **impossible as specified**.

### 0.1 Placement already has a complete API path. The first slice needs no new backend.

The brief says _"find the existing service and reuse it through the appropriate API boundary"_, as
though that boundary must be built. It exists and is in use:

```
RegionComposition.tsx:412
  POST /api/admin/regions/:regionId/members          app proxy, token stays server-side
  → POST /admin/regions/:regionId/members            Atlas
  → new RegionMembershipService(store, ids).assert(regionId, entityIds)
```

`assert()` takes an **array**, de-duplicates it, is idempotent (returns `alreadyMember`), refuses a
non-region target, refuses nesting a region inside a region, and returns `{added, alreadyMember,
unknownIds}`. It is the same service `define-region` uses.

**So "Place the new Recreation entities in the Okanagan" is a UI wiring job.** No new route, no new
service, no domain change.

This also means a claim in our own docs is wrong. ADR 041 §7 and `HANDOFF.md` both say _"no button
starts work"_. That was true of **runs**. Placement is not a run, and the button has existed on the
region page for some time.

### 0.2 Operation execution is already solved, and ADR 041 §7 was over-cautious

ADR 041 deferred running operations from a page pending _"who may start a run, what happens when two
run at once, how to stop one"_. `POST /admin/regions/:id/grow` answered all three by not needing to:

```ts
// Not awaited. The response carries the run id; progress is read
// from the run's own events. A failure after this point belongs on
// the run, not on a request that has already been answered.
void growth.grow(...).then(r => recorder.finish(...)).catch(...)
sendJson(res, 202, { runId: recorder.runId, ... })
```

**202 + `runId`, work proceeds unawaited in the Atlas process, progress read from the run's own
events.** `ActivityStream` in `RegionWorkflows.tsx` already polls `/api/admin/runs/:id` against it.
Four routes use this shape today: `grow`, `candidate-sources/:id/learn`,
`candidate-sources/:id/read-targetless`, `discovery/named`.

No job system is needed. **The smallest safe architecture already exists**; missions 1 and 4 need one
more route in the same shape, not new infrastructure.

There is deliberately **no cancellation** and no concurrency control. Nothing has needed either. I
recommend not adding them: a second concurrent run is not corrupting — the store is upsert-semantic
and the duplicate guard is per-run — and inventing a cancel that cannot actually stop an in-flight
HTTP fetch would be worse than none.

### 0.3 The coverage model in the brief does not map to Atlas's data. This is the one blocking decision.

The brief's example:

```
1,000 candidates discovered / 1,000 reviewed / 700 placed / 300 rejected / 0 waiting
```

assumes a **candidate-place review queue**. Atlas does not have one. Measured just now:

| Population            | Reality                                                                                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidate **sources** | **40 corpus-wide** — 30 queued, 10 ingested. These are _pages to read_, not places. 20 carry `expectedTargets`, 20 do not.                                                       |
| Candidate **places**  | **Does not exist.** `IngestionPipeline` runs `autoApproveReviewGate` and persists. An extracted place becomes an entity immediately.                                             |
| "Rejected"            | **Does not exist.** `archivedAt` is on the entity types and `AtlasStore` says archiving is "save the same entity again with `archivedAt` set" — but **no API route exposes it**. |

So `1,000 / 1,000 / 700 / 300` cannot be computed, and no rewording makes it true. Inventing it would
be the exact failure the principles forbid.

**Two honest options. §3 recommends one.**

### 0.4 Duplicate "No" still has no persistence — confirmed, not assumed

`MergeRecord` records `{survivingId, absorbedId, mergedAt, reason}` and nothing else.
`DuplicateGroupFinder` recomputes groups from scratch on every scan. There is no record anywhere
meaning _"a curator decided these are different things"_, so a rejected group returns on the next
scan, forever. **A domain whose completion depends on "no open duplicates" therefore cannot stay
complete.** §7 proposes the smallest fix.

### 0.5 There are two regions, and `placedIds` unions both — a live defect · **FIXED 2026-08-19**

```json
[{ "name": "Shuswap Highland" }, { "name": "Okanagan" }]
```

`loadAtlasFacts` took `regions[0]` for `regionName` and unioned **every** region's `memberIds` into
`placedIds`. An entity placed in Shuswap Highland counted as "placed in the Okanagan", and the region
name on the page was whichever region Atlas returned first.

**Fixed.** `regionUnderConstruction.ts` asserts the Region and `placedIds` carries its members only —
see ADR 044's amendment. The defect was latent: Shuswap Highland holds no members, so no figure was
visibly wrong. Stage 0 of §9 is done.

### 0.6 Publisher freshness does not exist, so "8 / 8 publishers checked" cannot be derived

There is no `lastCheckedAt` anywhere. The publisher set is authored in `knowledgeDomains.ts`; the
only observable trace of a publisher being consulted is a run event carrying a `sourceType`. §3
proposes what can honestly be said instead.

### 0.7 Live Recreation data, measured 2026-08-19

```
23 entities in Recreation categories · 5 placed in the Okanagan · 18 unplaced
parks 9 · resorts 5 · water-access 3 · viewpoints 3 · campgrounds 2 · beaches 1 · golf 1
trails 0 · cycling 0 · winter 0 · climbing 0
```

The unplaced 18 include **unnamed OpenStreetMap POIs**: `Viewpoint`, `Viewpoint`, `Boat Launch`,
`Campground`. A placement list showing two rows both labelled _Viewpoint_ is unusable — the UI must
disambiguate by category and coordinates. Worth knowing before designing the row.

---

## 1. Current-state diagnosis — why the mission cannot be completed today

**Nothing is missing from the backend. The page simply never asks.**

```
Recreation page
  → MissionHeader renders mission.operationId → Operation.command
  → prints `npm run define-region -- "Okanagan" --assign "…"` with a Copy button
  → STOP. The page has no list of what is unplaced and no action.

What already exists, unused by this page:
  POST /api/admin/regions/:regionId/members  { entityIds: string[] }
    → POST /admin/regions/:regionId/members
    → RegionMembershipService.assert()
    → store.saveRelationship(contains)  ·  returns { added, alreadyMember, unknownIds }
```

The mission's done-condition `allPlacedInRegion()` already computes the exact list the UI needs —
`ctx.entities.filter(e => !ctx.placedIds.has(e.id))` — and already renders three of their names as
prose. **The data is on the page; only the affordance is absent.**

---

## 2. Mission-by-mission audit

| #   | Mission                                                   | Completion evidence                                                                     | Operator actions                          | On-page today?          | Missing capability                                                                                                                        | Smallest fix                                                                                                                         |
| --- | --------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Sweep Ellison for recreation POI                          | `holdsSomethingIn(campgrounds, viewpoints, water-access, beaches)` — real, already true | Run `batch-ingest`                        | **NO**                  | No API for batch ingestion                                                                                                                | `POST /admin/batch-ingest {batchFile}` in the `grow` shape (202 + runId). Allow-list the batch files under `src/ingestion/batches/`. |
| 2   | Resolve the duplicates the sweep created                  | `noOpenDuplicates()` — real                                                             | Yes / No per group                        | **PARTIAL**             | _Yes_ works (`/api/admin/merge`). _No_ is not persisted (§0.4)                                                                            | `NotDuplicateRecord` — see §7                                                                                                        |
| 3   | **Place the new Recreation entities**                     | `allPlacedInRegion()` — real, 18 remaining                                              | Place each                                | **NO → YES in stage 2** | Only the UI                                                                                                                               | List + `[Place]` → existing members route                                                                                            |
| 4   | Ingest Ellison Park and Kalamalka Lake Park from BC Parks | `namedPlacesHaveSource(['Ellison','Kalamalka'], 'bcparks')` — real                      | Run `batch-ingest`                        | **NO**                  | Same as #1                                                                                                                                | Same route as #1                                                                                                                     |
| 5   | Make every provincial park presentable                    | `categoryPassportReady('parks')` — real                                                 | Add description, image, location per park | **PARTIAL**             | `GET/POST /admin/entities/:id/enrichment` exists (propose → apply) but nothing on this page uses it; **images are not acquirable at all** | Wire enrichment for description/hours; state the image gap honestly                                                                  |
| 6   | Acquire trails and trailheads                             | `holdsSomethingIn(['trails'])` — real                                                   | —                                         | **NO, correctly**       | Needs `osmPoiAllowList.ts` change or a trail publisher                                                                                    | Nothing. It is `blocked`, which is the honest state.                                                                                 |

**Three of six become completable on-page with one new route (#1, #4) plus UI (#3).** #2 needs a
small domain addition. #5 is partly reachable and partly a real gap. #6 should stay blocked.

---

## 3. Coverage model — what Atlas can truthfully say

### Recommendation: define the snapshot over populations Atlas actually has

| Term               | Definition                                                                                                                                    | Denominator                                 | Evidence                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------- |
| **Known**          | Entities matching this domain's `CATEGORY_RULES`                                                                                              | — (a count, not a ratio)                    | `/admin/entities` + `CATEGORY_RULES`                                              |
| **Placed**         | Known entities with a `contains` edge from **this region**                                                                                    | of Known                                    | `/admin/relationships`                                                            |
| **Corroborated**   | Known entities with ≥2 distinct source types                                                                                                  | of Known with ≥1 source                     | `describes` edges → source records                                                |
| **Passport ready** | Known **places** with name + description + image + location                                                                                   | of Known places                             | entity fields, `passportUsage.ts`                                                 |
| **Waiting**        | Open duplicate groups + pending relationship candidates touching Known, plus queued candidate sources whose `expectedTargets` intersect Known | —                                           | `/admin/duplicates`, `/admin/relationship-candidates`, `/admin/candidate-sources` |
| **Sources read**   | Distinct source types with ≥1 `describes` edge into Known                                                                                     | of the domain's **authored** publisher list | `knowledgeDomains.ts` + `describes` edges                                         |

**Rejected is deliberately absent** — Atlas has no such population (§0.3). The snapshot says so in
one line rather than showing `0`, which would claim nothing was ever rejected.

**"Discovered" is deliberately not used** as a headline. It means _candidate sources_ in Atlas's
vocabulary — pages, not places — and using it for places would be exactly the "do not mix
incompatible populations" error the brief warns against. Queued candidate sources appear under
**Waiting**, labelled as pages.

### The alternative, and why I am not recommending it now

A real candidate-place review queue would make the brief's numbers literal: the pipeline would stop
persisting on `autoApproveReviewGate` and park proposals in a `pending` state for accept/reject.

That is a **policy reversal**, not a feature. Atlas's rule is _automate reversible work, review
irreversible work_, and creating an entity from a cited source is reversible (archive it). Gating it
would put a human in front of the most common, most reversible operation in the system, and it would
invalidate every "Added automatically" count. **It needs its own ADR and a deliberate decision — it
should not arrive as a side effect of a UI improvement.** Recorded as a future opportunity, not
committed.

---

## 4. Recreation page, top to bottom

```
Recreation                                        ◐ Ready
23 known · 5 placed in the Okanagan · 18 to place · 0 decisions waiting

┌─ COVERAGE SNAPSHOT ───────────────────────────────────────┐
│  KNOWN 23   PLACED 5/23   CORROBORATED 7/23               │
│  PASSPORT READY 2/23      WAITING 0                        │
│  Sources read 3 of 8 publishers this domain has identified │
│  Atlas records no rejections — see Reference.              │
└────────────────────────────────────────────────────────────┘

━━ MISSION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Place the new Recreation entities in the Okanagan   18 remaining

1 EXECUTE
   Okanagan Mountain Provincial Park   park            [Place]
   Kekuli Bay Provincial Park          park            [Place]
   Viewpoint  50.21, −119.44           viewpoint       [Place]
   …                                        [Place selected (0)]
   ▸ Or run it from the terminal

2 REVIEW            0 questions
   Nothing is waiting on your judgement.
   ▸ What else the last run produced

3 COMPLETE          1 left
   ○ Every entity is placed in the region — 18 unplaced

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Missions              3 of 6 complete   (roster, unchanged)
What Recreation knows (category roadmap, unchanged)
Ready for Passport    (compressed to a line + gaps)
▸ Reference — domain health · opportunities · blockers · publishers ·
              operations · pipeline · troubleshooting · Atlas-wide backlog
```

**Moved into Reference:** the three health instruments, Biggest opportunities, blockers, the full
runbook, publishers, pipeline, troubleshooting, Atlas-wide backlog. **Nothing is deleted.**

**Completion, when the last one is placed:**

```
   ✓  MISSION COMPLETE
      Placed all 18 Recreation entities in the Okanagan
      23 known · 23 placed · 0 unresolved

      Next: Ingest Ellison Park and Kalamalka Lake Park   [Start]
```

and when every mission is complete, the snapshot carries the domain-level `DONE`.

---

## 5. Region landing status — derived, never stored

`evaluateDomain` already returns `{missions, current, completed, total}`. Three states fall out of it
plus one new fact:

| State                  | Derivation                                        |
| ---------------------- | ------------------------------------------------- |
| **BUILDING**           | `completed < total` and `current` exists          |
| **CURRENTLY COMPLETE** | every non-blocked mission is `complete`           |
| **UPDATE AVAILABLE**   | previously complete **and** new work has appeared |

The third needs the only genuinely new signal: _new work since the domain last had none_. It is
derivable without a status field, from **`discoveredAt` on candidate sources and `at` on run events**
— both already persisted. The rule:

> A domain is **UPDATE AVAILABLE** when it has no incomplete non-blocked mission, and the newest
> `discoveredAt`/event timestamp touching its entities is **later than** the oldest timestamp among
> the facts that satisfied its last incomplete condition.

That is derivable but fiddly. **Simpler and equally honest for now:** a domain with no incomplete
mission shows **CURRENTLY COMPLETE** with _"as of <newest evidence timestamp>"_; when new candidate
sources or entities appear the timestamp moves and any newly-unsatisfied condition flips the domain
back to **BUILDING**. `UPDATE AVAILABLE` becomes a rendering of _complete → not complete_ once we can
compare against a previous observation, which needs one durable row per domain per observation.

**Recommendation:** ship BUILDING / CURRENTLY COMPLETE now, both fully derived. Defer UPDATE
AVAILABLE to stage 5 and implement it as a tiny append-only `DomainObservation {domain, observedAt,
completeMissionIds[]}` — the smallest durable thing that can distinguish _"new work"_ from _"work
that was always there"_. Without it, "37 new candidates" is not distinguishable from "37 candidates
you never finished".

---

## 6. API and domain changes

| #   | Change                                                                                                                         | Where                                 | Size | Needed for                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- | ---- | ------------------------------------ |
| A   | **Nothing** — reuse `/api/admin/regions/:id/members`                                                                           | —                                     | 0    | Mission 3                            |
| B   | `POST /admin/batch-ingest {batchFile}` → 202 + runId, in the `grow` shape; batch file allow-listed to `src/ingestion/batches/` | `atlas/src/api/server.ts` + app proxy | S    | Missions 1, 4                        |
| C   | `POST /admin/entities/:id/archive` → sets `archivedAt`                                                                         | `atlas/src/api/server.ts`             | S    | Rejecting a place (§7)               |
| D   | `NotDuplicateRecord` + `POST /admin/duplicates/not-duplicate`                                                                  | Atlas domain + route                  | M    | Mission 2's "No"                     |
| E   | `DELETE /admin/regions/:id/members`                                                                                            | `atlas/src/api/server.ts`             | S    | Makes bulk placement reversible (§8) |

**B is the load-bearing one.** It is the difference between three of six missions being operable and
one of six.

### Batch actions — recommendation

`RegionMembershipService.assert()` is already batch-native and idempotent, so **`[Place selected]`
is safe and free**. I recommend:

- **`[Place]` per row** — the default.
- **`[Place selected]`** with explicit checkboxes — the operator chose each one.
- **No `[Place all]`** until change **E** exists. Placement is _reversible in principle_ — remove the
  `contains` edge — but **no route removes it today**, so at 18 rows a mis-click is currently a
  one-way action with no undo. "Automate reversible work" requires the reversal to actually exist.

---

## 7. Data-model gaps

1. **No "these are different entities" record.** `MergeRecord` records merges only. **Smallest
   truthful fix:** an append-only `NotDuplicateRecord {id, entityIds[], decidedAt, reason}`, and
   `DuplicateGroupFinder` skips any group whose exact id-set matches one. Append-only, no mutation,
   no new mutable state, and it survives re-scans. It is a _decision record_, not an assertion that
   two names differ — the same distinction ADR 036 draws for aliases.
2. **No candidate-place rejection.** `archivedAt` exists on entities; no route sets it. Change **C**.
3. **No publisher freshness.** Nothing records when a publisher was last consulted. _Sources read_
   (§3) is the honest proxy. A `PublisherConsultation {publisher, at, outcome}` row would make
   "8 / 8 checked" real; not proposed now.
4. **No operation execution state beyond runs.** Runs already carry `running | completed | failed`.
   Sufficient. Nothing new needed.
5. **Run attribution is by entity, not by domain.** Working as designed (ADR 044 §11) and
   sufficient — but note that **a batch that creates _no_ entities leaves nothing attributable**, so
   mission 1's completion rests on entity counts, not on the run.
6. **No mission completion history.** Nothing records that a domain was ever complete, which is why
   UPDATE AVAILABLE cannot be derived today (§5).

---

## 8. Risks

| Risk                                                                   | Mitigation                                                                                                                              |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Bulk placement is irreversible today** (no un-place route)           | Ship `[Place]` + `[Place selected]`; withhold `[Place all]` until change E                                                              |
| `placedIds` unions two regions (§0.5)                                  | Fix in stage 1, before any placement UI trusts it                                                                                       |
| Unnamed OSM POIs make a placement list ambiguous                       | Row shows name + category + coordinates, never name alone                                                                               |
| **`POST /admin/batch-ingest` executes a file path from a request**     | Allow-list to files already present under `src/ingestion/batches/`; reject anything else. Never accept a path from the client verbatim. |
| A batch calls OpenAI and costs money per click                         | The button states cost in requests before it is pressed; `dryRun` first, exactly as `grow` does                                         |
| Two concurrent runs                                                    | Accepted. Upsert semantics plus the duplicate guard make it non-corrupting; a fake cancel would be worse than none                      |
| Completing missions faster surfaces the duplicate-"No" gap sooner      | Change D is in stage 4, before mission 2 becomes the current mission                                                                    |
| `IngestionPipeline` test suite has not run since `persisted` was added | Run `npm test` in stage 0                                                                                                               |

---

## 9. Stages

| Stage | Work                                                                                                                                                                                                            | Verifiable by                                                                      |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **0** | `cd atlas && rm -rf dist && npm test`; `cd app && npm test`; fix the two-region `placedIds` defect (§0.5)                                                                                                       | Suites green; page says "placed in Okanagan" and counts only Okanagan              |
| **1** | **Vertical slice: mission 3.** Unplaced list on the Recreation page, `[Place]` per row, `[Place selected]`, posting to the existing members route. Optimistic count, `router.refresh()`, authoritative re-read. | **18 → 17 → … → 0 → MISSION COMPLETE, next mission becomes current. No terminal.** |
| **2** | Coverage snapshot (§3) + page hierarchy (§4): health, opportunities, blockers, runbook into Reference                                                                                                           | Recreation page fits the working-surface test                                      |
| **3** | `POST /admin/batch-ingest` (change B) + `[Run]` on missions 1 and 4, with live run status from `/api/admin/runs/:id`                                                                                            | Sweep runs from the page, status goes Running → Completed                          |
| **4** | `NotDuplicateRecord` (change D) + un-place route (E) + `[Place all]`                                                                                                                                            | "No" survives a re-scan                                                            |
| **5** | Region landing states; `DomainObservation` for UPDATE AVAILABLE                                                                                                                                                 | A completed domain that gains a candidate shows the update                         |
| **6** | Mission 5 via the existing enrichment route; state the image gap                                                                                                                                                | Parks gain descriptions from the page                                              |

**Stage 1 is the proof the brief asks for and it needs no backend change at all.** I would ship
stages 0 and 1, look at it, then continue.

---

## 10. What I need from you

**One decision:** §3 — accept the coverage snapshot defined over Atlas's real populations (known,
placed, corroborated, Passport-ready, waiting, sources read), with _rejected_ explicitly absent and
explained? Or do you want the candidate-place review queue, which is a policy reversal needing its
own ADR?

Everything else in this plan follows from the code and the principles, and I will proceed on it.
