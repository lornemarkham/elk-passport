# Release record 2026-11-12: CourtQueue live launch, 25 real players (M757)

Owner brief: _P0 — BADMINTON: 25-PERSON LIVE LAUNCH TOMORROW_ (Thursday
2026-11-12, 6:30–8:30 pm, Coldstream Elementary School Gym). Product:
`docs/product/badminton/README.md`; decision: ADR 017, amendment 2026-11-12.

## What changed (on top of the CourtQueue already in production)

CourtQueue already kept players, nights, games and the queue in Passport's
Postgres, shared by every phone (compare-and-swap writes). This release adds
what the brief asked for that was missing:

- **Four doubles courts** (was three). Stored three-court clubs gain Court 4
  when read; nothing to migrate.
- **Email at sign-up** (name + email + PIN). Private to the organizer; players
  with an account already can add theirs under Me. Not verified.
- **Join link and QR code** in the Organize tab (`/badminton`).
- **Final scores**: asked for when FINISH is tapped (or "We didn't keep
  score"), can be added or fixed afterwards. **Wins, losses, games, history**
  on the Me tab, plus everyone's record in name order and the score beside each
  game under Courts. Still no levels, ladder, ranking or percentage.
- `clock.ts` honours `COURTQUEUE_CLOCK` also on a throwaway **local** database,
  never on a remote one (so the 25-phone rehearsal can run on Postgres).

## Database

**No migration.** Everything is new optional fields inside the JSON documents in
`passport_courtqueue_docs` (`email` on a player, `courts[3]` in the club; game
`score` / `winner` already existed). The CourtQueue migration
`20261110000000_passport_courtqueue.sql` was applied earlier (ledger: 423a989).
No environment variable is new.

## Measured (local, this commit)

- `e2e/badminton-live25.spec.ts`: **25 independent browser contexts** (own
  cookies, phone-sized, iPhone user agent) + 1 organizer, one shared night, on
  (a) the memory store and (b) the **real Postgres + PostgREST** stack: 11/11
  both times. Joins by the UI form; signs up; checks in; queues; four games on
  four courts; START/FINISH with scores on the players' own phones; agreement
  of queue and courts across all 25 views at four checkpoints; no player in two
  places; organizer closes a court and every phone sees it; a late arrival;
  leave and rejoin; scores and history after refresh and from a brand-new
  browser; no 401/403/500 on any request. Scores survive a Postgres restart.
- Unit: 4571 passed (incl. `liveNight.test.ts`: four courts, rotation, scores,
  wins/losses, email). Other badminton specs: `badminton.spec` 6/6,
  `clubhouse.spec` 6/6, `badminton-game-night.spec` 4/4.
- Not measured: real iPhones/Androids, the production database and Vercel
  functions under 25 phones, push notifications.

## Rollback

Revert the commit. Stored `email` and the fourth court are ignored by older
code. Reset commands are in `RELEASE-2026-11-12-COURTQUEUE.md`.
