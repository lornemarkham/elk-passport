# Passport Labs (`/labs`)

A playground for experiments that work but are not products yet. A **LABS** link
sits quietly at the right of the Passport bar. Each experiment is listed with a
status decided from the environment it runs in (`src/app/labs/experiments.ts`):
a card links only if it can be played there; otherwise it says why and has no link.

Labs does not settle the open Experience-architecture question (doctrine §10);
it only makes experiments reachable. Inspiration (§13) and the §14 futures are
not here.

| Experiment                 | Route                                 | Status here                                                        |
| -------------------------- | ------------------------------------- | ------------------------------------------------------------------ |
| Go have a day              | `/go`                                 | Playable when `ATLAS_API_URL` is set                               |
| Discovery · Vancouver      | `/discovery` (pick Vancouver)         | Playable when `ATLAS_API_URL` is set                               |
| Hockey Night (lab fixture) | `/labs/experience/sycle-hockey-night` | Playable, browser-only, invented people                            |
| Experience Lab             | `/labs/experience`                    | Playable, browser-only                                             |
| Conference                 | `/labs/conference` → `/conferences`   | Follows `conferenceSetup()`; closed in production until configured |
| Conference · Arrivals      | —                                     | Blocked outside development (no durable store)                     |
| Hockey Night · shared      | —                                     | Blocked: needs real auth + unapplied migration; **not merged**     |

**October is not in Labs.** It belongs to iamoctober.com (queued mission 230).

## What was merged

`integration/labs` = `conference/live` (origin/main + Experience Lab +
conference RC + a first Labs door) + `release/go-have-a-day-family-rc`
(Go have a day, Discovery incl. Vancouver origin) + the Labs index and nav link.
Not merged: `feature/hockey`, `integration/october`, `lane/boards`,
`fix/ghad-understand-intent`.

## Known limits

- On phones the three-dot theme picker is hidden so LABS fits in the bar. Sign in
  still scrolls off the right edge at ~412px, as it did before.
- `go-release.spec.ts:212` is flaky under parallel workers (passes alone).
