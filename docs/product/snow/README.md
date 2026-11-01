# Go Have A Snow Day — the Snow Experience

**Status (2026-11-01):** first vertical slice, built on `feature/snow`. Not
merged, not deployed, no migration. Routes: `/snow`, `/snow/mountains`,
`/snow/new`, `/snow/day/[id]`, `/snow/join`.

Snow is an Experience **inside** Passport, not a second app. It follows the
doctrine's loop — DISCOVER → SAVE → PLAN → SHARE → EXPERIENCE → REMEMBER → GO
HAVE ANOTHER — and puts its weight on the second half (LIVE, REMEMBER).

## What a crew can do today

| Step        | Where                      | What it does                                                                                                                      |
| ----------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Discover    | `/snow`, `/snow/mountains` | Mountain imagery, one primary action. Atlas ski areas when connected, Passport's short list beside them, distance, skill guidance |
| Plan        | Day → **Plan**             | Date, mountain, getting there, meeting points, tickets, meals, après: options, one vote each, lock-in, last-minute change notice  |
| Build crew  | Day → **Crew**             | Who, what they ride, level, rentals, notes; announcements; share the plan                                                         |
| Hype        | Day → **Get ready**        | Countdown, reminders that fit how close it is, per-person gear list, optional drive-up playlist                                   |
| Challenges  | Day → **Challenges**       | 11 vetted challenges + crew-written ones, level-aware, each with a safety line                                                    |
| Competition | Day → **Challenges**       | Standings and playful awards, derived from what happened                                                                          |
| On the hill | Day → **On the hill**      | Plan card, meeting points, "where I am" in words, quick updates, print card; works with no signal                                 |
| Remember    | Day → **Memories**         | Photos, moments, recap (standings, awards, challenges), plain-text share                                                          |
| Go again    | Memories                   | Vote on the next one; "Same crew, next snow day" carries the crew over                                                            |

## Rules this build holds itself to

1. **Never invent.** Snow, lifts, trails, ticket prices and weather are not in
   the data. `domain/snow/mountains.ts` holds a name, region, approximate point
   and the resort's own site — nothing else — and a test pins that. Every
   such fact on screen carries a badge: `LIVE` (fetched now, from a named
   source), `STATIC` (written down, may be out of date) or `NOT CONNECTED`
   (with where to look). The only live fact is Environment Canada's town
   forecast via Passport's existing `/api/environment/here`, labelled as the
   nearest city, not the summit.
2. **Safe by construction.** There is no point source for speed, steepness,
   jumps, terrain or breaking a rule. Crew-written challenges are checked
   against a deny-list and refused in words. The group rides at its most
   careful member's level. Alcohol is never a prize; the après challenge says
   anyone driving stays alcohol-free.
3. **Location is words, not GPS.** On the hill, "where I am" is a label the
   person taps or types and chooses to send. Passport reads no position on the
   mountain. The mountains page can use browser location to sort by distance,
   only when asked, only in memory.
4. **Offline is exactly what is tested.** The day is on the phone
   (`localStorage`). With the network cut, the open page keeps taking and
   keeping changes (e2e). **Not** promised: opening the app from cold with no
   signal — there is no service worker.

## Reused, not rebuilt

- Hockey Night's `countdown()` (`domain/hockey/countdown.ts`), unchanged.
- Discovery's activity vocabulary (`doesActivity`, "skiing"/"snowboarding"),
  the Atlas client (`discoveryCandidates`), `candidateToExperience`, and
  `distanceKm`.
- Passport's forecast route, `PassportNav`, and its links into Discovery,
  Saved and adventures.
- The Hockey pattern: pure domain + a shell + a derived leaderboard + a
  plain-text recap. (The Experience Lab's `standings()` is bet-shaped, so
  Snow derives its own — it does not copy the code.)

## Tensions with the doctrine, named not resolved

- **§6 gives a skiing example — "Last run challenge. Who gets down fastest?"**
  The mission forbids rewarding speed. Snow keeps the ritual ("Last run: all
  ride down together") and drops the race. Doctrine text is untouched; a
  human may want to reword the example.
- **§14 fences "elaborate social games".** Competition here is one table, six
  awards and an off switch. If that is already too much, it can go.
- **§10 (are Experiences themes or compositions?) stays open.** Snow is a
  composition on shared capabilities with its own primary loop (_where → who →
  ready → ride → remember_), which is evidence, not an answer.
- **§15.12 (how group experiences work)** is informed, not answered: see
  [`SHARING.md`](SHARING.md).

## What is not here

See [`SHARING.md`](SHARING.md) and [`REPORT.md`](REPORT.md).
