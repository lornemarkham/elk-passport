# Release 2026-10-24 — Passport: Adventures + Conference Executive + Hockey Mayhem + Discovery speed

**Candidate:** local `main` on Metatron (`/home/lorne-markham/passport/main`).
It is the commit that adds this file, on top of the merges in §1.
**Status:** integrated and gated on Metatron. **Not pushed, not deployed.**
Pushing is disabled in that clone on purpose, so a person pushes it. Vercel
builds production from GitHub `main`, so the push is the deploy.

**Production when this was assembled:** GitHub `main` = `79a4891` ("Finish the
Night"), deployment `dpl_7tSHSWV3zqMxBcfkQb9mFyqGH47V`.

## 1. What is in

Every candidate below was finished and verified by its own mission. None was
redesigned here. The only edit made during integration is one import
conflict, noted in the table.

| Work                                                        | Commit                         | How it entered                                                                                                              |
| ----------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Hockey Night: Operation Mayhem                              | `36dba1d`                      | base (fast-forward of `79a4891`; mission 442's staged RC)                                                                   |
| Conference Executive (on Conference Together `3de2b72`)     | `2bb1532` (merge of `0f67d0d`) | `--no-ff`, no conflicts                                                                                                     |
| Saved + Adventures transformation (ADR 012)                 | `813d0cb`                      | `--no-ff`, no conflicts                                                                                                     |
| Discovery speed (sized images, zod out of the bundle, memo) | `c24cb2a`                      | `--no-ff`; one conflict, in the `PossibilityCard` imports: kept both `presentedLabel` (Adventures) and `sizedImage` (speed) |

A push of this candidate is a superset of the Hockey launch (`36dba1d`) and of
the Conference launch candidate as it stood at `2bb1532`. **If the Conference
launch mission (443) adds commits after `2bb1532`, merge them into this
`main` before pushing**, not the other way round. Pushing `2bb1532` alone
would drop Mayhem and Adventures.

Left out on purpose: `feature/experience-theme-isolation` (ADR 004, never
approved for release), `lane/vision` (docs only), `release/october` (unsafe
per the 10-23 runbook), and `sycle-prototype`.

## 2. Gates (Metatron, scratch clone of this candidate)

| Gate                                                    | Result                                                                                                                                       |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                                      | clean                                                                                                                                        |
| `npx eslint .`                                          | 0 errors, 41 warnings                                                                                                                        |
| `npx prettier --check .`                                | clean                                                                                                                                        |
| `npx vitest run`                                        | 3785 passed, 37 skipped                                                                                                                      |
| `npm run build`                                         | ok                                                                                                                                           |
| `npx playwright test` (`next start`, critic Atlas mock) | 249 passed, 5 failed, 7 skipped. All 5 are the recorded baseline: core-loop:26, october:554/570, discovery-natural:102, conference-mobile:23 |
| Adventures verification (real local Supabase stack)     | journey + acceptance + extraordinary: 12/12; Atlas-down variant 1/1; `src/lib/adventures` incl. `origin.stack.test.ts` 88/88                 |

Not re-run here: Conference `together.spec` / attack suites, and the Hockey
three-account and attack suites. Their own missions ran them on the same
commits: Conference in mission 439/443, Hockey in mission 441.

## 3. Database (production `frllwwxesxbmmaadzfaf`, SQL editor only)

Production state from anon probes on 2026-10-24 ("permission denied" means the
object exists):

- Adventures tables: present. **`passport_adventure_items.origin`: missing.**
- Conference Together (`passport_conference_plans`) and Arrivals: present.
- Hockey (mission 442): memories and mayhem **not applied**.

Steps:

1. `docs/product/hockey/memories-preflight.sql` → `memories-migration.sql`.
2. `mayhem-preflight.sql` → `mayhem-migration.sql` → `mayhem-preflight.sql`
   (the last five rows should read `APPLIED`).
3. `supabase/migrations/20261023100000_passport_adventure_item_origin.sql`.
   Its checks and rollback are in `docs/product/adventures/RELEASE.md`.
   - It is safe to deploy before this step: without the column, a dropped
     Passport suggestion goes back to the ideas instead of being deleted.

Conference Executive needs no migration (agenda and venue live in
`details` jsonb).

## 4. Owner steps (Mac)

```bash
git fetch metatron:passport/main main && git log -1 FETCH_HEAD   # this commit
# SQL editor: §3, in order
git push origin FETCH_HEAD:main                                  # Vercel deploys main
vercel ls elk-passport                                           # newest production = this commit
```

## 5. Production smoke

- `/` is Discovery ("What kind of day are you looking for?"). The bar reads
  Discover · Places · Saved · Experiences.
- Adventures: run the five steps in `docs/product/adventures/RELEASE.md`
  ("Production smoke"). Then check that an account with older saved places
  still sees them under _Places you've saved_.
- Hockey: `MAYHEM.md` §10 step 6. Conference: the runbook of mission 443.
