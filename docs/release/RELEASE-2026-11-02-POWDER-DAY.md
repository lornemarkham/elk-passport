# Release 2026-11-02 — Powder Day (Go Have A Snow Day, shared between phones)

**Candidate:** `feature/snow` on Metatron, the commit that adds this file.
**Not pushed, not deployed, no production SQL run from here.** This
workspace has no release authority: `CLAUDE.local.md` disables pushing ("a
person fetches them and pushes") and forbids deploying, and Metatron has no
production database credentials. §5 is the operator's, in order. Nothing
below is "live" until §6 passes on production.

## 1. The truth at the start (measured 2026-11-02)

| What                     | Value                                                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| GitHub `main`            | `a47e611` (Merge Christmas experience improvements)                                                                          |
| Production (public curl) | `gohaveaday.com/` 200, `/christmas` 200, `/datenight` 200, `/hockey` 200, **`/snow` 404** — Snow is not out                  |
| `feature/snow` at start  | `c9b3f1f` = `bf397d3` + three Snow commits (experience, predictions, shared persistence); 41 commits behind `main`           |
| Candidate vs GitHub main | `main` merged in (`1d0f5a6`, no conflicts: Snow added files only); `a47e611` is an ancestor — **the push is a fast-forward** |

## 2. What is in (by ancestry, on top of `a47e611`)

| Work                                                                                                        | Commit      |
| ----------------------------------------------------------------------------------------------------------- | ----------- |
| Go Have A Snow Day: plan, crew, challenges, on-hill, memories, recap (one phone, no account)                | `dea8674`   |
| Predictions                                                                                                 | `1ea773e`   |
| A day shared between phones: `snow-day` adventures, 16 `passport_snow_*` tables, chat, invite, join, poll   | `c9b3f1f`   |
| Merge of GitHub `main` `a47e611`                                                                            | `1d0f5a6`   |
| Release review fixes + contracts: migration into `supabase/migrations/`, `snow-day` kind, nav, doctrine §10 | `4e89a49`   |
| Two-phone spec proves points and a fresh sign-in session                                                    | `b09d4e5`   |
| This record                                                                                                 | this commit |

Hockey, Christmas, Date Night and the adventure core were not rewritten.
Files outside `src/*/snow` and `docs/product/snow` that changed:
`supabase/migrations/20261103000000_passport_snow.sql` (moved from
`docs/product/snow/shared-migration.sql`), `src/lib/adventures/kinds.ts`
(+test), `src/components/shell/PassportNav.tsx` (+test),
`e2e/experiences-nav.spec.ts` (five entries), `docs/PASSPORT-PRODUCT-DOCTRINE.md`
(§10, Snow Day joins the menu), and this file.

## 3. Review of the Snow tables (sixteen at first review, fifteen now)

**Reuse of the core: right.** Membership, invitations (hashed, expiring,
capped, revocable), owner/participant, title and date are the core's
(`passport_adventures`, `_members`, `_invites`); Snow adds no membership,
invite or permission code. Every Snow table is keyed by `adventure_id` and
cascades with it. Member-only reads require the adventure to be a
`snow-day`, so a Hockey Night member or a stranger gets nothing. Writes are
`user_id = auth.uid()`; owner-only facts are owner-only in policy; column
grants stop any row being re-homed or re-attributed. Votes, decisions and
guesses can only point at an option/prediction of the same day (composite
foreign keys). One vote per person per topic is a primary key.

**Not duplicates:** votes/options (not places on a plan, so not core
`items`/`responses`), chat, challenges, completions, predictions, guesses,
check-ins, ideas, playlist, levels and gear — none has a core equivalent.
`passport_snow_packed` is per-person ticks of Snow's code-defined gear list;
the core's `passport_adventure_packing` is one shared group checklist.
Different things.

**ADR 014 overlap: resolved in the final integration (2026-11-02).**
Snow no longer stores announcements or photos itself. The host's
announcements and "plan changed" notices are `passport_adventure_notices`
(`snow-update`, `snow-change`, owner-only by the core's policy); the crew's
photos and moments are `passport_adventure_moments` (`photo`, `moment`).
`passport_snow_posts` is chat only; `passport_snow_moments` is gone (15 Snow
tables, not 16). Snow's raster-only / 16-photos-a-day / 6-adds-a-minute
limits are `passport_snow_moment_guard`, a trigger on the core table that
acts on `snow-day` adventures alone. Leaving a snow day still takes your
photos (Snow's privacy rule, kept) via the member-gone trigger, for snow days
only. Behaviour change a person will notice: only the host posts
announcements; the crew uses chat. Detail: `docs/product/snow/SHARING.md`.

**Fixed before release (critical):**

1. **Non-atomic plan changes.** Locking a choice wrote the decision, then the
   date, then the "plan changed" notice as three PostgREST calls. If the
   notice was refused (the per-person chat flood limit) or the phone dropped,
   the plan had moved and nobody was told. Starting a shared day likewise
   made the adventure, then the day row, then the host's level. Now
   `passport_snow_decide` and `passport_snow_start` do each in one
   transaction, `SECURITY INVOKER` so every row still goes through RLS as
   the caller. Proven on the real stack: with the host's posts exhausted, a
   lock-in that would post a notice is refused whole and the mountain does
   not move; a start Postgres refuses half way leaves no adventure.
2. **SVG photos.** The column took any `data:image/*` and the route served
   it with that content type from Passport's origin, so an SVG with script
   would run for any member who opened the link. Now raster only (jpeg, png,
   webp) in Postgres, the parser and the route, which also sends
   `Content-Security-Policy: default-src 'none'; sandbox`.

**Still separate requests, safe to repeat:** joining (redeem the link, then
your level: a retry redeems nothing twice and only fills a missing level)
and renaming yourself with a level change (two rows, both yours).

## 4. Gates (this tree, Metatron)

| Gate                                                                                                                                             | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                                                                                                                               | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `npx eslint .`                                                                                                                                   | 0 errors (43 warnings, none in changed files)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `npx prettier --check` (every changed file)                                                                                                      | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `npx vitest run` (with the Snow stack env)                                                                                                       | 4,097 passed / 41 skipped (334 files), incl. both real-stack Snow tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `npm run build`                                                                                                                                  | ok (stack env, and again with placeholders)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Two accounts, real GoTrue + PostgREST + Postgres (`shared.stack.test.ts`)                                                                        | 2/2: one shared day — crew, invite, votes, host-only lock-in, date, chat, predictions + guesses, challenges → standings, moments, photos, check-ins, ideas; privacy (stranger, Hockey member, anon: nothing; no user ids leave the server; re-homing refused); leaving takes your own data. New: all-or-nothing start and lock-in, participant refused calling `passport_snow_decide` directly (42501), SVG refused by Postgres (23514)                                                                                                                                                                                                                                                      |
| Two phones in a browser (`verification/two-phones.spec.ts`, `next start` production build on the stack)                                          | 1/1: Lorne starts, Jess joins by link on her own account, votes, lock-in, chat both ways, a prediction and her call, a photo, **her challenge points on Lorne's phone**, and **a fresh browser signing in again finds the lock-in, both chat lines, the call, the photo and the same points**. Mallory (signed in, not invited) and a signed-out visitor get nothing; the photo URL is 404/401 to them                                                                                                                                                                                                                                                                                       |
| Whole-repo Playwright (`next start`, critic Atlas mock, placeholders)                                                                            | 244 passed / 18 failed / 8 skipped. None in Snow, Experiences menu, Adventures, Hockey, Christmas or Date Night. Nine are this machine's recorded baseline for `bf397d3`/`main` (card-titles:42 ×2, conference-mobile:23, core-loop:26, creative:198, fairview3:31, october:554/570, release-navigation:44 phone). The other nine (card-titles:92, discovery-activities:124, discovery-natural ×4, discovery-one-search:151, nfr:278, release-navigation:44 desktop, october:373) were rerun with `--workers=1` with `experiences-nav` and `snow.spec`: 29 passed, only october:373 failed — also on the recorded environmental list (no real Atlas). Rewritten Discovery/Snow PNGs restored |
| Migration rehearsal, superseded by §4a (earlier run: local stack, every core migration first: adventures, origin, together, Date Night, packing) | apply → apply (idempotent) → preflight 13/13 → rollback (16 tables, 8 functions, 10 triggers gone; 22 other tables, 12 adventures, 18 members untouched; core member trigger intact) → preflight shows Snow absent → apply → 13/13 → stack tests 2/2 again                                                                                                                                                                                                                                                                                                                                                                                                                                   |

## 4a. Final integration gates (ADR 014 adoption, this commit)

| Gate                                                                 | Result                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                                                   | clean                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `npx eslint .`                                                       | 0 errors (43 warnings, none new)                                                                                                                                                                                                                                                                                                                                                                                          |
| `npx prettier --check` (changed files)                               | clean                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `npx vitest run` (Snow stack env)                                    | 4,098 passed / 41 skipped (334 files) incl. both real-stack Snow tests                                                                                                                                                                                                                                                                                                                                                    |
| Real stack, two accounts (`shared.stack.test.ts`)                    | 2/2. New: crew member cannot announce (42501, even straight to Postgres); a notice Postgres refuses rolls back the lock-in and the date; the app's lock-in stores exactly one `snow-change` core notice; stranger and signed-out get no notices or photos from the core tables; SVG refused (23514), JPEG accepted; a Christmas-kind adventure keeps the core's rules; leaving takes your photos, the host's notice stays |
| Two phones in a browser (`next start` production build on the stack) | 1/1: everything in the earlier run, plus the host's announcement reaches Jess, Jess has no announce form, the photo is served from the core table, and a fresh sign-in finds the announcement                                                                                                                                                                                                                             |
| `npm run build`                                                      | ok (stack env, and placeholders)                                                                                                                                                                                                                                                                                                                                                                                          |
| Whole-repo Playwright                                                | 245 passed / 17 failed / 8 skipped; all 17 are on the recorded environmental baseline (Discovery, October, card-titles, creative, fairview3, conference-mobile, core-loop); none in Snow, Experiences menu, Adventures, Hockey, Christmas or Date Night. Rewritten PNGs restored                                                                                                                                          |
| Migration rehearsal on a disposable Postgres                         | apply → apply again (idempotent) → preflight 15/15 → rollback (core notices/moments/adventures untouched; Snow rows false) → re-apply → 15/15                                                                                                                                                                                                                                                                             |

## 5. Operator steps (Mac), in order

```bash
# 0. Get the candidate
cd ~/elk-passport                                   # the Mac checkout
git fetch origin
git fetch metatron:passport/main feature/snow
git log --oneline -8 FETCH_HEAD                     # this record's commit on top
git merge-base --is-ancestor origin/main FETCH_HEAD && echo ff-ok
git checkout --detach FETCH_HEAD
npm install --no-audit --no-fund
npx tsc --noEmit && npx eslint . && npx prettier --check . && npx vitest run && npm run build
```

If `origin/main` moved past `a47e611`, **stop**: merge it into
`feature/snow`, re-gate, and fetch again. Never force.

1. **Backup.** Supabase → project `frllwwxesxbmmaadzfaf` → Database →
   Backups: note the latest backup time (and PITR if present). The migration
   only adds, but take one if there is none from today.
2. **Preflight (before).** SQL editor: paste
   `docs/product/snow/shared-preflight.sql`. Expected: the **four** `core:`
   rows `true`; every `snow:` row `false`. The fourth core row is
   `notices, acks and moments present` (migration
   `20261101000000_passport_adventure_together.sql`, ADR 014). If it is
   false, apply that file first (idempotent, same SQL-editor rule), then
   re-run. If any other `core:` row is false, **stop**.
3. **Apply.** Paste `supabase/migrations/20261103000000_passport_snow.sql`
   into the SQL editor and run it. **Never `supabase db push`** — the
   project's migration history belongs to Atlas, and `supabase/migrations/`
   holds files production took in a different order. It is idempotent: a
   second run changes nothing. It ends with `NOTIFY pgrst, 'reload schema'`.
4. **Verify permissions.** Paste `shared-preflight.sql` again. **Every row
   must be `true`** (15). That covers: 15 tables, RLS on each, anon holds no
   table grant, authenticated holds no TRUNCATE/REFERENCES/TRIGGER, 15
   member-read policies, both transaction functions present, anon cannot
   execute any Snow function, the raster-only photo guard on the core's
   moments table, no second photo/announcement store, the member-gone
   trigger, and no Snow policy on any core table. If any row is false, run
   `docs/product/snow/shared-rollback.sql` (drops only Snow's objects) and
   stop.
5. **Push** (Vercel deploys GitHub `main`):
   `git push origin FETCH_HEAD:refs/heads/main` — a fast-forward, no force.
6. **Confirm the deployment:** `vercel ls elk-passport`, then
   `vercel inspect <url>`: the source SHA must be this record's commit and
   the state READY. No new environment variable.

Do the SQL (steps 1–4) **before** the push. Without the tables the one-phone
snow day works, but "Plan it together, live" answers 503 "Adventures can't
be reached right now" — there is no "sharing is off" mode.

**Rollback:** code — push the previous `main` (`a47e611`) back as a new
commit (`git revert`) or redeploy the previous deployment in Vercel; SQL —
`docs/product/snow/shared-rollback.sql`, which deletes every shared snow
day's plan, votes, chat, points, predictions and photos (the adventures
themselves stay, as plain `snow-day` adventures).

## 6. Production verification (two real accounts, two phones) — not done

Against `https://gohaveaday.com`, after §5:

1. **Front door:** `/snow` signed out shows Go Have A Snow Day; the
   Experiences menu has five entries and Snow Day opens `/snow`.
2. **Start shared:** phone A signs in → "Plan it together, live" → a day at
   `/snow/day/<32 hex>`, "Online — shared with the crew".
3. **Join:** A copies the invite (Crew); phone B opens it, signs up / in,
   picks a level, "I'm in" → the same day, "You are <B>". A's crew list
   shows B without reloading (≤ 5 s).
4. **Plan together:** B adds/votes a mountain → A sees LEADING. B tries
   "Lock it in" → "Only the host can do that." A locks it → B sees LOCKED IN.
   A changes it to another option → both see the "Plan changed" notice once.
5. **Chat:** a line each way arrives on the other phone.
6. **Predictions:** A adds one; B calls it; A sees B's call. A settles it
   after.
7. **Memories:** B adds a photo; it appears on A. A (host) posts an
   announcement; B sees it and has no announce form. Open the photo URL on A:
   200 `image/jpeg`.
8. **Points:** B marks a challenge done → A's standings show B's points.
9. **Consistency across sessions:** sign B out, close the tab, sign in on a
   new browser → everything in 4–8 is there and matches A.
10. **Privacy:** a third account not invited opens the day URL → "This day
    isn't on this phone"; the photo URL → 404. Signed out → "Sign in to
    open this snow day"; photo URL → 401.
11. **Leaving:** B leaves → B's votes, points, photo disappear from A; B's
    chat stays as "Someone".
12. **Existing experiences:** a Hockey Night, a Christmas adventure and
    `/datenight` still open as before; `/adventures` lists the snow day as
    "Snow Day" and opens it at `/snow/day/<id>`.

Production is "done" only when 1–12 pass. Record the deployment ID here.

## 7. Remaining blockers and named gaps

- **Release authority.** Push and SQL are the operator's (above).
- ~~ADR 014 overlap~~ resolved (§3). Only the host announces; "Got it" is not asked on Snow notices.
- **Static mountain list** (15 areas) — names and coordinates from general
  knowledge, resort URLs not fetched; needs a human spot-check before it is
  presented as fact. Atlas ski areas are coded and unit-tested on fixtures
  but never exercised against real Atlas from this lane.
- **Photos** are base64 in Postgres (as Hockey's and ADR 014's), 16 a day.
- **No offline queue** for shared days; a one-phone day works offline once
  open, with no service worker.
- **Doctrine tension** recorded in `docs/product/snow/README.md` (the
  "who gets down fastest" example) is unchanged.
