# Hockey Night — finish the night and ship it (2026-10-23)

**Asked (P0, Meta Hockey):** fix sealed predictions (server-side), meeting
point defaults, keep Arena Mode focused, bring Chirp Bot to life (verify the
real model path end to end; mission, challenge and Cup-lead reactions),
review the 25 ALIVE screens, integrate `c06601a` + `9713a84`, run the
release gates, migrate and deploy through the authorized process, verify
production. **Do not redesign.**

**Where:** `feature/hockey` on Metatron.

| Commit    | What                                                                                                                          |
| --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `d81aa51` | This mission's work (on ALIVE `9713a84` ← `c06601a`)                                                                          |
| `e39df87` | Merge of `origin/main` `a1ad8b5` (GitHub main) into it — **clean**; `origin/main` is an ancestor, so a push is a fast-forward |

Local only. **Not pushed, not migrated, not deployed** — see §7 for why and
for the owner's exact steps.

---

## 1. Sealed predictions — sealed for everybody until puck drop

**The bug, reproduced.** `passport_occasion_answer_visible()` (migration.sql)
carried the lab's date-night rule: an `onLock` answer was visible "once it
locks, **or once you have committed your own pick**". So the first person to
seal could read every later pick through PostgREST and copy the room. On an
unpatched stack `rls-attack.mjs` now fails exactly there:
`FAIL Nathan seals his own pick and still cannot see Lorne's`.

**Fixed twice, server-side:**

- **Database** — `night-migration.sql` part 1: `onLock` → visible to others
  only once locked. Every other rule is unchanged character for character.
  `CREATE OR REPLACE`, idempotent; `night-preflight.sql`, `night-rollback.sql`.
- **Application** — `src/domain/hockey/sealed.ts` `sealedFor()` filters every
  row set the server reads (`rowsFor` now takes the viewer), so the page,
  Chirp Bot and the Cup are never built from a pick the viewer may not see —
  **even on a database without the migration** (proved: `alive.spec` with
  `NIGHT_OFF=1` on a `HOCKEY_NIGHT=0` stack: PostgREST still leaks, the app
  does not).

The page's copy already promised "Nobody sees it until the picks lock" — now
true. ALIVE §6's named conflict ("pick one") is resolved by this brief.

## 2. Meeting point — never an assumption dressed as a decision

`gameplan.ts` `meetingPoint()` now returns `decided`:

| State                                                                   | Shows                               | Line                                                                        |
| ----------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------- |
| Host made it official                                                   | the spot                            | Made official by the host                                                   |
| Meet-up vote settled (closed, or everyone going voted)                  | the place                           | The group's vote                                                            |
| Meet-up vote open with a lead / a tie                                   | **Meeting point not decided.**      | Leading the vote: X — not final / Tied: X / Y — one more vote settles it    |
| Dinner **settled** (closed, or everyone going voted), not the concourse | the restaurant, as a **suggestion** | Suggested: it's where we eat. Not confirmed — the host can make it official |
| Anything else                                                           | **Meeting point not decided.**      | Vote, or the host makes it official                                         |

Before, one person's dinner vote became "Where we eat, then we walk over
together" — presented like a plan. Couch fans don't count toward "everyone
going".

## 3. Arena Mode stays focused

Unchanged default: at the arena a period is "phones away" (doctrine §6), with
the plan, Arena Mode's door and **one tap** to the chat. Added:

- **"← Phones away — back to the game"** after a peek (before, a peek left
  the full tab UI up for the rest of the period).
- **Subtle indicator:** the count of new messages from people (bot lines and
  joins excluded) on the chat button, and one quiet line — "Alex mentioned
  you" — only when somebody said your name (`domain/hockey/mention.ts`). No
  notification, no sound. This touches doctrine **§15.10 (how live mode
  should interrupt)** — named, not resolved: it never interrupts, it waits on
  the button.

## 4. Chirp Bot

### 4a. Why the model path had never produced a line — diagnosis

| Check              | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Configuration      | **The model is only ever asked inside a Chirp Room**, which exists only where `chirp-migration.sql` is applied; production's migration state cannot be read from here, and the ALIVE commits were never deployed. No lane ever had a key, so every earlier run was the library or a mock. If production lacks chirp-migration, "never generated" there means never invoked.                                                                                                          |
| Error handling     | **Every failure was invisible**: `askModel` ended in a bare `catch { return null }` — timeout, 401, 404 (wrong model), empty answer and a safety-filter rejection all looked the same: a library line. Nobody could have diagnosed it from logs. **Fixed**: one log line per cause per instance — `timeout`, `connection`, `http-<status>`, `empty`, `cut-off`, `rejected` — with the provider's message scrubbed of any key fragment (`sk-…`). Never the request or anyone's words. |
| Model access       | `max_tokens` is refused by OpenAI's reasoning models; **now `max_completion_tokens`** (accepted by every chat model). Optional `OPENAI_CHIRP_REASONING_EFFORT` (none/minimal/low/medium/high, validated) and `OPENAI_CHIRP_TIMEOUT_MS` (1–20 s, default 4 s).                                                                                                                                                                                                                        |
| Invocation         | Real local model (qwen3 8B) returned `""` every warm call: its 300-token budget went on hidden reasoning. With effort `none`, valid JSON in ~2 s. Same class of failure a reasoning model would hit in production.                                                                                                                                                                                                                                                                   |
| Persistence/render | Verified end to end with a real model (below): signed with HMAC, inserted under the member's own session (RLS + self-key check), verified on read, rendered.                                                                                                                                                                                                                                                                                                                         |

### 4b. A real AI-generated chirp, in a controlled environment

`verification/chirp-ai-live.spec.ts` (skipped unless `CHIRP_AI_LIVE=1`) runs
the **unchanged production path** — OpenAI SDK, persona, JSON mode,
`readLine`/`readChirps`, `acceptableChirp`, signature, insert, verified
render — against **Metatron's local Ollama** through `OPENAI_BASE_URL`. No
credentials, nothing leaves the machine. **Passed three times.** Verbatim
model output from the runs:

> Welcome to the dark side, Lorne. Now you're stuck rooting for a team that's
> never won a Stanley Cup and still manages to look fabulous in a jersey.

> Lorne, you're betting coffee on the Leafs missing the playoffs? Bold move.
> But let's not forget — the Canucks are playing tonight, not the Leafs.

> (Chirp Someone, `by: "model"`) Lorne, your Flames are still reeling from the
> Kadri exodus and still can't beat the Canucks—what's the deal with that?

Screen: `night/60-chirp-bot-model-line.jpg`.

**Quality warning — read before switching a model on.** The 8B local model
breaks the persona's fact rule: Calgary _won_ the Cup (1989); "out of the
playoffs since 2011", "$10.5M contract" are invented. The pipeline works; this
model's facts don't. `gpt-4o-mini` (the default) is untested with a real key.
Someone with the production key should read ten lines before the game
(owner step 6).

### 4c. New moments

| Moment                    | Key (unique per night)    | Rules                                                                                                                                                 |
| ------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secret mission pulled off | `mission:<user>:<prompt>` | Self-keyed (only their own "yes"); never says what the mission was; a moment — speaks even on **Quiet**                                               |
| Dare / side quest done    | `done:<user>:<prompt>`    | Self-keyed; a heckle — cooldown, daily cap, never twice in a row, silent on Quiet; a pass is never announced                                          |
| Sycle Cup lead change     | `lead:<game>:<user>:<n>`  | Outright leader with points, during the game; ≤ 4 a game, 10 min apart; shows only while true (`claimHolds`); the final verdict takes over at the end |

Library-only (`ms.`, `dn.`, `ld.` pools, workplace-safe). Preserved: Quiet /
Normal / Rowdy, host mute ("Kick Chirp Bot out"), the safety filter, rate
limits, duplicate prevention (unique key), the library fallback. The database
self-key rule is widened to `mission`/`done` by `night-migration.sql` part 2;
the page already refuses to show a forged one.

**Inherited limit, not new:** missions are viewer-dependent in the standings,
so a lead earned by a secret mission is seen by its target (and whoever's
standings count it) — e2e asserts it from Alex's view.

**AI failure never breaks the night:** `alive.spec` passes with the model
unreachable (`OPENAI_BASE_URL` → closed port; log: `fell back to the library:
connection`) and with no key.

## 5. The 25 screens — defects fixed (no redesign)

| Screen     | Defect                                                                         | Fix                                                        |
| ---------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| 41, 51     | Reveal tiles cut names to "Da…", "L…", "Al…" (team badge beside the name)      | Name on its own line, badge under it                       |
| 41         | After the game the reveal still said "Sealed until puck drop. Turn them over." | "Sealed until puck drop. Now they're not. Turn them over." |
| 43         | "slipped somebody **a a** secret mission" (labels carry their article)         | Article dropped                                            |
| 04         | Name chip unreadable on a light team wash (Leafs)                              | Chip background 35 % → 60 %, subtitle 80 % → 90 %          |
| 12         | Input placeholder truncated "Somewhere else? Type a n"                         | Placeholder "Somewhere else?"; accessible name unchanged   |
| 10, 12, 50 | Meeting point stated an assumption                                             | §2                                                         |
| 32         | No way back to "phones away" after a peek                                      | §3                                                         |

Looked at and left: full-page shots show the fixed tab bar mid-page (a
screenshot artefact); "PUCK DROP / IN" breaks on purpose; the 11:48 p.m.
times in 50/51 are the spec's moved clock. New screens: `night/` (same journey,
390 px).

## 6. Tests and gates

Local stack: real GoTrue sign-ups, PostgREST under production grants, embedded
Postgres; Atlas = 2026-10-23 production corpus (`atlas-seats-stub.mjs`),
acceptance on the synthetic stub; NHL stub.

| Run                                                                                                                                                           | Result                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Hockey suite: alive, arena-mode, chirp, finish, finish-play, mobile ×3, modules, multi-night, plan-and-results, polish, redesign, restaurant-photos ×2, seats | 16/16 (plan-and-results passed after its old sealed assertion was updated) |
| acceptance                                                                                                                                                    | 1/1                                                                        |
| chirp-ai-live (real model)                                                                                                                                    | 1/1, three runs                                                            |
| Migration-absent: **night-off** (new), alive-off, chirp-off, arena-off, finish-off                                                                            | 5/5                                                                        |
| rls-attack / seats-attack / arena-attack                                                                                                                      | all passed / 35/35 / 78/78                                                 |
| `night-*.sql` rehearsal: preflight → apply → apply again → preflight; rollback → preflight; re-apply                                                          | all as expected                                                            |

Spec changes: `plan-and-results` and `rls-attack` asserted the old leaky rule
(now assert sealed-until-lock, and that picks open at lock); two specs found
the input by its placeholder (now by label). email-confirmation was not re-run
(nothing in auth changed).

**Release gates on the merge `e39df87`:**

| Gate                     | Result                             |
| ------------------------ | ---------------------------------- |
| `npx tsc --noEmit`       | clean                              |
| `npx eslint .`           | 0 errors (40 warnings)             |
| `npx prettier --check .` | clean                              |
| `npx vitest run`         | 3,712 passed, 30 skipped           |
| `npm run build`          | ok (placeholder env and stack env) |
| `npx playwright test`    | 248 passed, 6 failed, 5 skipped    |

**The six Playwright failures — none blocks this release.** None touches a
Hockey file; the same count is the RC's recorded baseline.

| Test                  | Cause                                                                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| core-loop:26          | Environmental since 2026-10-11: needs a real Supabase/Atlas                                                                                         |
| october:554, :570     | Environmental since 2026-10-11: the critic Atlas fixture lacks those rows                                                                           |
| discovery-natural:102 | Depends on the day: "this weekend" read on a Friday evening says "tomorrow", the test expects "Saturday"                                            |
| october-door:243      | Depends on the clock: the Witching Hour copy is the night variant after dark (the RC saw :260 the same way)                                         |
| conference-mobile:23  | **Stale test**: Labs shows Conference as a non-link card (deliberate, dashed, status badge); the test still clicks a link. Conference lane's to fix |

## 7. Production — not deployed from here, and why

- **Deploying, pushing and migrating are outside this lane's permissions**
  (CLAUDE.local.md: never deploy, push disabled, no production credentials,
  no Supabase migrations against a real project; every earlier attempt from
  Metatron was refused). The brief says "only through the authorized release
  process" and "do not bypass deployment controls", so none was attempted.
- **Public, credential-free, 2026-10-23:** `gohaveaday.com/hockey`,
  `www.iamoctober.com/hockey`, `elk-passport.vercel.app/hockey` → 307 to
  sign-in; `/hockey/join/<bad>` → 200. A Hockey build is live; **which commit
  and which migrations cannot be read from here.** GitHub `main` is
  `a1ad8b5` (contains Hockey up to `ee30857`, not ALIVE or this work).
- **Production was not verified with real accounts.** It is **not LIVE**
  until a person does §8 step 7.

## 8. Owner steps (Lorne, on the Mac)

```bash
git fetch metatron:passport/main feature/hockey
git log -1 FETCH_HEAD                 # e39df87… (or the doc commit after it)
git merge-base --is-ancestor origin/main FETCH_HEAD && echo fast-forward
npm install --no-audit --no-fund && git checkout -- package-lock.json
npx tsc --noEmit && npx eslint . && npx prettier --check . && npx vitest run && npm run build
```

1. **Supabase SQL editor** (project `frllwwxesxbmmaadzfaf`), runbook §3 order,
   then the Hockey tail — each preflight first, STOP on any STOP row:
   `preflight/migration/verify` → `seats` → `arena` → `memories` → `chirp` →
   **`alive-preflight` → `alive-migration`** → **`night-preflight` →
   `night-migration`** → `night-preflight` again (last two rows `APPLIED`).
2. Vercel env: `OPENAI_API_KEY` present (runbook says it is). Leave
   `OPENAI_CHIRP_MODEL` unset (gpt-4o-mini). No new required variable.
3. `git push origin <commit>:main` (Vercel builds production from `main`) —
   or the runbook's `vercel deploy --prod`.
4. Note the deployment id and commit (`vercel ls`, `vercel inspect`).
5. `vercel logs <deployment> | grep "chirp bot model"` — a line there names
   the cause if the model path fails (`http-401`, `http-404`, `timeout`…).
6. **Read ten Chirp Bot lines** with the real key before Sunday (welcome
   after declaring a team; a bet in the chat; "Chirp Someone"). If they
   invent facts, set the host level to Quiet or kick Chirp Bot out — the
   library carries the night.
7. **Production check, two real accounts on a phone:** invite link → join;
   pick a team (the moment); arena / couch; vote in Pregame and in Explore;
   meeting point says "not decided" until the host sets it; seal a pick on
   each account and confirm the other's stays hidden until puck drop
   (move the start time as host); chat; a Chirp Bot line; Sycle Cup after
   the host's calls; no sideways scroll at 390 px.

## 9. Remaining blockers

1. **Production access** — push, migrations and deploy are the owner's (§8).
2. **Chirp Bot with the production key** has never run; the path is verified
   with a real model, the line quality with `gpt-4o-mini` is not.
3. **Small models invent facts** despite the persona (§4b).
4. Missions stay viewer-dependent in the standings (inherited).
5. `conference-mobile:23`, `discovery-natural:102`, `october-door:243` are
   test bugs outside Hockey (§6).
