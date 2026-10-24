# Hockey Night — make the night come alive (2026-10-23)

**Asked:** turn the Hockey Night features into one connected, playful evening
for three coworkers and the people watching from home: a compact game plan,
one dinner vote, team identity that feels like identity, a Chirp Bot that
takes part, a Sycle Cup worth winning, the peanut gallery, and a night that
changes with the clock. Preserve everything that works.

**Where:** `feature/hockey`, on top of `ee30857`, which is an ancestor of
`origin/main` `a1ad8b5`. The nine commits main has beyond it touch no Hockey
file, so this merges cleanly. Local only, **not pushed, not deployed** (this
lane cannot push or deploy). Product authority read first:
`docs/PASSPORT-PRODUCT-DOCTRINE.md` (conflicts named in §6 below).

**Screens:** `alive/` (phones at 390 px, the whole evening, four people), with
the "before" in `alive/before-*.jpg`.

---

## 1. What was there — audited, not assumed

Each feature was driven in a browser on the local stack (real GoTrue sign-ups,
PostgREST under RLS, today's production Atlas corpus), not read off the code.

| Feature                 | Found                                                                                                                                                                                                                                                   | Now                                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invitations and joining | Built and working                                                                                                                                                                                                                                       | Unchanged; the first screen after joining is now a welcome (§2)                                                                                               |
| Who do you bleed for?   | Built and working (32 teams). **Disconnected / hidden**: a slim bar floating over the content on every tab; identity was a small chip beside a name                                                                                                     | Picker kept. Declaring is a moment; the team rings every avatar, washes the roster card; asked in the welcome, not over the page                              |
| Chirp Bot               | Built and working (library; model path untested live). Spoke on team, arrival, chat, pregame questions, last call. **Too noisy on joining**: every arrival got "no allegiance yet" seconds before its welcome line (4 joiners → 8 bot lines vs 3 human) | Arrival nag dropped (the welcome asks). New moments: couch fan, picks sealed (boldest call), final verdict, a jumped dinner vote. Host sets how much it talks |
| Group chat              | Built and working. **Hidden during periods** (quiet mode had no chat at all)                                                                                                                                                                            | Couch: periods open on the chat. Arena: "phones away" stays, with "At a whistle? Open the chat"                                                               |
| Pregame venue discovery | Built and working, **duplicated**: photographic ballot cards, then a second shelf of cards, then the concourse row, then "add your own" — plus "The plan" card summarising what was above it                                                            | One compact vote; the full cards one tap away in Explore                                                                                                      |
| Voting                  | Built and working                                                                                                                                                                                                                                       | Same endpoints. One vote: places, the concourse, typed names                                                                                                  |
| Meeting points          | Built and working, **asked three times**: the meet-spot vote (as cards), "Meet here" host pick, the host's time/gate form under "Getting there"                                                                                                         | One "Meet up" stop: the vote, the host's official meetup, and a sensible default (where we eat)                                                               |
| Seats / directions      | Built and working, **permanently expanded** (about two screens)                                                                                                                                                                                         | Under "Game time", on demand                                                                                                                                  |
| Predictions             | Built and working; locked by the server at puck drop                                                                                                                                                                                                    | Unchanged; Chirp Bot reads out the boldest call at lock                                                                                                       |
| Secret missions         | Built and working                                                                                                                                                                                                                                       | Unchanged                                                                                                                                                     |
| Sycle Cup               | Built and working. **Incomplete**: no way to know how to score before the standings appear (after the game); no winner moment. **Bug:** the vault vote says "you can't vote for your own" and nothing enforced it                                       | "How to win the Cup" from the night's own questions; a champion reveal in the winner's colours; server refuses a self-vote                                    |
| Arena Mode              | Built and working                                                                                                                                                                                                                                       | Hidden from couch fans                                                                                                                                        |
| Photos and memories     | Built and working (needs `memories-migration.sql`)                                                                                                                                                                                                      | Unchanged                                                                                                                                                     |
| After-game activities   | Built and working (postgame vote)                                                                                                                                                                                                                       | The "After / What's next" stop                                                                                                                                |
| Run it back             | Built and working                                                                                                                                                                                                                                       | Leads Plan the morning after, above "How the night went"                                                                                                      |
| Remote participants     | **Missing**                                                                                                                                                                                                                                             | At the arena / from the couch (§3)                                                                                                                            |

## 2. The evening, before and after

**Before** (`alive/before-plan.jpg`): Plan was about 5,700 CSS px at 390 —
seven phone screens — of full-size cards, a second shelf, a plan card that
repeated them, the walk form, meeting-place cards, the seats, the after vote.

**After** — the same night, phase by phase:

1. **The invitation** (`01`, `03`). A guest lands on the night with a
   welcome card: _"Alex, it's game night."_ — Wild at Canucks, when, where,
   who's in (their faces), what they can do; then the two things that make it
   theirs, one tap each: _Who do you bleed for?_ and _Where are you
   watching?_ Part of the page, never over it; answering both or ✕ puts it
   away.
2. **Identity** (`02`, `04`, `05`). Declaring a team fills the screen with
   its colours, the crest lands, the colours burst (none of that under reduced
   motion), and their own face in the team's ring says _It's official_. From
   then on every avatar — roster, chat, votes, standings, the champion card —
   wears a two-colour team ring and badge, and the roster card washes in the
   team's colour. Tonight's game keeps its own colours: personal and event
   identity coexist.
3. **The buildup** (`10`–`15`). Plan is **Our game plan**: four stops on a
   rail, the current one gold.
   - **5:30 p.m. Pregame** — the leader (photo, walk, votes). _Vote_ opens one
     compact list: every place on the ballot with its own small photo, the
     concourse, typed names; under a short ballot, the best three places
     nobody has added, one tap to add and vote. _Explore_ opens Passport's
     full photographic cards, places on the vote first; any card adds itself
     to the same vote.
   - **6:30 p.m. Meet up** — one answer, and who decided it: the host's
     official spot, else the group's vote, else _where we eat, then we walk
     over together_. The host's time/gate/spot form lives here.
   - **7:00 p.m. Game time** — the arena and my seat; _Seats & directions_
     opens the seats, the walk handed to Google/Apple Maps, the arena's guide
     and Arena Mode's door. On the couch: _From the couch_, and nothing about
     getting there.
   - **After** — the after vote, which becomes _What's next_ at the horn.
4. **Game time** (`30`–`32`). Picks lock (by the server); Chirp Bot reads out
   the boldest score call. At the arena the page is "phones away" with the
   plan and a button into the chat; on the couch it opens on the chat.
5. **After the game** (`40`–`43`). Play leads with the **Sycle Cup
   champion** in their team's colours (a tie is shared, not broken); Chirp
   Bot's final verdict; receipts, awards, the recap and memories as before.
6. **The next day** (`50`, `51`). Run it back leads Plan; the plan below it is
   _How the night went_.

## 3. What was newly built

- `src/domain/hockey/gameplan.ts` — the four stops, where the night is now,
  the meet-up time, and **one meeting point** (`meetingPoint`).
- `src/components/hockey/PlanTab.tsx` — rewritten around the game plan; the
  dinner vote's mechanics (`nominate` then `respond`) are unchanged.
- `src/components/hockey/Identity.tsx` — `TeamMoment`, `WelcomeCard`,
  `WatchingToggle`. `FanAvatar` (in `FanTag.tsx`) replaces the lab avatar in
  every Hockey component.
- `src/components/hockey/Cup.tsx` — `HowToWin`, `CupChampion`.
- **The peanut gallery** — `src/domain/hockey/crowd.ts`, action
  `setWatching`, `crowd` in the night's snapshot, `alive-migration.sql`.
- **Chirp Bot** (`domain/hockey/chirp.ts`, `_server/chirp.ts`): kinds
  `couch`, `picks`, `final`, `switch`; library pools `cw.`, `pk.`, `fv.`,
  `o.sw.`; `chirpTick` (time-driven moments, run after the night's poll
  answers); the host's level `quiet | normal | rowdy` in
  `occasions.details.chirpLevel` (no migration — the host already writes
  `details`).

**Same safety model as before.** Lines are stored as library ids and rendered
by the server on every read; a line about a person must be written by that
person's own session (DB check, widened to `couch` and `switch` by the
migration); a line that quotes somebody's pick or crowns somebody shows only
while the record this member can read agrees (`claimHolds`), so a forged row
cannot put words in the record. One line per key per night (the existing
unique index). Heckles (`switch` included) keep the cooldown, the daily cap
and "never twice in a row"; `quiet` turns them off; `rowdy` is a 4-minute
cooldown and 14 a day. Picks and the verdict are library-only and never wait
on a model.

**Fixed:** the vault's self-vote (refused by the server, 422); a verdict
posted between two of the host's calls could crown the wrong points and then
hide forever (now keyed by person, waits for the final score, says points as
they stand); keys with a time in them split wrongly on `:` (`gameStamp`).

**Removed:** `BleedPrompt.tsx` (the floating bar — the welcome asks),
`MeetingSpots.tsx` (meeting-place cards — the compact vote), and
`GettingThereEditor` (split into `OfficialMeetup` and `Directions`).

## 4. Database

**One additive migration: `alive-migration.sql`** (+ `alive-preflight.sql`,
`alive-rollback.sql`). Needs `chirp-migration.sql` first.

- `passport_occasion_members.watching` (`'arena' | 'couch' | null`), with a
  check, and `GRANT UPDATE (watching)` to `authenticated`. RLS unchanged: the
  existing self-update policy (`user_id = auth.uid()`).
- The self-keyed Chirp Bot rule now also covers `couch:` and `switch:` keys.

Without it the night works and the couch is simply absent (proved by
`alive-off.spec`: no "where are you watching", `setWatching` → 409, teams and
Chirp Bot still work). Rehearsed on the local stack only: preflight → apply →
apply again (no change) → every spec. **Not applied anywhere real.**

Production order (SQL editor, a person): `migration` → `memories` → `seats`
→ `arena` → `chirp` → **`alive`**, each preflight first (the runbook
`docs/release/PRODUCTION-RUNBOOK-2026-10-23.md` §3 step 4 lists the first
five; add `alive` after `chirp`).

## 5. Tests — local stack, not production

Real GoTrue sign-ups, PostgREST with production's grants, embedded
Postgres, Chromium phones; Atlas = today's production corpus served by
`atlas-seats-stub.mjs` (acceptance: the synthetic `atlas-stub.mjs`); NHL =
`finish/nhl-stub.mjs` (recorded game; `MODE=down` for missing data).

| Run                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Result                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| **`alive.spec`** — Lorne (Flames), Alex (Leafs), Danny (Canucks), Priya (Oilers, couch): invite links, welcome, team moments, persistent identity, forged team/couch rows refused, game plan ≤ 2,400 px with no tiny targets, Explore + add + vote, one vote with concourse and typed names, a jumped vote heckled, host makes the meetup official, directions on demand, couch plan, sealed picks unreadable, a secret mission, puck-drop lock (422), picks line, couch chat in a period, arena "open the chat", calls, champion, verdict, What's next, the morning after | pass                       |
| Same, with a model "configured" and unreachable (`OPENAI_BASE_URL` → closed port): AI unavailable                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | pass                       |
| Hockey suite: acceptance, alive, arena-mode, chirp, finish, finish-play, mobile ×3, modules, multi-night, plan-and-results, polish, redesign, restaurant-photos ×2, seats                                                                                                                                                                                                                                                                                                                                                                                                  | 16/16 + acceptance 1/1     |
| Migration-absent: alive-off, chirp-off, arena-off, finish-off (no photos table, NHL down)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 4/4                        |
| email-confirmation (`CONFIRM_EMAIL=1`, SMTP sink)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 2/2                        |
| `rls-attack.mjs` / `seats-attack.mjs` / `arena-attack.mjs`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | all passed / 35/35 / 78/78 |
| `vitest` (repo)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 3,672 passed, 30 skipped   |

### 5a. Gate results

| Gate                         | Result                                                                                                                                                                                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`           | clean                                                                                                                                                                                                                                                       |
| `npx eslint .`               | 0 errors (40 warnings)                                                                                                                                                                                                                                      |
| `npx prettier --check .`     | clean                                                                                                                                                                                                                                                       |
| `npx vitest run`             | 3,672 passed, 30 skipped                                                                                                                                                                                                                                    |
| `npm run build`              | ok (stack env and placeholder env)                                                                                                                                                                                                                          |
| `npx playwright test` (repo) | 248 passed, 6 failed, 5 skipped — the release candidate's recorded baseline exactly, by name: core-loop, october ×2 (finishing defects), conference-mobile, discovery-natural (depends on the day), october-door (Witching Hour). No Hockey test among them |

**Spec changes.** The older specs asserted the old Plan. `night-tabs.ts`
maps the old decisions onto the new stops (`openDecision`) and adds
`openExplore`; acceptance, chirp, plan-and-results, polish, redesign,
restaurant-photos, seats, arena-mode and arena-off follow the new structure
and still check the same behaviour. **`release1.spec` and `release2.spec`
were retired**: they asserted those releases' own presentation (an accordion;
venue and meeting-spot cards), which this mission replaces; the behaviours
they protected (votes, nominations, the meetup, Arena in the bar) are
asserted by `alive.spec`, `seats.spec` and `arena-mode.spec`. Two specs
computed "two days from now" as a UTC date, which is a day ahead every
evening in Vancouver; they now use Vancouver's calendar.

## 6. Decisions and named conflicts — for a person to confirm

- **Doctrine §6 (less phone) vs "during the game: chat".** At the arena a
  period stays "phones away"; the chat is one tap off, for that period only.
  On the couch, periods open on the chat. Change it if the arena should open
  on chat too.
- **Doctrine §14 lists "elaborate social games" as not-now**; the Hockey
  brief asks for them by name (as M216 did). Recorded, not resolved.
- **§15.12 (how group experiences work) stays open.** The peanut gallery is
  this night's answer, not Passport's.
- **Sealed picks are visible to anyone who has sealed theirs** (the lab's
  `onLock` rule, mirrored in the database), while Play says "Sealed until puck
  drop." The rule is unchanged; the copy overstates it. Pick one.
- **"Where we eat" is the default meeting point** when nobody votes and the
  host hasn't made one official — an interpretation of "default
  intelligently". The concourse is never the default (it's already inside).
- **Chirp Bot no longer heckles an arrival without a team** — the welcome
  asks. Arrival lines already stored still render.
- **The welcome says "Wild at Canucks"** (away at home), the way a fan says
  it.

## 7. Production status — not verified, not deployed

- `origin/main` is `a1ad8b5`; this work is on top of an ancestor of it and is
  **not pushed** (pushing is disabled here).
- Public, credential-free check on 2026-10-23: `gohaveaday.com/hockey` → 307
  to sign-in; `/hockey/join/<bad token>` → 200 with Hockey's own "invitation
  lets in one person, once" copy. So **a version of Hockey Night is live**.
  Which commit, and which of the six migrations production has, cannot be
  read from here (no production credentials; the classifier has denied
  Vercel/Supabase reads in earlier missions).
- `OPENAI_API_KEY` in production: per the runbook it is present; whether
  Chirp Bot's model path produces good lines has **never been observed** —
  everything here ran on the library.

**Owner steps for Sunday:** fetch `feature/hockey`, merge into the release
(clean), run the gates, apply `alive-preflight.sql` → `alive-migration.sql`
after the others, deploy, then on production with two real accounts: join by
link, pick a team (the moment), choose arena/couch, vote in Pregame and in
Explore, set the meetup as host, and read one Chirp Bot line.

## 8. Still open

- The model path for Chirp Bot has still never produced a real line.
- The NHL feed in progress (period/clock) is unit-tested only; watch it
  Sunday.
- Chirp Bot does not yet notice a challenge or mission win as it happens, nor
  Cup lead changes during the game — only the final verdict.
- A remote fan's dinner vote counts like anyone's (they may still come to
  dinner); not asked.
- Missions remain viewer-dependent in the standings (inherited from the lab).
