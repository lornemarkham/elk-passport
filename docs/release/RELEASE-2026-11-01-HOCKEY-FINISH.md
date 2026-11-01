# Release 2026-11-01 — Hockey Night: finish the experience

**Candidate:** `feature/hockey` on Metatron, the commit that adds this
file. It is a fast-forward of GitHub `main` `26b9ccf` (Fairview 3): the
branch was moved onto it first, so the push is `--ff-only`. **Not pushed,
not deployed, no database change made from here** — pushing and deploying
are disabled in this clone on purpose (`CLAUDE.local.md`). What is
"measured" below was measured here.

Product report, decisions and the owner's smoke:
[`docs/product/hockey/FINISH-THE-EXPERIENCE.md`](../product/hockey/FINISH-THE-EXPERIENCE.md).

## 1. What is in

| Work                                                                  | Where                                                        | Needs SQL?                   |
| --------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------- |
| A score always names its teams ("VAN 2–4 MIN"); regression suite      | `src/domain/hockey/score.ts`, `score.test.ts`                | no                           |
| Host announcements, chat replies                                      | `announce.ts`, `Announcements.tsx`, `ChatRoom.tsx`, server   | **`announce-migration.sql`** |
| Public `/hockey`; any league game from the schedule; the arena's zone | `HockeyLanding.tsx`, `StartNight.tsx`, `api/games`, `nhl.ts` | no                           |
| The group's own trophy name                                           | `CupName.tsx`, `night.ts cupNameOf`                          | no (`details.cup`)           |
| The run-up card and Chirp Bot's stage lines                           | `runup.ts`, `RunUp.tsx`, `chirp.ts runupPlan`                | no                           |
| Host nudged to call the league's final                                | `GameDayHero.tsx`                                            | no                           |
| Mini-fantasy reader (no screen)                                       | `fantasy.ts`                                                 | no                           |

Everything is additive. A night created before this release composes
exactly as before: Rogers Arena, Vancouver time, the Sycle Cup, the
Canucks at home.

## 2. Gates (this tree)

_(filled in after the run — see the product report §6)_

## 3. Database (production `frllwwxesxbmmaadzfaf`)

Still unapplied from `RELEASE-2026-10-24-HOCKEY-VANCOUVER.md` §4 (not
re-probed here): Hockey Plan data rows, Hockey Crew, Adventure origin.
New here: **`docs/product/hockey/announce-migration.sql`** — two columns
and one on the moments table (`reply_to`, `tag`, `href`), a wider kind
check, a trigger, a re-stated insert policy. Idempotent; rehearsed on the
local stack as preflight → apply → apply → preflight (`APPLIED`) →
rollback → preflight (`NOT APPLIED`) → apply. Applies **after
chirp-migration.sql** (production has it). The code is safe before it:
`announce-off.spec.ts`.

## 4. Owner steps (Mac), in order

1. SQL editor: the leftovers above, then `announce-preflight.sql` →
   `announce-migration.sql` → `announce-preflight.sql`.
2. `git fetch metatron:passport/main feature/hockey && git merge --ff-only FETCH_HEAD` on `main`; gates; `git push origin main`.
3. Vercel: confirm the deployment's SHA. No new env var.
4. Smoke (product report §9 step 4).

## 5. Rollback

- **Code:** Vercel → promote the previous deployment. Then `git revert`
  on main; no force-push.
- **Database:** leave it; the previous code ignores the new columns.
  If needed, `announce-rollback.sql` (deletes announcements; replies
  stay as plain lines).
