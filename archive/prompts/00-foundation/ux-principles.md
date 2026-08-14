# UX Principles

Scope: how a person moves through Passport — flows, choices, and what the product asks of them. Not visual composition (see [`design-principles.md`](./design-principles.md)), not animation (see [`motion-principles.md`](./motion-principles.md)).

## Core rule

An interaction is only right if it requires no explanation. If a screen needs a tooltip, an onboarding tour, or a first-time modal to be usable, the interaction — not the user — needs to change.

## Principles

1. **Confidence over quantity.** Passport is a curator, not a search engine. One flexible, confident recommendation beats a results list. The target reaction is "Of course, that's exactly what I wanted" — not "here are ten nearby attractions." See [`/09-curation-framework.md`](../../09-curation-framework.md).
2. **Reduce decision fatigue; don't relocate it.** Every question asked is a small tax on the day. Prefer noticing, reacting, and lightweight choices (cards, quick reactions, sliders) over long forms. If confidence is too low for a strong recommendation, keep learning through enjoyable interaction — don't present weak options as a substitute for understanding. See [`/12-mvp-experience-visual-contract.md`](../../12-mvp-experience-visual-contract.md).
3. **Bend, don't break.** Plans should adapt to changed weather, changed energy, changed circumstances while preserving the spirit of the day, not force a restart. This is Capability 4, "Adapt My Day" — see [`/11-capabilities.md`](../../11-capabilities.md).
4. **Every recommendation should be explainable.** Passport should always be able to answer why this, why today, why this person, why now — even if that explanation isn't always shown. A recommendation that can't be explained is a guess wearing understanding's clothes.
5. **The interface confirms itself.** An action's own motion or state change is the feedback — see [`motion-principles.md`](./motion-principles.md) for the rule this implies (no toasts, no "Saved!" banners layered on top of an animation that already said so).
6. **Surrendered choice must be opted into, never assumed.** Letting someone else shape your day (a partner, a friend, "surprise me") can deepen an experience — but only the version the person actively chose. Never design a flow where choice is quietly removed rather than freely given. See [`/13-philosophy.md`](../../13-philosophy.md) §"Discovery doesn't always have to be your own."
7. **Context adapts the interface, not just the content.** Adventure Mode (in-progress) and Plan/Reveal (before the day) are different jobs: one needs to be glanceable, one-handed, and fast; the other can afford a slower, more cinematic pace. Don't reuse a planning-mode interaction pattern where a mid-adventure one is needed, or vice versa.

## The core loop this all serves

```
Plan → Reveal → Experience → Track → Capture → Recap → Share
```

Every flow decision should be legible as a step in this loop. See [`/12-mvp-experience-visual-contract.md`](../../12-mvp-experience-visual-contract.md) for what each stage demands emotionally, and [`../../docs/architecture.md`](../../docs/architecture.md) for how it currently maps to routes.

## Explicit anti-patterns

- A twenty-question onboarding form before any value is shown.
- A results list where a single confident recommendation was called for.
- Gamification, badges, or streaks used to manufacture engagement rather than serve the day. (Not ruled out forever — just not part of the core experience. See [`/04-decisions.md`](../../04-decisions.md).)
- Any flow where "let someone else choose" is the default rather than a deliberate, reversible opt-in.
- Capture/logging flows heavy enough to feel like homework — capturing a moment should be nearly as fast as living it.

## When the Product Brain doesn't answer the question

If a screen needs a decision the Product Brain hasn't made yet (final Adventure DNA fields, final Today's Intent categories, the recommendation mechanism itself), stop and flag it rather than inventing a taxonomy. See the open TODOs in [`../../docs/architecture.md`](../../docs/architecture.md) and [`../../docs/build-contract.md`](../../docs/build-contract.md).
