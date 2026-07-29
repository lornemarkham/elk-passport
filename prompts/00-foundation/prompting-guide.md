# Prompting Guide

Scope: how to write a future implementation prompt for Passport so it produces work consistent with everything else in `00-foundation/`, without having to restate this whole folder every time.

## The pattern

A good Passport implementation prompt has four parts, in this order:

1. **Role and lens** — which disciplines matter for this task (frontend engineering, UI design, UX, motion, brand). Not every prompt needs all of them, but naming the relevant ones tells the model which of the `00-foundation/` documents to weigh most heavily.
2. **What this is not** — the fastest way to protect scope. Naming the adjacent thing this must not become (a form, a dashboard, a search bar, a booking flow) prevents the most common failure mode: solving the problem with the nearest generic pattern instead of Passport's actual answer to it.
3. **The experiment or outcome** — what question this work is actually trying to answer, and what "successful" looks like emotionally, not just functionally. See [`passport-philosophy.md`](./passport-philosophy.md)'s decision hierarchy — emotional experience is evaluated first.
4. **Explicit boundaries** — tech stack, isolation (is this a `/labs/*` throwaway prototype or a core-loop feature?), and anything intentionally out of scope for this pass.

## Reference this folder, don't restate it

Future prompts should point at these documents rather than re-explain their contents:

> "Follow `prompts/00-foundation/` — particularly `design-principles.md` and `motion-principles.md` for this one."

This keeps prompts short and keeps the foundation as the single place these rules live. If a prompt needs to say more than a sentence to explain a principle, that principle belongs in `00-foundation/`, not copy-pasted into the prompt.

## Read this before every implementation

At minimum, before writing product-facing code:

1. [`passport-philosophy.md`](./passport-philosophy.md) — the decision hierarchy and what Passport is/isn't.
2. Whichever of [`design-principles.md`](./design-principles.md), [`ux-principles.md`](./ux-principles.md), [`motion-principles.md`](./motion-principles.md), [`visual-language.md`](./visual-language.md) are relevant to the surface being built.
3. [`engineering-principles.md`](./engineering-principles.md) — for the actual conventions in code.

If the task touches product scope or capability (not just visual/interaction polish), also check the Product Brain (`/01-mission.md` onward at the repo root) for whether the capability is already decided, explicitly deferred, or genuinely open — see [`ux-principles.md`](./ux-principles.md) §"When the Product Brain doesn't answer the question."

## A worked example

The prompt that produced `/labs/discovery-space` is a reasonable template: it assigned two roles (frontend engineer, interaction designer), named one precise question to answer ("can this create curiosity before asking a single question?"), listed explicit anti-patterns (no search bars, forms, wizards, filters), specified isolation (new route, no nav, throwaway prototype), and defined success emotionally ("someone instinctively moves their mouse around") rather than functionally ("cards render correctly"). That shape — question, anti-patterns, isolation, emotional success criterion — is reusable for the next lab prototype.

## Anti-patterns for prompts themselves

- A prompt that lists features without naming the emotional job those features are meant to do.
- A prompt that doesn't say what _not_ to build — the model will default to the nearest familiar pattern (search bar, form, dashboard) unless told not to.
- A prompt that restates all of `00-foundation/` inline instead of referencing it — this drifts out of sync with the real documents over time.
- A prompt for a `/labs/*` experiment that doesn't say it's a throwaway prototype — without that signal, implementation work defaults to production rigor (full test coverage, error handling, accessibility hardening) that a one-question prototype doesn't need yet.
