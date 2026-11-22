# Christmas public-launch QA repair (2026-11-21)

Owner brief: _P0 — Passport Christmas public launch QA repair._ A stabilisation
pass over the 40 findings; nothing rebuilt. Doctrine read first (§7, §10, §12,
§15.12); no question in §15 was resolved here.

## What changed

| #          | Finding                              | What it does now                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1, 2       | Location filtering on every page     | The town and the distance ride every link. Front page, Discover, the lights map, the plan sketch and the itinerary read both. **Only what is placed inside the radius is "near you".** Placed further out, or in another area, is set aside and counted ("N set aside: further away"). The "Worth the drive" section (up to 250 km) is gone from the front page. The lights map filters pins and markets by radius.                        |
| 3          | Distance selector                    | 15 / 30 / 60 / 100 km, 30 default (`DistancePicker`; `DISTANCES`/`DEFAULT_KM` in `discover.ts`). Old links with 10/25/50/250 fall back to 30. The itinerary's drive reach is the chosen distance unless the sentence says "within 10 km".                                                                                                                                                                                                  |
| 4–7        | Expired / current / historical dates | `readWhen` gains a **phase** (on now / upcoming / finished). A dated find's badge says _On now · dates confirmed_ or _Upcoming · dates confirmed_; a window says _Check the days_; no dates says _Dates not confirmed_; earlier years say _Earlier dates_ and sit on their own shelf, never on a front-page section. An organiser's schedule that names only earlier years ("…Dec 24, 2024") is now _earlier dates_, not "check the days". |
| 8–11       | Privacy                              | See below. New private page `/christmas/list`.                                                                                                                                                                                                                                                                                                                                                                                             |
| 12–15      | Navigation                           | `ChristmasNav` under the global header on every Christmas page: **Discover · Lights Map · My Christmas List · Plan My Route · ← Go Have a Day**. See "Outside my lane".                                                                                                                                                                                                                                                                    |
| 16, 17     | Snow On / Light the Fire             | Both buttons removed. The snowfall stays (still off for reduced-motion devices). Fireplace sound is no longer offered.                                                                                                                                                                                                                                                                                                                     |
| 18         | "What are you in the mood for?"      | The plan builder's first question.                                                                                                                                                                                                                                                                                                                                                                                                         |
| 19         | No Atlas in public words             | About 55 strings reworded (cards, shelves, plan notes, errors). Internal code and comments still say Atlas. An e2e check fails the build if "Atlas" appears in the front page or Discover.                                                                                                                                                                                                                                                 |
| 20, 21     | Add to My Christmas List             | Renamed. **Save vs Add investigated — see below.**                                                                                                                                                                                                                                                                                                                                                                                         |
| 22         | Simpler location                     | One place bar (unchanged) with the distance row directly under it, on the front page, Discover and the lights map.                                                                                                                                                                                                                                                                                                                         |
| 23         | Obvious text input                   | Bordered white box, "Tell us what you'd love to do", and it is the first thing on **Plan My Route** for everybody — no account.                                                                                                                                                                                                                                                                                                            |
| 24         | Dates in generated plans             | The day control stays on the plan after a day is chosen (it only showed while the day was unanswered).                                                                                                                                                                                                                                                                                                                                     |
| 25, 26     | Venue blurbs, itinerary language     | A venue's own paragraph is no longer printed on a stop. "“Christmas” in its organiser's facts" → "Matches “Christmas”".                                                                                                                                                                                                                                                                                                                    |
| 27, 28, 29 | Browse, destinations, personal       | The tall "Browse real Christmas" tiles and "Show me everything" tile became one row of chips. Lights Map is in the bar. "Your Christmas adventures" moved off the front page to `/christmas/list`.                                                                                                                                                                                                                                         |
| 30–33      | Placeholders and photos              | Giant emoji blocks removed from the lights cards, light pages and the tour. No photo → a compact text card. Venue photos of a different thing are still never used (`pictures.ts`).                                                                                                                                                                                                                                                        |
| 34, 35     | Mobile                               | Hero no longer fills the screen; the first thing under it is the dated list. The lights map is 63 % of the screen (was 68 %) so its button stays in view with the new bar.                                                                                                                                                                                                                                                                 |
| 36–40      | Surprise Me                          | **There is no Surprise Me in the Christmas lane** (nothing in `src/*christmas*`); the one in Go Have a Day belongs to Discovery (ADR 005). Not invented here. See "Open".                                                                                                                                                                                                                                                                  |

## Save vs Add (finding 21)

Two buttons on a card, different things:

- **Save** writes the experience to the person's Atlas _board_ (`boards-repo`,
  the one Saved / My Stuff collection). Server-side, owner-only, needs an account.
- **Add to My Christmas List** was a `sessionStorage` selection that **vanished
  when the tab closed** and was never shown anywhere but a floating tray. It is
  now kept on the device (`localStorage`), shown on `/christmas/list`, and
  carried into a plan by "Plan these". It is **not** sent to a server until it
  becomes a plan, so it is private by construction.

They remain two actions. Whether they should become one (Add = Save + queue
for the plan) is a product decision, doctrine §15.14 (Want / Plan / Lived), and
is left open: merging them here would silently pick an answer.

## Privacy (findings 8–11) — what was actually tested

- `verification/privacy.spec.ts` (real GoTrue + PostgREST + Postgres, RLS on):
  an anonymous visitor, a signed-in stranger, an invited member and the owner,
  against the API and the pages. Added this pass: `/christmas/list` shows the
  owner her plan, shows a stranger and a visitor nothing of it, and a signed-out
  visitor gets a sign-in prompt. **Passes.**
- Shared links: a single-use invite link makes one stranger a member, cannot be
  reused, and a member cannot mint links, announce or delete.
- `acceptance.stack.test.ts` 15 of 16 (the 16th calls the group-adventures
  stack's own restart script, which this checkout cannot run; unchanged).
- **Not covered:** production's RLS and grants (only a local stack was
  reachable). The migrations are the same files, so the claim is "the policies
  as written hold", not "production holds".

## Outside my lane

- `src/lib/adventures/…`, `src/domain/experience/…`, `src/components/ghad/…`:
  read only.
- **Shared contract not touched:** `src/components/shell/PassportNav.tsx`. The
  global bar still shows Discover / My Stuff / Build a Day / Experiences above
  Christmas's own bar. The change that hides them inside `/christmas` is one
  conditional: `proposals/shell-nav.md`.

## Conflicts named

1. **Doctrine §12 ("silence still removes nothing") vs finding 1.** The owner's
   QA asks for a hard radius. On Christmas, a find Atlas places outside the
   radius, or in another area, is now set aside (and counted). A find with no
   place at all is _kept_, on a shelf headed "Location not confirmed", and is
   never offered as near, on the front page, or in a plan. Same owner
   decision as the 2026-11-14 production-polish note; it is still the owner's.
2. **Branch.** `CLAUDE.local.md` says commit on `feature/christmas`; the
   checkout is on `ship/christmas-increment`, where every Christmas release
   since 2026-11-14 has been committed. Work is on the checked-out branch.

## Open

- Surprise Me for Christmas does not exist; building it is a feature. When it
  is, it must read `ask.km`, `readWhen().phase` and the "dated" confidence only.
- The lights tour page still lists festive stops by the map's own area, not
  the chosen distance.
- `verification/christmas.spec.ts` and `around.spec.ts` remain stale.
