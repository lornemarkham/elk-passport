# Build Contract

_Living document. The engineering standard for this repository — what "done" means, and the gates every change should pass. This complements [`vision.md`](./vision.md), [`experience.md`](./experience.md), [`technical.md`](./technical.md), and [`architecture.md`](./architecture.md); it does not redefine product scope._

## The acceptance test that overrides all others

> The founder must be able to use ELK Passport tonight to plan a real adventure tomorrow.

Any change that moves the product away from this — for the sake of polish, abstraction, or "best practice" — is out of scope until this bar is met.

## Definition of done

A change is done when:

- It builds cleanly (`next build`).
- ESLint and Prettier pass with no manual overrides added to suppress real issues.
- TypeScript has no `any` used to route around a real type problem.
- All external input (form submissions, API request bodies, third-party responses) is validated with Zod at the boundary — not trusted implicitly.
- Relevant unit tests (Vitest) exist for non-trivial logic (validation, recommendation-input assembly, data transforms).
- If the change touches the core loop (Plan → Reveal → Experience → Track → Capture → Recap → Share), the Playwright happy-path test still passes, or is updated to reflect the new behavior.
- It matches the personality and anti-pattern constraints in [`experience.md`](./experience.md) — a technically correct screen that reads like a SaaS dashboard is not done.

## Git hooks (Husky)

Pre-commit should run lint, format check, and typecheck at minimum. Pre-push (or CI, once it exists) should run the test suite. Hooks should never be bypassed (`--no-verify`) as a way to "come back to it later."

## Testing philosophy

- **Unit tests (Vitest):** logic that can silently produce a wrong day — validation rules, constraint filtering, data assembly for the recommendation call.
- **E2E tests (Playwright):** the core loop, prioritized in this order: Plan → Reveal happy path first (this is the path the founder needs tonight), then Experience/Capture, then Recap/Share.
- Do not chase 100% coverage. Test what would embarrass the product if it broke silently — a broken recommendation flow or a capture that loses a photo, not pixel-perfect styling.

## Product-decision guardrails for engineering

- Do not invent product capabilities to fill a gap — if a screen needs a decision the Product Brain doesn't make (e.g. final Adventure DNA fields, final Today's Intent categories, the recommendation mechanism), stop and flag it rather than guessing. See the TODOs in [`architecture.md`](./architecture.md).
- Do not add badges, gamification, social features, or similar — [`/10-core-experience.md`](../10-core-experience.md) and [`/04-decisions.md`](../04-decisions.md) explicitly place these outside the core experience for now.
- Do not build multi-tenant, admin, or team features — V1 is a single-user (the founder) product.

## Commit hygiene

- Small, reviewable commits scoped to one concern.
- Commit messages explain _why_, not just _what_.
- No secrets (`.env`, Supabase keys, OpenAI keys) ever committed. Use `.env.local` (git-ignored) for local secrets.

## Living document

This contract should be revised as the team (currently: the founder + founding engineer) learns what actually matters in practice. If a rule here is slowing down getting to "founder plans tonight's adventure" without protecting something real, it should be challenged, not silently ignored.
