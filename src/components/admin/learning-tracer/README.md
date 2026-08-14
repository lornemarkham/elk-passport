# ELK Learning Tracer — Live Application Narrator

A small, event-driven panel attached to the Atlas Curator Workbench (`/admin/content/*`). Not an "Apply Enrichment explainer" — it narrates real, meaningful actions as you naturally use the app: what happened, why, which files handled it, and which architectural layers were involved.

## What it does

As you click around the Curator Workbench, the panel automatically updates to explain the action you just took, rendered as a vertical architecture flow — one card per real step, layer-tagged with an icon and color, connected by an animated flow line. The collapsed cards alone (icons, layer badges, short labels) are meant to communicate the shape of what happened in well under 10 seconds. Expanding a card reveals **What**, **Why**, **Files**, and **Concepts** for that step; each concept expands further inline for a definition, why it exists, and a real Passport/Atlas example.

The panel lives in the shared Curator Workbench layout (`app/admin/content/layout.tsx`), not any one page — it persists as you navigate between Explorer, Duplicates, and the overview, and can be reopened anytime via the **Learning Tracer** toggle in the shared header.

## Currently traced actions

| Action                  | Where                                                          | Real path                                                                                                                                                                                                                      |
| ----------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Select an entity**    | Content Explorer, clicking an entity in the list               | Pure React state (`setSelectedId`) — no fetch. 2 short events, both `ui` layer.                                                                                                                                                |
| **Check Other Sources** | Content Explorer, `EnrichmentPanel`                            | The richest trace: UI → UI data layer → API proxy → Atlas API → gather linked sources → re-run AI extraction (real OpenAI call, including geocoding rescue) → duplicate matching → response. Read-only — nothing is persisted. |
| **Apply Enrichment**    | Content Explorer, `EnrichmentPanel`                            | UI → UI → API → API → Service → Store → Database → Response. The original traced action; unchanged in substance, just moved onto the shared `TraceProvider`.                                                                   |
| **Refresh**             | Content Explorer, the Refresh button next to a selected entity | UI → 4 parallel real GETs (entities, source records, relationships, merge records) → response. Deliberately _not_ traced on the "include archived" toggle or the initial page-load fetch — see Known limitations.              |

Every event above was written after reading the real code path it describes — see `traceActions.ts` for the full event lists and exact files.

## What's deliberately NOT traced (and why)

- **Search and Filter** — same shape as Select (pure client-side, no network), and tracing them would just repeat the "sometimes it's just React state" lesson Select already teaches. Signal, not noise.
- **Opening a source** (the external-link icon next to each Source card) — it's a plain `<a target="_blank">` to the original BC Parks/Wikipedia page. It leaves the app; there's no application architecture to narrate.
- **Relationship navigation** — genuinely not implemented yet. The "Other relationships" list in Content Explorer is a static, read-only display (`<div>`, no `onClick`) — you can see a relationship, but can't currently click through it. Tracing it would mean inventing an interaction that doesn't exist. Flagged for a real product decision, not silently added here.
- **Derived relationship computation** (`near`) — real, but only runs via `npm run compute-near-relationships`, a CLI script with no Curator Workbench button. Nothing to hang a UI trace on today.
- **Merge Entities** — real and architecturally close to Apply Enrichment (`DuplicateGroupCard.handleMerge()` → `POST /api/admin/merge` → Atlas `POST /admin/merge` → `MergeService.merge()` → store → database), but it lives on a separate page (`/admin/content/duplicates`) and was left for a future pass rather than rushed into this one — "optimize for enjoyable, not for more actions working."

## Architecture

```
Real user action (click)
        ↓
useTrace().record({ actionId, headline, detail? })   ← called directly at the point the action actually completed
        ↓
TraceContext (React Context, one instance, mounted once in the Curator Workbench layout)
        ↓
LearningTracerPanel   ← subscribes via useTrace(), re-renders automatically
        ↓
getTraceAction(actionId) → a static TraceAction { title, events: TraceEvent[] }
        ↓
Generic rendering: one card per TraceEvent, keyed only by layer/label/what/why/files/conceptIds
```

- **`traceActions.ts`** — the event-driven data model. `TraceEvent` is the atomic, uniform unit (`layer`, `label`, `what`, `why`, `files`, `conceptIds`); `TraceAction` is just an ordered `TraceEvent[]`. `LAYER_META` maps the six layers (`ui`/`api`/`service`/`store`/`database`/`response`) to an icon and color, applied identically regardless of which action is showing. Four `TraceAction`s are seeded: `apply-enrichment`, `select-entity`, `check-other-sources`, `refresh`.
- **`TraceContext.tsx`** — the runtime event model you asked for: `TraceProvider` holds exactly one piece of state (the current `TraceEmission` + whether the panel is open) and exposes exactly one way to change it, `record()`. This is not a generalized event bus — no subscriptions, no event types beyond `TraceEmission`, no history. Any client component under the provider calls `useTrace().record(...)` directly; nothing is threaded through props between unrelated components anymore.
- **`LearningTracerPanel.tsx`** — reads `emission`/`open`/`close` from `useTrace()`. Renders any registered `TraceAction` generically — there is no `if (action.id === ...)` branch anywhere in this file, and there shouldn't need to be one for a fifth or sixth action either.
- **`LearningTracerToggleButton.tsx`** — small client component, `useTrace().toggleOpen()`, lives in the shared layout header.
- **`glossary.ts`** — unchanged in shape; three new concepts added (`local-state`, `ai-extraction`, `duplicate-detection`) to support the two new traces honestly, without stretching an existing concept to cover something it doesn't quite mean.
- **`workflows.ts`** — superseded, left as an inert stub (this workspace's tooling couldn't delete the file outright). Safe to remove by hand.

## Runtime-derived vs. static

- **Static, hand-authored, verified against real code**: every `TraceEvent`'s `layer`/`label`/`what`/`why`/`files`/`conceptIds`, and every `GlossaryConcept`. Nothing here is generated or AI-authored.
- **Runtime-derived**: which `TraceAction` is showing (`emission.actionId`), and the two short presentation strings each action's own code builds at the moment it fires (`emission.headline`, e.g. an entity's real name; `emission.detail`, e.g. "3 proposals found" or which fields were actually applied). The _shape_ of each trace is fixed data; the _specific instance_ you're looking at (which entity, how many proposals, which fields) is genuinely computed from what just happened, not templated after the fact.

## Known limitations

- **Four actions, not the whole app.** Search, Filter, Relationship navigation, derived-relationship computation, and Merge Entities are all real gaps — see the table above for exactly why each was left out this round, not silently dropped.
- **No trace history.** Only the most recent emission is kept; closing and reopening the panel shows the same one, but navigating to a different real action replaces it. A real "narrator" arguably wants a short scrollback eventually — not built here.
- **Detail strings are short and manually composed per action**, not templated from a shared formatter. Fine at four actions; would be worth a shared helper if this grows past ten or so.
- **No automated test for the trace content itself** — accuracy today rests on the same discipline as the rest of this session (read the real code before describing it), not on a test that would catch drift if, say, `EnrichmentService.applyEnrichment` changes shape later. Worth a lightweight "these files still exist" smoke test if this becomes long-lived.

## Deliberately left for the future

- Relationship navigation (needs a real, separate decision: should relationships become clickable at all, and if so, is that decided here or elsewhere).
- A UI trigger for derived-relationship computation, if one is ever added.
- Merge Entities tracing, once/if it's worth the second page-mount.
- Cross-product reuse (Passport, ELK Garden, ELK Wrench, ELK Inventory) — explicitly out of scope; nothing here assumes or hints at a plugin/registration system for other apps yet.
- Any relationship to `atlas/engineering-coach` (competency tracking, evidence, Bloom/SFIA) — a deliberately separate product; see below.

## Relationship to `atlas/engineering-coach`

Engineering Coach is a longer-term, curriculum-based mastery tracker — ~210 concepts, SWEBOK/Bloom/SFIA classification, evidence, session review. It answers _"what do I know, how confidently, what's the evidence?"_ over months.

The Learning Tracer answers a narrower, immediate question: _"what did the application just do?"_ No scoring, no evidence workflow, no session state, and none of that will be added here — that's the whole point of keeping these two products separate.

## How to test this

1. `npm run dev` (from `app/`), sign in as admin, open `/admin/content/explorer`.
2. Click any entity in the left list → the Learning Tracer panel should open automatically, showing "Entity Selected" with that entity's name, and two short `ui`-layer cards.
3. With an entity selected, click **Check other sources** on its Enrichment panel → the tracer should update to "Checked Other Sources," 8 cards spanning ui/api/service/response, with a detail line like "3 proposals found" (or "no differences found").
4. Select at least one proposed field and click **Apply N field(s)** → the tracer should update to "Apply Enrichment," 8 cards spanning ui/api/service/store/database/response, with the applied field names in the subline.
5. Click **Refresh** next to the selected entity's name → the tracer should update to "Refreshed Content Explorer," 3 cards (ui/api/response).
6. Expand any card → confirm What/Why/Files appear, and clicking a concept chip reveals its fuller definition inline.
7. Click the **Learning Tracer** toggle in the shared header to close and reopen the panel without redoing an action — it should still show the last one.
8. Navigate from Explorer to the Duplicates page and back — the last trace should still be there (proves the `TraceProvider` is shared at the layout level, not per-page).
