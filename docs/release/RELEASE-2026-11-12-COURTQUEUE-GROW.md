# Release record 2026-11-12: CourtQueue — Play. Learn. Grow. Together. (M687)

Stacks on `b7c5cad`. **Not pushed, not deployed from the mission**
(`CLAUDE.local.md`): the Forge runner ships local `main` after the mission.
**No migration, no env, no package change.**

## Conflict named

M686 removed all skill levels; this brief returns an optional private level.
Recorded in ADR 017 (amendment 2026-11-12) and doctrine §10. Levels stay
private and are only a gentle tie-break.

## Check production after the runner ships it

1. `/badminton/demo` shows three scenarios (Maya & Sam; Alex, Dana, Eli, Omar;
   an "invited game" with Jordan).
2. New player: Home shows "Where are you in your badminton journey?"; Not now
   dismisses it; the mood card lists four moods.
3. Grow → My Journey / Learn work; no level appears on any other phone.
4. Existing players keep their account and sign-up.

## Verified here / not

tsc, eslint (touched), vitest `src/lib/courtqueue`, Playwright
`badminton.spec.ts` 6/6 and `clubhouse.spec.ts` 6/6 on a scratch build with the
memory store. Not verified: production, real Postgres, push, full-suite gates.
