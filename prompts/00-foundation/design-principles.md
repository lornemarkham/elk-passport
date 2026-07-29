# Design Principles

Scope: the visual and structural design of a screen — layout, hierarchy, density, composition. Not color/type tokens (see [`visual-language.md`](./visual-language.md)), not interaction behavior (see [`ux-principles.md`](./ux-principles.md)), not animation (see [`motion-principles.md`](./motion-principles.md)).

## Core rule

Clean design is welcome. Lifeless design is not.

Passport's personality is bright, bold, energetic, playful, slightly rebellious, encouraging, and unafraid to be memorable — closer in spirit to ambitious early-2000s interactive websites than to a modern minimalist SaaS product. Borrow their confidence and sense of spectacle; leave their usability problems behind. See [`/12-mvp-experience-visual-contract.md`](../../12-mvp-experience-visual-contract.md).

## Principles

1. **Hierarchy over density.** One clear focal point per screen beats ten equally-weighted elements. If everything is emphasized, nothing is.
2. **Whitespace is a design choice, not empty space to fill.** Room to breathe signals confidence; cramming signals anxiety about the content not being interesting enough on its own.
3. **Typography carries mood, not just legibility.** Type choices should feel like they belong to an adventure brand, not a form. Confident type can do the emotional work that decoration usually gets asked to do instead.
4. **Imagery and color over icons and chrome.** Passport sells a feeling; UI chrome (borders, dividers, boxed sections) should recede so the content — the place, the moment, the possibility — stays the subject.
5. **Every screen should look like it belongs to the same product.** Motion, type, and spacing choices should feel like a system, not a one-off per screen. See [`engineering-principles.md`](./engineering-principles.md) for how that system is meant to be built (shared components, not per-screen reinvention).
6. **Mobile-first, not mobile-only.** Core actions must be comfortable one-handed, readable outdoors, fast to understand. Desktop should feel deliberately cinematic — a bigger canvas for the same experience — never a stretched phone layout.
7. **Design the emotional beat before the layout.** Ask what the person should _feel_ looking at this screen before deciding what goes where. A recommendation reveal and a settings screen should not use the same visual register.

## Explicit anti-patterns

Do not build:

- A conventional SaaS dashboard.
- A sterile itinerary planner.
- A generic tourism website.
- A form with twenty questions.
- A wall of identical cards.
- A ChatGPT-style text conversation.
- A minimalist beige lifestyle brand.
- A purple-gradient "AI app."
- A corporate productivity tool.

If a screen would look at home in an expense-reporting tool, it has failed regardless of how clean the code behind it is. See the decision hierarchy in [`passport-philosophy.md`](./passport-philosophy.md) — emotional experience outranks code elegance.

## A working example

The `/labs/discovery-space` prototype (`src/components/labs/discovery-space/`) is a concrete instance of these principles applied to a browsing surface: no search bar, no filters, no grid — organic scatter, depth, and a single pinned collection point instead. It intentionally strips everything back to test the emotional beat in isolation. Treat it as a reference for _tone_, not as a template to copy wholesale into product surfaces that need more structure (e.g. Adventure Mode, which needs to be scannable at a glance while moving — see [`ux-principles.md`](./ux-principles.md)).
