# Hockey Night — the original vision, recovered (2026-10-16)

**What this is:** an audit of where Sycle Hockey Night's creative ideas came
from, which of them the shared product kept, which it lost, and what was put
back. Quotes are verbatim from the sources named. Nothing here invents a
historical idea; where the history is silent, this says so.

---

## 1. The sources — there are exactly two

Searched: `docs/product/hockey/`, `src/experience-lab/`, `src/app/labs/`, every
local branch (`sycle-prototype`, `integration/labs`, `worktree-agent-*`, the
`lane/*` lines), commit messages, `archive/`, `docs/old-might-be-garbage/`,
`docs/architecture/decisions/`, and the untracked workspace root.

| Source                                                                                           | Commit                              | Date       | What it is                                                                                    |
| ------------------------------------------------------------------------------------------------ | ----------------------------------- | ---------- | --------------------------------------------------------------------------------------------- |
| **Experience Lab, round 1** — _"An experience is a group answering questions, not an itinerary"_ | `974e1d6` (on `main` via `bd6f596`) | 2026-09-06 | The engine, the five fixtures, Hockey Night as "the specimen", `src/experience-lab/README.md` |
| **Experience Lab, round 2** — _"The curator gets a toy box, and Passport learns to shut up"_     | `e960687` (`main`)                  | 2026-09-07 | `toybox.ts`, `lineage.ts`, `InheritedMemory.tsx`, `CuratorSetup`, `QuietMode`, `PromptDeck`   |

Everything after those is adaptation: `docs/product/hockey/README.md`
(`f60a96e`, M216, the shared night), `OWNER-CHECKLIST.md` (`bba1bd1`),
`october-experience-bible.md` (`f17285a`, which names "Vancouver Hockey Night"
and "experience recap and lineage ('run it back')" in passing), and
`boards-gatherings.ts` (`62e9900`, a "Sycle staff hockey game" placeholder).
`sycle-prototype@6ae9ab2` is an arrivals board with no hockey ideas in it.

**Nothing was ever removed from the lab.** Between `e960687` and HEAD the only
lab change is touch-target CSS (`812966d`). Every loss below happened in the
adaptation (`src/domain/hockey/night.ts`, `HockeyNightScreen.tsx`).

**What the history does not contain:** any Sycle Cup points table that spans
nights, any "season", any multi-host model. The nearest thing is `lineage`,
and it deliberately does **not** carry points (§4).

---

## 2. The ideas, in their own words

**The finding everything follows from** (lab README):

> The escalation is almost entirely made of **questions the group answers
> about each other**, not information about the event. Nothing Passport could
> tell you about Rogers Arena moves that needle. "Nathan is the only person
> predicting a shutout" does.

> **The single most valuable affordance found in the lab is letting a person
> invent a question.** ("Will Lorne buy a $19 arena beer before puck drop?")

> A planner produces a document. This produces **a reason to be excited on
> Tuesday, an argument on Thursday, and something to be insufferable about on
> Saturday.**

**The four load-bearing properties:** shared (_"no admin view … every time a
management affordance was added it immediately started feeling like
software"_); changes shape; not over when it's over; and

> **It accumulates.** The next edition can inherit the roster, the standings
> and the running joke. That is where tradition comes from, and it is the only
> part of the loop that is genuinely valuable and genuinely cheap.

**The night's rhythm and headlines** (`fixtures/hockeyNight.ts`): _Make Friday
worse. Everyone gets a say._ · _Last call on picks. They lock at puck drop._ ·
_Picks are locked. Nobody can save you now._ · _Eighteen minutes. Enough for
one stupid thing._ · _The vault is ready when somebody opens it._ · _The horn is
not the end of the night._ · _What actually happened._ · _There is a next one.
There is always a next one._ And during a period, the whole page becomes
**"Put your phone away."**

**Funny predictions:** final score (_"Right winner"_ partial credit), who
scores first, overtime, total goals, _"Will Lorne buy a $19 arena beer before
puck drop?"_ (_"Ridiculous longshot"_), _"First person to complain about the
refs"_, _"Pick a side. Loser pays up."_ Toy-box starters: _"Someone in this row
spills a full beer before the third."_ · _"We end up talking about work within
twenty minutes."_ · _"Somebody suggests leaving early and is ignored."_

**The toy box** — eleven shapes, the fixture holds the wording: prediction,
sealed pick, **secret mission** (_"Get Nathan to say the word 'analytics' out
loud"_, _"Convince one person you played junior hockey. Maintain it all
night."_), **dare** (_"Get on the jumbotron. Any means short of a criminal
record."_), side quest (_"Find the single worst item of merchandise in this
building."_), photo challenge, **sealed photo vault**, **group quest** (_"All
of us plus one opposing fan in a single photo before the third."_), **forfeit**
(_"Losing side delivers an overly sincere concession speech."_), **who said
this?** (_"The stupidest thing you've done on a trip."_), just ask (_"Is anyone
actually watching the game right now?"_).

> The curator sets the stage. Passport provides the toys. The group creates the
> night.

**Postgame and awards:** _"So. Where are we going?"_ (karaoke, _"One last drink
— The lie we tell every time"_); **The Sycle Cup — _"Worth nothing. Contested
bitterly."_**; 🏆 _Sycle Cup Champion — "Insufferable until the next one."_ ·
🥔 _Passport Potato — "Somebody has to be."_ · 🎯 _Prophet of the Night_ · 🤡
_Boldest Wrong Opinion_. **The receipts** — who owes what — _"the most
anticipated block in the whole prototype"_, while _"the leaderboard is the
block nobody looks at twice"_.

**Run it back** (`core/lineage.ts`):

> a next edition is _the same definition with a later anchor and a memory of
> the last one_. No new fixture, no new route template, no creation flow.

> Carrying a score forward would make the second night a continuation of the
> first, and the thing worth carrying is the story, not the standings — **a
> defending champion is funny, a head start is not.**

> nobody wrote "Nathan's 7–1 remains indefensible", it is simply the worst
> surviving prediction, found.

---

## 3. Multi-event audit — verified against code and schema

Schema: `docs/product/hockey/migration.sql` (unchanged by this work). Every
table is keyed by `occasion_id`; every policy is "member of _this_ occasion".

| #   | Capability                      | Before (`812966d`)                                                                                                                        | Now                                                                                                                                             | Evidence                                                                       |
| --- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | Multiple independent nights     | **PARTIAL** — schema yes; the shelf hid "Start it" once you hosted one, and every start was the same hard-coded game (25 Oct, Wild)       | **BUILT**                                                                                                                                       | `chooseGame`, `NightsShelf`; `multi-night.spec.ts`                             |
| 2   | Multiple hosts                  | **PARTIAL** — one `host_id` per night, so different nights could have different hosts in principle, but nothing let anyone else start one | **PARTIAL** — any member of a finished night can run it back and hosts the next; **co-hosts on one night: MISSING** (needs a schema change, §7) | `createSycleNight({after})`; spec: Maya, a guest, hosts No. 2                  |
| 3   | Different guest lists per night | **BUILT** (membership per occasion)                                                                                                       | **BUILT** — now proven across two nights                                                                                                        | spec: Maya on Kraken only, Sam on Oilers only                                  |
| 4   | Separate invitations            | **BUILT** (per occasion; expiry = that night + 24 h)                                                                                      | **BUILT**                                                                                                                                       | spec: Oilers invites list only "Sam"; a used Kraken link opens nothing for Sam |
| 5   | Separate predictions            | **BUILT**                                                                                                                                 | **BUILT**                                                                                                                                       | spec: Maya's pick on Kraken absent from Oilers; her pick on Oilers → 404       |
| 6   | Separate conversations          | **BUILT**                                                                                                                                 | **BUILT**                                                                                                                                       | spec: Kraken comment absent from Oilers; posting on Oilers → 404               |
| 7   | Independent results             | **BUILT** (`resolution` per occasion prompt)                                                                                              | **BUILT**                                                                                                                                       | spec: Kraken final called; Oilers final unresolved                             |
| 8   | Upcoming and past nights        | **MISSING** — one flat list                                                                                                               | **BUILT** — "Coming up" / "Already happened"                                                                                                    | `NightsShelf`, `isOver`                                                        |
| 9   | Event switching                 | **PARTIAL** — "Your nights" link only                                                                                                     | **BUILT** — shelf, Cup roll links every night, "No. 2 is on — go"                                                                               | `CupRoll`, `RunItBack`                                                         |
| 10  | Persistent Sycle Cup standings  | **MISSING** — per-night leaderboard; `lineage: undefined`                                                                                 | **BUILT as a roll of honour** — titles and nights played, per run; **not** cumulative points (§4)                                               | `sycleCup`, `series.test.ts`                                                   |

Isolation was already enforced by RLS (`rls-attack.mjs`: all checks pass, rerun
2026-10-16); what is new is that it is now exercised with several nights at
once and a stranger to all of them.

---

## 4. Decisions made, and one named conflict

- **The Cup persists titles, not points.** The mission asked for "persistent
  Sycle Cup standings". The lab tested carrying points and recorded why not
  (§2). So each night's leaderboard still starts at zero, and what persists is
  who has held the Cup and how often. If a human wants a cumulative points
  table, it is a small change in `series.ts` — but it overturns a lab finding,
  so it should be a decision, not a drift.
- **A run is explicit.** "Run it back" links the next night to the last
  (`details.series`, `details.edition`), so a coworker group's Cup does not
  mix with a family night the same person hosts. A brand-new night starts a
  new run.
- **Each viewer's Cup is built only from nights they were at.** RLS decides
  what anyone may know about last time. Two people on the same run who
  attended different nights see different rolls. That is the privacy model,
  not a bug.
- **Home games only.** "What's near the arena?" measures from Rogers Arena's
  coordinates; an away game would need a venue Passport has not measured.
- **Doctrine §14 lists "elaborate social games" as not-now.** A persistent Cup
  across nights pushes further in that direction than M216 did. Named, not
  resolved; §15.12 (group experiences) stays open and this does not answer it.

---

## 5. Comparison — kept, lost, hidden, incomplete

**Great ideas already implemented (M216 kept them, unchanged):** the
`Prompt` engine; the pregame vote with real Atlas nominations; the hard-out
vote; seven sealed picks in a deck; the host-beer question (renamed to the
real host); refs; pick-a-side forfeit and the receipts; ten of eleven toy
families; curator brief and the two-ceiling consent scale; quiet periods and
intermission bursts; the vault; group quests; all four awards; the feed,
reactions and Passport's derived voice; the plain-text share card.

**Great ideas lost in development:**

| Idea                                                   | State               | Why                                                                                                                   |
| ------------------------------------------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Run it back / lineage / receipts from last time**    | **Recovered here**  | M216 hid the block; its comment called it "still unbuilt", but lab round 2 had built it                               |
| **The Cup as a tradition**                             | **Recovered here**  | Leaderboard was per night only                                                                                        |
| **"Who said this?"** and the toy box's _people_ family | Still withheld      | Builds questions from answers nobody may read; on a shared page that leaks authors. Needs server-side materialisation |
| Secret mission aimed at Mike                           | Dropped correctly   | A fixture person; the toy box still makes real ones                                                                   |
| Photos                                                 | Still captions      | No upload or storage bucket                                                                                           |
| "Just looking, thanks" guests                          | Deliberately absent | M216 requires an account                                                                                              |

**Features implemented but hidden:** the `runItBack` block (now shown from the
morning after); `RecapBlock`'s lineage line (now fed). Nothing else was hidden.

**Incomplete interactions:** a night's Cup winner is "unofficial" whenever the
host leaves a result uncalled (`settled` needs every scored question);
secret-mission scoring is viewer-dependent (inherited); live updates are 5 s
polling.

**Opportunities to make it more fun, not built:** server-side "who said this?"
(the lab's _"the group's content is the product"_); a trophy hand-over moment
on the morning page; real photos in the vault; the one-at-a-time pick run the
lab README wanted instead of a deck; letting the defending champion set one
question on the next night.

---

## 6. Before / during / after

The night already had ten phases, each composing its own page. What it lacked
was a way to see where you are. `RunningOrder` adds one line under the poster:
**Before the game · During · After**, with the current act lit, and each other
act saying what it holds (_"Phones away. Intermissions are for one stupid
thing."_, _"Awards, receipts, and whether you run it back."_), plus _"Now: Warm-up.
Next: 1st period in 2 hours."_ It is a map, not navigation. Nobody can skip to
the morning after, and it disappears during a period like everything else.
The phase grouping lives in `src/domain/hockey/acts.ts`, and a test makes
sure every fixture phase is in exactly one act.

---

## 7. Proposed, not done (outside this lane)

- **Co-hosts.** `passport_occasion_members.role` allows one host by policy
  (`host_id`, "Nobody removes the host"). A second host needs a
  `passport-domain` change to `migration.sql` / `supabase/migrations/`.
- **Bring last time's crew automatically.** Membership is created only by the
  create and redeem functions, so No. 2 cannot copy No. 1's roster. Today the
  new host gets last time's crew as one-tap labelled links. A `SECURITY
DEFINER` "run it back" that copies members would need a schema change.

## 8. A time-zone fact worth knowing

This machine's Node and OS (tzdata 2026c) keep `America/Vancouver` on UTC−7
**after** 1 November 2026. The Chromium used in tests still switches to PST.
The first version converted "7pm" on the server, and the host's own page then
showed 6:00 p.m. The conversion now happens in the host's browser (`toRequest`),
and the server only validates the instant. Guests whose browsers hold
different tz data than the host's could still see a one-hour difference for
November-onward games. The 25 October night is unaffected, because every
database agrees about October.
