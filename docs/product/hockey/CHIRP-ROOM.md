# Hockey Night — Declare your team + the Chirp Room (2026-10-23)

**Status:** code on `feature/hockey`, unpushed, **not deployed**. It needs
**`chirp-migration.sql`** in the production Supabase project before any of
it shows. Without the migration the night works exactly as before (proven by
`verification/chirp-off.spec.ts`).

**The brief:** make Hockey Night more fun before puck drop with two connected
features. People declare their NHL team. **Chirp Bot**, a sarcastic hockey
commentator, works the existing chat. No redesign, no second chat system.

---

## 1. What a person sees

- **WHO DO YOU BLEED FOR?** Anyone on the night without a team is asked.
  That covers new arrivals and everybody who joined before this existed. It
  never blocks the night. In Chat the ask is a card at the top. On Plan, Play
  and Group it is a slim bar pinned above the tab bar, so nothing on the page
  moves (dinner still leads Plan; `release2.spec` holds that line). _Pick_
  opens all 32 teams in their own colours, with a search box. _Not now_ (✕)
  hides it on this device for this night. You can pick or change at any time
  from Group. The sheet says plainly that this is **your team, not tonight's
  game**.
- **Your team beside your name** wherever names matter: chat author lines,
  the Group roster, the face and back of a flipped pick in the reveal, and
  your own profile (_You bleed for Calgary Flames 🔥 · Change team_). It is a
  scoreboard chip: two colours, the code and an emoji. No logos, for the same
  licensing reason the matchup has none (`teams.ts`).
- **Chirp Bot in the chat.** Its lines sit in the same conversation. They are
  styled so they can't be mistaken for a person: a striped mic avatar, a
  dashed yellow bubble, a **BOT** tag on the name, and a label saying what
  kind of line it is (**Satire** or **Hot take · opinion**). When a question
  rests on something recent, the **fact** appears under it, separate from the
  joke, with its source and the date it was checked. People react to bot
  lines the same way they react to each other's.
- **🔥 Chirp Someone.** Pick a person and Chirp Bot writes three chirps about
  _their team_. Tap one and it lands in **your own message box**, where you
  can edit it. Nothing is sent until you press Send. _Three more_ asks again.
- **The host can kick Chirp Bot out** (and let it back in) from the bottom of
  the chat. While it is out, its lines and Chirp Someone are hidden, people's
  own messages stay, and everybody's team is kept.

## 2. When Chirp Bot speaks

Chirp Bot only speaks after **a person does something**. It never speaks
because of another bot line, so it cannot talk to itself.

| Trigger                                                     | Line                            | Limit                                                                                                     |
| ----------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Someone declares a team                                     | team-specific welcome           | once per person per team; at most 3 team lines per person per night                                       |
| Someone changes team                                        | a "bandwagon" heckle            | same                                                                                                      |
| Someone joins with no team (their team follows them if set) | "who do you bleed for?"         | once per person                                                                                           |
| A bet or challenge in the chat                              | "holding the receipts"          | **organic**: 10 min quiet after any heckle, 8 a day, never right after another bot line                   |
| Fans of real rivals going at it (CGY↔VAN, TOR↔MTL …)        | stirs it up, naming the rivalry | organic; once per pair per day                                                                            |
| A bold call ("5-1", "sweep", "guarantee")                   | "Chirp Bot will remember this"  | organic                                                                                                   |
| Someone opens the chat before the game                      | a controversy question          | one per 6-hour slot over the last 72 h; needs ≥2 people; needs a person to have spoken since the last one |
| Someone opens the chat in the last 90 min (picks on)        | last call for picks             | once per game time                                                                                        |

Every line carries a `bot_key`, and the database keeps it unique per night.
If two phones trigger the same line in the same second, one line is posted.
All of these limits are read from the database, so they hold across server
instances.

**Sealed picks are never heckled.** A bold call is only noticed when somebody
says it in the chat. Commenting on a sealed pick would reveal it.

## 3. Facts, opinions and satire

- **Recent facts** live only in `STORYLINES`
  (`src/domain/hockey/chirp-library.ts`). Each one has a source URL, the day
  it was checked (2026-10-23) and an `until` date, after which it is never
  used again. The current list: the Quinn Hughes trade to Minnesota
  (12 Dec 2025), the Canucks finishing 32nd in 2025–26, Calgary's deadline
  sell-off and Huberdeau's contract, Buffalo ending its 14-year drought,
  Carolina's 2026 Cup, and Marner leading the 2026 playoffs with Vegas.
  Library lines that say "last season" or "defending champions" are tied to
  a storyline and retire with it (`LINE_STORYLINE`).
- **History** (Cup years, Finals, famous series) is long-settled record. I
  checked each line against what I could verify. Lines that assumed tonight's
  opponent were rewritten.
- **Questions are opinion questions.** Nobody is right. They come only from
  the library, never from a model, so a question can never rest on an
  invented "fact".
- The model is handed only the storylines relevant to the people in the chat.
  It is told it may state nothing else as fact.

## 4. How it is built: one chat, one identity, one authorization model

| Need                     | Reused                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Messages                 | `passport_occasion_moments` (the chat's table). Bot lines are a new **kind**, `chirp`.                                                            |
| Persistence / "realtime" | the existing 5-second visible-tab polling (`useSharedNight`)                                                                                      |
| Permissions              | the existing member-only RLS. Every write runs as the person whose action caused it, never with the service role                                  |
| Identity                 | the membership row. Allegiance is `passport_occasion_members.nhl_team`                                                                            |
| Actions                  | the one door, `POST …/actions` (`setTeam`, `chirpLook`, `setChirp`), plus `POST …/chirps`, which writes nothing                                   |
| AI                       | the existing provider and pattern (`lib/ai/ask/model.ts`): OpenAI `gpt-4o-mini`, server-only key, 4 s timeout, no retries, any failure falls back |

**One allegiance per person.** `setTeam` writes the person's team to every
night they are in (the self-update policy allows only their own rows). A new
night, started or joined, copies it from any existing one. In practice that
makes it per person, without a new table or new read rules: only people who
share a night with you can see your team.

**Why a bot line is provably Chirp Bot's.** The database can't tell this
server apart from a member holding their own session. So a row only counts
as Chirp Bot's if the server can show it wrote it:

- A **library line** is stored as its id, not its text, and is rendered again
  on every read. A forged row can only say something already in the library,
  of the right kind for its key, about the person who wrote it.
- A **model's line** carries an HMAC. The key is `CHIRP_BOT_SECRET`, falling
  back to `OPENAI_API_KEY`, so no new configuration is needed. The server
  checks the HMAC on read. Anything that fails is **not shown at all**: not
  as Chirp Bot, and not as the member who wrote it.
- A line about a person (`team:<id>:…`, `arrive:<id>`) must be written by
  that person's own session. This is enforced by a database check. The
  end-to-end run caught the reason it is needed: without the check, a member
  could write a key about somebody else first and so block that person's real
  welcome.

**Cost.** The model is only called for Chirp Someone and for welcome or
heckle lines. Those are already capped by the posting limits above. On top
of that, an in-memory limiter allows 6 requests per person per 10 minutes and
200 per server instance per hour. Calls use `max_tokens` 300. Over a limit,
or on any failure, the curated library answers instantly.

**Safety net.** The persona prompt forbids roasting anything except teams.
Model output is then checked by `acceptableChirp`: one line, 8–240
characters, no links, no words about bodies, identity, family, health or
self-harm, no slurs. A line that fails is dropped and replaced from the
library, never edited. Every library line passes the same check in a test.
This is a coarse net, not moderation (see §8).

## 5. Data: `chirp-migration.sql` (proposal for `supabase/migrations/`)

- `passport_occasion_members.nhl_team text`, checked against the 32 codes,
  plus `GRANT UPDATE (nhl_team)`.
- `passport_occasion_moments`: kind `chirp`, plus `bot_key`, `bot_line`,
  `bot_sig`. Ordinary messages must leave all three empty. A unique
  `(occasion_id, bot_key)` index. A self-key check (added `NOT VALID`; a first
  apply has no rows to spare).
- `passport_occasion_moments_say` is recreated with `'chirp'` added. The rule
  is otherwise the same: a member, as themselves, in their own night.
- No new table and no new function. The host can still delete any line,
  including Chirp Bot's.

On the local stack: applied twice with no change, rolled back
(`chirp-rollback.sql`), the preflight came back all OK, then re-applied.
`chirp-preflight.sql` reports `REVIEW` if the migration is already applied.

## 6. Verification

| What                                                                                                                                                                                                                                                                                                                                                                                 | Result               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| `src/domain/hockey/fans.test.ts`: 32 teams, codes and colours match the scoreboard, rivalries, mention parsing, `setTeam` accepts only the 32 and no actor id                                                                                                                                                                                                                        | pass                 |
| `src/domain/hockey/chirp.test.ts`: library coverage for all 32, every line passes the safety net, storylines dated and sourced and retired on time, rendering, refusing forgeries, welcome dedupe, switch cap, no repeats, chatter triggers, cooldown, daily cap, never twice in a row, per-pair/day, prompt slots, empty-room rule, stale facts, last call, library chirps, limiter | pass                 |
| `src/app/hockey/_server/chirp.test.ts`: HMAC sign/verify and its fallback, forged and removed-member lines hidden, host switch, posts as the triggering person, model line signed, off-limits model line falls back, duplicate key is quiet, heckle cooldown end to end, pregame question library-only, Chirp Someone (model, filter, fallback, refusals), prompt content            | pass                 |
| `src/app/hockey/_server/chirp-ai.test.ts`: no key means no call, persona as system message, failure returns null, per-person limit                                                                                                                                                                                                                                                   | pass                 |
| `verification/chirp.spec.ts`, **real accounts on the local stack (GoTrue + PostgREST + Postgres, production grants)**, phones at 390 and 320                                                                                                                                                                                                                                         | **pass** (see below) |
| `verification/chirp-off.spec.ts`: stack without the migration                                                                                                                                                                                                                                                                                                                        | see §6.2             |
| Full Hockey suite (`-c docs/product/hockey/verification`)                                                                                                                                                                                                                                                                                                                            | see §6.2             |
| Repo gates                                                                                                                                                                                                                                                                                                                                                                           | see §6.2             |

**`chirp.spec.ts` covers:** the host declares Calgary from the card. 32
radios, "not tonight's game", no sideways scroll. The roster chip appears. A
guest joins through an invitation, sees the ask, uses the night with the ask
still showing, taps _Not now_ (still hidden after reload), then picks
Vancouver from Group. Both welcomes and the arrival ask appear in the chat as
Chirp Bot (BOT, Satire). Opening the chat with two people posts a
controversy question (Hot take · opinion, with its fact). The guest's message
reaches the host with a VAN chip beside it. The Flames–Canucks rivalry
heckle appears **once**, and a second rival message gets no reply. Chirp
Someone returns three chirps naming the target. The chosen one is in the
host's box and **not** posted until Send; once sent, it is the host's own
message.

Doors that stay shut: a guest can't chirp themselves (422). A guest can't
chirp a non-member (404). A **stranger** gets 404 from both chirps and
`setTeam`, and reads nobody's team and no bot rows through PostgREST. A guest
can't set the host's team (0 rows), can't set a team that doesn't exist
(400), can't post as the host (403), and can't squat a key about the host
(400). A forged model line with a fake signature, and a library line under
the wrong kind of key, are both stored and **neither is shown**. An ordinary
message can't carry bot columns (400). A guest can't switch Chirp Bot off
(403). The host kicks it out: lines and the button disappear, chirps return
409, people's messages stay. The host lets it back in.

Persistence: a fresh session on another device still shows CGY. Changing to
Toronto moves the chip and draws a bandwagon heckle, and the guest's view
shows TOR. A brand-new night starts with TOR already set. At 320 px there is
no sideways scroll, and Chirp Someone and Send are at least 32 px high.

Screenshots: `chirp-room/` (bleed prompt, picker, chat, Chirp Someone, 320 px).

### 6.2 Results of the full runs (2026-10-23, final code)

| Gate                                                                                | Result                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                                                                  | clean                                                                                                                                                                                                                                                                                                                                                                  |
| `npx eslint . --ignore-pattern playwright-report`                                   | 0 errors (40 warnings, all pre-existing, none in Hockey)                                                                                                                                                                                                                                                                                                               |
| `npx prettier --check .`                                                            | clean                                                                                                                                                                                                                                                                                                                                                                  |
| `npx vitest run`                                                                    | **3641 passed**, 30 skipped, 0 failed (288 files)                                                                                                                                                                                                                                                                                                                      |
| `npm run build`                                                                     | passes                                                                                                                                                                                                                                                                                                                                                                 |
| Hockey suite on the local stack, chirp migration applied                            | **all pass**: acceptance (on its synthetic `atlas-stub`), arena-mode, **chirp**, finish, finish-play, mobile ×3, modules, multi-night, plan-and-results, polish, redesign, release1, release2, seats (on `atlas-seats-stub` with the real 2026-10-20 candidates body). Skipped by design: email-confirmation ×2, arena-off, finish-off (each needs its own stack mode) |
| `chirp-off.spec` on a stack **without** the migration                               | pass                                                                                                                                                                                                                                                                                                                                                                   |
| Repo `npx playwright test` (placeholder Supabase, critic atlas-mock, `E2E_ATLAS=1`) | 249 passed, 5 failed, 5 skipped. 3 are the known environmental baseline (core-loop:26, october:554/570). The other 2 (conference-mobile:23 "Labs door", discovery-natural:102 "Vancouver this weekend") **fail identically on the pre-mission commit e4ada1b**, built the same way in a scratch clone: pre-existing, not caused by this work                           |

The first full Hockey run caught two real regressions, both fixed before the
final run:

1. The host's "Kick Chirp Bot out" button was 36 px, under the suite's 40 px
   tap rule (`mobile.spec`).
2. The first version of the team ask was a card at the top of Plan, which
   pushed dinner from the first phone screen to 730 px (`release2.spec`).
   That is why the ask is now a pinned bar.

The chirp e2e run also found the key-squatting hole (§4) that the self-key
check closes.

## 7. Doctrine: conflicts named, not resolved

- **§6 "Less phone, more life" and "time in app may be actively
  misleading."** The brief's goal, "people should want to open Hockey Night
  because something funny might be happening", is an engagement goal. I kept
  it within limits: no notifications (as the brief asked). Bot lines do
  **not** count toward the chat's unread badge, which still counts only
  people. Chirp Bot never posts on a timer, only when someone opens the chat
  or acts. During periods the page is still "put your phone away" (quiet
  mode shows no chat). It is a pregame feature by design. Whether bot lines
  should ever add to the unread badge is an owner call.
- **§3 "AI is not a tab / no AI theatre"** and **§15.6 "how the helper
  manifests, not assumed to be a chatbot."** Chirp Bot is a persona inside
  the group's own chat. It is not a chatbot you talk to, and it is not
  Passport's helper. The brief asked for it by name. This answers nothing
  about §15.6 for Passport in general, and I did not edit the doctrine to say
  it does.
- **§14 "elaborate social games" (not now).** Chirp Someone and the heckles
  are arguably social games. The brief explicitly asks for them. Recorded, as
  the README already does for the toy box.
- **§5 signals vs truth.** A person's team is an explicit statement
  (confirmed state), never inferred. Chirp Bot does not guess allegiances
  from what people say.
- **ADR 009 (one group foundation).** This adds no tables and stays on
  Hockey's existing foundation, as Release 2026-10-23 §2 already decided.

## 8. Not done, and why

- **No live model was exercised.** There is no `OPENAI_API_KEY` in this lane
  (by rule). The model path is tested with a mocked client, including the
  fallback and the safety net. The real tone of `gpt-4o-mini` with this
  persona has **not** been seen. Before inviting people, someone with the key
  should generate ~20 chirps and read them.
- **No moderation API.** `acceptableChirp` is a word-list net. If the model
  ever produces something cruel that uses no listed word, the backstops are:
  the human still chooses to send (Chirp Someone), the host can delete any
  line, and the host can kick Chirp Bot out. Adding OpenAI's moderation
  endpoint would add a call per line. That is an owner choice.
- **A member can suppress a shared bot line** (a pregame question, a rivalry
  heckle) by writing its key first, straight into PostgREST. The result is
  one missing joke. It cannot put words in Chirp Bot's mouth. Closing it
  fully needs a server-only writer (a service role or a signed RPC), which
  Hockey Night deliberately does not have.
- **The cost limiter is per instance**, not global. The posting limits that
  bound model calls for bot lines are global (database). Chirp Someone's
  per-person limit is per instance.
- **No standings-driven questions.** The NHL API Hockey already uses could
  ground "Vancouver are 3–4–1, too early to panic?". That was left out to
  keep the scope tight. The storylines need a person to refresh them each
  season (their `until` retires them on 2027-07-01).

## 9. To release (a person; this lane never deploys)

1. Production Supabase SQL editor: run `chirp-preflight.sql` (all OK), then
   `chirp-migration.sql`, then the preflight again (the last row now says
   REVIEW: applied). Rollback: `chirp-rollback.sql`.
2. Optional: set `CHIRP_BOT_SECRET` in Vercel (any long random string).
   Without it, model lines are signed with `OPENAI_API_KEY`. Without
   `OPENAI_API_KEY`, Chirp Bot runs on its library, and that is a complete
   experience.
3. Merge `feature/hockey` and push to `main` (Vercel deploys from GitHub
   `main`).
4. Smoke test with two real accounts: declare a team on each, see both
   welcomes, chirp each other, and check one line with a phone at 390 px.
