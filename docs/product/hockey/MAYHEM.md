# Hockey Night — Operation Mayhem: make PLAY ridiculously fun (2026-10-23)

**Asked (P0, Meta Hockey):** PLAY was "eight yellow locks, a white spreadsheet
of predictions, and almost nothing involving the other participants". Make it
the most entertaining part of Hockey Night: real multiplayer (challenge,
accept, decline, react, missions, legitimate points), team allegiance that
matters, reinvented predictions, a Sycle Cup that feels real and is the same
for everybody, funny verifiable secret missions, PLAY ↔ Chirp Bot, a pregame
loop two days out, a real visual standard. Keep predictions, sealing,
scoring, venue voting, Arena, chat history and Cup records. Prove it with
three authenticated people.

**Where:** `feature/hockey` on Metatron, on `79a4891`. **Not pushed, not
migrated, not deployed** (§10).

---

## 1. Before and after

| Before (79a4891, same three people, picks sealed)                                                                  | After                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`before/before-04-all-sealed-full.jpg`](mayhem/before/before-04-all-sealed-full.jpg)                              | [`02-lorne-play-full.jpg`](mayhem/02-lorne-play-full.jpg)                                                                                                                        |
| Seven yellow padlocks; a white list of your own answers; nothing about anyone else; Lorne's Flames appear nowhere. | Opens on **Enemy Territory** in Flames colours; three challenges aimed at real people; picks as game cards; the Sycle Cup with every competitor's team; what everybody else did. |

Every after-screen (390 px unless named) is in [`mayhem/`](mayhem/):

| #     | Screen                                                                      |
| ----- | --------------------------------------------------------------------------- |
| 00    | PLAY before anybody declares a team ("Who do you bleed for?")               |
| 01–03 | Enemy Territory — Lorne's own view, and the same rivalry from Alex's side   |
| 04    | Throwing a bet: who, which question, which side in team colours, trash talk |
| 05    | Alex's phone: **⚔️ Your move** — the challenge first thing on the page      |
| 06    | Lorne's phone: "Alex accepted your challenge. It's on."                     |
| 07    | The chat: Chirp Bot escalates the accepted bet                              |
| 10    | Two days out, all three people (`-lorne`, `-alex`, `-sam`)                  |
| 11–13 | A bold-call game card; the picks **in the vault**; peeking at your own      |
| 14    | Sam's secret mission, claimed, waiting on its mastermind                    |
| 20    | First intermission                                                          |
| 30–32 | The verified champion reveal; full PLAY after; Sam's view                   |
| 33    | The chat after the game: verdicts, the spectacularly wrong pick, the Cup    |
| 40    | After, at 375 and 320 px                                                    |
| 50    | Without `mayhem-migration.sql` (still works, no challenges offered)         |

## 2. What PLAY is now

**Before the game (the two-day loop).**

1. **⚔️ Your move** — only when something waits on you: a challenge to
   accept or pass, a performance to deliver, a jury to sit on. Always first.
   The PLAY tab's badge counts open challenges aimed at you, so a challenge
   is a reason to open the app.
2. **The rivalry banner**, built from what people actually declared
   (`rivalryFor`, no joke is about a name):
   - a fan of a team that isn't playing → **🔥 Enemy territory**, in their
     team's colours, with the real feud from `fans.ts` ("1989 and 2004: two
     Game 7s in overtime, both won by Calgary"). Others read "A Flames fan has
     entered Rogers Arena. Lorne has willingly agreed to attend a Canucks game.
     The group has 2 days to make them question that decision." — and
     **Challenge Lorne**. Lorne reads "You're a Flames fan at a Canucks game.
     2 people have 2 days to make you regret it." — and **Defend yourself** /
     **Go on the attack**. Any outsider gets it (a Leafs fan, in tests);
   - a split room → **⚔️ House divided** ("2 Canucks fans. 1 Wild fan.");
   - everyone agrees → **🤝 United front** ("Chirp Bot finds this deeply
     boring. Pick a fight anyway.");
   - nobody declared → **Who do you bleed for?** with Pick your team.
3. **Tonight's chaos** — three challenges chosen for you (`chaosFor`): make
   the outsider defend their team; bet the fan on the other side (your
   natural side of tonight comes from your team — a Flames fan roots against
   Vancouver); hand somebody the commentator's mic or dare a hot take; make a
   prophecy. Never one you've already sent; rotated by day. Then what's in
   play and what's settled.
4. **Bold predictions** — §4.
5. **The Sycle Cup** — §5.
6. **Secret missions** — §6.
7. **The latest drama** — every challenge thrown and taken, verdicts,
   prophecies, team reactions, missions pulled off, and Chirp Bot's PLAY
   lines, newest first, with "N new since you looked". Declines never appear.

**During the game.** Periods stay "phones away" (unchanged). In an
intermission PLAY is short: your move, the host's calls, the Cup live
(clearly **provisional**), the picks turned over, intermission games, six
drama items.

**After.** The Cup first: the **champion reveal only once verified** (§5),
then **🤡 Spectacularly wrong** ("Alex called it 4–1. It finished 2–4. Frame
it."), the forfeits owed, the receipts, the recap, Run It Back.

## 3. Challenges — real multiplayer

`src/domain/hockey/challenges.ts`, `mayhem-migration.sql`.

| Kind                   | How it works                                                                                                                                           | Who decides                                                        | Points             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------ |
| 🤝 **The Bet**         | Pick a side of one of tonight's questions (who wins, first goal, overtime, over/under 5.5 goals); accepting takes the other side. Closes at puck drop. | The host's call of that question — the same call the picks wait on | Winner +3          |
| 🛡️ **Enemy Territory** | Defend your team's honour, 280 characters.                                                                                                             | The jury                                                           | +3 if upheld       |
| 🎙️ **The Commentator** | Call a goal like a broadcaster who has lost all perspective.                                                                                           | The jury                                                           | +3                 |
| 🌶️ **The Hot Take**    | One take so outrageous the jury has to rule on it.                                                                                                     | The jury                                                           | +3                 |
| 🔮 **The Prophecy**    | Your own ridiculous, measurable prediction, on the record before puck drop.                                                                            | The jury, from puck drop                                           | +5 if it came true |

- **The jury** is everybody but the person being judged. It closes when
  every juror has ruled, or at the final horn (the morning after for a
  prophecy). Majority wins; a tie or no votes is "not convinced" and scores
  nothing. Votes are public.
- **Volunteering**: a performance can be thrown at yourself (that's
  "Defend yourself") — you write it first, the jury rules.
- **Declining**: "Pass quietly — passing costs nothing, and nobody but Lorne
  is told." A declined or withdrawn challenge is readable by its two people
  only, in the database.
- **Limits** (deterministic): one per pair per kind (and per market); a
  declined one can't be re-thrown; 8 issued per person per night; challenges
  count up to **12 points** per person per night, in the order they were
  made.

## 4. Predictions, reinvented

Same seven questions, same scoring, same sealing (`sealed.ts` + the
database's onLock rule, untouched). New: `play/BoldCalls.tsx`.

- **Before picks:** each card has a personality (`personaOf`) — **The Big
  One** (final score), **First Blood**, **Sudden Death**, **Goal Fest**,
  **The $19 Beer** ("Lorne's most expensive decision of the night"), **Ref
  Rage**, **Pick a Side** — dark game cards lit in their own colour,
  played by thumb. The progress row names the cards instead of numbering
  locks.
- **After picks:** **In the vault.** — face-down cards with a seal, "6 picks
  sealed. They open at puck drop, 7:00 p.m. — in 2 days", **your big call**
  (VAN 2–4 MIN) and the pick worth the most, then what to do next: **Bet
  somebody on it** (opens a bet from your own pick's side), **Peek at mine**,
  **Change a pick**. An opt-in forfeit you skipped doesn't hold the rest out
  of the vault (a bug found here).
- **At puck drop / after results:** unchanged lock and reveal rules; the
  existing reveal turns the picks over; points as before; plus
  **Spectacularly wrong** and Chirp Bot's line about it.
- With the host's picks switched off, the block is "Ask the group" and
  promises no sealing (as before).

## 5. The Sycle Cup

`play/CupBoard.tsx`, `domain/hockey/cup.ts`.

- A drawn trophy (`play/Trophy.tsx`) — the bowl-on-tiers shape, engraved
  SYCLE CUP, a slow shine, a glow once it's won.
- **Real competitors**: every member, avatar in their team's colours, their
  team, rank, points, and **where every point came from** ("+3 Won a bet vs
  Alex", "+3 Enemy Territory: the jury agreed", "+8 Secret mission").
  "⚔️ 2 with you" shows your open rivalries with each person. **React to
  their team** — 🫡 Respect · 🤡 Clown · 🧂 Salty · 🔥 Bold · 🪦 RIP — one
  each, changeable, persisted, shown to everyone and in the drama.
- **Before any points**: "No points on the board yet, and none invented.
  They arrive when bets settle, juries rule and the host calls the game."
- **Verified champion only**: `cupStatus` names a champion only when the game
  is over and nothing that could still move points is open — every answered
  pick called, every member question called by its asker, every bet's
  question called, every jury closed. Until then: "Provisional — still
  waiting on the host to call “Total goals, both teams” and the jury on
  Sam's hot take." Chirp Bot's final verdict now waits for the same
  (`nightFacts.called` = verified). Ties are shared, not broken.
- **The bug where mission totals differed between viewers — fixed.** A
  secret mission's points came from the mission row, which RLS shows only to
  its target and mastermind, so each viewer summed a different Cup. Now a
  `SECURITY DEFINER` ledger (`passport_occasion_mission_ledger`) tells every
  member _that_ a mission was completed and confirmed — never what it was —
  and the Cup counts it from there for everybody. Challenge points come from
  challenge rows every member reads. **Proven:** three phones, identical
  tables (§8, and a unit test composing the night as each of three viewers).
- **How points are added up**: settled challenges and confirmed missions
  become resolved score lines inside the existing engine (`cupLines`), so
  the leaderboard, awards, recap and the multi-night Cup count them with no
  change to the engine. Nothing is stored as a score.

## 6. Secret missions

`play/Missions.tsx`. Missions are still the lab's (one person sees it, opt in
or pass, passing is never announced), now a visible section:

- **The target**: "🕵️ TOP SECRET · from Alex" → **Show me** / **Not for
  me** → the brief → **I pulled it off** → "Claimed. Waiting on Alex to
  confirm."
- **The mastermind**: "Your mission for Sam" → **Yes, they did it**.
- **It counts only when both have said so**, the target had opted in, and
  they're two different people (the ledger's rule). Nobody verifies their
  own; a mission you aim at yourself never counts; points come from Passport's
  rule (≤ 8), not what the sender typed (the spec sends 20; it scores 8); at
  most 2 count per person per night.
- Everybody else: "🕵️ Missions pulled off tonight: Sam. What they were stays
  secret." **Slip somebody a secret mission** opens the toy box.

The brief's examples map as: **The Hot Take**, **Enemy Territory**, **The
Commentator** and **The Prophecy** are challenges (§3). **The Nickname
Committee** was not built (§11).

## 7. Chirp Bot ↔ PLAY

New moments (`domain/hockey/chirp.ts`, library in `chirp-library.ts`):

| Event                                          | Key                          | Class                                                               | Voice                                |
| ---------------------------------------------- | ---------------------------- | ------------------------------------------------------------------- | ------------------------------------ |
| A challenge thrown / volunteered               | `chal:<user>:<challenge>`    | heckle (cooldown, daily cap, silent on Quiet, never twice in a row) | model, library fallback              |
| A prophecy made                                | `oracle:<user>:<challenge>`  | heckle                                                              | model / library                      |
| A challenge accepted — "the rivalry escalates" | `took:<user>:<challenge>`    | moment (speaks on every level)                                      | model / library                      |
| A challenge decided                            | `ruled:<challenge>:<winner>` | moment; fresh decisions only (6 h)                                  | **library only** (it states who won) |
| The spectacularly wrong score pick             | `worst:<stamp>:<user>:<a-b>` | moment, once per game                                               | library only                         |

Existing moments still fire: a team declared (Calgary gets Calgary jokes), a
mission pulled off, a Cup lead change, the final verdict (now waits for
verified). **A decline is never announced** — there is no plan for it.

Every line is checked on read against the rows: the key's person must have
caused it (and the database's self-key rule now covers `chal`/`took`/`oracle`),
the line must come from that kind's own pool, and a verdict shows only while
the rows still say so (the host corrects a call → the old verdict
disappears). Quiet / Normal / Rowdy, host mute ("kick Chirp Bot out"),
rate limits, the safety filter, workplace-safe lines: all preserved and
tested (§8).

### Real model results (Metatron's local Ollama, qwen3:14b, no credentials)

`verification/mayhem-ai.spec.ts` (skipped unless `MAYHEM_AI=1`), the
unchanged production path. Verbatim, after the fixes below:

> Lorne, you're betting against the team that just traded Quinn Hughes? Real
> confidence there.

> Lorne, you're betting on the Wild? Cute. Alex, are you _that_ desperate to
> prove Hughes was a better trade than Rossi?

> Lorne, you're betting against the team that just traded Quinn Hughes? Bold
> move. Alex, are you really going to let a Flames fan take that bet?

(The Hughes/Rossi details are the verified storyline handed to the model.)

**What the first runs got wrong, and what changed:**

1. The model reversed who held which side ("Alex, Lorne says you're betting
   the Wild win"). My prompt said "a bet that the Wild win" without saying
   whose side was whose. **Fixed:** the prompt names both sides and both
   people.
2. It invented facts and quotes ("they barely beat the Jets last week",
   "Lorne: 'You think…'"). **Fixed for challenge lines:** a model line with a
   number or quoted speech is rejected and the true library line is posted
   (`inventsFacts`, logged as `rejected`). In the three final runs the
   "accepted" line fell back to the library every time.

**Not fixed, inherited:** welcome lines from small models still invent
records ("haven't beaten the Flames since 2011"). The previous report's
warning stands: somebody should read ten lines from the production model
(`gpt-4o-mini`, never run here) before Sunday, or set Chirp Bot to Quiet.

## 8. Tests and security

Local stack: real GoTrue sign-ups, PostgREST under production grants,
embedded Postgres, the 2026-10-23 Atlas corpus, NHL stub.

**The acceptance test — `verification/mayhem.spec.ts`, three real accounts
(Lorne/Flames host, Alex/Canucks, Sam/Wild), passes:**

- **A — the Flames fan.** Lorne opens PLAY: the personal Enemy Territory
  banner (asserted under 30 s) and Chirp Bot's Flames welcome. Lorne throws a
  bet through the UI → Alex's phone shows it under **Your move** (and on the
  tab badge) → Alex taps **Bring it on** → Lorne's phone shows "It's on" and
  "Alex accepted your challenge." Cross-account both ways.
- **B — the competition.** All three seal picks; Alex challenges Lorne to
  defend the Flames (Lorne writes it in PLAY; Sam and Alex uphold it); Sam
  volunteers a hot take (upheld), makes a prophecy (hung jury, 1–1, 0
  points), dares Alex, who passes privately; Alex sends Sam a mission worth
  "20", Sam claims it, Alex confirms it. The host calls the game. **All three
  phones show exactly `Lorne 34 · Sam 20 · Alex 13`**, worked out by hand in
  the spec, and the verified champion. Cheating attempts in the same run:
  - a 999-point question written straight into the database, answered by
    its own asker (directly) and called by them → **worth 5, and nothing to
    its asker**;
  - inserting a challenge row by hand → refused;
  - declining a bet aimed at somebody else → 403;
  - forging a vote in somebody else's name → refused;
  - judging your own performance → refused;
  - confirming your own mission → 403;
  - bets after puck drop → refused;
  - reading a sealed pick from PostgREST → `[]`.
- **C — the bot.** Accepted bet → a contextual "took" line naming both
  people, visible in the chat. Host sets **Quiet**: a new challenge is not
  heckled, but accepting it still speaks, and with a different line (not
  repetitive). Host **kicks Chirp Bot out**: no lines at all. After the game:
  the bet's verdict and the spectacularly wrong line, once each.
- **D — two days out.** Each of the three has Tonight's chaos with things to
  start or answer, the predictions and the Cup; no padlock row.
- **E — mobile.** Every major state at 390 px; no sideways scroll; no tap
  target under 32 px in PLAY or the sheet; the after state at 375 and 320.

| Run                                                                                                                                                                   | Result                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **`mayhem-attack.mjs`** (new, straight at PostgREST/RPC with real JWTs)                                                                                               | **71/71**                                                  |
| Hockey suite: mayhem, alive, arena-mode, chirp, finish, finish-play, mobile ×3, modules, multi-night, plan-and-results, polish, redesign, restaurant-photos ×2, seats | 16/18 in the full run; both failures pass on rerun (below) |
| acceptance                                                                                                                                                            | 1/1                                                        |
| rls-attack / seats-attack / arena-attack                                                                                                                              | all passed / 35/35 / 78/78                                 |
| Migration-absent: **mayhem-off** (new), night-off, alive-off, chirp-off, arena-off, finish-off                                                                        | 6/6                                                        |
| mayhem-ai (real model)                                                                                                                                                | 1/1, three runs                                            |
| `mayhem-*.sql` rehearsal: preflight → apply → apply again (no change) → preflight `APPLIED`                                                                           | as expected                                                |

The two full-run failures:

- **`plan-and-results`**: its test picked "the last section containing 'the
  Sycle Cup'", and the new drama feed can quote a Chirp Bot line with those
  words. The selector now targets the Cup's named region; 3/3 since.
- **`mobile` at 390 px**: the audit once caught the Memories component's
  hidden 1×1 "Choose a photo" file input. That's timing-dependent and in a
  component this mission did not touch. It passes on rerun. Reported, not
  patched.

Spec changes for the new PLAY: the "Your picks" region is now "Bold
predictions" (5 specs); `finish-play` expects 9 sealed picks (the mission
moved out of the deck) and opens the mission from its own card.

`mayhem-attack.mjs` covers:

- issuing: as the caller only, not to non-members, no self-bets, real sides
  only, only questions the night has, no duplicates, 8 a night;
- answering: only the target, only once; only the challenger withdraws;
  declines are invisible to third members and can't be re-thrown;
- performing: only the target, after accepting, once;
- the jury: no self-judging, no votes on bets, no hand-written votes, closed
  once all have ruled, prophecies not judged before the game;
- deadlines: puck drop and the final horn;
- team reactions: own name only, not to yourself, not to non-members, the
  five emoji only, nobody deletes another's;
- the mission ledger: needs claim + mastermind + opt-in, never self-set,
  never says what the mission was, identical for every member, empty for a
  non-member;
- Chirp Bot keys: no `chal`/`took`/`oracle` line about somebody else;
- the host's games module switched off: no challenges.

**Release gates on this branch:**

| Gate                     | Result                                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`       | clean                                                                                                 |
| `npx eslint .`           | 0 errors, 40 warnings (the baseline's 40; this mission adds none)                                     |
| `npx prettier --check .` | clean                                                                                                 |
| `npx vitest run`         | 3,746 passed, 30 skipped (new: `challenges.test.ts` 25, `chirp-challenges.test.ts` 8, `inventsFacts`) |
| `npm run build`          | ok (stack env and placeholder env)                                                                    |
| `npx playwright test`    | 249 passed, 5 failed (all on the baseline list), 5 skipped                                            |

**`npx playwright test` (whole repo, placeholder env + critic Atlas mock): 249 passed, 5 failed, 5 skipped.**
All five are on the recorded baseline list and none touches Hockey:
core-loop:26 and october:554/570 (environmental since 2026-10-11),
discovery-natural:102 (Friday-evening date reading), conference-mobile:23
(stale Labs test, Conference lane's). The previous RC recorded 248/6/5;
october-door:243 (time of day) passed this time.

## 9. Migration

**`mayhem-migration.sql`** (+ `mayhem-preflight.sql`, `mayhem-rollback.sql`).
Applies **after `night-migration.sql`**. Adds three tables, five functions
and one widened constraint. It changes no existing row, policy or function:

- `passport_occasion_challenges`, `passport_occasion_challenge_votes` —
  `SELECT` only for `authenticated`. Every write goes through `SECURITY
DEFINER` functions (`passport_issue_challenge`, `_answer_`, `_perform_`,
  `_vote_`, plus `passport_challenge_closed`) that take the caller from
  `auth.uid()`;
- `passport_occasion_team_reactions` — RLS, own rows only;
- `passport_occasion_mission_ledger(occasion)` — the shared mission count;
- `passport_occasion_moments_bot_self_check` widened to
  `chal`/`took`/`oracle` (only if it is still night-migration's).

All grants are explicit (production has no default grants). It is
idempotent. The rollback drops only what it added; challenges go with it,
and the Cup simply stops counting them, because points were never stored.

**Without it** (app deployed first, or the SQL never run): the night loads
exactly as before plus the redesign — no challenges are offered, the rivalry
banner still reads teams (chirp-migration), and the old mission scoring stays
in place. Proven by `mayhem-off.spec.ts`.

## 10. Owner release steps (Lorne, on the Mac)

```bash
git fetch metatron:passport/main feature/hockey
git log --oneline -3 FETCH_HEAD          # the RC commit (below) on top of 79a4891
npm install --no-audit --no-fund && git checkout -- package-lock.json
npx tsc --noEmit && npx eslint . && npx prettier --check . && npx vitest run && npm run build
```

1. **Supabase SQL editor** (project `frllwwxesxbmmaadzfaf`), in order, each
   preflight first, STOP on any STOP row: everything in
   `FINISH-THE-NIGHT.md` §8 step 1 (through `night-migration`), then
   **`mayhem-preflight.sql` → `mayhem-migration.sql` → `mayhem-preflight.sql`**
   (the last five rows read `APPLIED`).
2. No new environment variable.
3. Push / deploy through the runbook (`git push origin <commit>:main`).
4. `vercel logs <deployment> | grep "chirp bot model"`. `rejected` lines are
   the new invention filter working, not a failure.
5. **Read ten Chirp Bot lines from the production model** before Sunday:
   throw a bet, accept it, declare a team. If they invent facts, set Quiet,
   or kick Chirp Bot out; the library carries the night.
6. **Three-phone production check** (the spec's journey, by hand): one
   person declares a team that isn't playing → Enemy Territory on everyone's
   PLAY; bet across two accounts, accept, see it back; pass on one (the
   third phone must not see it); a jury on a defence; a mission claimed and
   confirmed; all three Cups identical; no sideways scroll at 390 px.

## 11. Doctrine, decisions, and what I did not do

**Named conflicts (doctrine is product authority):**

- **§14 lists "elaborate social games" as not now.** This brief explicitly
  asks for them in Hockey Night, as did ARENA-MODE, CHIRP-ROOM and ALIVE.
  It's still one private night, built on doctrine §6 ("bets, challenges,
  predictions, friendly competition"). Recorded as a conflict, not resolved:
  the doctrine was not edited (it's outside this lane). If this stays,
  §14's wording should say so.
- **§15.12 (how group experiences work)** is informed by this mission, not
  answered: a jury of the others, public challenges, private declines.

**Product decisions taken here that the owner should confirm:**

1. **Side quests no longer score.** "I did it", with nobody to check, was a
   self-verification exploit. They still exist, for the story and Chirp Bot.
2. **Member questions:**
   - each is worth Passport's fixed amount, not what was typed (prediction
     or sealed ≤ 5, photo/vault ≤ 5, group quest ≤ 6);
   - each person's first three scored questions count;
   - **whoever asked one can't score on it**, because they call it.
3. **Secret mission points**: ≤ 8 (dare ≤ 5), 2 a night, confirmed by the
   mastermind. A past night's mission recorded above 8 now counts as 8 (this
   is the only change to existing Cup records).
4. Challenge values (bet +3, jury +3, prophecy +5) and the 12-point
   challenge cap are my calls, made so picks still matter most (28 points
   available).
5. **The host is still the referee** of tonight's results, as before. If
   the host calls a result wrongly, that changes bets too. The NHL record
   can be used to check them ("Use the NHL's numbers").

**Not built:** **The Nickname Committee** (a vote on a player's nickname —
no clear way to settle it that isn't another jury). Live NHL scoring beyond
the existing NHL board was not added; no new data source is claimed.

**Outside my lane:** none of the shared contracts were touched. The
migration is proposed here (`docs/product/hockey/`), not in
`supabase/migrations/`. Every file changed is under `src/app/hockey/`,
`src/components/hockey/`, `src/domain/hockey/` or `docs/product/hockey/`.
The untracked `night-*.png` files at the repo root are not new: they're
`mobile.spec`'s screenshots from an earlier run with `SHOTS` unset (it
writes to `.`). I left them in place.

## 12. Does it meet the bar?

Honestly, from the screens rather than the tests:

- **Yes:**
  - opening PLAY as the Flames fan _is_ funny, and it's about them;
  - a challenge is the first thing the challenged person sees;
  - the bet sheet is fast and looks like hockey;
  - the vault replaced the padlocks;
  - the Cup has a trophy, real people, and receipts for every point;
  - the chat after the game reads like the night's story.
- **Not yet:**
  - the before-game page is long (`02-lorne-play-full.jpg` scrolls a lot);
  - the jury flow is still a form at heart — a text box, then two buttons;
  - Chirp Bot's model voice is only as good as the model behind it;
  - nobody has played it with real friends — that is the real test.
