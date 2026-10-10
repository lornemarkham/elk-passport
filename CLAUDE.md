# Passport — agent instructions

This file covers the `app/` repository: **Passport**, the traveller-facing
product. The workspace-level `CLAUDE.md` one directory up covers how the
workspace is organised and the engineering principles that apply everywhere.
That file is **not version controlled** (the workspace root is not a git
repository); this one is.

---

## Read the product doctrine first

**[`docs/PASSPORT-PRODUCT-DOCTRINE.md`](docs/PASSPORT-PRODUCT-DOCTRINE.md) is
product authority.**

**Before starting work on any of the following, read it in full:**

- Passport product behaviour of any kind
- Discovery
- Inspiration
- planning, itineraries, or scheduling a day
- saved / wanted / chosen / planned / lived state, boards, collections
- reactions and personalisation
- Experiences — October, Christmas, Skiing, Hockey, or any new one
- AI UX, natural language, voice, recommendations, ranking

This is a **deliberate startup step**, not a suggestion. Do not rely on a
semantic search happening to surface it. If your task touches that list, open
the file before you open the code.

### Why

Passport's purpose has been reconstructed from scratch too many times, because
it lived in conversation while the repository only held implementation. Four
earlier vision documents exist, in folders named `archive/` and
`old-might-be-garbage/`, which is roughly how much authority they ended up
carrying. The doctrine is the one canonical replacement.

### What it means for your work

- **The current implementation is evidence, not intent.** Routes, components,
  the data model and the tests record experiments and historical decisions.
  They tell you what Passport _does_. They do not tell you what Passport is
  _for_.
- **If implementation and doctrine appear to conflict, stop and name the
  conflict.** Do not silently treat the code as truth. Do not silently treat
  the doctrine as licence to rewrite working code either. Report it; let a human
  decide.
- **An open question in §15 is genuinely open.** Do not resolve one by picking
  whichever answer the existing code implies. The workspace rule applies:
  _never silently resolve an open question._
- **Naming a direction in the doctrine is not approval to build it.** §13
  (Inspiration) and §14 (future sensing, social, cross-ELK) are explicitly
  fenced off from implementation.
- **When a product decision becomes canonical, update the doctrine** in the same
  change that implements it, and record the decision in
  `docs/architecture/decisions/` if it is architectural.

---

## The rest of the documentation

| Path                                       | What it is                                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| `docs/PASSPORT-PRODUCT-DOCTRINE.md`        | **Product authority.** Why Passport exists and what it is trying to become.   |
| `docs/product/discover.md`                 | What the Discover feed actually does today, measured against the live corpus. |
| `docs/product/october-experience-bible.md` | October's product detail. One Experience — not the Experience contract.       |
| `docs/passport/the-physics-of-passport.md` | Motion and interaction doctrine: how Experience objects move and feel.        |
| `docs/architecture/`                       | Architecture, including `decisions/`.                                         |
| `docs/RELEASE.md`                          | Release process, including the manual steps nobody can automate.              |

`archive/` and `docs/old-might-be-garbage/` are history. Read them for context;
do not cite them as authority.

---

## Engineering

The workspace `CLAUDE.md` holds the engineering principles — code is the source
of truth for behaviour, evidence over invention, a small real seam over a
speculative framework, ship a vertical slice before generalising, never silently
resolve an open question, don't redesign silently, prefer reversible steps, and
a visible inconsistency is more honest than a hidden one. They apply here in
full.

Repository specifics:

- Dev server runs on **port 3100**, deliberately not 3000.
- Gates before any commit: `npx tsc --noEmit`, `npx eslint .`, `npx prettier
--check`, `npx vitest run`, `npx playwright test`, `npm run build`.
- `playwright.config.ts` reuses whatever is already listening on its port. Set
  `E2E_PORT` to point the suite at a server whose provenance you know — a stale
  dev server left running has silently served the suite before.
- Atlas is reached over HTTP with `ATLAS_API_URL` and a bearer token. Local
  `.env.local` points at a **local** Atlas; production Atlas is a different
  host. Measure against the right one.
