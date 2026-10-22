# Board ownership repair — production execution package

**Project:** `frllwwxesxbmmaadzfaf` (shared with Atlas) · **Prepared:** 2026-10-21 on `integration/release` · **Status:** tested on scratch Postgres 18 and PGlite (Postgres 17). **Nothing here has been run against production.**

This closes the two live board ownership holes that the production readiness diagnostic (`docs/release/PRODUCTION-DATABASE-READINESS.md`) reports as `FAIL`. It changes three policies and adds one read-only function, in one transaction. It changes no rows.

## What to paste, in order

Supabase dashboard → project `frllwwxesxbmmaadzfaf` → **SQL editor** → new query for each step → paste the **whole file** → **Run**. Export each result as CSV before going on.

| #   | Paste                                                                                                          | Writes?            | Expect (details in §D)                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| 0   | Dashboard → Database → Backups: note the latest backup / PITR time                                             | —                  | a restore point exists                                                                                                    |
| 1   | `01-preflight.sql`                                                                                             | no                 | no `STOP`; three policies say `VULNERABLE`; function missing. **Keep the two `preserve:` rows**                           |
| 1b  | only if any `audit:` row in step 1 is `ATTENTION`: `../../product/group-adventures/boards-ownership-audit.sql` | no                 | lists the rows behind each count. Keep it; read §E before going on                                                        |
| 2   | `../../product/group-adventures/boards-owner-claim-fix.sql`                                                    | **yes** (DDL only) | `Success. No rows returned`. The editor may warn about a destructive operation (`DROP POLICY`): that is expected; confirm |
| 3   | `03-verify.sql`                                                                                                | no                 | first row `REPAIRED: 0 FAIL, 0 REVIEW, 17 PASS`; `preserve:` rows equal step 1's                                          |
| 4   | the diagnostic from `PRODUCTION-DATABASE-READINESS.md` §4                                                      | no                 | `board ownership fix` group has no `FAIL`; overall 0 `FAIL` (§D)                                                          |

Stop at the first step that does not match. Steps 1, 3 and 4 can be re-run any time. Step 2 can be re-run any time too: it is idempotent and step 1 then says `FIXED`.

Then, separately and not SQL: `docs/product/group-adventures/verification/prod-isolation.mjs --i-mean-production` with two test accounts made for the purpose (`group-adventures/RELEASE.md` step 5). It is the real-account attack test; a `PASS` from a catalog query is not.

## What was vulnerable

`accessToBoard` (`src/lib/collaboration/boardAccess.ts`) asks Atlas for a shared board **on behalf of the `board_owner_id` written in the caller's membership row**. Whoever can write a row or an invite naming Olive reaches Olive's Atlas board, with whatever role the row says.

1. **Hole 1: claiming a shared board.** Baseline policy `passport_board_members_self_claim` lets any signed-in user insert `(board_id = any id, user_id = me, role = 'owner')`. They become owner in Passport: they read the members, invites and events, and can mint invites.
2. **Hole 2: naming somebody else as owner.** Baseline `passport_board_members_owner_writes` and `passport_board_invites_owner_writes` check that the writer is an owner but never pin `board_owner_id`. An owner (including one who got there through hole 1 on a never-shared board, which is most boards; see the first-share bug in `group-adventures/README.md` §6) can repoint their row, write a member row, or mint an invite naming the real owner. `accessToBoard` then serves the real owner's board, read and write, to them or to whoever redeems the invite. Members (editors/viewers) cannot do this directly; the owner policies already refuse them. An owner can.

What it takes: a board id and its owner's user id. A member the owner removed has both.

## What the repair changes (B)

`docs/product/group-adventures/boards-owner-claim-fix.sql`, the `ca20324` version, plus a lock timeout and a self-check:

| Object                                              | Before                              | After                                                                                                        |
| --------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| function `passport_board_has_members(text)`         | absent                              | `SECURITY DEFINER`, `STABLE`, `search_path=public`; `authenticated` may execute, `anon` and `PUBLIC` may not |
| policy `passport_board_members_self_claim` (INSERT) | own row, owner role, names yourself | same **and the board has no rows yet**                                                                       |
| policy `passport_board_members_owner_writes` (ALL)  | writer is an owner                  | same **and every row written names the writer as `board_owner_id`**                                          |
| policy `passport_board_invites_owner_writes` (ALL)  | writer is an owner                  | same **and the invite names the writer as `board_owner_id` and as `created_by`**                             |

- One transaction (`BEGIN … COMMIT`). `SET LOCAL lock_timeout = '5s'`: if a long transaction holds a board table, the repair aborts after 5 s with nothing changed, instead of queueing and blocking every board read behind it. Re-run later.
- Before `COMMIT` a `DO` block re-reads the catalog. If any of the three policies or the function's grants are not as intended, it raises an error and everything rolls back.
- It ends with `NOTIFY pgrst, 'reload schema'` (PostgREST learns the new function).
- **Not touched:** any row; RLS settings; the two read policies; every other table, including Atlas's (`boards`, `board_items`, …), Hockey, Conference, Arrivals and Adventures; no `GRANT` to `anon`. The only grant it makes is `EXECUTE` on the new function to `authenticated`.
- Every write the app makes already satisfies the new checks: `writeOwnerRow` names the writer; `createInvite` passes `access.ownerId`, which is the caller's own id, because only an Atlas-proven owner reaches it (`canShare` = `owner`); revoking changes only `revoked_at`; redemption copies the invite's owner inside a `SECURITY DEFINER` function. No app deploy needed.
- The policy text and function body are byte-identical to what the diagnostic fingerprints, so its board rows go to `PASS`.

## A. Preflight: `01-preflight.sql`

One read-only `SELECT`. It confirms the environment (Supabase roles, `auth.uid()`, that you are a role that can own a function that reads every row) and shows each policy's live definition as `VULNERABLE` / `FIXED`. It lists any policy on the board tables the repo does not know about, any session holding a board-table lock, the five audit counts, and two `preserve:` rows: row counts and an MD5 digest of every board member and invite row. It prints no ids, tokens or emails.

## C. Verification: `03-verify.sql`

One read-only `SELECT`, first row `OVERALL`. It checks the three policies by command and by text (owner role, the `board_owner_id` and `created_by` pins, the empty-board rule), that **no other permissive INSERT/UPDATE/ALL policy** exists on either table (one would bypass the pins), that the read policies are unchanged, and the function's definer, volatility, `search_path`, body hash and grants. It also confirms RLS is on, `anon` has no DML on the board tables, and signed-out visitors can still read an invite link. It repeats the audit counts and the `preserve:` rows.

## D. Expected results

| Step         | On production as reported (holes open, no past forgery)                                                                                               |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 preflight  | all `OK`. Rows 7–9 say `VULNERABLE …`, row 6 `missing (expected…)`. Any `ATTENTION` row: read it (extra policy, lock, audit count)                    |
| 2 repair     | `Success. No rows returned`. An error means nothing changed: `55P03 lock timeout` → run again later; `self-check failed: …` → stop, send it           |
| 3 verify     | `REPAIRED: 0 FAIL, 0 REVIEW, 17 PASS`, and 2 `INFO` rows identical to step 1's `preserve:` rows                                                       |
| 4 diagnostic | the four board `FAIL`s and the board fingerprint `REVIEW` gone. **0 FAIL**. `REVIEW` = the six you saw minus one (the board fingerprint) → **5** (§F) |

If boards were used between steps 1 and 3, the digest can legitimately differ (somebody shared a board). The counts tell you whether rows were only added. The repair itself never deletes; the scratch tests prove the digest is unchanged across it.

If the audit counts are not 0, steps 3 and 4 show them as `REVIEW` after the repair as well. That is correct: the repair closes the door; it does not decide what to do about anyone who already came through it (§E).

## E. Rollback and recovery

- **The repair changes no data**, so there is no data to recover. Rollback is about policies only.
- **Rollback** (`rollback.sql`): puts the three baseline policies back exactly (verified against a fresh baseline) in one transaction. Idempotent, changes no rows, leaves the harmless function in place. **It re-opens both holes.** Use it only if genuine sharing is proven broken and cannot wait for a fix-forward. Re-apply step 2 afterwards; tested.
- **A failed run** of step 2 rolls itself back (lock timeout or self-check; both tested). Nothing to clean up.
- **Point-in-time restore** is the last resort for anything else. It restores the whole shared project, Atlas included, so it is not a tool for this change.
- **Rows written through the holes before the repair** stay exactly as they are. Step 1b lists them. What to do is a human decision:
  - `optional-revoke-forged-invites.sql` marks only **live invites naming someone else** as revoked (`revoked_at = now()`; nothing deleted; member rows untouched). Run it only if the count is above 0 and you have read the rows. **Why it matters:** an invite forged before the repair still redeems after it, because `passport_redeem_board_invite` copies whatever owner the invite names. The tests prove both that and that this file stops it.
  - Forged owner/member rows and people who joined via a forged invite: treat those boards as disclosed. Removing a membership is a deliberate `DELETE` a person writes after reading the audit, not a template.

## F. The six REVIEW findings

On a scratch database built from the repository with every migration **except** the board fix (the state production reports), the diagnostic shows **4 FAIL, 4 REVIEW, 98 PASS**. Production reported **5 FAIL, 6 REVIEW, 96 PASS**. Production's numbers add up to 107. This diagnostic has 106 checks plus the `OVERALL` row, so the likeliest reading is that the `OVERALL` row (`NOT READY`) was counted as a fifth `FAIL`. The four real `FAIL`s are then exactly the board ones: `passport_board_has_members` missing, plus the three `OLD POLICY LIVE` rows. If production really shows five `FAIL` rows apart from `OVERALL`, send the fifth: the repair is only proven to clear the four.

Four of the six `REVIEW`s are the same on a clean build, so they can be named with confidence:

| `REVIEW` row                                                            | What it is                                                                                                                                                                                                                                                                                                                                        | Database change?                                                                                                                          |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `board ownership fix` · policy definitions match the repo (fingerprint) | The three old policies differ from the fixed ones. Same fact as the `FAIL`s                                                                                                                                                                                                                                                                       | **Cleared by this repair** (proven on PG 17 and 18)                                                                                       |
| `20260927 baseline` · function EXECUTE grants (anon / authenticated)    | Readiness finding R1. The baseline never revokes `PUBLIC` EXECUTE, so `anon` can call `passport_board_role(board, user)` / `passport_is_board_member(board, user)` and learn "is user X on board Y, as what", given both ids. `passport_redeem_board_invite` refuses `anon` itself (`sign-in required`). Low severity; no ownership or write path | Not in this repair. A separate decision; the readiness doc §7 R1 has a proposal. `anon` keeps `passport_describe_board_invite` either way |
| `other` · `passport_board_interest`                                     | The app reads it, but no migration for it exists in this repo (R2). If it is missing, "interested" says "can't be recorded yet"                                                                                                                                                                                                                   | No. The contracts lane owes a migration                                                                                                   |
| `other` · `page_compositions`                                           | Documented as never existing (`supabase/README.md` hazard 2). Curator compositions fall back to defaults                                                                                                                                                                                                                                          | No                                                                                                                                        |

**The other two are not identifiable from the counts** (they `PASS` on a clean build), and no row-by-row output was available here. Because Hockey, Conference, Arrivals and Adventures passed, they must be in the environment, baseline or board group. Read their `detail`:

| If the row is…                                                                                                                             | It means                                                                                              | Action                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `board ownership fix` · `audit: …` with a number                                                                                           | **Rows that match a past takeover.** The most important possibility                                   | Step 1b, then §E. The repair does not clear these; they stay `REVIEW` until a person acts                                                   |
| `board ownership fix` · only the three known board-member/invite write policies exist                                                      | **An unknown write policy on a board table.** It could keep a hole open after the repair              | Do not treat the repair as done: `03-verify.sql` row 4 will `FAIL`. Read the policy (step 1 row 10 prints it), then decide                  |
| `environment` · default privileges on new public tables                                                                                    | Default grants exist in `public` (possibly Atlas's). Weakens the grant checks as evidence; not a hole | No change for this repair                                                                                                                   |
| `20260927 baseline` · policy fingerprint / no policies beyond the repo / unintended privilege / table privileges / function body or config | Baseline drift: a hand edit, an older version, or a different Postgres deparse                        | Read the live definition. Not touched by this repair. Only the board tables matter for ownership, and `03-verify.sql` checks those directly |

## What was tested

`node docs/release/board-ownership-repair/test-repair.mjs` (132 checks, all passing). It runs on a throwaway Postgres 18 (embedded-postgres binaries, port 55729, `~/passport/scratch/board-repair`), never production. The database has Supabase's roles, `auth.uid()` read from the request JWT claims, **no default grants** (production's posture), and all six Passport migrations except the board fix. It is seeded with a shared board (owner, editor, viewer, live / revoked / expired invites), a never-shared board, and rows an attacker could have written through the holes (a second owner, an owner row naming someone else, a member row and a live invite naming a non-owner).

- **52 access probes, as `authenticated`/`anon` with RLS on, before and after.** Each one must give its stated outcome on both sides:
  - Existing owners and members keep access: they read members and invites, and the membership row `accessToBoard` reads still names the real owner.
  - Sharing still works: the owner creates, revokes and re-upserts invites, changes roles, removes and adds members. Newcomers redeem live invites (twice, harmlessly) and refused ones stay refused. Signed-out visitors can read a link. First share works via `writeOwnerRow`, then the first invite. Editors still write events.
  - Hole 1 (claim a shared board, then read it): allowed before, refused after.
  - Hole 2, all seven variants (repoint own row, accomplice row, invite naming the owner, invite in the owner's name, owner repointing her own or a member's row, rewriting an existing invite): allowed before, refused after.
  - Members cannot forge ownership through invites or rows (create an invite, revive one, promote themselves, add a member, upsert-claim): refused before and after.
  - `anon` reads nothing, writes nothing and cannot call the new function.
- **Data:** a digest of every member and invite row is identical before and after the repair, after rollback, and after re-applying. Preflight's digest equals an independent digest.
- **Idempotent:** the repair applied three times; rollback twice; repair again after rollback.
- **Transactional:** behind a held lock it aborts in 5.0 s with policies unchanged and no function created. A deliberately broken edit fails the self-check and changes nothing.
- **Rollback:** the five board policies' fingerprints equal a freshly applied baseline's.
- **Reports:** the diagnostic goes from 4 board `FAIL`s to **0 FAIL**. `03-verify.sql` gives `REPAIRED: 0 FAIL` with only the seeded audit rows as `REVIEW`. `01-preflight.sql` reports `FIXED` on a repaired database. `boards-ownership-audit.sql` lists exactly the seeded forgeries.
- **Containment:** `optional-revoke-forged-invites.sql` revokes exactly the forged live invite, deletes nothing, and stops it redeeming, while genuine invites still redeem.
- **Postgres 17 parity** (PGlite 17.5, the engine the diagnostic's fingerprints came from): repair ×2, verify `REPAIRED: 0 FAIL, 0 REVIEW, 17 PASS`, diagnostic `0 FAIL, 3 REVIEW, 103 PASS` (the documented target), holes refused, owner's invite allowed, rollback → re-apply clean.

Not tested: the real Supabase SQL editor, PostgREST and GoTrue (the RLS decisions are Postgres's own, and these probes run them directly), and production's actual data.

## Risks and what remains

- **Residual, by design (denial, not disclosure):** a signed-in user who learns the id of a board nobody has shared can pre-claim it in their own name. It reaches nothing, because their rows name them and Atlas holds no such board for them. But the real owner then cannot share that board until an operator deletes the stray row. The audit cannot see this (only Atlas knows real owners). If `owner_rows_total` is small, compare each owner row with Atlas `boards`.
- **Past forgery is not undone** (§E). This is why step 1 matters.
- **New oracle, small:** `authenticated` can ask `passport_board_has_members(id)` "does this board have any members". It reveals nothing else, and board ids are not guessable.
- **Not covered here:** R1 (above); the first-share app bug (`5f91b5c`, ships with the app, independent of this SQL); leaving a board as a member: `leaveBoard` deletes the caller's own row, but no migration in this repo has a policy that lets a non-owner do that, so it is refused before and after this repair. The self-leave policy was proposed board-side (`62e9900`/`f5e20a6`; `group-adventures/README.md` "Boards") and is still undecided. This repair does not change it.
- **Blockers:** none in the SQL. It needs a person with SQL-editor access to `frllwwxesxbmmaadzfaf` to run steps 0–4, and two test accounts for `prod-isolation.mjs`.
