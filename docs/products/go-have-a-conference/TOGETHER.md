# Conference, together — the Vancouver adventure (2026-10-23)

> **Status:** built on `feature/conference-adventure` (branched from
> `integration/release` d8a1c0a, which already holds Conference Arrivals and
> every Hockey Night system). **Not merged, not deployed, migration not
> applied to any real Supabase project.** Verified against a local Postgres +
> GoTrue + PostgREST with five real accounts.

**The brief:** a coworker arrives in Vancouver, opens Conference, finds their
people, joins a morning walk, organises lunch, explores the city and shares
memories — a shared adventure, not conference software, reusing what Hockey
Night already built.

That story is now one Playwright run (`scripts/conference-stack/together.spec.ts`),
start to finish, on real authentication and real row-level security.

---

## 1. What a person can do

| #   | Feature               | What is there                                                                                                                                                                                                                                                                            | Where                                        |
| --- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 1   | **Arrival board**     | Unchanged map, board, statuses and the three kinds of time. **Added:** who has landed, who's arriving next, a timeline by day, and **Landing together** (people within 45 min of each other) with _Meet at arrivals_, which opens a plan already filled in. Home shows the summary.      | `/arrivals`, `Coordination.tsx`, `digest.ts` |
| 2   | **Group chat**        | The conference's room plus a thread per plan; reactions; delete your own; organisers moderate what they can see. Hidden members read; posting is a choice to be seen. Updates every 4 s while open.                                                                                      | `/chat`                                      |
| 3   | **Find my people**    | Share where you are for 15 min – 4 h (you choose up front), with a note; coworkers who are sharing appear on a city map and a list with distance, freshness and walking directions; **Stop** deletes it at once. Rules in [ADR 011](../../architecture/decisions/011-find-my-people.md). | `/people`                                    |
| 4   | **Make a plan**       | Eight kinds (morning walk, coffee, lunch, dinner, drinks, sightseeing, explore Vancouver, custom), with title, description, day(s), time, meeting point, venue, organiser, invitations, RSVPs, participant list. Edit and cancel for the organiser.                                      | `/plans`                                     |
| 5   | **Recurring**         | Pick several days; one time for all. Each day is its own occurrence and is answered separately. Moving a day keeps everyone's answers on the days that didn't move.                                                                                                                      | `/plans`                                     |
| 6   | **Invitations**       | _Everyone_ or _selected coworkers_ (people who chose to be seen). A selected plan, its answers, its thread and its photos exist only for the organiser and invitees. _I'm in · Maybe · Can't make it_, with counts; seen people are named, hidden people are counted (“+1 more”).        | `/plans`, home                               |
| 7   | **Explore Vancouver** | Six shelves from Atlas (Discovery's corpus): restaurants, coffee, drinks, walks & waterfront, sights, do something together. Photographed first, straight-line walk from the venue or a chosen meeting place or _where I am now_ (not kept). _Plan this_ and _Add to a plan_.            | `/discover`                                  |
| 8   | **Lunch & dinner**    | Suggest places (from Explore), one vote each, the organiser chooses; directions to the venue and to the meeting point in Google or Apple Maps; the plan's thread for “I'm at the door”.                                                                                                  | `/plans`                                     |
| 9   | **Shared memories**   | Upload (shrunk on the phone), caption, attach to a plan, browse, react, download (named file), delete your own; organisers can take one down. Private to the conference, served only through a members-only route.                                                                       | `/memories`                                  |
| 10  | **Reminders**         | “Morning walk starts in 30 minutes.” / “Your lunch group meets at 12:30.” Only for plans you said _I'm in_ to; at most two per occurrence (`today`, `soon`); never repeated across reloads or tabs; optional device notification while Conference is open.                               | everywhere `Reminders` sits                  |
| 11  | **Conference home**   | Same hero and colours. Then: _What's happening_ (next plans, one-tap answer, where we meet), quick actions, _Who's here_ (arrivals, seen people, who's sharing), the chat's last words, _What we've done together_ (recent photos), _Good nearby_ (photographed places), modules, You.   | `/conferences/{id}`                          |

Screenshots from the passing run are in [`together/`](together/).

## 2. Reused from Hockey Night, and what wasn't

Hockey's _tables_ (`passport_occasion_*`) are not reused: they live only as
SQL in `docs/product/hockey/`, are keyed to occasions and auth user ids, and
run through the Experience Lab engine. Putting a conference on them would give
one group two memberships — exactly what ADR 009 forbids. Everything that
could be reused without that was:

| From Hockey                                                                  | Used as                                                                                |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Chat shape: row per message, row per person per reaction, toggle, member RLS | `passport_conference_messages` / `_message_reactions`, same rules                      |
| `useSharedNight` visible-tab polling with a generation guard                 | `usePoll.ts` (generalised)                                                             |
| `domain/hockey/memories.ts` `PhotoInputSchema`, `PHOTO_EDGE_PX`, size caps   | imported directly; table shape `passport_conference_photos` is Hockey's                |
| `Memories.tsx` `shrink()` (private there)                                    | lifted unchanged to `lib/image/shrinkPhoto.ts`; Hockey can import it and drop its copy |
| Members-only photo bytes route (`private`, `nosniff`)                        | `/api/conferences/[id]/memories/[photoId]`, plus `?download=1`                         |
| `domain/hockey/directions.ts` (`walkingLinks`, `preferredOrder`)             | imported directly, `Directions.tsx`                                                    |
| `domain/hockey/nearby.ts` `nearbyImage` (Passport's photo rule)              | imported directly by Explore                                                           |
| `VenueCard.tsx` `PlanPhoto` (refuses logos/icons on load)                    | imported directly on every place picture                                               |
| Shared curated Vancouver list (`collections/vancouver.ts`)                   | fallback places and meeting-point ideas                                                |
| Arena Mode's consent shape (window, purge, vanish any time)                  | Find my people (with coordinates; see ADR 011)                                         |
| Security model: as the signed-in person, definer helpers, explicit grants    | the whole migration                                                                    |

**Not modified:** any file under `src/**/hockey/`, `docs/product/hockey/`, or
the Hockey worktree. Moving the reused pieces out of `hockey/` folders into a
shared place is the next coordinated step, for the Hockey lane to agree to.

## 3. How it is built

```
src/domain/conference-plans/     types, plan input, views (privacy), reminders, time zones
src/domain/conference-chat/      message rules and room view
src/domain/conference-people/    share rules, rounding, who's on the map
src/domain/conference-memories/  album view, reactions, download names
src/domain/conference-explore/   shelves from Atlas's own words
src/domain/conference-arrivals/digest.ts   landed / next / timeline / together
src/lib/conference-{plans,chat,people,memories}/   service + memory store + Supabase store
src/lib/conference-explore/places.ts   bounded Atlas read, place lookup, anchors
src/lib/conference-together/      enabled flag, request deps, page helper, replies
src/app/conferences/[id]/{plans,chat,people,memories,discover,community}/
src/app/api/conferences/[id]/{plans,chat,people,memories,explore}/
src/components/conference-together/
```

- **Module contract kept.** Each module checks membership through the
  foundation (`homeFor`), keys data on `(conferenceId, memberId)`, registers a
  `ConferenceLifecycle` (`lifecycle.ts`), and answers strangers 404.
- **Foundation edits (named):** `MODULE_IDS` gains `people` and `memories`;
  the registry flips `plans` and `community` to built; the create form ticks
  every built module except chat by default (VISION §7: chat “optional and off
  by default” — still a lean, not a decision). `readArrivals` gained a
  `refresh=false` option so the home page reads stored flights without calling
  ADS-B.
- **Realtime is polling** (4–15 s, only while visible), as Hockey ships. The
  local stack has no Supabase Realtime; swapping it in later changes
  `usePoll` only.
- **Places are ids.** Plans store a curated or Atlas id and the name the
  person saw; facts (photo, address, coordinates) are resolved on read, with
  a 1.5–2.5 s budget so a slow Atlas costs a photograph, not the page.

## 4. Database migration

**`supabase/migrations/20261023000000_passport_conference_together.sql`** —
11 tables, 37 policies, 12 definer helpers, explicit grants. Depends on
`20261012000000_passport_conferences.sql` and `20261016000000_passport_conference_grants.sql`.
Idempotent (applied twice locally: no change).

Owner steps, in order, when it is time:

1. Conference migrations already applied in production? (`select count(*) from
pg_tables where tablename like 'passport_conference_%'` ≥ 4.) Production
   lacked `passport_conference_arrivals` on 2026-10-21; apply those first.
2. Paste the together migration into the Supabase SQL editor (never
   `supabase db push`; supabase/README.md hazard 1).
3. Check `select count(*) from pg_policies where tablename like
'passport_conference_%'` rose by 37 (to 48 with the earlier conference migrations).
4. Set `CONFERENCE_TOGETHER=on` on Vercel. Without it the four modules say
   “isn't open yet” and nothing touches the new tables.
5. Existing conferences keep their stored module list: an organiser ticks
   Plans, Chat, Find my people and Memories in _Organiser settings_.

Rollback: unset `CONFERENCE_TOGETHER` (code stops reading the tables at once);
the tables can then be dropped, children first, with no effect on conferences
or arrivals.

## 5. Verified

| Check                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Result                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `together.spec.ts` — five real accounts (organiser, phone, coworker, hidden member, stranger): arrivals coordination → recurring walk → per-day RSVPs → hidden counted not named → invite-only lunch, suggestions, vote, choose, directions → chat room, reaction, private thread → share, find, stop → Explore → Plan this → reminder once → photo, react, download, delete → home answers five questions → leaving erases everything; strangers 404 everywhere; 390 px pages never scroll sideways | **passes**, twice in a row, on a fresh stack |
| `together-attack.mjs` — straight at PostgREST with real JWTs                                                                                                                                                                                                                                                                                                                                                                                                                                         | **76/76**                                    |
| `rls-attack.mjs`, `arrivals-attack.mjs` with the new migration present                                                                                                                                                                                                                                                                                                                                                                                                                               | 68/68, 33/33                                 |
| vitest (incl. `together.test.ts` 17, `digest.test.ts` 3, `explore.test.ts` 2)                                                                                                                                                                                                                                                                                                                                                                                                                        | 3,668 passed, 0 failed                       |
| tsc, eslint (0 errors), prettier, `next build`                                                                                                                                                                                                                                                                                                                                                                                                                                                       | clean                                        |

Two real defects were found by running it, not by reading it: the plans read
policy refused `insert … returning` (it re-read the row through a definer
function that couldn't see it yet), and an organiser could delete a photo of
a private plan they weren't invited to. Both fixed in the migration, both
pinned by the attack script.

To rerun (ports 547xx and 3160 were free on Metatron on 2026-10-23):

```
S=~/passport/scratch/together-stack   # bin/ and node_modules/ symlinked from ~/passport/scratch/hockey-stack
STACK=$S PG_PORT=54729 AUTH_PORT=54741 REST_PORT=54742 PROXY_PORT=54721 SITE_URL=http://localhost:3160 \
  node scripts/conference-stack/stack.mjs start
node docs/product/hockey/verification/atlas-seats-stub.mjs ~/passport/scratch/hockey-m/atlas-real.json 54760 &
set -a; . $S/env; set +a
CONFERENCE_STORE=supabase CONFERENCE_ARRIVALS=on CONFERENCE_TOGETHER=on ATLAS_API_URL=http://127.0.0.1:54760 npm run build
ADSB_LOL_API_URL=http://127.0.0.1:9 ADSB_LOL_ROUTES_URL=http://127.0.0.1:9 CONFERENCE_STORE=supabase \
  CONFERENCE_ARRIVALS=on CONFERENCE_TOGETHER=on ATLAS_API_URL=http://127.0.0.1:54760 npx next start -p 3160
STACK=$S node scripts/conference-stack/together-attack.mjs
E2E_PORT=3160 npx playwright test -c scripts/conference-stack together
```

`acceptance.spec.ts` in the same folder expects Arrivals **closed**, so it
needs a server without `CONFERENCE_ARRIVALS=on`.

## 6. Gaps, honestly

- **Atlas has no cafés near the venue.** In the saved production body (3,028
  candidates) there is no café, coffee shop or bakery with coordinates within
  15 km of the convention centre, and no Activity or Experience with
  coordinates nearby. So _Coffee_ and _Do something together_ say “nothing
  within a walk”, and the coffee-plan picker falls back to restaurants. An
  Atlas ingestion gap to report (doctrine §15.15), not something to invent.
- **Some Atlas photographs don't load or aren't photographs**; those cards
  get the designed placeholder (Hockey's rule). Several restaurant options in
  the vote showed none.
- **Reminders reach an open Conference only.** No push service exists in
  Passport (no service worker, no web-push keys, no email). A closed app
  hears nothing.
- **Find my people updates only while its page is open** (by design), and
  others see changes on their next poll (≤ 5 s). Revocation at the source is
  immediate.
- **“Memories remain available after the conference ends”** holds for the
  conference's retention window (30 days after its last day, ARCHITECTURE
  §7), then everything is erased with the conference. Keeping an album longer
  conflicts with that rule and is **not decided** here. Download is the way
  to keep a photo today.
- **Explore's “where I am now”** sends a point rounded to ~1 km for one
  answer and keeps nothing (ADR 002 unchanged).
- **Model-free.** No AI in these modules; nothing here needed it.
- **Not built:** per-occurrence times (one time for all days), waitlists or
  capacity, plan comments other than its thread, cross-conference memories,
  guest (no-account) participation on the durable store.
- **Repo-wide Playwright** (memory mode, critic Atlas mock): 249 passed, 5 failed, 5 skipped. All five are on failure lists recorded by earlier missions (not re-run on d8a1c0a here): core-loop:26, october:554, october:570 (the long-standing baseline), conference-mobile:23 (`/labs` has no Conference link) and discovery-natural:102.

## 7. Doctrine and earlier documents — named, not resolved

| Where                                                   | What this work does                                                                                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR 002, VISION §6 (“never a person's location”)        | Overturned **for Find my people only**, by the owner's brief; recorded in ADR 011.                                                                      |
| VISION §7 (chat optional, off by default)               | Kept: chat is off in a new conference until the organiser ticks it.                                                                                     |
| ARCHITECTURE §7 / retention vs “memories remain”        | Kept the 30-day erasure; longer keeping is open (above).                                                                                                |
| ADR 009 (one group foundation)                          | Conference stays on `passport_conference_*`; four modules' worth of tables were added there, not on `passport_adventures`, which neither lane uses yet. |
| Doctrine §2.2 / §15.14 (want / plan / lived vocabulary) | _I'm in · Maybe · Can't make it_ are this module's words for one plan, not Passport's general vocabulary.                                               |
| Doctrine §6 (less phone)                                | Reminders only for _I'm in_, at most two per occurrence; polling only while visible; chat's empty state says “then put the phone away”.                 |
| Doctrine §15.12 (how group experiences work)            | Informed, not answered: this is one composition for one kind of group.                                                                                  |
