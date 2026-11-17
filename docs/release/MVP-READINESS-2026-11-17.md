# MVP readiness — the five experiences (M864, 2026-11-17)

**MVP:** a real visitor can complete the experience's primary journey on their
phone without assistance. Priorities: working functionality, reliable data,
clear loading/error states, mobile usability, no broken images or links.

## How to read this

Evidence labels: **READ** (code or docs), **RAN** (I executed it), **UNKNOWN**.
Four read-only agents audited the code and docs. The only things run were unit
tests: Christmas 71 passed, Date Night 110 passed (2 skipped), Hockey 412
passed. **No browser, no Playwright, no production call.** Nothing here proves
a journey works on a phone, and nothing says what is applied in production.
Estimates are rough engineer-days. Production state is the same blind spot for
all five: which Supabase migrations are applied is UNKNOWN from this checkout.

## Ranked roadmap (closest to shareable first)

| #   | Experience | Verdict                                                             | To MVP                               | First move                                                              |
| --- | ---------- | ------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------- |
| 1   | Christmas  | No hard blocker found                                               | 2–3 d (3–5 if a migration is absent) | Stop the signed-out `/api/boards` 401; walk the plan journey on a phone |
| 2   | Snow Day   | One-phone day built and specced; shared day and conditions are gaps | 1–3 d                                | Confirm snow migrations; decide `SNOW_FORECAST`; re-verify resort dates |
| 3   | Hockey     | Public site works (prod audit); signed-in journey never evidenced   | 2–4 d + owner steps                  | Two-phone production run; NHL terms decision                            |
| 4   | Sesh Wars  | Real competition off; demo works                                    | 4–6 d + owner decisions              | Move and apply the migration, add a moderator, exercise real Storage    |
| 5   | Date Night | **Not MVP**: one dated Vernon evening for one couple                | 9–12 d                               | Owner decides the sign-in-first question; then generic date/place       |

Ranking is a hypothesis built on the agents' reading. Seasonal timing matters
for order: Christmas is in season now and loses value after 25 December;
Snow Day's resorts open 21–27 November; Hockey is mid-season.

## 1. Christmas

1. **Works (READ: specs):** `e2e/christmas.spec.ts` (10 tests) and
   `e2e/christmas-lights.spec.ts` (2): countdown, sentence to plan with
   sign-in carried through, Vernon then Kelowna, event plus lights in one
   day, lights map, tour, bingo, private pin. Several need `E2E_ATLAS=1`.
   Production audit: loads, 55 images, none broken, no horizontal scroll.
2. **Critical bugs:** none found. `Picks.tsx:71-90` calls `/api/boards` on
   mount; signed out it gets a 401 (`src/app/api/boards/route.ts:14-16`),
   swallowed in the UI but logged. Fix ≈ 0.25 d.
3. **Missing for MVP:** production proof that a signed-in visitor reaches a
   kept plan; `20261101000000_passport_adventure_together.sql` (sharing) and
   `20261111000000_passport_insiders.sql` (lights pins) applied: UNKNOWN.
4. **Mobile:** not reviewed in depth; tap targets and the map's loading and
   error states unchecked. Atlas-down panel exists.
5. **Estimate:** 2–3 d; +1–2 d if a migration is absent or the plan step fails.
6. **Acceptance (phone):** (a) `/christmas` shows countdown and Vernon-first
   sections, no atlas-down panel, no sideways scroll. (b) A theme chip opens
   `/christmas/discover` with images. (c) Picking then planning signed out
   goes to sign-in and returns. (d) Signed in, `/christmas/plan?shape=evening`
   with a town and date makes an `/christmas/adventure/[id]` page with a
   sketched day within ~10 s. (e) Share link opens for a second account.
   (f) `/christmas/lights` renders pins, filter works, a pin opens. (g) Tour
   and bingo work. (h) Signed out, console has no 401.
7. **Deployment:** `ATLAS_API_URL` required; two migrations above unconfirmed
   (use `together-preflight.sql` first; never `supabase db push`). Dates:
   `challengePicks.ts:78` defaults to `2026-11-01` (wrong for 2027); the 2026
   lights pins are hand-seeded; after 25 December the page says Christmas has
   been.

## 2. Snow Day

1. **Works (READ):** `e2e/snow.spec.ts` (3) and `e2e/snow-mountain.spec.ts`
   (3): crew plans and remembers, shared plan opens as a copy, start the day
   with gloves, no invented forecast, stale forecast marked old. Production:
   `/snow` and `/snow/mountains` load.
2. **Critical bugs:** none confirmed. The forecast is off unless
   `SNOW_FORECAST=on` (`src/app/snow/api/conditions/route.ts:13`), pending
   Open-Meteo terms, so conditions for a chosen mountain are thin.
3. **Missing for MVP:** shared days need `20261103000000_passport_snow.sql`
   and `20261108000000_passport_snow_activity.sql` (applied? UNKNOWN; hidden by
   a readiness probe if absent). Resort facts are static, checked
   2026-11-08; SilverStar alpine 2026-11-27 is "tentative"; all resorts are
   closed today. No live lift or run status.
4. **Mobile:** specs run at 390×844 with glove targets; nothing wrong seen in
   code.
5. **Estimate:** 1–3 d.
6. **Acceptance (phone):** `/snow` → Find a mountain → pick → Start a day;
   opening date shows with its caveat; with forecast off the page says so;
   add activities, lunch and après, save, reload and it persists; share link
   opens as a copy on a second phone; two signed-in phones start a shared
   day, invite and vote (only if migrations applied); airplane mode marks the
   forecast old.
7. **Deployment:** code live. `SNOW_FORECAST=on` optional, owner call.

## 3. Hockey Night

1. **Works:** production audit: public `/hockey` shows live scores, standings,
   teams; Create a Night sends a signed-out visitor to sign-in and back.
   RAN: 412 unit tests. Past sign-in: docs claim only. **No hockey spec is
   in `e2e/` in this checkout** (the docs cite specs I could not find).
2. **Critical bugs:** none confirmed; the signed-in journey was not run.
3. **Missing for MVP:** a recorded two-phone production run; the NHL terms
   decision (`WEBSITE.md:84-125`: personal, non-commercial, no
   redistribution, undocumented API); Supabase redirect allow-list and
   email/SMTP settings (UNKNOWN); results are called by hand ("Call it");
   mini fantasy is disabled. The OWNER-CHECKLIST is tied to the 25 Oct game
   and is stale. Off-season empty state not verified (mid-season now).
4. **Mobile:** docs report 390 px, 44 px targets; not rendered here.
5. **Estimate:** 2–4 d plus about 1 d of owner steps; low confidence.
6. **Acceptance (phone):** `/hockey` signed out renders scores, standings,
   teams, no sideways scroll → a game → Create a Night → sign-in → returns to
   the start form (not the homepage) → create on an upcoming game → copy an
   invite → second account joins and the host sees them → a used link is
   refused clearly → guest picks, host sees → host calls the result → everyone
   sees it → `/hockey/my-nights` lists it; leave and remove-guest work → with
   NHL blocked the pages show the "can't be reached" copy, not a crash.
7. **Deployment:** core `migration.sql` plus `announce-migration.sql` (the one
   the docs list as outstanding) and optional memories, mayhem, crew, arena,
   chirp, alive, seats SQL; which are applied is UNKNOWN. Env:
   `NEXT_PUBLIC_SUPABASE_*`, `ATLAS_API_URL`, `ATLAS_SERVICE_TOKEN`;
   optional `NHL_API_BASE`, `HOCKEY_SITE_ORIGIN`, `OPENAI_API_KEY`.
   Kill switches: `disable.sql`, Vercel rollback. Hockey nights live under
   `/hockey/[id]`, not `/night/[id]` (that is Date Night).

## 4. Sesh Wars

1. **Works:** the demo (`/snow/sesh-wars/demo`, fictional riders) and two
   e2e tests; 20 domain unit tests. The real flow is covered only by local
   stack tests that use a stand-in for Storage, so real upload is unproven.
2. **Critical bugs / blockers:** the real competition is off.
   `seshReady()` (`src/app/snow/_server/sesh.ts`) probes
   `passport_sesh_features`; absent, the page says "warming up". No flag
   exists. iPhone HEVC `.mov` clips may not play everywhere (no transcoding).
   Only Big White (3) and Whistler (4) have features, SilverStar none; Big
   White's park opens 2026-11-26, so nothing is postable today.
3. **Missing for MVP:** move `docs/product/snow/sesh-wars-migration.sql` into
   `supabase/migrations/` and apply it (it is not there; rollback is
   `sesh-wars-rollback.sql`); insert a moderator (SQL only, no UI); a
   moderation queue; seed content; owner calls on Storage plan (ADR 019
   proposed), age model, and doctrine §14.
4. **Mobile:** clips can exceed the 50 MB limit and the limit is shown only
   as a message; upload goes browser-to-Storage and fails with "didn't make it"
   on poor signal.
5. **Estimate:** 4–6 d plus owner decisions.
6. **Acceptance (phone, after migration):** `/snow/sesh-wars` does not say
   "warming up" → open a feature after its park opens → sign in on a second
   phone and post a 10 s clip with both safety confirmations → it appears and
   plays → a second account challenges with an answer clip → a third votes,
   the tally updates, a second vote is refused → the shared link opens
   elsewhere → repeat with an iPhone `.mov`, plays on Android and desktop.
7. **Deployment:** NOT READY (migration, moderator, bucket, owner decisions).

## 5. Date Night

1. **Works:** RAN: 110 unit tests (compose, itinerary, plays, answers). The
   legacy `/lorne-and-jess` flow lets one person answer without an account
   (docs, local stack). `/datenight` loads. No spec in `e2e/`; phone specs sit
   in `docs/product/date-night/verification/`.
2. **Critical bugs / conflicts:** the itinerary is hard-coded to 2026-11-02 in
   Vernon with the partner named "Jess"
   (`src/domain/date-night/adventures/tomorrow.ts:5`, `markham.ts:87-88`);
   that date is past. **Sign-in wall before value** (`OpenNight.tsx:39-45`,
   `/api/night/start`, `src/app/night/[id]/page.tsx`): a visitor sees a photo,
   a title and a button. This conflicts with doctrine §2.1 and is named, not
   resolved. The invitee must also sign in on the new `/night` flow.
3. **Missing for MVP:** a choose-your-own evening, date and place; a
   pre-sign-in preview; anonymous answers on `/night`; per-night Atlas
   lookups instead of baked ids; specs in `e2e/`.
4. **Mobile:** nothing wrong seen in code; the failure copy "Couldn't start
   just now" has no detail or retry.
5. **Estimate:** 9–12 d.
6. **Acceptance (phone):** signed out, `/datenight` offers an evening and a
   future date and shows a dated itinerary with no sign-in → changing place or
   date updates sunset and hours (BC times correct) → Invite makes a link
   (sign-in asked here at most) → a second phone in a private window answers
   Yes/Maybe/No with no account → the first phone sees the answers, which
   persist on reload → packing list has no PGRST205 → airplane mode keeps the
   draft across reload.
7. **Deployment:** `20261102000000_passport_date_nights.sql` may be unapplied;
   packing needs `NOTIFY pgrst, 'reload schema'` run by hand; check with
   `PREFLIGHT-SHARED.sql` A and G (UNKNOWN). `ATLAS_API_URL` needed;
   `WEATHER_PROVIDER=msc` optional.

## 6. Seasonal Archive (built with this report)

October is the first entry. Christmas will need it after 25 December.

- `SEASONAL_ARCHIVE` and `LABS_NOW` in `src/lib/experiences.ts`; status
  **Out of Season**; optional `seasonal: { season, reactivation[] }`.
- `/labs` has a **Seasonal Archive** section above Prototypes. Routes, content
  and the Open Experience link are unchanged; October stays public.
- **Reactivation** is moving an entry from `LAB_EXPERIENCES` into
  `EXPERIENCES`. It is never date-driven, and each entry carries the checklist
  (dates, content, functionality, owner agreement) that must be confirmed first.
- Verified: `tsc` clean, eslint 0 errors, `experiences.test.ts` and shell
  tests pass (41). **`e2e/labs.spec.ts` was updated but not run**: the
  Playwright dev server exited at start-up on a Next.js security-upgrade
  notice (see the report below). Run it before shipping.
- October moved from "Archived" to "Out of Season" (a judgement call, §9).

## Owner decisions this audit surfaces

NHL data terms (Hockey); Sesh Wars Storage plan, age model and §14 fence;
`SNOW_FORECAST`; Date Night sign-in-first versus doctrine §2.1; whether
October is "Out of Season" or "Archived"; applying the unapplied migrations.
