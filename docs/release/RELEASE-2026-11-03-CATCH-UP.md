# Passport — production catch-up and baseline, 2026-11-03

Lodge mission 514, "Production catch-up and release". This is the verified
starting point for the next mission. It records what production runs, what
is waiting, what blocks it, and what each experience does. Snow Day has its
own release mission (513 and successors) and is only named here.

Every claim is labelled **Verified** (checked by this mission, with the method
given), **Recorded** (taken from a dated record, cited), or **Unknown**.

---

## 1. What production is

| Fact                         | Value                                                                                                                      | How it was established                                                                                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Production URL               | https://gohaveaday.com (October also on https://www.iamoctober.com)                                                        | Verified: browser pass, §4                                                                                                                                                           |
| Production code              | GitHub `main` = **`963daec`** (2026-11-02, "Exclude test files from production TypeScript build")                          | Verified: `git fetch origin`. The Vercel project deploys GitHub `main` (Git link, recorded since 2026-10-16). Deployment id: Unknown (`vercel ls` refused by the session classifier) |
| Last release through Forge   | `743e171`, 2026-10-23 20:28Z, smoke-verified                                                                               | Verified: `~/.local/state/elk-release/ledger.jsonl`. Everything since went to production by a person's push to GitHub `main`                                                         |
| Forge release mode, Passport | **MANUAL** (`~/forge/data/release-policy.json`); candidates `refs/heads/main` and `refs/heads/ship/*` of `~/passport/main` | Verified                                                                                                                                                                             |
| Live app's Supabase project  | **`frllwwxesxbmmaadzfaf`**                                                                                                 | Verified: the project URL baked into gohaveaday.com's JS bundle; server code reads the same `NEXT_PUBLIC_SUPABASE_URL`                                                               |
| Forge's database service     | `passport-production` connects to **`mbyigfvqqolmtszgzruy`**, a different project                                          | Verified: `psql service=passport-production` read-only `\conninfo` (host only)                                                                                                       |

### 1a. The database blocker (owner decision, first)

Forge's runner plans every Passport database release against
`mbyigfvqqolmtszgzruy`. The live app uses `frllwwxesxbmmaadzfaf`. Read-only
`db-check` against main on 2026-11-03:

```
absent       0/88   20260927000000_passport_baseline.sql
absent       0/60   20261012000000_passport_conferences.sql
absent       0/13   20261014000000_passport_conference_arrivals.sql
unverifiable    -   20261016000000_passport_conference_grants.sql
present   162/162   20261021000000_passport_adventures.sql
absent      0/150   20261023000000_passport_conference_together.sql
present       2/2   20261023100000_passport_adventure_item_origin.sql
present     54/54   20261101000000_passport_adventure_together.sql
present     24/24   20261102000000_passport_date_nights.sql
present     20/20   20261102100000_passport_adventure_packing.sql
absent      0/119   20261103000000_passport_snow.sql
```

That database's `public` schema has exactly 14 tables, the adventures family
plus Date Night. It has no boards, profiles, preferences, October or
conference tables, which production has used since October. **Any SHIP of a
candidate that touches `supabase/migrations/` would, as currently configured,
apply the baseline and the conference migrations to `mbyig…` and then deploy
code that reads `frllw…`.** That includes `main` and `ship/powder-day`. The
new tables would land in a database the site doesn't read.

Possible explanations, none verified:

- (a) the service file points at the wrong project.
- (b) `mbyig…` is a new project being prepared for a cut-over.
- (c) some SQL-editor steps since 10-24 were run in `mbyig…`. This would fit
  production's packing `PGRST205` "Not switched on yet"
  (`docs/product/date-night/FINISH-POLISH-SHIP.md` §1), because PGRST205 is
  also what a truly missing table returns.

This mission could not look at `frllw…`: an anon-key PostgREST existence probe
was refused by the session classifier [Credential Exploration].

**Owner action:** in `~/.config/elk-release/pg_service.conf`, make
`passport-production` point at the project the site uses. Or, if `mbyig…` is
intended, say so and plan the cut-over. Then re-run
`npx tsx scripts/elk-release.ts db-check --project passport` in `~/forge` and
check the table above flips. Until then, **do not press SHIP on any Passport
candidate that changes `supabase/migrations/`**.

---

## 2. What this mission did

| Ref               | Commit    | What                                                                                                                                                 |
| ----------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ship/date-night` | `2a4326a` | **Release candidate: Date Night finish, code only.** Fast-forward of production `963daec`: `b3527d0` + the two commits below                         |
|                   | `327c740` | `finish.spec.ts` makes a fresh test password per run. Forge held `main` eafdb99 on 2026-11-03 18:12Z: "Looks like it adds a credential"              |
|                   | `2a4326a` | Holds back the two `NOTIFY pgrst` lines b3527d0 appended to already-applied migrations. Without this, the release enters Forge's database plan (§1a) |
| `main`            | `8cea8b5` | Cherry-pick of `327c740`. `main` keeps the NOTIFY lines                                                                                              |

`ship/date-night` changes no file under `supabase/`, no sensitive path
(`middleware.ts`, `src/lib/supabase/`, auth, `next.config.ts`), and adds no
credential-shaped line. So Forge should hold it only at **approval** (MANUAL
mode), not at safeguards or database.

### Gates on `ship/date-night` 2a4326a (scratch clone `~/scratch/catchup/repo`)

- `npm ci`, `npx tsc --noEmit`, `npx eslint .` (0 errors, 42 warnings), prettier on changed files, `npm run build`: all pass.
- `npx vitest run`: **4146 passed, 42 skipped** (339 files).
- Date Night acceptance specs on a fresh real local stack: 2 pass. The three journey specs have expired by date and fail identically on `b3527d0`; see §3.

### Not done, and why

- **Forge did not test or release it during the mission.** The runner pauses
  while a mission is running in the `passport` workspace (state.json: "a mission
  is running in passport: its branches are work in progress"). It evaluates
  `ship/date-night` once this mission ends. In MANUAL mode it then waits for
  **SHIP in Forge** on `2a4326a`.
- **No push, no deploy, no SQL.** `CLAUDE.local.md` forbids all three here.
  Production read-backs (`vercel ls`, anon PostgREST) were refused by the
  classifier.
- **Snow untouched.** `ship/powder-day` 8a175e7 and the Snow merge in `main`
  belong to the Snow mission. `main` 8cea8b5 is still held by Snow's two
  flagged files (fixed only on `ship/powder-day`) and by its migration.

---

## 3. Date Night acceptance on the release candidate

Run on a fresh real local stack per spec (GoTrue + PostgREST + Postgres,
575xx), `next start`, dated-corpus Atlas stand-in. Runner:
`~/scratch/catchup/one.sh`.

- `date-night.spec`: **2 passed** (Jess answers without an account; nothing
  lost before the database step).
- `finish.spec`, `magic.spec`, `markham.spec`: **fail. The specs have
  expired by date; this is not a regression.** The product pins the first Date
  Night to 2 November 2026 (`src/domain/date-night/adventures/tomorrow.ts:28`,
  `on: "2026-11-02"`). From 3 November the night opens on the Memories room, and
  the specs wait forever for the Adventure room's "Choose" button in a hidden
  tab. **`b3527d0`, the exact commit verified on 2 November
  (`FINISH-POLISH-SHIP.md`), fails identically at the same step.** The candidate
  differs from it only by a test-password line and two migration comments plus
  NOTIFY.
- Not re-run: a clock override needs libfaketime (not installed) or spec
  edits. Next Date Night mission: make these specs take their day from a
  parameter instead of the calendar.

Two harness traps, for whoever runs these next:

- The critic `atlas-mock` is the wrong stand-in. The group-adventures
  `atlas-standin.mjs` with the dated corpus is the one these specs were
  written against.
- `date-night.spec` claims `/lorne-and-jess` (first owner wins), so every
  other spec needs a fresh stack.

---

## 4. Production, as a person sees it (signed out), 2026-11-03

A Playwright pass from Metatron against https://gohaveaday.com. It used a
Pixel 7 phone profile and a 1366×900 desktop. It made no accounts and wrote
nothing. Each route was checked for status, page errors, failed or broken
images, horizontal overflow and the visible heading. Script:
`~/scratch/catchup/prodcheck/check.mjs`. Screenshots are beside it.

| Route               | Phone / desktop | Heading                                        | Notes                                                                                                            |
| ------------------- | --------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `/` (Discovery)     | 200 / 200       | What kind of day are you looking for?          | 50 images, 0 broken. **HTML is 10.4 MB** (curl): a performance defect                                            |
| `/datenight`        | 200 / 200       | Just us                                        | Clean                                                                                                            |
| `/hockey`           | 200 / 200       | Hockey Night — NHL scores, standings and teams | Clean                                                                                                            |
| `/hockey/my-nights` | 200 / 200       | Welcome back                                   | Sign-in gate, as designed                                                                                        |
| `/christmas`        | 200 / 200       | Let's make some Christmas memories.            | 17 images, 0 broken                                                                                              |
| `/october`          | 200 / 200       | October                                        | Clean; iamoctober.com 200                                                                                        |
| `/conferences`      | 200 / 200       | Everyone's going to be in the same place.      | Clean                                                                                                            |
| `/adventures`       | 200 / 200       | Go have a day.                                 | Clean                                                                                                            |
| `/saved`            | 200 / 200       | Where to next?                                 | Clean                                                                                                            |
| `/creative`         | 200 / 200       | ELK Creative Archive                           | Clean                                                                                                            |
| `/fairview3`        | 200 / 200       | No more crystal balls                          | **`/api/fairview3/live` and `/presence` answer 503**: no Upstash env (Recorded as intended after the 10-28 show) |
| `/snow`             | 404 / 404       | —                                              | Not released (Snow mission)                                                                                      |

**Not verified on production by this mission.** These are all signed-in
journeys: creating and joining experiences, invitations, group
interactions, saving, notifications, and database persistence. Doing them
needs prod sign-ups. Earlier missions had those refused by the classifier
[Modify Shared Resources]. More importantly, §1a means nobody can currently
say which database the shared features need. These are the operator
two-phone smokes in §6.

---

## 5. Product inventory (production `963daec`)

"Works" means it was verified on a real local stack by the cited record,
unless it says _production_. Owner decisions are listed, not resolved.

### Date Night — `/datenight`, `/night/<id>`, `/lorne-and-jess`

- **Release status:** live up to 963daec (rooms, plays, leave-time options,
  packing, memories). The finish pass (Send to Jess, steady Together buttons,
  turns, Soundtrack) is the candidate `ship/date-night` 2a4326a.
- **Works:** five rooms, plays + "Text Jess", packing, memories, two phones
  (`docs/product/date-night/SHARED-ADVENTURE.md` §§2–5). Production: front door
  renders on phone and desktop (§4).
- **Incomplete:** packing in production shows "Not switched on yet"
  (PGRST205). The remedy is `NOTIFY pgrst, 'reload schema';` in the SQL editor
  of the **site's** project. Forecast needs `WEATHER_PROVIDER=msc`.
- **Owner decisions:** plays vs doctrine §14; recipient must sign in (§15.12)
  (`FINISH-POLISH-SHIP.md`).
- **Next:** SHIP `ship/date-night`; the NOTIFY; two-phone production smoke.

### Hockey Night — `/hockey` (public NHL site), `/hockey/my-nights`, `/hockey/[id]`

- **Release status:** live (website `dffd758`, finish work).
- **Works:** public scores/standings/teams (production §4); named scores,
  announcements + replies, league picker (`RELEASE-2026-11-01-HOCKEY-FINISH.md`).
- **Incomplete:** announcements need `docs/product/hockey/announce-migration.sql`.
  Mini fantasy is disabled. Chirp Bot output has never been read by a person.
  Arenas other than Vancouver are unmeasured.
- **Owner decisions:** NHL terms of use (`docs/product/hockey/WEBSITE.md`);
  two announcement systems (Hockey's vs ADR 014 notices).
- **Next:** announce SQL → smoke (`RELEASE-2026-11-01-HOCKEY-CHRISTMAS.md` §6) → read ten Chirp lines.

### Christmas — `/christmas`, `/christmas/discover`, `/christmas/plan`, `/christmas/adventure/[id]`

- **Release status:** live (production §4: 17 images, none broken).
- **Works:** family journey on a phone, `christmas-off` (stack).
- **Incomplete:** announcements and shared memories need the together
  migration in the site's database. Limits: Atlas coverage, no music,
  polling only, budget not a verified cost (`docs/product/christmas/RELEASE.md`).
- **Next:** together SQL (confirm database, §1a); two-phone smoke.

### October — `/october/*`, iamoctober.com

- **Release status:** live; unchanged since October missions.
- **Works:** room with Halloween threshold, store (`october-experience-bible.md`).
- **Known:** e2e `october:554/570` are long-standing environmental baseline
  failures. The "From October" memory lives in one browser only. `ROOM_OPENS`
  pacing is unconfirmed.
- **Next:** none recorded; maintenance only.

### Conference — `/conferences`, `/labs/conference`

- **Release status:** live; Sycle Summit shipped 571fdb6 (2026-10-24).
- **Works:** agenda import, calendar, reminders, five tabs (Recorded).
  Production front door renders (§4).
- **Incomplete:** `CONFERENCE_TOGETHER` deliberately unset (plans/chat
  dark). Arrivals depends on `CONFERENCE_ARRIVALS` + a table recorded missing
  in production on 10-21. No push notifications.
- **Next:** none until the next event; §1a affects its tables too.

### Discovery — `/`, `/discovery`

- **Release status:** live.
- **Works:** Vancouver sentences, venue pages (production-verified 10-26).
- **Defects:** **10.4 MB HTML document** (new measurement, this mission). 7.5 s
  cold load and `/places/[id]` 10.8–13.8 s to first byte (Recorded). Default
  area mixes Okanagan/Vancouver. Hero image coverage 21% (10-16 audit).
- **Owner decision:** IP default area options a/b/c (`RELEASE-2026-10-26-VANCOUVER.md`).
- **Next:** page weight (the 10.4 MB document) is the cheapest large win.

### Saved / Adventures / Day Builder — `/saved`, `/adventures`, `/adventures/new`

- **Release status:** live; production front doors render (§4).
- **Works:** 12/12 stack journeys (`docs/product/adventures/RELEASE.md`).
  Tables present in the database Forge inspects; **Unknown** in the site's.
- **Weak:** evening hours, skate times, dare ratings (`docs/product/adventures/smarter/README.md`). Model features need `OPENAI_API_KEY`.

### Fairview 3 — `/fairview3`

- Live page; APIs 503 without Upstash env (§4). Event was 2026-10-28. No action
  unless it runs again.

### Creative Archive — `/creative`

- Live (§4). Open: two docs to recover, Fishing With Emi originals (`docs/history/creative-archive.md`).

### Snow Day — `/snow` (404)

- Not released. Owned by the Snow mission: `ship/powder-day` 8a175e7, held by
  Forge for SHIP because it adds a migration. **§1a applies to it directly.**

### Outside production and not shipped by this mission

| Work                                                                               | Where                                            | Why not                                                                                                                                             |
| ---------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Experience theme isolation (ADR 004, "context decides")                            | `feature/experience-theme-isolation` 17ae892     | Never adopted. It conflicts with current `main` in the doctrine and `/passport/[id]`, and merging it would decide product authority. Owner decision |
| Conference Arrivals RLS work                                                       | uncommitted in `.claude/worktrees/agent-abb20c…` | Incomplete since 2026-10-12                                                                                                                         |
| Sycle prototype                                                                    | `sycle-prototype` 6ae9ab2                        | Kept out on purpose                                                                                                                                 |
| `lane/vision`, `fix/ghad-understand-intent`, `m184/int-on-main`, `release/october` | branches                                         | Mission docs, or already in production by content (M383 audit)                                                                                      |

Every other branch and worktree head is an ancestor of production `963daec`
(checked with `git merge-base --is-ancestor` across all refs). `lanes/perf`
holds only re-shot PNGs, uncommitted.

---

## 6. Operator steps, in order

1. **Fix or explain Forge's database service (§1a).** Nothing with a migration ships safely before this.
2. **Press SHIP in Forge on `ship/date-night` `2a4326a`** once the runner has
   tested it (it starts after this mission ends). The runner deploys,
   smoke-tests and moves GitHub `main`.
3. In the SQL editor of **the site's** project (`frllw…`), run
   `NOTIFY pgrst, 'reload schema';`. Then open a date night's Together room:
   packing should load.
4. Two-phone production smoke, Date Night (`FINISH-POLISH-SHIP.md` "Release"):
   make → Send to Jess → join → turn → Soundtrack → Memories photo.
5. Outstanding SQL from earlier records, each after its preflight, and only once
   §1a says which database:
   - `docs/product/hockey/announce-migration.sql`
   - `20261101000000_passport_adventure_together.sql` (if the preflight says not applied)
   - Snow (its mission)
6. **Do not press SHIP on `main`** until Snow's mission has landed. `main`
   carries Snow's migration and two flagged verification files.

## 7. Recommended next missions

1. **Forge database service ↔ live Supabase reconciliation** (Forge workspace,
   with the owner). This blocks every database release.
2. **Discovery page weight**: a 10.4 MB HTML document on the front door.
3. **Production two-phone smokes** for Date Night, Hockey and Christmas, run by
   the owner or with a permission rule allowing prod test sign-ups
   (`@example.test`).
4. **One announcement system** (Hockey's vs ADR 014's), and NHL terms of use.
5. **Snow Day release** (existing mission), after item 1.
