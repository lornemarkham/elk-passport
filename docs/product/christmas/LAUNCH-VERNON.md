# Vernon launch — the Christmas Lights Map (P0, before 2026-11-27)

Written 2026-11-14 (M840). Read `PIN-THE-MAGIC.md` first: this page is the
launch checklist and the plan around it, not a redesign.

**Share this URL:** `https://gohaveaday.com/christmas/lights` (the `www.` host
308s to it). `?at=vernon` opens the map on a town. Its link preview is
`/christmas/lights/opengraph-image` (drawn, shows no home). Invitation to
submit: the red **PIN THE MAGIC!** button on the map.

## Evidence, by the ten things to verify

| #   | Check                  | State       | Evidence                                                                                                                                                                                                                                                                                                                                 |
| --- | ---------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Map works in prod      | **Partly**  | Prod 322d05c serves `/christmas/lights` 200, `/api/lights` `ready:true`, 15 pins, map-worker 200. Not seen on a real phone.                                                                                                                                                                                                              |
| 2   | Submissions persist    | **Local**   | `e2e/christmas-lights.spec.ts` on `next start` with the memory store: submit → private → reviewer → published. **Not run against prod** — it needs a signed-in account and would leave a pin in the public store.                                                                                                                        |
| 3   | Photos                 | **Local**   | Same spec uploads a JPEG, sees the preview and the published photo. Prod unverified.                                                                                                                                                                                                                                                     |
| 4   | Homeowner privacy      | **Tested**  | Domain rules 1–2 in `lights.test.ts` (71 tests) + the spec: a home is invisible until owner consent is recorded; photo 404s.                                                                                                                                                                                                             |
| 5   | Moderation / takedown  | **Tested**  | Owner report hides at once; reviewer restore/decline; submitter remove. Needs a named reviewer in prod (`ADMIN_EMAILS` or an ambassador) — **unconfirmed**.                                                                                                                                                                              |
| 6   | Mobile map / location  | **Partly**  | Spec runs at 390×844 (emulated). Not a real device. Metatron's phone Chromium is known to crash on idle pages.                                                                                                                                                                                                                           |
| 7   | Build My Lights Tour   | **Local**   | Spec builds, shares and reopens a tour link; saving needs sign-in.                                                                                                                                                                                                                                                                       |
| 8   | Lights Bingo           | **Local**   | Spec plays it; unit-tested seeded card.                                                                                                                                                                                                                                                                                                  |
| 9   | Atlas listings current | **Unknown** | No Atlas here. The map's 15 pins are researched, each with source/date/quote; 5 are last-confirmed 2025 and show dim. **Coldstream and Lumby have no pins; prod has no homes yet.** Frostival (Fri Nov 27) is the first dated pin.                                                                                                       |
| 10  | Analytics              | **Added**   | Page views: existing Vercel Web Analytics (path only). New server events: `lights_pin_submitted` (town, kind, photo), `lights_approve/decline/report/remove/react/check`, `lights_tour_saved`. Reviewer dashboard at `/christmas/lights/review` ("Launch numbers"). **Custom events need a Vercel plan that includes them — unchecked.** |

## What this change added

- Share preview: Open Graph + Twitter card, canonical URL, 1200×630 image.
- `src/lib/measure.ts` (the hockey helper, promoted; Hockey re-exports it) and
  the events above. No ids, emails, addresses or coordinates are sent.
- `launchStats` + the reviewer-only "Launch numbers" panel.

## Remaining blockers (none is code)

1. **Ship it.** Nothing here is deployed; Pushing is disabled in this checkout.
2. **One real prod submission** by a person, end to end (pin + photo → reviewer
   publishes → takedown), then delete it. I did not write to the public store.
3. **A named reviewer** who will clear the queue daily, or nothing a family
   submits ever appears.
4. **Coldstream / Lumby seed**: source real public displays (e.g. the
   Coldstream light-up venue) or launch Vernon-only and say so. Do not invent.
5. Confirm Vercel Analytics custom events are on for the project.
6. Re-read the researched pins' organiser pages before the first post.

## $100 advertising experiment (not purchased)

Question: does a cold Vernon parent pin a display or build a tour?

- **Spend:** $100 over 7 days, Facebook/Instagram, ~$14/day, Vernon + 15 km
  (Coldstream, Armstrong), parents 28–50. One ad set, two creatives.
- **Creatives:** A "Know a house that goes all out? Pin it." B "Build a free
  lights tour for tonight." Both use the share image; both land on the share
  URL with `?utm_source=fb&utm_campaign=lights-a|b` (the analytics strips
  query strings, so read the split in Meta, and count landings by path).
- **Judge by:** cost per landing, per tour saved, per pin submitted. Success =
  ≥ 5 pins submitted or ≥ 20 tours saved. Below that, spend nothing more and
  try community groups (Vernon Facebook groups, Vernon Morning Star, school
  newsletters) first — free, and where lights recommendations actually spread.
- **Gate:** do not start before blockers 1–3 are closed.

## Score and recommendation

**Launch readiness: 62 / 100.** Product and privacy are built and tested;
production proof, a reviewer and Coldstream/Lumby content are missing.

**CONDITIONAL GO** for a free, Vernon-only soft launch once blockers 1–3 are
closed (days, not weeks). **NO-GO on paid ads** until then.
