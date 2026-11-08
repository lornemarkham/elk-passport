# Go Have a Day — the experience overhaul (mission 642, 2026-11-08)

The owner's brief: _turn Go Have a Day into a delightful, easy-to-use
adventure discovery and planning experience — connect what exists, don't
rebuild._ Journey: **DISCOVER → SAVE IDEAS → BUILD AN ADVENTURE → GO HAVE A
DAY → REMEMBER IT → DO IT AGAIN.** Doctrine §9 records the decisions.

## What changed, and where

| Brief | What a person gets                                                                                                                                                                                                                                                           | Where                                                                               |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| P0    | The bar is **Discover · My Stuff · Build a Day · Experiences**. Places and Labs are off it (routes kept; Labs is linked from `/creative`). Date Night is in Experiences.                                                                                                     | `src/components/shell/PassportNav.tsx`                                              |
| P1    | No board beside Discovery; results use the full width (4 columns at 2xl).                                                                                                                                                                                                    | `DiscoveryListView.tsx`                                                             |
| P2    | **Adventure Pocket**: "3 ideas saved · Make a day" in the corner; a panel on desktop, a bottom sheet on a phone; photos, remove + Undo, reorder, details, Make a day, Make a weekend, Keep collecting. Saving says "Good find. Into the Pocket." with Undo.                  | `src/components/pocket/AdventurePocket.tsx`, `src/lib/pocket/`                      |
| P3    | **My Stuff** (`/saved`): next adventure, then Ideas · Collections · Adventures · Memories. Collections are optional and made later (empty, or from chosen ideas).                                                                                                            | `src/app/saved/page.tsx`, `src/components/my-stuff/`, `src/lib/data/loadMyStuff.ts` |
| P4    | Pocket → Make a day opens the Day Builder with the chosen ideas kept, in Pocket order; it adds food, travel and order as it always has. A day not opened from an adventure can now be **saved as an adventure**. "Make it a weekend" carries the stops into a new adventure. | `src/components/go/SaveAsAdventure.tsx`, `GoHaveADay.tsx`                           |
| P5    | Discovery's area follows a shared position (nearest named town within 40 km), not only a picked town. Pocket pictures fall back like cards.                                                                                                                                  | `DiscoveryListView.tsx`                                                             |
| P6    | One voice file, used by the Pocket, toasts, My Stuff and the Day Builder ("Well, that looks like a pretty good day.").                                                                                                                                                       | `src/lib/voice.ts`                                                                  |
| P7    | Featured hosts between Discovery's shelves; ELK Lark is the first entry; labelled; no dates, prices or availability.                                                                                                                                                         | `src/domain/featured/hosts.ts`, `FeaturedHosts.tsx`                                 |
| P8    | A day finished on the phone is a memory at once (device mark, like the companion's).                                                                                                                                                                                         | `src/lib/adventures/lived.ts`, `TodayPanel.tsx`                                     |

## Decisions made here (named, not buried)

- **Ideas is every board the person owns.** Saves go to their first own
  board (a new person gets "My Places", as a place page's first save already
  did); every other board is a collection, including boards shared with
  them. Remove takes an idea off every own board holding it, and Undo puts
  it back on exactly those. No store, table or migration was added.
- **The Pocket's order is kept on the device** (`gh.pocket.order`). It is
  only an order; membership always comes from the boards.
- **A thing saved now stays where it is on Discovery**, marked _Saved_;
  things saved on an earlier visit stay out of the feed, as before.
- **Memories** = adventures whose dates are over, plus days finished on this
  phone. §15.14 (Want / Plan / Lived) stays open.
- **The next adventure still leads My Stuff** (ADR 012), above the four
  sections the brief orders.

## Open questions for the owner

1. **Where ELK Lark's card should lead.** Gold Bank GB-2026-10-11-029 records
   elklark.com as presenting retreats and accommodation; the brief says
   adventures, not a B&B. The card leads to `/about` ("Meet the family")
   until there is somewhere honest to send people. Atlas holds no ELK Lark
   record (checked in the 2026-11-08 production corpus).
2. **The default area for a person who has said nothing.** Still the area
   most of Atlas's corpus is about (now Metro Vancouver, 4,559 ideas, with
   "912 more in Okanagan" one tap away). An IP-based default needs an owner
   decision (privacy, provider).
3. **Collections vs boards wording.** `/boards/:id` still says "board".

## Verification

Real browsers, real local Supabase (GoTrue sign-up, PostgREST, RLS) and a
production Atlas corpus captured 2026-11-08 (Sandhill Winery
`01614338…`, Penticton Farmers' Market `46f8bcb0…`/`756d7193…`, Peak of
Christmas `61a9f336…`):

```
STACK=~/passport/scratch/m642-stack SITE_URL=http://localhost:3164 \
  node docs/product/group-adventures/verification/stack.mjs start
node docs/product/group-adventures/verification/atlas-standin.mjs <corpus.json> 3165
# in a scratch clone (this checkout's .next is served by a stale server):
set -a; . $STACK/env; set +a; export ATLAS_API_URL=http://127.0.0.1:3165
npm run build && npx next start -p 3164
E2E_PORT=3164 npx playwright test -c docs/product/go-have-a-day/verification
```

`journey.spec.ts` drives the owner's fourteen steps on **desktop** and
**phone (Pixel 7)**, checks the board through the API after each step that
could lose something, and screenshots each step.

Not covered by it: the Day Builder's reading of "Add somewhere for lunch" is
checked only to answer (not to add a lunch stop), photo capture on a real
camera, and the map canvas (tiles unreachable from Metatron).
