# Release record 2026-11-10: CourtQueue — Everyone belongs (M686)

Owner brief: _COURTQUEUE — P0: EVERYONE BELONGS_. Product: `docs/product/badminton/README.md`
(section _Everyone belongs_). ADR 017 amendment. Stacks on `7b38708`.

**Not pushed, not deployed from the mission** (`CLAUDE.local.md`): the Forge
runner ships local `main` once no Passport mission is running.

## What ships

- No skill levels, tiers, win records, points, boards, scores or "challenged"
  language anywhere in the app, the API or notifications.
- "What kind of game sounds fun today?" (3 optional choices, per night).
- Welcome copy; "happy to say hello" volunteers seat beside newcomers.
- Organizer: **Play next**, rename/close courts, assign by hand, fix times.
- **No migration, no env, no package change.** Existing stored clubs (real
  players, "Beginner/Intermediate/Expert Court" names, `skill` fields) are
  cleaned when read and rewritten clean on the next club write.

## Check production (after the runner ships it)

1. `/badminton`, "I'm new": name and PIN only; the welcome line is shown; no
   level choices.
2. Sign in as an existing player: no level tag on the Me card; no "Club board",
   no won–lost, no points; Courts tab shows "Court 1/2/3".
3. On a club night: after signing up, "What kind of game sounds fun today?"
   appears; choose one, change it, skip it.
4. FINISH GAME has no score boxes. Organize → roster → **Play next**; Courts →
   **Rename**.
5. Existing players' data: confirm nobody lost their account or their
   sign-up for the night.

## Verified here (and not)

tsc, eslint, prettier, full vitest (4425 passed), `next build`; Playwright
`badminton.spec.ts` 4/4 and `clubhouse.spec.ts` 6/6 and `rehearse.mjs` (25
phones, 12 games, 0 problems) on a scratch build, memory store. Not verified:
production, a real Postgres store (the stack tests were skipped), other
Passport Playwright specs, real push delivery.
