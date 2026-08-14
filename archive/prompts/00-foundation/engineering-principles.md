# Engineering Principles

Scope: this is the one foundation document allowed to talk about actual components, files, and code conventions. Everything else in `00-foundation/` stays implementation-agnostic on purpose; this one exists to keep implementation consistent.

For the authoritative, more detailed version of most of this, see [`../../docs/technical.md`](../../docs/technical.md), [`../../docs/architecture.md`](../../docs/architecture.md), and [`../../docs/build-contract.md`](../../docs/build-contract.md) — this document is a fast-reference summary oriented at "what to do while writing a component," not a replacement for those.

## Stack

Next.js (App Router) + React + TypeScript + Tailwind CSS v4 + shadcn/ui (`base-nova` style, neutral base, see `components.json`) + Framer Motion, TanStack Query for client data, React Hook Form + Zod for forms, Prisma + Supabase Postgres for persistence, Supabase Auth/Storage, OpenAI for recommendation logic.

## Conventions actually in use in this repo

- Path alias `@/*` → `src/*` (see `tsconfig.json`).
- Class merging via `cn()` from `@/lib/utils` (`clsx` + `tailwind-merge`) — use it, don't hand-roll conditional className strings.
- shadcn primitives live in `src/components/ui/`; product-specific components live in feature folders under `src/components/` (e.g. `src/components/adventure/`). Follow that split for new work — generic/reusable goes in `ui/`, Passport-specific goes in a named feature folder.
- Route segments map to the core loop (`plan`, `reveal`, `adventure`, `summary`, `api/recommend`) — see [`../../docs/architecture.md`](../../docs/architecture.md). New top-level routes should map to a stage of `Plan → Reveal → Experience → Track → Capture → Recap → Share`, not be added ad hoc.
- Zod schemas for shared taxonomies (e.g. `TODAYS_INTENTS`, `ADVENTURE_DNA_TRAITS`) live in `src/lib/schemas.ts`, explicitly commented as non-final where the Product Brain hasn't locked the taxonomy — match that pattern rather than inventing a parallel one.
- Experimental/throwaway prototypes live under `/labs/*` routes with their own component folder under `src/components/labs/<name>/` (see `src/components/labs/discovery-space/`) — isolated, no nav/header/footer, not wired into the core loop.

## Principles

1. **Match the emotional and interaction contract before matching a pattern in existing code.** If an existing component's pattern would produce a screen that violates [`design-principles.md`](./design-principles.md), [`ux-principles.md`](./ux-principles.md), or [`motion-principles.md`](./motion-principles.md), don't copy it forward — those documents outrank precedent.
2. **No `any` used to route around a real type problem.** If the type is genuinely unknown, model that explicitly (`unknown` + narrowing), don't erase it.
3. **Validate at the boundary, trust internally.** All external input — form submissions, API request bodies, third-party responses — is validated with Zod at the boundary. Code past that boundary trusts the validated shape; don't re-validate defensively deeper in the call stack.
4. **Motion lives in shared components, not reimplemented per screen.** Framer Motion usage for anticipation/reveal/progressive-disclosure should be encapsulated so pacing stays consistent — see [`motion-principles.md`](./motion-principles.md).
5. **Don't build ahead of a Product Brain decision.** If a screen needs a decision the Product Brain hasn't made (final Adventure DNA fields, final Today's Intent categories, the recommendation mechanism itself), stop and flag it rather than inventing a taxonomy or a mechanism to fill the gap. See the TODOs in [`../../docs/architecture.md`](../../docs/architecture.md).
6. **No unrequested scope.** No multi-tenant, admin, roles, or team features — V1 is single-user (the founder). No badges/gamification/social features — explicitly outside the core experience for now ([`/04-decisions.md`](../../04-decisions.md)). Building these prematurely isn't thoroughness, it's scope creep against a documented decision.
7. **Test what would embarrass the product if it broke silently**, not for coverage numbers. Vitest for logic that can silently produce a wrong day (validation, constraint filtering, recommendation-input assembly). Playwright for the core loop happy path, prioritized Plan → Reveal first.

## Definition of done

A change is done when it builds cleanly, passes lint/format/typecheck, has tests for non-trivial logic, keeps the core-loop Playwright happy path green (or updates it), and matches the personality/anti-pattern constraints in [`design-principles.md`](./design-principles.md) — a technically correct screen that reads like a SaaS dashboard is not done. Full detail: [`../../docs/build-contract.md`](../../docs/build-contract.md).

## The acceptance test that overrides all others

> The founder must be able to use Passport tonight to plan a real adventure tomorrow.

Any change that moves the product away from this bar — for the sake of polish, abstraction, or "best practice" — is out of scope until the bar is met.
