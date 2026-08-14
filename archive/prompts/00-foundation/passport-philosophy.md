# Passport Philosophy

**Read this first, always.** Every other document in `00-foundation/` is a lens on this one. If a future decision seems to conflict with a document elsewhere in this folder, resolve it against this one.

## Why Passport exists

Passport exists to help people build richer, more memorable lives through meaningful experiences. Travel and free time are the medium. Living well is the objective.

The measure of success is not "user clicked recommendation." It is: **"That was one hell of a day."** Engagement, retention, and click-through are at best shadows of that outcome. When a shadow metric and the real one disagree, the real one wins.

See [`/07-success.md`](../../07-success.md) and [`/13-philosophy.md`](../../13-philosophy.md) for the full statement this document compresses.

## What Passport is not

- Not a tourism website.
- Not a search engine.
- Not an itinerary builder.
- Not a recommendation engine, fundamentally — recommending is a capability it has, not the reason it exists.

Naming any one of these as the mission risks optimizing for the wrong thing: more results, more listings, more clicks — instead of a better day.

## What Passport is

A trusted curator that helps people answer a harder question than "what do you want?" — namely, **"what kind of day would make your life better today?"**

People often confuse goals with solutions. "I want kayaking" may really mean _I want family time, fresh air, to cool off._ Passport's job is to find the goal underneath the guess, not just match the guess.

Over the long term, Passport is a **Life Experience Engine**, not an activity recommendation engine. The difference is orientation, not scale: an activity engine is judged by whether today's suggestion landed; a Life Experience Engine is judged by whether the person's life, taken as a whole, is richer for having used it. This is a direction to grow toward, not a roadmap — see [`/13-philosophy.md`](../../13-philosophy.md) for the long-form version, including its still-open questions.

## Discovery over search

People are not looking for more information. They are looking for better decisions. Passport should feel like noticing, not searching — curiosity and wonder before a single question is asked. See [`design-principles.md`](./design-principles.md) and [`ux-principles.md`](./ux-principles.md) for what that means for interface work.

## The decision hierarchy

When disciplines disagree while building Passport, resolve in this order:

1. **Emotional experience** — does this protect curiosity, anticipation, delight, and trust?
2. **Usability** — can a person do this without instructions, one-handed, outdoors?
3. **Maintainability** — will this still make sense in a year?
4. **Code elegance** — is this well-written?

Never optimize step 4 at the expense of step 1. A technically elegant screen that reads like a SaaS dashboard has not succeeded — see [`design-principles.md`](./design-principles.md) for the explicit anti-patterns this rules out.

## Standing principles

These recur across the Product Brain and should shape every product decision, not just visual ones:

- **People over technology** — technology exists to create better experiences, not to impress people.
- **Curated over comprehensive** — fifty unforgettable experiences beat five thousand average ones.
- **Less planning, more living** — reduce decision fatigue; every unnecessary question is a tax on the day.
- **Trust is earned slowly and lost quickly** — a poor recommendation damages trust immediately; protect it relentlessly.
- **Keep it fun** — never let Passport become homework, self-improvement, or a lecture.
- **Curiosity over certainty** — when uncertain, ask a thoughtful question rather than guess confidently. An honest "I'm not sure yet" beats invented certainty.
- **Growth must stay invited, not imposed** — nudging toward healthy novelty is welcome; the person must always be free to say no, and Passport should be able to explain why it believes the stretch is worth making today.

Full list: [`/08-principles.md`](../../08-principles.md).

## Source of truth

This document is a compression, not a replacement. Where anything here conflicts with the Product Brain (`/01-mission.md` through `/14-science-of-meaningful-experiences.md` at the repo root), **the Product Brain wins.** This file exists so implementation work doesn't require re-reading fourteen documents to stay aligned — read the Product Brain when a decision needs the full nuance, especially its recorded open questions.
