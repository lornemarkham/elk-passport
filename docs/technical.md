# Technical

_Living document. This is the agreed technology stack as directed by the founder. This document records what and briefly why — not a tutorial for any individual tool._

## Application

- **Next.js (App Router)** — application framework, routing, server rendering.
- **React** — UI layer.
- **TypeScript** — type safety across the codebase.
- **Tailwind CSS** — styling.
- **shadcn/ui** — accessible component primitives, used as a base and customized to fit the bright/bold/playful visual identity in [`experience.md`](./experience.md) — not used as an off-the-shelf generic look.
- **Framer Motion** — the meaningful motion, layered reveals, and progressive-disclosure requirements in [`experience.md`](./experience.md) depend on this.

## Data & fetching

- **TanStack Query** — client-side data fetching, caching, and sync with the server.
- **React Hook Form** — form state.
- **Zod** — schema validation, used at all boundaries (forms, API inputs, external data).

## Backend & data

- **Prisma** — ORM / database access layer.
- **PostgreSQL (Supabase)** — primary database.
- **Supabase Auth** — authentication.
- **Supabase Storage** — file storage (adventure photos, captures).

## AI

- **OpenAI** — powers the "Curate My Day" and "Understand Me / Understand Today" capabilities described in [`experience.md`](./experience.md).

> TODO (founder decision): confirm whether OpenAI is called directly or through an abstraction layer (e.g. Vercel AI SDK / AI Gateway) for provider flexibility, observability, and fallback support. Not yet decided — do not architect around a specific integration pattern until confirmed.

## Quality tooling

- **ESLint** — linting.
- **Prettier** — formatting.
- **Husky** — git hooks (pre-commit lint/format/test gates).
- **Vitest** — unit tests.
- **Playwright** — end-to-end tests, most relevant to verifying the core loop (Plan → Reveal → Experience → Track → Capture → Recap → Share) actually works end to end.

## Open technical decisions

> TODO (founder decision): hosting/deployment target. Not specified in the founder's technical direction. Vercel is a natural fit for this stack (Next.js, Supabase-compatible, edge/serverless) but has not been explicitly confirmed.

> TODO (founder decision): exact package versions / Next.js version pin. To be decided at scaffolding time, not before.

> TODO (founder decision): repository is not yet a git repository. Version control should be initialized before implementation begins.
