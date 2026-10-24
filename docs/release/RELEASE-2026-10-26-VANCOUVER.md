# Release 2026-10-26 — Vancouver: one candidate for everything finished

**Candidate:** local `main` on Metatron (`/home/lorne-markham/passport/main`),
the commit that adds this file. **Not pushed, not deployed, no database
change made.** Pushing is disabled in this clone on purpose and production
cannot be read from here, so the push and the SQL editor are the owner's
steps (§6).

## 1. The truth on 2026-10-24 (measured, not reported)

| What                     | Value                                                                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub `main`            | `d542503` (fetched)                                                                                                                             |
| Vercel production        | `dpl_8qAj75E9wJRrE83jfQ5vAackqTDy`, built from GitHub `main` `d542503` (`vercel api` gitSource), aliased to gohaveaday.com, www, iamoctober.com |
| Atlas production         | `dpl_G7vnbBFhfu9rzehwdYrzoGHqpeaU`, project `elk-atlas`, READY, target production (CLI deploy, no git metadata)                                 |
| Atlas, as Passport reads | gohaveaday.com's `/go` payload: 4,384 candidates (2,821 Organizations, 1,058 Places, 502 Events), 3,859 with a `presentationImage`              |
| Candidate vs GitHub main | 23 commits ahead; `origin/main` is an ancestor, so **the push is a fast-forward**                                                               |

Venue pages in production already carry Atlas addresses and websites
(e.g. Guu with Otokomae: 375 Water Street + guu-izakaya.com; Shenanigans:
1227 Robson Street + OSM source). They are titled "… — October" in
production; this candidate fixes that ("— Go Have A Day").

## 2. What is in

| Work                                              | Commit                              | In GitHub main? | How it entered this candidate                                           |
| ------------------------------------------------- | ----------------------------------- | --------------- | ----------------------------------------------------------------------- |
| Hockey Mayhem                                     | `36dba1d`                           | yes             | already there                                                           |
| Conference Together (code; flag off)              | `3de2b72`                           | yes             | already there                                                           |
| Conference Executive + Explore link fix           | `d542503`                           | yes             | already there                                                           |
| Conference Executive release branch               | `2bb1532`                           | via `d5ceea8`   | `ff5b06c` (10-24 candidate)                                             |
| Saved + Adventures (ADR 012)                      | `813d0cb`                           | **no**          | `476e62d` (10-24 candidate)                                             |
| Discovery speed                                   | `c24cb2a`                           | **no**          | `2ca7070` (10-24 candidate)                                             |
| 10-24 candidate + re-verification                 | `9a6a6e7`, `72d71f9`                | **no**          | first-parent history of this `main`                                     |
| Vancouver launch (Discovery downtown, Parq, etc.) | `a2038a8`, `d30c227`, `d3a25fe`     | **no**          | first-parent history of this `main`                                     |
| **Hockey Bet button fix**                         | `498f9cb`…`d80009b` (tip `0e79fcf`) | **no**          | **`9f0b88f`**, `--no-ff`, clean, this mission                           |
| **Conference mobile first**                       | `d41705b`, `aa0090b`                | **no**          | **`afe51ab`**, `--no-ff`, clean, this mission                           |
| October                                           | `feature/october` (`8a7a6b0`)       | yes             | fully contained; `release/october`'s only own change is already in main |

No file was edited to make a merge work. The two merges this mission made
touch no shared contract (no `package.json`, no migration, no schema); the
only global file is `src/app/globals.css`, whose new rules are scoped to
conference pages (`[data-cf-frame]`, `.cf-agenda-day`, `.cf-shelf`).

## 3. What is left out, and why

| Branch / work                                                              | Why                                                                                                                                     |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `lanes/conference` working tree (`feature/sycle-summit`, uncommitted)      | **In flight, not finished**: agenda import, calendar route, schedule components. Nothing committed beyond `aa0090b`, which is included. |
| `lanes/hockey` working tree (uncommitted spec / PlanTab / VenueCard edits) | In flight, not committed.                                                                                                               |
| `feature/experience-theme-isolation` `17ae892`                             | ADR 004, never approved for release; off `1d8974d`.                                                                                     |
| `lane/vision` `1c07623`, `39f011f`                                         | Docs about the 10-15 release only.                                                                                                      |
| `fix/ghad-understand-intent` (2 unique of 5), `m184/int-on-main`           | 10-11 work on a base 400+ commits old; superseded by later Discovery work; never listed as approved.                                    |

## 4. Gates (Metatron, this candidate's tree)

| Gate                                                                                                                        | Result                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                                                                                                          | clean                                                                                                                                                                                                                                                          |
| `npx eslint .`                                                                                                              | 0 errors (warnings include a stale `.claude/worktrees` copy)                                                                                                                                                                                                   |
| `npx prettier --check .`                                                                                                    | clean                                                                                                                                                                                                                                                          |
| `npx vitest run`                                                                                                            | **3803 passed**, 38 skipped                                                                                                                                                                                                                                    |
| `npm run build`                                                                                                             | ok                                                                                                                                                                                                                                                             |
| `npx playwright test` (`next start`, critic Atlas mock, `E2E_ATLAS=1`)                                                      | 248 passed, 6 failed, 7 skipped. **Baseline (5):** core-loop:26, october:554/570, discovery-natural:102, conference-mobile:23 (`/labs` has no Conference link). **Flake (1):** october-door:243 — passes alone, 30/30 in its file ×3; no October file changed. |
| Vancouver visitor (phone, real GoTrue/RLS, production's corpus)                                                             | 1/1 — coffee near the Parq, dinner for five, 20-minute walk, save three, plan an evening, share + coworker joins, venue page, come back                                                                                                                        |
| Vancouver extra questions (same server, scratch spec)                                                                       | 4/4 answer: bars in Yaletown, interesting places in Gastown, entertainment after the sessions, experiences within walking distance (quality notes in §8)                                                                                                       |
| Adventures (real stack)                                                                                                     | 12 passed, 1 skipped (journey, acceptance, extraordinary)                                                                                                                                                                                                      |
| Conference `together.spec` (5 accounts; all five tabs at 320/375/390)                                                       | 1/1                                                                                                                                                                                                                                                            |
| Conference attacks                                                                                                          | together 76/76, rls 68/68, arrivals 33/33                                                                                                                                                                                                                      |
| Hockey specs (bet-button ×8, mayhem, chirp, alive, finish, finish-play, polish, redesign, modules, plan-and-results, seats) | 18 passed, 1 skipped                                                                                                                                                                                                                                           |
| Hockey attacks                                                                                                              | rls, mayhem: all checks passed; seats 35/35; arena 78/78                                                                                                                                                                                                       |
| `grants-check.sql`                                                                                                          | Hockey 4/4 OK; Adventures 4/4 OK; Conference: two **pre-existing, dormant** unbacked policies (see §8)                                                                                                                                                         |

Not run: the migration-absent Hockey variants (`*-off`; no SQL changed),
the Adventures Atlas-down variant, `mayhem-ai` / `chirp-ai-live` (need a
model). Nothing was run against production from here (§5).

## 5. Database (production `frllwwxesxbmmaadzfaf`, SQL editor only)

**State unknown from here.** The classifier refused production reads in
this mission. Earlier anon probes (10-24 morning) said: Adventures tables
present, `origin` column missing; Together tables present; Hockey memories
and mayhem not applied. Hockey `36dba1d` and Conference `d542503` have been
live since, so re-measure before pasting anything:

1. **`docs/release/PREFLIGHT-2026-10-26.sql`** — read-only, one row per
   candidate, says `APPLIED` / `NOT APPLIED` / `PARTIAL — STOP`. Checked on
   three local stacks with different states; each read correctly.
2. Only for rows that say `NOT APPLIED`, in this order:
   1. Hockey Memories: `docs/product/hockey/memories-preflight.sql` (all OK)
      → `memories-migration.sql`.
   2. Hockey Mayhem: `mayhem-preflight.sql` → `mayhem-migration.sql` →
      `mayhem-preflight.sql` (last rows `APPLIED`) → `NOTIFY pgrst, 'reload schema';`.
      **Without it the Bet button refuses in the sheet** ("Could not find
      the function…"); the fix makes that visible, it does not make bets
      work.
   3. Adventure origin:
      `supabase/migrations/20261023100000_passport_adventure_item_origin.sql`
      (checks + rollback in `docs/product/adventures/RELEASE.md`). Safe to
      deploy before it.
   4. Conference Together: only if `NOT APPLIED`, paste
      `supabase/migrations/20261023000000_passport_conference_together.sql`.
      **Do not set `CONFERENCE_TOGETHER`.** It stays dark until someone
      reviews it against production (`together-attack.mjs` against the real
      project) and decides to open it.
3. Re-run step 1: every row should read `APPLIED`, except Together if you left it out.

Every migration is additive and idempotent. A `PARTIAL` row means stop and
report. Do not re-paste.

## 6. Owner steps (Mac)

```bash
cd <your elk-passport checkout>
git fetch metatron:passport/main main
git log -1 --format='%H %s' FETCH_HEAD           # = this commit
git fetch origin && git merge-base --is-ancestor origin/main FETCH_HEAD && echo FAST-FORWARD
# SQL editor: §5, in order
git push origin FETCH_HEAD:main                   # Vercel builds production from main (~1 min)
vercel ls elk-passport                            # newest Production = Ready
vercel inspect gohaveaday.com                     # its git sha = this commit
```

If `origin/main` moved after this record, stop: merge it into this `main`
on Metatron, re-gate, then push. Never force-push.

**Environment:** no new variables. Keep `CONFERENCE_STORE` and
`CONFERENCE_ARRIVALS` as they are; **leave `CONFERENCE_TOGETHER` unset**.

## 7. Production smoke (after the push, signed in with a real account)

1. `/` is Discovery. With _JW Marriott Parq_ chosen: "Great coffee near my
   hotel" → Coffee & cafés, under 1 km; "A good restaurant for five
   coworkers tonight"; "bars in Yaletown"; open a venue → address, website,
   title "… — Go Have A Day".
2. Save three → `/saved` → **Create an adventure** → reshape it in words →
   invite a second account → it joins → share link → sign out and back in:
   the adventure is still there (`docs/product/adventures/RELEASE.md`
   "Production smoke").
3. Conference on a phone: the five bottom tabs (Home, Arrivals, Agenda,
   Explore, People). Sycle shows **26–29 October** in Vancouver time, the
   real agenda, venue JW Marriott Parq Vancouver; a signed-out visitor
   gets a 404. Plans, Chat and Memories still say "isn't open yet" (flag off).
4. Hockey: an existing night still shows its predictions and Sycle Cup;
   place a bet (Bet button) and accept it from a second phone; Chirp Bot;
   Memories (needs the memories migration).

## 8. Found, not fixed (named for the owner)

- **Sycle Summit data is production data.** The agenda, the 26–29 October
  dates and the venue live in the conference's `details` in production. This
  candidate renders whatever the organiser entered, in Vancouver time
  (verified: times on the stack read PDT). The agenda importer is still
  uncommitted in the conference lane. Check it in smoke step 3. If it is
  wrong, the organiser fixes it in Organiser settings. That needs no deploy.
- **Doctrine §10, named by the conference lane:** on a phone inside a
  conference, the Go Have A Day bar is hidden. The conference's own bars
  replace it, and the bar becomes one item in the profile menu. This ships
  with `aa0090b` and needs a human OK, or a revert of that one CSS rule.
- **Discovery quality:** "interesting places in Gastown" answers with a
  generic heading and downtown-wide picks (Rogers Arena, BC Sports Hall of
  Fame); "bars in Yaletown" includes Fox Cabaret (Main St). Product work,
  not release blockers.
- **Conference grants (pre-existing since 10-12/10-16, already in
  production):** RLS policies allow `authenticated` to UPDATE
  `passport_conference_codes` and DELETE `passport_conference_invites` with
  no matching grant. The app never does either (codes: delete + insert;
  invites: update `revoked_at`), so nothing breaks. Either drop the policies
  or add the grants, deliberately.
- Open owner questions carried from `docs/product/vancouver/LAUNCH-2026-10-26.md`:
  an IP-derived default area (ADR 002), and whether Start over keeps the
  activity.

## 9. Rollback

- **Code:** Vercel → elk-passport → Deployments → promote
  `dpl_8qAj75E9wJRrE83jfQ5vAackqTDy` (`d542503`) back to production. That
  takes seconds and needs no git change. To make GitHub agree afterwards:
  `git revert -m 1 <merge>` for the offending merge(s) on a new commit, then
  push. **No force-push.**
- **Database:** every migration above is additive. `d542503` runs with or
  without them, because the stores fall back when tables or columns are
  missing. Leave them in place on a code rollback. Each file's header holds
  its own reversal, if one is ever needed.
