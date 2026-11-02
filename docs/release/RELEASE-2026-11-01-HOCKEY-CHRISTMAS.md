# Release 2026-11-01 — Hockey Night (finish the experience) + Go Have a Christmas

**Candidate:** local `main` on Metatron, the commit that adds this file.
**Not pushed, not deployed, no production SQL run from here.** This
workspace has no release authority: `CLAUDE.local.md` disables pushing
("a person fetches them and pushes") and forbids deploying, and Metatron
has no database credentials (no `psql`, no service key, no SQL editor). So
§5 is the operator's, in order. Nothing below is "live" until §6 passes on
production.

Owner decisions this release carries (brief "Ship Hockey and Christmas"):
D-9 is approved (shared memories visible to an adventure's members,
personal memories private); Hockey and Christmas are the priorities; Snow
follows; Hockey mini fantasy stays disabled.

## 1. The truth at the start (measured 2026-11-01)

| What                     | Value                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| GitHub `main`            | `26b9ccf` (Fairview 3), fetched                                                                                       |
| Production (public curl) | `gohaveaday.com/hockey` 200 (the pre-finish page), `/hockey/api/games` 404, `/christmas` 404 — neither release is out |
| Local `main` at start    | `a983018` = `26b9ccf` + `bf397d3` (Fairview 3 on Redis) + `a983018` (alignment report, docs only)                     |
| `feature/hockey`         | `ce5a9fd`, 12 commits on `26b9ccf`, worktree clean (six untracked screenshots in the lane, left alone)                |
| `feature/christmas`      | `0733ba5`, on `a983018` (already merged `main`), worktree clean                                                       |
| Candidate vs GitHub main | `origin/main` is an ancestor — **the push is a fast-forward**                                                         |

## 2. What is in (by ancestry)

| Work                                                                                            | Commit      | Entered as                                                                   |
| ----------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------- |
| Fairview 3 on a temporary Redis (see §7, not this brief)                                        | `bf397d3`   | already on local `main`                                                      |
| Product alignment report (docs)                                                                 | `a983018`   | already on local `main`                                                      |
| Hockey Night — finish the experience                                                            | `ce5a9fd`   | `0a2ebb2` merge, no conflicts                                                |
| Go Have a Christmas + Experiences menu (fourth entry)                                           | `0733ba5`   | `8f51a48` merge, `e2e/experiences-nav.spec.ts` auto-merged (both sides kept) |
| D-9 accepted: ADR 014, migration into `supabase/migrations/`, doctrine §10/§15.12, ADR 012 note | `96b33b4`   | integration                                                                  |
| Hockey mobile audit ignores 1×1 visually hidden inputs; this record; preflight                  | this commit | integration                                                                  |

Neither experience was rewritten. Existing Sycle Hockey Nights compose
exactly as before (Rogers Arena, Vancouver time, the Sycle Cup). Christmas
adventures are ordinary `passport_adventures` rows of kind `christmas`.

## 3. Gates (this tree, Metatron)

| Gate                                                                  | Result                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                                                    | clean                                                                                                                                                                                                                                                                                                                                    |
| `npx eslint .`                                                        | 0 errors (80 warnings, none new in kind)                                                                                                                                                                                                                                                                                                 |
| `npx prettier --check .`                                              | clean                                                                                                                                                                                                                                                                                                                                    |
| `npx vitest run`                                                      | 3,973 passed / 39 skipped (319 files)                                                                                                                                                                                                                                                                                                    |
| `npm run build`                                                       | ok (three builds: Hockey stack env, Christmas stack env, placeholders)                                                                                                                                                                                                                                                                   |
| Whole-repo Playwright (`next start`, critic Atlas mock, placeholders) | 250 passed / 8 failed / 8 skipped. The 8 are exactly the recorded environmental baseline of `bf397d3` on this machine: card-titles ×2, conference-mobile:23, core-loop:26, creative:198, fairview3:31, october:554/570. Includes `e2e/christmas.spec.ts` and `experiences-nav` (Christmas the fourth entry, Hockey's public front door). |
| Hockey specs, real GoTrue + PostgREST + Postgres                      | every spec green: announce, mobile ×3, plan-and-results, plan-pregame, bet-button, mayhem, alive, chirp, modules, multi-night, polish, redesign, restaurant-photos, seats, arena-mode, crew, finish, finish-play; public-night 6/6; acceptance 1/1                                                                                       |
| Hockey production-before-SQL                                          | `announce-off` 1/1 on a stack without `announce-migration.sql`                                                                                                                                                                                                                                                                           |
| Hockey security                                                       | rls-attack all; seats 35/35; arena 78/78; crew 93/93; mayhem all; **announce 30/30**                                                                                                                                                                                                                                                     |
| Hockey migration rehearsal                                            | preflight NOT APPLIED → apply → apply → APPLIED → rollback → NOT APPLIED → apply → APPLIED                                                                                                                                                                                                                                               |
| Christmas specs, real stack + Atlas corpus stand-in                   | family journey on a 390 px phone 1/1 (three accounts: owner plans, invited member joins, votes, _Got it_, shares; outsider 404 on post and photo; recap) · 320 px overflow + tap audit 1/1 · `christmas-off` 1/1 (production's state today) · migration rehearsal apply → apply → rollback → preflight ok → apply                        |

One spec change was needed. `mobile.spec.ts` failed at 320/375/390 on one
item: `input "Choose a photo" 1x1`, the `sr-only` file input that Memories'
full-width 48 px button opens. It failed the same way in the lane's own batch
run, and the Hockey code here is byte-identical to `ce5a9fd`. The audit now
skips elements of 1×1 or smaller. It is a false positive, not a tap target.

## 4. Database (production `frllwwxesxbmmaadzfaf`)

Measured from here with the public anon key, **existence only** (42501 =
exists, anon has no grant; 42703 = no such column; PGRST205 = no such
table). The SQL editor preflight is the authority.

| Migration                                                                                     | Probe 2026-11-01                                         | Needed                   |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------ |
| Hockey base, Memories, Seats, Arena, Mayhem                                                   | all tables exist                                         | no                       |
| Hockey Crew (`crew-migration.sql`)                                                            | all 5 tables exist (was NOT APPLIED on 10-24)            | no                       |
| Hockey Chirp, Alive                                                                           | `bot_key`, `nhl_team`, `watching` exist                  | no                       |
| Adventure origin (`20261023100000`)                                                           | `origin` exists (bogus column → 42703, `origin` → 42501) | no                       |
| Hockey Plan data rows (`plan-migration.sql`)                                                  | unreadable to anon                                       | **preflight A1 decides** |
| **Hockey announcements** (`announce-migration.sql`)                                           | `reply_to`, `tag`, `href` → 42703                        | **yes**                  |
| **Adventure together** (`supabase/migrations/20261101000000_passport_adventure_together.sql`) | the 3 tables → PGRST205                                  | **yes**                  |

Both new migrations are additive and idempotent. Neither deletes, moves or
rewrites a row. `announce` adds three nullable columns, a trigger, and a
wider kind check (the check and the insert policy are dropped and
re-created, so for a moment during the run chat inserts are refused).
`together` creates three tables with RLS and explicit grants only. The code
is safe to deploy before either one: Hockey says announcements are off
(`announce-off.spec`), and Christmas says sharing isn't switched on (409
`off:true`, `christmas-off.spec`).

`PREFLIGHT-2026-11-01-HOCKEY-CHRISTMAS.sql` (read-only) answers, before and after:

- A: what still needs applying, plus its prerequisites.
- B: counts of adventures, members, items, Christmas adventures, Hockey
  nights, members, chat and photos. They must not change.
- C: any Passport table with RLS off. Expect none.
- D: any anon grant. Expect none.
- E: the new policies (4 / 3 / 3, plus Hockey's re-stated insert policy, 1).

It was run on the local stacks. On the Hockey stack, A1/A2 APPLIED and A3
NOT APPLIED, as expected there. On the Christmas stack, E showed 4 / 3 / 3,
and C and D returned no rows. (Each stack holds only one foundation, so
blocks A and B error on the other's tables there. Production has both.)

## 5. Operator steps (Mac), in order

```bash
# 0. Get the candidate
cd ~/elk-passport            # the Mac checkout
git fetch metatron:passport/main main
git log --oneline -6 FETCH_HEAD          # this record's commit on top
git merge-base --is-ancestor origin/main FETCH_HEAD && echo ff-ok
npm install --no-audit --no-fund
npx tsc --noEmit && npx eslint . && npx prettier --check . && npx vitest run && npm run build
```

1. **Backup.** Supabase dashboard → project `frllwwxesxbmmaadzfaf` →
   Database → Backups: confirm the latest daily backup is from today, and
   PITR if the plan has it. Note its time. If there is none, take one
   (Backups, or `pg_dump` with the connection string) **before** step 2.
   The migrations add things only, but the brief requires a backup and this
   workspace cannot see one.
2. **Preflight.** SQL editor: paste
   `docs/release/PREFLIGHT-2026-11-01-HOCKEY-CHRISTMAS.sql` and save the
   output. P1 and P2 must say `ok`, C and D must return no rows. If any of
   those fail, stop.
3. **Hockey Plan** (only if A1 says NOT APPLIED): `plan-preflight.sql`
   (every row OK) → `plan-migration.sql`.
4. **Hockey announcements:** `docs/product/hockey/announce-preflight.sql`
   (OK, OK, NOT APPLIED) → `announce-migration.sql` →
   `announce-preflight.sql` (last row APPLIED).
5. **Adventure together (D-9):** `docs/product/christmas/together-preflight.sql`
   (`ok` ×3) →
   `supabase/migrations/20261101000000_passport_adventure_together.sql` →
   preflight again ("already applied"). Paste it in the editor. **Never
   `supabase db push`**: GitHub `main`'s `supabase/migrations/` holds files
   production has not taken in that order.
6. **Preflight again.** A1–A3 APPLIED. B identical to step 2. C and D still
   return no rows. E: notices 4, acks 3, moments 3, the Hockey insert
   policy 1.
7. **Push** (Vercel deploys GitHub `main` in about 1 minute):
   `git push origin FETCH_HEAD:refs/heads/main`. That is a fast-forward and
   needs no force.
8. **Confirm the deployment:** `vercel ls elk-passport`, then
   `vercel inspect <url>`. The source SHA must be this record's commit.
   Record the deployment ID and URL in §8.
9. **No new environment variable** for Hockey or Christmas. `NHL_API_BASE`
   stays unset. For Fairview 3, see §7.

Steps 1–6 may come after step 7 instead (the code is safe before the SQL).
Doing the SQL first means announcements and sharing work from the first
request.

## 6. Production verification (two real accounts, phones) — not done

None of this can be done from Metatron until the push. Every item is the
operator's, against `https://gohaveaday.com`:

1. **Public `/hockey`** signed out: the front door ("Hockey is better with
   your crew."), indexable; `/hockey/api/games` returns the league's next
   three weeks.
2. **New Hockey Night:** sign in → pick a league game that is not in
   Vancouver → the night names both teams and the arena. "Near the arena"
   says it hasn't been measured.
3. **Invitation and group isolation:** a second account joins by link and
   sees the night. A third account, not invited, gets nothing at the
   night's URL.
4. **Predictions and chat:** seal a pick; it reads back with both codes
   ("VAN 0–5 MIN" style). Reply to a line, and the quote shows.
5. **Host announcements:** host announces → the guest's banner shows on
   Plan and Play → _Got it!_ → the host sees "Everyone got it". Take it
   down.
6. **Existing Sycle Hockey Night:** still opens with its Sycle Cup,
   predictions and photos.
7. **Christmas discovery:** `/christmas` shows the countdown and finds, and
   **no** "Atlas can't be reached" panel.
   `/christmas/discover?theme=lights&at=north-vancouver` shows Canyon Lights
   with dates from Atlas.
8. **Christmas planning:** `/christmas/plan?shape=evening` → town and date →
   _Make our Christmas plan_ → an adventure page with a sketched day.
9. **Christmas invitations and voting:** the second account joins by link,
   votes in / maybe / out, and the owner sees it.
10. **Announcements and shared memories:** the owner announces, the second
    account sees it and taps _Got it_. A shared photo or tradition shows
    for both. A signed-out visitor and an uninvited third account see
    nothing. A personal memory stays private.
11. **Recap:** the adventure's recap shows the shared moments.
12. **Experiences menu:** four entries; each opens its route.
13. **Mobile:** steps 1, 5, 8 and 10 on a phone. No sideways scroll.
14. **Chirp Bot — before calling Hockey a public beta:** read ten
    production Chirp Bot lines on a test night (production model
    `gpt-4o-mini`, never yet read by a person). If any is unfit, set Quiet
    and report it. Mini fantasy has no screen and stays that way.

## 7. Named, not in this brief

- **Fairview 3 (`bf397d3`) ships with this push.** It is on local `main`
  under both branches. Without `UPSTASH_REDIS_REST_URL` /
  `UPSTASH_REDIS_REST_TOKEN` / `FAIRVIEW3_PRESENTER_KEY` in Vercel,
  `/fairview3` answers 503 `not-ready` and says what is missing. It never
  falls back silently, and no other route is touched. The show was 28
  October. Leaving it 503 is honest. Set the vars only if the show is
  wanted again.
- **Two announcement systems now exist:** Hockey's on
  `passport_occasion_moments`, and the adventure core's
  (`passport_adventure_notices`). ADR 014 names this. Hockey adopts the
  core's when it moves onto ADR 009.
- **ADR 014's code move** (`together.ts` → `src/lib/adventures/`) is
  deferred. The brief said not to rewrite.
- **Hockey beta blockers that stay open** (FINISH-THE-EXPERIENCE §8):
  arenas other than Vancouver are unmeasured; email confirmation on public
  sign-up is the owner's setting; there is no rate limit on starting
  nights.

## 8. Deployment record (fill in after §5 step 8)

| Field              | Value |
| ------------------ | ----- |
| GitHub `main` SHA  |       |
| Vercel deployment  |       |
| Production URL     |       |
| SQL applied (time) |       |
| §6 result          |       |

## 9. Rollback

- **Code:** Vercel → promote the previous deployment (from `26b9ccf`).
  Then `git revert -m 1` the merges on `main`, with no force-push.
  Christmas adventures stay as ordinary adventures and open on the generic
  page.
- **Database:** leave it. The previous code ignores the new columns and
  tables. If you must: `announce-rollback.sql` (removes announcements;
  replies stay as plain lines) and `together-rollback.sql` (**drops every
  shared notice and memory**, so export them first). Both were rehearsed
  here.
- **Full restore:** the backup from §5 step 1. That is a last resort: it
  loses every write since.
