# ELK Passport

Let's make today unforgettable.

See `/docs` for the engineering foundation (vision, experience, technical, architecture, build contract) and the numbered files at the repo root (`01-mission.md` onward) for the full Product Brain.

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
