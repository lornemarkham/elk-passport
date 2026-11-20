# Christmas public-launch polish (2026-11-19)

Owner brief: _P0 — Passport Christmas: public launch polish._ Improves the
existing experience; nothing was rebuilt. Doctrine read first (§10, §12,
§15.12); no open question in §15 was resolved here.

## What changed

| Brief           | Change                                                                                                                                                                                                                                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Cards         | `FindCard` no longer paints a dark title tile when there is no picture, and no longer prints the title twice: no honest picture → a compact text card (`CardPhoto` renders nothing; a failed image falls to the next, then to nothing). Stand-in photos of the _kind_ of thing ("Illustrative photo", "Representative image") are dropped (`pictures.ts`). |
| 1 My adventures | "Your Christmas adventures" is a compact text list (`MyAdventures`, `mine.ts`): upcoming first, soonest first; past ones folded behind a count; the same plan (title + days + place) shown once and the repeats counted, never deleted.                                                                                                                    |
| 3 Entry points  | Three tiles under the headline: **Explore Christmas lights** (`/christmas/lights`), **What's happening tonight?** (`/christmas/discover` with today as the only day — only what Atlas dates to today), **Plan a Christmas adventure** (the sentence box).                                                                                                  |
| 4 Map           | Suggested drives on `/christmas/lights` (`drives.ts`): built with the existing `buildTour` from published pins confirmed lit this season, on the first night they are all on; a drive with fewer than two such stops is not offered. Directions open Google Maps from the phone's own position. Overflow at 320 px fixed.                                  |
| 5 Data          | A "date range" longer than 75 days is no longer "Dates from Atlas": it reads _Check the days_ and stays off Happening soon (a weekly DJ night listed "Dec 25, 2025 – Dec 25, 2026" was shown as a confirmed date). Atlas's geocoder notes (`→ … (bc-address-geocoder: …)`) no longer print on cards (`tidy.ts`).                                           |
| 8 Console       | Signed-out visitors no longer fire `GET /api/boards` (a 401 on every page view): `PicksProvider` asks only when someone is signed in.                                                                                                                                                                                                                      |

## Conflict named (doctrine vs brief)

The brief allows "curated Christmas artwork" where an image is missing.
Doctrine §12 (2026-11-13) says never an unrelated stock picture. Resolved the
conservative way: **text-first**, no artwork added. If the owner wants
illustration it is a design addition, not a photograph.

## Verification (local, on a production build, port 3131)

- Stack: real GoTrue + PostgREST + Postgres with the migrations; Atlas
  stand-in serving Atlas's real corpus of 2026-11-14. **Production Atlas and
  the production database were not reachable from this lane.**
- Privacy: `verification/privacy.spec.ts` (HTTP, 5 kinds of visitor) and the
  existing `acceptance.stack.test.ts` (15/16; the one failure is its
  restart step calling the group-adventures stack script). Anonymous reads of
  all seven adventure tables are refused by Postgres (42501).
- Data: `quality.eval.test.ts` over the 6,426-candidate corpus: 347 Christmas
  finds, 291 dated, 0 expired-but-not-shelved, 0 expired on any front page.
  Only 17 of 347 have an honest picture; 5 carry a price in the organiser's
  words; Atlas candidates carry no official-website field.
- E2E: `e2e/christmas*.spec.ts` 18/18; unit 4,708 pass; eslint 0 errors;
  prettier clean; build exit 0.
- Mobile: 7 pages × 320/375/390/820/1280: no horizontal scroll, no broken
  image, no title tile, no console error; median load 1.8 s on the dev box.

## Not done / stale

- `verification/christmas.spec.ts` (3-person journey) and `around.spec.ts`
  are stale against ADR 020 (the town pills they click are gone) and against
  corpus drift. Not gates; they need rewriting before they can be trusted.
- Lumby/Coldstream/East Hill have few or no confirmed-lit places yet; drives
  appear only where two or more are confirmed for a night.

## Merge with the experience-first front page (M950, 2026-11-20)

M942 was written against the old front page; production already ran M865's
(six ways, near-you strip, Surprise me). On merge the front page keeps **M865's
behaviour** and takes these of M942's changes: the three entry points under the
headline (Explore lights / What's happening tonight? / Plan — `#plan` is the
sentence box), "Your Christmas adventures" as the compact `MyAdventures` list,
and no `GET /api/boards` for signed-out visitors (`PicksProvider signedIn`).

**Dropped from M942 on the front page** (M865's layout has no place for them):
the hero photograph and its "Pictured:" line, the theme tiles with Atlas counts,
and the "How Passport knows" counts panel. `FindCard`/`CardPhoto` text-first
cards, drives, date honesty and the discover/lights changes are all kept.
`CardPhoto` also now re-checks on mount for a picture that failed before
hydration. `e2e/christmas.spec.ts` "every picture fails" now expects a text
card (heading), not M865's title tile.
