# Release 2026-10-28 — Fairview 3: No More Crystal Balls

A one-morning live show for ~140 Sycle phones, built inside Passport as
three public routes and one SQL migration. **Candidate:** local `main` on
Metatron, the commit that adds this file (parent `83bc669`, which is also
GitHub `main`). **Not pushed, not deployed, no database change made from
here** — pushing and deploying are disabled in this checkout on purpose
(`CLAUDE.local.md`), so the push and the SQL editor are the owner's steps
(§4). Everything below that is _measured_ was measured here.

## 1. What it is

| Route                  | Who           | What                                                                                                      |
| ---------------------- | ------------- | --------------------------------------------------------------------------------------------------------- |
| `/fairview3`           | every phone   | Follows the presenter section by section; votes; sends anonymous feedback; lyrics for the finale.         |
| `/fairview3/stage`     | the projector | Public, read-only. QR code to join, live counts, vote bars on reveal, approved feedback wall, the anthem. |
| `/fairview3/presenter` | the presenter | Console behind the presenter key: sections, open/close/reveal, moderation, finale audio URL, resets.      |

Fourteen sections, in order: Curtain (QR) → Ask Merlin → Spellbook → Data →
AI → Unification → Care Management → Both at once (the parallel diagram) →
We need to know (the serious moment) → Vote 1 → Vote 2 → Vote 3 → Challenge
us → Finale. Content lives in `src/lib/fairview3/show.ts`.

This is not a traveller Experience in the doctrine's sense and touches no
Discovery, Hockey, Conference or October code. It adds files only.

## 2. How it works, and why

- **Storage.** Four `passport_fairview3_*` tables (state, participants,
  votes, feedback) with RLS on and **no policies**: the public anon key is
  granted nothing on them. Every read and write is a `fairview3_*`
  `SECURITY DEFINER` function that decides for itself (vote only while
  open, option within range, one vote per phone per question with change of
  mind, six feedback rows per phone, duplicate text refused). Prod grants
  nothing by default, so every grant is explicit.
- **Presenter protection.** The key is stored as a sha256 in the state row
  and checked **inside the database** (`fairview3_presenter_ok`), so the
  route handler is not the only gate. The browser keeps it in an httpOnly
  cookie after one sign-in; actions re-check it on every call. Wrong keys
  are rate limited per address. Why not `ADMIN_EMAILS`: its production
  state is unknown and Vercel env writes are denied from here; a key the
  owner sets in the same SQL editor run has no such dependency.
- **Audience identity.** A random UUID in `localStorage`, nothing else. No
  account, no name, no cookie. It is the duplicate-vote key and survives a
  reload or a dropped connection.
- **Realtime.** Polling: 2 s on phones (paused when the tab is hidden),
  1.5 s on the stage and console, exponential back-off and a visible
  "reconnecting" pill on failure. A reconnect is simply the next request.
- **Rate limits are keyed on the participant id**, with a loose per-IP
  backstop. 140 phones on one conference Wi-Fi share one NAT address; a
  per-IP limit tight enough to matter refused the whole room's votes in
  rehearsal here, so it is not that.
- **Feedback screening.** Emails, links, phone-number-like digit runs,
  dates and `MRN`/`DOB`/`SSN`-style tokens are refused on the phone with a
  reason; everything that gets through is `pending` until the presenter
  approves it. Only approved rows ever reach the public snapshot.
- **Finale audio.** The presenter pastes an `https://` URL into the
  console; it is saved in the state row and the stage plays it. No rebuild.
  With no URL the stage shows a ready state; no audio is ever generated.
- **Not ready.** Until the SQL is applied, the API answers 503 `not-ready`;
  phones show the curtain with "doors open soon", the console says which
  SQL to run. Nothing crashes.
- **No AI inference anywhere** in the voting or feedback path.

## 3. Gates (Metatron, this tree)

| Gate                                                                                                                                | Result                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                                                                                                                  | clean                                                                                                                                                           |
| `npx eslint .`                                                                                                                      | 0 errors, 80 warnings (baseline 80)                                                                                                                             |
| `npx prettier --check .`                                                                                                            | clean                                                                                                                                                           |
| `npx vitest run`                                                                                                                    | **3893 passed**, 38 skipped (baseline 3876 + 17 new in `src/lib/fairview3/store.test.ts`)                                                                       |
| `npm run build`                                                                                                                     | ok; `/fairview3`, `/fairview3/stage`, `/fairview3/presenter`, 6 API routes                                                                                      |
| `e2e/fairview3.spec.ts`, memory store (`next dev` and `next start`)                                                                 | 3/3                                                                                                                                                             |
| `e2e/fairview3.spec.ts`, **real Supabase path** (private stack: embedded Postgres + PostgREST, migration applied as the owner will) | 3/3                                                                                                                                                             |
| Migration SQL on a scratch database, applied twice                                                                                  | idempotent; anon cannot read any table (42501) nor set the key (42501); wrong key refused; `javascript:` audio URL refused                                      |
| Load, 140 simulated phones, 30 s, memory store (`next start`)                                                                       | 1,938 polls + 140 presence + 140 votes, **0 errors**, p99 4 ms, 140/140 votes counted                                                                           |
| Load, 140 simulated phones, 30 s, Supabase path (`next dev`)                                                                        | 1,904 polls + 140 presence + 140 votes, **0 errors**, live p99 115 ms, 140/140 votes counted                                                                    |
| Existing routes on the `next start` build                                                                                           | `/`, `/discovery`, `/conferences`, `/october`, `/october/discover`, `/adventures`, `/saved`, `/about` 200; `/hockey` 307 (sign-in, as before); unknown path 404 |
| Full `npx playwright test` (`next start`, critic Atlas mock, `E2E_ATLAS=1`, 2 workers)                                              | see §3a                                                                                                                                                         |

Phone (390×844) and stage (1600×900, 16:9 like the projector) screenshots
of every section were reviewed; every stage section fits without scrolling.

### 3a. Full Playwright suite

**252 passed, 5 failed, 8 skipped** (5.5 min, 2 workers). Four of the five
are the documented baseline from the 2026-10-24 release
(`conference-mobile:23`, `core-loop:26`, `october:554`, `october:570`). The
fifth, `discovery-one-search:58` ("real results start on the first screen",
first card has an image), is a Discovery assertion against the mock
corpus; Fairview 3 adds files only and touches no Discovery code. Its
re-run alone is recorded below. The run rewrites the committed Discovery
journey screenshots; they were restored with `git checkout --` on those
three directories (the known trap).

Re-run of `discovery-one-search.spec.ts` alone on the same server: 11
passed, the same 1 failed (`:58`, the first card's `data-has-image` is
`false` against the 2026-10-11 critic fixture). It is not in the 10-24
baseline list, so it is recorded here as **off-baseline and unexplained
by this change**: nothing under `/discovery` imports anything from
`fairview3`, and the first-card image is a property of the mock corpus and
Discovery's ranking. Worth a look by the Discovery lane; not a reason to
hold this release.

## 4. Owner steps, in order (Mac)

**1. Database** — Supabase SQL editor, production project, one run:

```sql
-- paste the whole of supabase/migrations/20261028000000_passport_fairview3.sql, then:
select public.fairview3_set_presenter_key('CHOOSE-A-LONG-KEY');
```

Check it took: `select presenter_key_hash is not null from
passport_fairview3_state;` → `true`. Applying the migration twice changes
nothing. To change the key later, run only the `select` line again.

**2. Push** (fast-forward; GitHub `main` is `83bc669`, the parent):

```bash
git fetch metatron:passport/main main
git push origin main
```

If Vercel is Git-connected it builds from this push; otherwise
`npx vercel deploy --prod` from the app directory. No new environment
variable is needed: the Supabase URL and anon key already in Vercel are all
it uses. Do **not** set `FAIRVIEW3_STORE` in production.

**3. Verify production** (two minutes, phone + laptop):

1. `https://gohaveaday.com/fairview3` on a phone: "You're in", pill says
   **live** (not "doors open soon" — that means step 1 has not run).
2. `https://gohaveaday.com/fairview3/presenter` on the laptop: enter the key.
   Press **Next** twice; the phone follows to "Ask Merlin".
3. Jump to **Vote 1**, **Open voting**, vote on the phone, **Reveal
   results**; the bar appears on `/fairview3/stage`.
4. **Challenge us**: send one line from the phone, approve it in the
   console, see it on the stage.
5. Finale: paste the song's `https://` URL, **Save**, **Start the anthem**
   on the stage (press the play button once if the browser asks for a
   click).
6. **Reset all** in the console before the audience arrives.

**4. Show day.** Stage on the projector in a full-screen browser tab
(`F11`), console on the laptop, QR on the curtain. Approve feedback as it
lands — the stage only ever shows approved rows.

## 5. Rollback

The routes are additive; reverting the commit removes them. The tables and
functions are harmless to leave; to remove: `drop function` each
`fairview3_*` and `drop table` each `passport_fairview3_*`.
