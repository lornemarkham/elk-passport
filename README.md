# ELK Passport

Let's make today unforgettable.

## Start here

**[`docs/PASSPORT-PRODUCT-DOCTRINE.md`](docs/PASSPORT-PRODUCT-DOCTRINE.md) is product authority** — why Passport exists, the Discover → React → Collect → Shape → Commit → Live → Adapt → Remember → Learn loop, what is deliberately not being built yet, and what is still an open question. Read it before changing product behaviour, and do not infer Passport's purpose from the current UI alone.

`CLAUDE.md` carries the same instruction for agents. The rest of `docs/` is engineering and per-surface product detail; `archive/` (the old numbered "Product Brain", `01-mission.md` onward) and `docs/old-might-be-garbage/` are history rather than authority.

## Running it tonight

```bash
npm install
npm run dev
```

Opens at `http://localhost:3100` (not 3000 — kept separate on purpose in case another local project is already running there). No account, no API keys required: it runs on a local, browser-only data layer and a local recommendation fallback until Supabase/OpenAI credentials are added (see `.env.example`).

## Scripts

| Script                            | What it does                                               |
| --------------------------------- | ---------------------------------------------------------- |
| `npm run dev`                     | Local dev server                                           |
| `npm run build`                   | Production build                                           |
| `npm run start`                   | Run the production build                                   |
| `npm run lint`                    | ESLint                                                     |
| `npm run typecheck`               | TypeScript, no emit                                        |
| `npm run format` / `format:check` | Prettier                                                   |
| `npm test`                        | Vitest unit tests                                          |
| `npm run e2e`                     | Playwright end-to-end test (builds + serves automatically) |

## Enabling real persistence and AI

Copy `.env.example` to `.env.local` and fill in `DATABASE_URL` (Supabase Postgres), `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `OPENAI_API_KEY`. Until then, adventures live in the browser's local storage and recommendations come from a local archetype library — see `/docs/architecture.md` for what that unlocks and what's still a manual wiring step.
