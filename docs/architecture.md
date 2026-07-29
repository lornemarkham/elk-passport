# Architecture

_Living document. Proposed reference architecture using the stack in [`technical.md`](./technical.md), mapped to the core loop and capabilities in [`experience.md`](./experience.md). This is a starting structure for the first implementation, intended to also serve as a reference pattern for future ELK applications. It will evolve — treat it as a proposal to review, not a finished spec._

## Guiding constraint

The architecture should stay as simple as the core loop requires. The founder must be able to plan a real adventure tonight — this is a single-user-flow product for V1, not a multi-tenant platform. Do not add structure (roles, orgs, admin surfaces, plugin systems) that isn't required to deliver the loop in [`experience.md`](./experience.md).

## High-level shape

```
Next.js App Router (single app)
├── app/                      route segments, mapped to the core loop (see below)
├── components/                shared UI (shadcn/ui-based primitives + product-specific components)
├── lib/                       server-side logic: db client, auth helpers, OpenAI client, validation schemas
├── prisma/                    schema + migrations
└── e2e/                       Playwright tests for the core loop
```

## Route segments mapped to the core loop

The core loop (`Plan → Reveal → Experience → Track → Capture → Recap → Share`) is the organizing principle for top-level routes:

- `plan` — the collaborative, visual planning flow (Capability: Understand Me, Understand Today, Curate My Day).
- `reveal` — the paced adventure reveal.
- `adventure` (Experience/Track) — Adventure Mode: current step, what's next, timing/location, capture entry point, adjust-plan entry point (Capability: Adapt My Day).
- `capture` — lightweight photo/note capture, likely a component or modal used from within `adventure` rather than a standalone heavy flow.
- `recap` — the shareable story view.

> TODO (founder decision): exact route/URL structure and whether these are top-level routes vs. states within a single adventure flow. The above is a proposal based on the documented loop, not a finalized IA.

## Data layer

Prisma + PostgreSQL (Supabase). The following entities are directly implied by the documented capabilities and are proposed as a _starting point only_:

- **User** — auth identity (Supabase Auth) plus profile.
- **AdventureDNA** — long-term preferences tied to a user (Capability 1: Understand Me).
- **Adventure** — a single planned/experienced day: intent, constraints, context captured at plan time, and the resulting recommendation (Capabilities 2–3).
- **Moment** — a captured photo/note tied to an Adventure (Capture/Recap).

> TODO (product decision): exact fields for `AdventureDNA` and the "Today's Intent" taxonomy are explicitly non-final in the Product Brain ([`/09-curation-framework.md`](../09-curation-framework.md)). Do not lock the schema for these until the founder confirms the model. Recommend starting with a flexible/JSON field for evolving attributes rather than a rigid column-per-attribute schema.

## Recommendation flow (Curate My Day)

Proposed shape only:

1. Client submits today's intent + constraints (validated with Zod).
2. Server combines Adventure DNA + today's intent + constraints + context.
3. Server calls OpenAI to produce a single confident recommendation (not a list).
4. Recommendation is persisted against the Adventure record and returned for the Reveal flow.

> TODO (founder decision): the actual prompting/recommendation strategy (structured prompt, retrieval over a curated experience dataset, etc.) is not decided. [`/10-core-experience.md`](../10-core-experience.md) and [`/09-curation-framework.md`](../09-curation-framework.md) define the desired _outcome_ (one confident, personal recommendation) but not the mechanism. This is a significant product/technical decision requiring founder input before building the recommendation engine.

## Motion & visual layer

Framer Motion handles the anticipation-building, progressive-reveal, and transition requirements in [`experience.md`](./experience.md) — particularly the Reveal and Plan flows. Motion should be encapsulated in shared components so pacing/personality stays consistent rather than being reimplemented per screen.

## Auth & storage

- Supabase Auth for identity.
- Supabase Storage for captured photos.

> TODO: for a single-founder MVP, confirm whether full auth (signup/login) is needed on day one, or whether a single authenticated founder account is sufficient to hit the "plan tonight" bar. Building less here may be the faster path to the MVP acceptance test.

## Testing

- Vitest for unit-level logic (validation schemas, recommendation-input assembly, utility functions).
- Playwright for the core loop end to end — the most important test is a single happy-path test that plans, reveals, and captures an adventure, since that mirrors the founder's actual use case.

## Explicitly out of scope for V1 architecture

Per [`/10-core-experience.md`](../10-core-experience.md) and [`/04-decisions.md`](../04-decisions.md), the following are documented as _not_ part of the core experience and should not shape the initial data model or routes: badges/achievements/gamification, social features, maps as a first-class feature, reviews. If they're needed later, they should be added without requiring rework of the core loop above.
