# Date Night — a shared adventure, not a static itinerary

Monday 2 November 2026. Owner brief: "PASSPORT — DATE NIGHT: MAKE IT
MAGICAL" (P0), on production baseline `9fd5af3` (mission 495, `MAGICAL.md`).
Not a redesign: the forest hero, cream paper, editorial type, the journey
timeline, the adventure cards, Just say it, the invitation and the memories
are all still there. What changed is below, by the brief's numbers.

## 1. Packing said "Not switched on yet" with the table applied

**What the code did.** The night page read the list with
`packingOf(db, id).catch(() => null)`, and the panel shows _Not switched on
yet_ whenever that is `null`. So **every** failure looked the same: a missing
table, a table PostgREST can't see, a permission error, a column mismatch, a
network blip. Production's real reason was invisible, in the UI and in the
logs.

**The most likely production cause, reproduced.** On the real local stack
(PostgREST with no DDL watcher), running
`20261102100000_passport_adventure_packing.sql` **without** a schema reload
afterwards gives exactly production's symptom: the table exists, preflight
block A says `true`, and the API answers
`PGRST205 Could not find the table 'public.passport_adventure_packing' in the
schema cache`, which the old page turned into _Not switched on yet_.
`NOTIFY pgrst, 'reload schema';` fixes it at once. Mission 495 rehearsed
with that NOTIFY (its `reload.sql`) but **the operator steps in `MAGICAL.md`
never included it**. Supabase normally reloads the cache on DDL by itself, so
this can't be proven from Metatron without production credentials (none
here, by design). The page now proves it either way the first time the
owner opens it (below).

A second way to get the same symptom, also reproduced: the table without its
`GRANT … TO authenticated` (42501, _permission denied_). Production has no
default grants, so a partial run or a hand-made table would do this.

**The fix** (`src/lib/date-night/night.ts`):

- `readPacking` never throws; it returns the list, or **exactly why not**:
  `missing` (42P01), `unseen` (PGRST205: missing _or_ a stale schema cache,
  the API can't tell them apart), `refused` (42501), `mismatch` (a column or
  function missing: 42703, PGRST204…), `unavailable` (anything else).
- The panel says _Not switched on yet_ only for `missing`/`unseen`; _Not
  switched on properly_ for `refused`/`mismatch`; _Can't open it right now_
  otherwise. **The owner** also sees one line saying which, with the
  database's code: e.g. _"…Either its migration hasn't run, or it has and the
  API's schema cache needs a reload: NOTIFY pgrst, 'reload schema'; (PGRST205)"_.
- The server logs `[date-night] packing list can't be read {trouble, code,
message, hint}`, which is never a secret, so Vercel's logs say it too.
- The members query only puts names on ticks; if it fails, the list still
  opens ("One of you").
- `PREFLIGHT-SHARED.sql` gains read-only blocks **G** (exists, RLS, each
  grant to `authenticated`, policies, the membership function) and **H** (the
  eight columns), and names the remedy for each answer.

Both people add, remove and tick: unchanged (RLS from the migration), and
proven again below on two phones.

## 2. When we leave — scheduling that thinks

**Change it → When we leave** (also one tap on _Leave_ in the plan's strip).
Pick a half-hour or any time; nothing changes until someone taps. Passport
lays the day out again with the same rules as every other change
(`itinerary.ts`: each stop's drive and least, the sunset anchor, closing
times), and offers a few honest ways to spend it (`departure.ts`):

| Option                            | What it does                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------- |
| **Passport's pick** (first)       | The first option with no warning                                             |
| _Shorter …, still the sunset_     | Optional stops before the sunset go; the rest at their least; then extras go |
| _All the light for the hunt_      | Drops the stops after the main one; it runs until the light does             |
| _Home by 11:00 pm_                | When "just later" runs long: trims after-sunset stops, latest first          |
| _The other ending_ (dinner moves) | e.g. _Warm ending: dinner at BNA Brewing at 6:40 pm_                         |
| _Closer: Cold Water, Warm Fire_   | Another adventure that fits without a warning, at its own time if later      |
| _Everything, just later_ (last)   | The plan as it is, **with its warnings**, button _Keep it anyway_            |

Each option says when you're home, what it drops (−), adds (+) or changes (~),
the daylight at the main stop (_"At King Edward Forest Service Road about
4:40 pm: 53 min of daylight before sunset at 5:35 pm. Legal hunting ends at
6:35 pm"_), and the forecast when the server read one (wet → _"colder up
high"_). It also says plainly that drives are the plan's own estimates, not
live traffic, and that **Passport doesn't know a closer place to hunt that
anyone has checked, so it won't suggest one** (access, closures and No
Shooting Areas are yours). Only the plan-as-it-is may carry a warning; an
alternative is offered because it works. The other person sees the same
options and **suggests** one to the planner.

King Eddie at 4 pm (the real constraint): Passport's pick is grouse 4:40–5:25,
the 10-minute drive to the lake, sunset 5:35, fire and stars, home about
8:30, with no warnings. _Everything, just later_ is still there, saying _"Sunset's at 5:35
pm. This misses it"_ and _"That's a dip after sunset"_.

Two rules fixed on the way: a **cold dip is never lengthened** by the layout
either (the warm-up or leaving waits instead; it was 18 minutes, now 15, on
Cold Water's default), and a skipped stop's **drive is kept as a drive** when
the plan is read back from the database.

## 3. Five rooms behind a bottom bar

`NightNav.tsx`, Hockey Night's bar dressed for Date Night: **Adventure ·
Change it · Together · Memories · Invite**. Fixed at the bottom on a phone
(60 px targets, safe-area padding, ember marker on the active room, badge on
Together for what's waiting on you and on Invite until they've joined);
on a desktop the same rooms are a compact row under the hero and the bar is
gone. Rooms are `#adventure`…`#invite`, so links open them and Back works.
Rooms stay mounted (hidden), so a half-typed sentence survives a tab
switch. The hero is full height on Adventure only, and compact elsewhere,
which cuts the scrolling. Toasts sit above the bar on a phone
(`globals.css`). The old in-page anchor row (Our adventure · Just say it ·
Together) is replaced by the bar.

## 4. Play together — no chat, things worth texting

`Plays.tsx` + `src/domain/date-night/plays.ts`. Three first, polished and
working end to end:

1. **This or That.** Two choices (a deck themed by the night: grouse, the
   lake, the fire…, or your own words). Optionally say yours. They pick,
   then both see: _"Same. 🎯"_ / _"Opposites. ⚡"_.
2. **Send a Challenge.** Funny, romantic, brave or photo; drawn from a deck or
   written. _I'm in 🔥_ / _Chicken 🐔_, then _Done it ✓_ ("Legend").
3. **You Decide.** They choose; you go with it. The first pairs are the
   adventure's own: _Stay wild or Warm ending_, _King Eddie Lake or Crazy Creek
   Escape_. When Jess picks, Lorne gets **Make it so**, which changes the
   plan. When the planner is the one deciding, the pick applies at once.

Also working: **Our Predictions** (guess their pick; _"You called it. 🎯"_),
**Photo Dares**, **Surprise Me** (a twist for the night, sent as a dare),
**Love Notes** and **Secret Surprise** (open now, when we leave, at sunset,
or when we're home), and **the Bad Ideas Department** (clearly jokes;
reactions 😂 / _Absolutely not_ / _…wait, actually_).

**Stored without a new table.** A play is an ordinary adventure item with no
day: `label` is the sentence a person would read, `note` the play, tagged
`♥play `. An answer is another item (`♥answer `) pointing at it. Both people
may add items and withdraw their own under the core's RLS, which is all that
playing needs, so **there is nothing to apply in production**: it works the
moment the code is deployed. Plays never show up as suggestions.

**A note that hasn't opened never reaches the other browser**: the page
replaces it before render (`hideUnopened`), keeping only when it opens. The
database still holds it for both members, so it's a surprise, not
encryption, and the composer says so.

## 5. Text Jess

Every play has **Text Jess** (on Jess's side, **Text Lorne back**):
`share.ts` copies the words and the link, then opens the phone's own share
sheet (Messages, WhatsApp…); with no share sheet, a new text on a phone
(`sms:?&body=`), or the copy on a computer. A copy button sits beside it.
**The link opens that exact card**: `/night/<id>?p=<play>` lands in Together
with the card lit and scrolled to. **Before Jess has joined**, the link is her
invitation carrying the play:
`/adventures/join/<token>?next=/night/<id>?p=<play>`. She signs in, joins,
and lands on it (`JoinAdventure` follows `next` only into the adventure she
just joined; the join page accepts only that exact shape). One invitation is
made per session and reused. A link that's already been used shows
**Already in? Open it**. The invitation card's _Send it to Jess_ uses the same
helper. No chat infrastructure anywhere.

## 7. Verified

Production build against the real local stack (569xx, GoTrue + PostgREST +
Postgres with every adventure migration), corpus stand-in for 2 November,
`next start` on 3128:

- **`magic.spec.ts`: the brief's 13 steps, two phones (390×844)**: Lorne
  starts the night and chooses King Eddie; taps _Leave 2:15_; picks 4:00;
  sees 53 min of daylight, legal hunting to 6:35, the plan-as-it-is with its
  warnings, all five alternatives and not Crazy Creek; uses Passport's pick;
  the itinerary is _Leave · Grouse 4:40 · Sunset · Fire · Stars · Home_ through
  a reload, with no warnings. Together: the list is open (7 items), he adds
  _Hand warmers_; makes a This or That and **Text Jess**: the share sheet gets
  the words and an invitation link carrying the play, the clipboard has it
  too. Jess opens it, signs up, joins, **lands on the card**, sees the same
  plan at 4:00, picks (_Opposites_), ticks _Chairs_, adds _Wool socks_,
  sends a romantic dare; its link is the direct `/night/…?p=…`. Lorne opens
  it (Together, _1 waiting_), accepts and does the dare, sees her pick, her
  tick and her socks. You Decide: Jess picks _Warm ending_, Lorne taps **Make
  it so**, the plan ends at BNA and still leaves at 4:00. A love note at
  sunset is locked on Jess's phone and **absent from her page's HTML**.
  Memories: Jess shares one; Lorne sees it. Packing ticks again. On both
  phones, in all five rooms, the room ends above the bar. An **Android-sized**
  phone (412×915): the same. **Desktop** (1440×900): no bottom bar, the room
  row under the hero; a Bad Idea with no share sheet is **copied** with its
  link.
- **`markham.spec.ts`** (mission 495's acceptance spec, now opening each room
  first): green, both tests.
- **`packing-trouble.spec.ts`**, with the stack put into each state:
  _unseen_ (table made, no reload: PGRST205), the reload fixes it; _refused_
  (SELECT revoked: 42501), the grant fixes it. Each says its reason and code.
- **`shared-off.spec.ts`** (`SHARED_OFF=1`, both migrations rolled back):
  green; then both re-applied twice and reloaded, packing works.
- **`date-night.spec.ts`** (the no-account answers): green.
- `night.stack.test.ts` (real RLS: plan, packing, memories): green.
- Unit: `departure.test.ts` (14), `plays.test.ts` (10), and every existing
  Date Night test.

Screenshots: `verification/screenshots/magic-*.jpg` (from the final run,
at 1×): 02 the leave-time options, 03 the plan at 4, 04 This or That, 05 Jess
lands on it, 07 Lorne sees her answers, 08 the locked note, 10 Android, 11–12
desktop, `packing-unseen` / `-refused` / `-ok` the three packing states. The
`markham-*.png` set is mission 495's and predates the rooms.

## Release

**Code only, no new migration, no environment variable.** One commit on
`main`, a fast-forward of `9fd5af3`.

Operator, in order:

1. **Packing, before or after the push** (Supabase SQL editor, Passport
   project): run `PREFLIGHT-SHARED.sql` block **G**. If everything is true,
   run `NOTIFY pgrst, 'reload schema';` (harmless, no data touched). If a
   grant is false, re-run `20261102100000_passport_adventure_packing.sql`
   (guarded), then the NOTIFY. If **H** is short, stop and ask.
2. Push `main`. On `gohaveaday.com/datenight`, the owner opens **Together**:
   the list opens. If it doesn't, the panel now says why, with the
   database's code, and so does the Vercel log (`[date-night] packing`).
3. Change it → When we leave → **4:00 pm** → Passport's pick → Use this.

Rollback: redeploy `9fd5af3`. Nothing in the database needs undoing. One
cosmetic catch: the older page doesn't know plays, so it would show each play
and answer as a suggestion card. If that matters, they are the night's items
whose `note` starts with `♥` (`♥play `, `♥answer `) and can be deleted.

## Named, not resolved

- **Doctrine §14 lists "elaborate social games" as not-now**; §6 asks for
  "bets, challenges, predictions, friendly competition". This brief asked
  for nine playful interactions. They're built as **small things to text**,
  with no game state, scores or live mode, which reads as §6, not §14. Whether
  that line is in the right place is the owner's call.
- **Plays live in the items table.** It needed no migration, and RLS already
  fits. If plays grow (scores, reactions from more than two people), they
  deserve their own table. Not decided here.
- **The leave-time constraint isn't remembered as a constraint.** Choosing
  another adventure later lays it out at that adventure's own leave time.
  Passport doesn't store "not before 4".
- **The owner can delete the other person's plays through the API** (the
  core's owner-may-change-anything rule); the UI only offers your own.
- **A closer grouse spot** is unknown to Passport and isn't suggested. If one
  is wanted, it needs a checked place (access, closures, No Shooting Areas)
  in the night's data.
- **The texted name** is the member's display name (for an email sign-up,
  the email's local part), the same name the hero shows.
- Doctrine §15.4 and §15.12 stay open; this is one more narrow answer.
