# Hockey Night — Arena Mode: the Crew (2026-10-24)

**Status:** built and tested on `feature/hockey`, on top of latest GitHub main
(`d542503`, already an ancestor). **Not deployed, not pushed, not migrated.**
Needs `crew-migration.sql` (after `arena-migration.sql`). Until it is applied,
Arena Mode behaves as before and the Crew's own parts say they're off
(`verification/crew-off.spec.ts`).

Screenshots: `crew/*.png` (written by `verification/crew.spec.ts`, 320/375/390 px).

## What changed in Arena

| Brief item               | Where                                                                                                                                                                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Find My Drunk Friend** | "Find friends" tab. Name is the constant `FIND_FRIEND_NAME` in `crew.ts`; the screen never says anything about a person, only that you lost them.                                                                                  |
| **Summon the squad**     | Button under the map (replaces "Find the herd"), "Squad" tab, an incoming card for everyone else. Place by map tap, meeting point, my spot or seat. Answers: On my way / Busy / Where?; the summoner sees who's coming. Persisted. |
| **The Crew**             | Compact avatar strip above the map replaces the seven big herd cards; tap a face for their sheet (find / ping / meet). Arrivals cheer (toast + confetti; none under reduced motion).                                               |
| **Snack run**            | "Snack run" tab. Announce a run to a stand from the arena's own map (nearest the seat first), friends add one line of request (chips from the dietary guide where it lists items), runner closes it. No prices, no payment.        |
| **Personality**          | Copy, confetti, bobbing, one-tap answers. Not Play: no points, no scoring.                                                                                                                                                         |

## Privacy and safety, as built

- **Off by default.** Nothing is shared until the person checks in or taps _Share a GPS hint_. The browser is not asked for a position before that tap.
- **GPS is a hint, never a position.** The server turns one reading into `zone` (around / near / away the arena), distance rounded to 50 m and accuracy rounded to 10 m, then discards the coordinates. The table has no coordinate column (attack-tested). One row per person, overwritten: no history. GPS never draws a dot. Readings worse than ±1500 m are refused. Every GPS line shows accuracy and age and says it can't tell level or section.
- **Manual first.** The primary button is "Tell the crew my section or spot"; it works with GPS denied (tested with a phone that refuses permission).
- **Present only by their word.** ✓ and "checked in" require a manual check-in inside the building. GPS hint, seat, "on my way" and "outside" never count (`presenceOf`, unit-tested).
- **Visible indicator and one-tap stop.** A green bar lists exactly what is shared with how many friends; **Stop sharing** deletes the check-in and the hint at once (verified from another account immediately after).
- **Expiry.** Everything is readable only inside the arena window (3 h before to 5 h after puck drop), DB-stamped, purged by `passport_crew_purge()` (+ the existing arena purge). A closed night read as empty in the e2e. Note: Postgres applies the read policy to a DELETE's WHERE, so after the window you cannot delete your own row, but nobody can read it either, and the purge removes it.
- **Members only; no public endpoint.** Same membership RLS as Arena; signed-out and non-member requests get nothing. GPS refresh is once a minute **only while the page is open and visible**, and resumes after a reload only if the browser already granted permission.
- **No inference.** Nothing reads behaviour or location to guess how someone is doing.

## Verification (local stack: real GoTrue + PostgREST + Postgres)

- `verification/crew-attack.mjs` — 93 checks straight at PostgREST: members-only, own-row-only, no coordinates, rounding, no trail, instant revoke, removed member, window, expiry/purge, summons, replies, runs, requests, no money columns, idempotent re-apply, and **re-applying arena-migration after the Crew leaves it working** (this caught a real bug: the first draft replaced Arena's shared stamp function).
- `arena-attack.mjs` 78/78 (unchanged).
- `crew.spec.ts` — the acceptance flow above with three phones (320/375/390, one reduced-motion, one with GPS granted, one refused).
- `arena-mode.spec.ts` (existing, updated for the new controls) passes: map, sections, concessions, check-ins, quests, removal, expiry.
- `crew-off.spec.ts` with `HOCKEY_CREW=0` — passes after running `crew-rollback.sql` on the stack (also shows the rollback refuses while rows exist).
- Regression: acceptance, plan-and-results, plan-pregame, polish, redesign, mobile, finish-play, seats — pass (with the Atlas stubs each needs). vitest 3792 pass; tsc clean; eslint 0 errors (40 existing warnings); prettier clean; `npm run build` clean.
- Not run: `arena-off.spec.ts` (needs a `HOCKEY_ARENA=0` stack; untouched path) and the full Playwright suite.

## Decisions for the owner

1. **Doctrine pressure, not resolved:** §15.8 (privacy and consent for richer context) and §14 (sensing, "elaborate social games") are open. This ships an opt-in, coarse GPS hint on the owner's explicit brief; it does not answer §15.8 generally. Doctrine unchanged.
2. **Name.** "Find My Drunk Friend" is used as briefed; one constant renames it.
3. **Overlap:** the older _Beer Run_ and _Hot Dog Hero_ quests do the same job as Snack run. Left in place; hiding them is a one-line filter.
4. **Old screenshots** in `arena-mode/` show the pre-Crew herd cards and are stale.
5. **Apply order:** `crew-preflight.sql` → `crew-migration.sql` (SQL editor, never `db push`) → on Supabase, `notify pgrst, 'reload schema'` if tables aren't picked up (the local stack needed it after a drop/re-create).

`src/domain/hockey/arena-mode.ts` gained the new action schemas and `crew` in `ArenaView`; no shared contract files were touched.
