# Hockey Night — discovery first (2026-10-22)

**Asked:** make the restaurant cards the first thing on Plan; keep seats,
meeting time and after-game decisions, but secondary.

**Changed (`PlanTab.tsx` only, presentation):**

- "Where are we going before?" now leads Plan: the photographic ballot cards
  (or, on a fresh night, the three best places full width) start on the first
  screen at 390 px and at 1280 px. Voting, Add & vote, Atlas reads and seats
  are untouched.
- The plan card ("So far · by vote") moved under the dinner cards; its lines
  still go to every part.
- The vote head is a little smaller and shorter, and a fresh night no longer
  repeats it in a "Near Rogers Arena" header, so the photograph clears the tab bar.
- `release2.spec` now asserts the first card is on the first phone screen,
  unscrolled (was: the plan card starts in the first screen).

Pictures: `discovery-first/` (host fresh, host busy, guest, desktop).

**Verified locally (Metatron, local stack, Atlas stub with production's body):**
tsc, eslint (0 errors, 40 baseline warnings), prettier, vitest 3,560 passed,
`next build`, Hockey browser suite 12/12 (acceptance, arena-off and
email-confirmation not run: they need their own stack variants).

**Not done:** integration into `integration/release` and deployment. This lane
may not touch other branches, push or deploy, so nothing here is live.
