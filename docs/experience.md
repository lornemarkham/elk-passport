# Experience

_Living document. Synthesizes the Curation Framework, Capabilities, and MVP Experience & Visual Contract from the Product Brain for engineering purposes. Source of truth for detail: [`/09-curation-framework.md`](../09-curation-framework.md), [`/11-capabilities.md`](../11-capabilities.md), [`/12-mvp-experience-visual-contract.md`](../12-mvp-experience-visual-contract.md)._

## Primary hero (V1)

**The Local Explorer** — a busy person with limited free time who wants to make the most of weekends, evenings, holidays, and days off. Their core need is _confidence that their limited free time is being well spent_. This is the only hero defined for V1; the founder is the first instance of this hero. See [`/06-heroes.md`](../06-heroes.md).

## The four capabilities

The product must be able to:

1. **Understand Me** — the person's long-term preferences, interests, dislikes, and "Adventure DNA" (interests, fears, dietary preferences, activity preferences, travel style, budget tendencies — examples only, not a finalized model).
2. **Understand Today** — today's intent and circumstances (desired type of day, available time, budget, weather, location, season, other context).
3. **Curate My Day** — combine both understandings into a confident, personal recommendation. Prioritize confidence over quantity.
4. **Adapt My Day** — bend the plan, not break it, when circumstances change (weather, fatigue, changed plans).

See [`/11-capabilities.md`](../11-capabilities.md).

## The curation model

Four inputs feed every recommendation ([`/09-curation-framework.md`](../09-curation-framework.md)):

| Input            | Nature                             | Examples (non-final)                                                                   |
| ---------------- | ---------------------------------- | -------------------------------------------------------------------------------------- |
| Adventure DNA    | Long-term, rarely changes          | loves water, fear of heights, foodie, budget conscious                                 |
| Today's Intent   | Changes daily                      | Adventure, Active, Family, Food, Water, Learning, Date, Road Trip, Escape, Relax       |
| Hard Constraints | Eliminates options before curation | available time, budget, driving distance, accessibility, weather, mobility, open today |
| Context          | Situational                        | weather, season, local events, time of day, sunset, location                           |

Output is **one flexible, confident recommendation** — not a results list. Target user reaction: _"Of course. That's exactly what I wanted."_

> TODO (founder decision): Adventure DNA attributes and Today's Intent categories are explicitly non-final in the Product Brain. Do not hardcode either as a closed enum without confirming.

## The core loop

```
Plan → Reveal → Experience → Track → Capture → Recap → Share
```

This loop is the MVP scope boundary. See [`/12-mvp-experience-visual-contract.md`](../12-mvp-experience-visual-contract.md).

### Plan

Not a long questionnaire. Collaborative and visual — cards, imagery, reactions, quick choices, sliders/weights, short conversational prompts. When confidence is too low for a strong recommendation, keep learning through enjoyable interaction rather than showing weak options. Target feeling: _"Okay, I think I have something you are going to love,"_ not _"here are ten nearby attractions."_

### Reveal

Not a plain itinerary display. Paced, with personality — imagery, short copy, transitions, possibly a suggested soundtrack, a preview of the emotional arc, moments of surprise. The user should finish the reveal with a grin and a strong desire to go.

### Experience (Adventure Mode)

Simpler and more practical once the adventure begins. Must clearly show: what's happening now, what's next, timing/location info, how to capture a moment, how to adjust the plan. Adventure Mode supports the experience — it does not compete with it for attention.

### Track / Capture

Capturing a moment (photo, short note) must be extremely lightweight — not homework.

### Recap / Share

The completed adventure becomes a story worth sharing, not a checklist of completed items. Target framing: _"This is what I did. You should do it too."_ Playful exaggeration is welcome.

## Emotional target

Move the user from _"I have time off, but I don't know what to do"_ to _"THIS IS GOING TO BE DOPE."_ Planning is the opening act of the adventure, not administrative work.

## Personality

Bright, bold, energetic, playful, slightly rebellious, encouraging, informative, occasionally funny, unafraid to be memorable. Spirit of ambitious early-2000s interactive websites (motion, drama, surprise) — without their usability problems.

## Explicit anti-patterns

Do not build: a conventional SaaS dashboard, a sterile itinerary planner, a generic tourism website, a 20-question form, a wall of identical cards, a ChatGPT-style text conversation, a minimalist beige lifestyle brand, a purple-gradient "AI app," a corporate productivity tool. Clean design is welcome; lifeless design is not.

## Platform priority

Mobile-first. Core actions must be comfortable one-handed, readable outdoors, fast to understand, usable while moving through an adventure. Desktop should feel intentional (more cinematic planning/replay), not a stretched phone layout.

## NFR

"No Friggin' Regrets" (exact wording may evolve; initials NFR must remain). The experience should end with the user feeling glad they went, proud they used their time well, excited to tell the story, and ready to plan another adventure.

## MVP acceptance bar

The founder must be able to use the product tonight to plan a real adventure tomorrow. This is the literal, non-negotiable acceptance test for the first version of the core loop.
