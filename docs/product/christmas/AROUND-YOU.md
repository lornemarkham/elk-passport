# Christmas Around You — make discovery magical

**Owner brief:** "CHRISTMAS — MAKE DISCOVERY MAGICAL" (P1, 2026-11-10). Lane
christmas. Authority: the [doctrine](../../PASSPORT-PRODUCT-DOCTRINE.md).

`/christmas` now opens on **Christmas around <town>** instead of a theme
picker. Sections, in a family's order, each hidden when it has nothing real:
Happening soon · Christmas lights near you · Christmas markets · Santa &
family activities · Festive events · Worth the drive · Build a Christmas
adventure (`src/domain/christmas/around.ts`, tested on Atlas's real corpus).

## Rules

- **Where.** The town in the URL, else the one remembered (cookie
  `xm-town`, set only when somebody taps a town), else **Vernon**. Towns are
  Discovery's one list (`domain/discovery/towns.ts`) — Passport has no other
  persisted location; there is no GPS here. Local sections hold only what Atlas
  _places_ within 50 km or names the town's area for; Worth the drive is Atlas's
  placed finds 50–250 km out. Unplaced finds are never called "near you".
- **Sure first.** Dates from Atlas, then "check the days", then "dates not
  confirmed" (each card says which). Last year's finds are never on the front
  page. Happening soon is dated-only, next four weeks.
- **Atlas and local listings stay apart.** Community lights-map pins (reviewed
  by a person, researched public displays) appear in their own labelled row —
  "local listings checked by a person, not from Atlas" — never mixed into
  Atlas's cards (doctrine §12, locals). No second content database: pins are
  Pin the Magic's existing store; finds are Atlas's.
- **One Christmas day.** "Add to my Christmas day" on a find or a display feeds
  one tray; **Make it an adventure** opens the planner with `with=` (Atlas) and
  `lights=` (displays). `POST /christmas/api/start` adds displays as confirmed
  items read server-side from published pins only (privacy rules unchanged).
  Share = the adventure's own invite link.

## What the real data gave (Atlas stand-in, 2026-10-24, read 2026-11-10)

Vernon: 1 dated event soon (Craft Culture Holiday Market, Dec 4), 4 family,
3 festive, 1 worth the drive (Christmas Express); Kelowna: 1 soon, 3 family,
1 festive. Atlas is **thin in the Okanagan** — the community map's researched
pins carry most of the lights, soon and markets rows. Atlas-side gaps (market
dates, coordinates for the Delta Grand and Sparkling Hill listings, Armstrong
and Coldstream events) are Atlas's to fill, not Passport's to invent. This is
the fixture, not live Atlas: run `around.test.ts` with a fresh corpus before
claiming live numbers.

## Not done / open

- **Hot chocolate and dining as stops:** the Day Builder sketch adds food from
  Atlas around the chosen things; the Okanagan has few Atlas food records near
  the lights. Not verified beyond that.
- **Real event times and a driving route** for a mixed day come from the Day
  Builder's travel legs and the lights tour's estimates; a tour route for events
  without coordinates is not built.
- Signed-out "no account" path (`/go`) carries finds, not light displays.
- **§10/§15.1** untouched; this is one more composition.

## Verification

`vitest src/domain/christmas` · `e2e/christmas.spec.ts` (signed out) ·
`verification/around.spec.ts` (real GoTrue/Postgres: Vernon → Kelowna → event +
light → adventure → invite link; screenshots 08–10) · `verification/christmas.spec.ts`
(family journey, unchanged apart from the tray's wording).
