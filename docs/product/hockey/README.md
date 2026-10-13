# Sycle Hockey Night — the private, shared one (M216)

**Status (2026-10-11):** first acceptance milestone working end to end with
real authentication, on a local stack. **Not deployed. Not migrated.** Two
human steps stand between this and sending invitations — see
[Before invitations can be sent](#before-invitations-can-be-sent).

The night: **Sunday 25 October 2026, Canucks vs Wild, Rogers Arena, 7:00pm
Pacific** (`2026-10-26T02:00Z`; PDT ends 1 November).

---

## What already existed

| Found                                                                                      | Where                                                                                          | Used?                                                                                                                  |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Experience Lab** — the Sycle Hockey Night prototype M216 points at                       | `src/experience-lab/` (on `origin/main` as `bd6f596`; `feature/hockey` fast-forwarded onto it) | **Yes — it is the product.** Engine, cards, deck, toy box, voice, quiet mode, leaderboard, feed: all reused unchanged. |
| The lab's own verdict on itself: "Nobody else is really there. Everything is one browser." | `src/experience-lab/README.md`, _What still feels lame_ #4, _Auth implications_                | This mission is that item.                                                                                             |
| `core/store.ts`, built as "the swap point for a server later"                              | `src/experience-lab/core/store.ts`                                                             | Replaced (for this page only) by `useSharedNight`, same interface.                                                     |
| Supabase auth, `currentUser`, `requireUser`, `/auth?next=`                                 | `src/lib/auth/`, `src/app/auth/`                                                               | Yes, unchanged.                                                                                                        |
| Board invites / membership (`passport_board_*`, `SECURITY DEFINER` redeem)                 | `supabase/migrations/…baseline.sql`                                                            | The pattern, not the tables — boards are Atlas-owned objects; a night is not.                                          |
| Discovery's Atlas candidates, the **Eat & drink** intent, `distanceKm`                     | `src/lib/data/atlas-repo.ts`, `src/domain/discovery/intents.ts`, `src/lib/environment/geo.ts`  | Yes — restaurant nominations.                                                                                          |
| `sycle-prototype` branch: a Sycle _arrival board_ (flights, conference code)               | `sycle-prototype` @ `6ae9ab2`                                                                  | No. Different product (a code-gated board for ~160 colleagues); its gate is a shared code, not an identity. Untouched. |
| Any `/hockey` route or hockey domain code                                                  | —                                                                                              | None existed.                                                                                                          |

## Architecture

```
/hockey                      your nights; "Start it" (+ your name)
/hockey/[id]                 the night — HockeyNightScreen (the lab's ExperienceScreen, shared)
/hockey/join/[token]         an invitation
/hockey/api/occasions        GET mine · POST start
/hockey/api/occasions/[id]   GET the night, as I may see it
  /actions                   POST everything a member does (ActionSchema)
  /invites                   host: GET · POST make link · DELETE revoke
  /members/[userId]          DELETE: host removes a guest, or a guest leaves
  /nearby                    food & drink near the venue (Atlas, via Discovery)
/hockey/api/join             POST redeem (needs a session)
```

- **`src/domain/hockey/night.ts` — `composeNight(rows, me)`** turns database
  rows into the lab's own `ExperienceDefinition` + `ExperienceState`. That is
  the whole adapter; everything above it is the lab. The template is the lab
  fixture with every _fact_ removed (fixture people, authored results, last
  March's standings, invented pubs and walk times, "Flames", "Section 302")
  and every piece of _structure and voice_ kept.
- **`useSharedNight`** — drop-in for `useExperienceLab`. Optimistic for cheap
  gestures, then replaced by what the server says; polls every 5s **only while
  the tab is visible** (a phone in a pocket asks nothing — fitting for a
  product whose best screen is "Put your phone away").
- **Generic underneath.** Tables are `passport_occasion_*`, keyed by a
  `template`; nothing in the schema says hockey. A GHAD outing, a concert or a
  birthday is a new template, not a new table. No generic _UI_ was built.

## Authentication and persistence

- **Identity is the Passport account** (`currentUser()` → `auth.uid()`).
  There is no join gate, no "become someone else", no claimed identity.
- **Every query runs as the signed-in person** — anon key + their session,
  never the service role — so RLS is not a backstop behind the server; it is
  what the server _sees_. The server additionally runs the lab engine to refuse
  locked, unconsented or malformed answers (`answerProblem`).
- **Concurrency without overwriting:** one row per person per answer, per
  comment, per reaction. Nobody ever writes a shared blob.
- **Invitations:** 24 random bytes, base64url; only `sha256` is stored; single
  use; expire the morning after the game; revocable. A signed-out visitor
  learns only _that_ a link is valid — not the title, host or guests. Redeeming
  requires a session (`auth.uid()` checked inside the function).
- **Sealed answers are sealed in the database**, by a copy of the lab's reveal
  rules (`passport_occasion_answer_visible`): `immediate`, `onLock` (after lock
  or after you commit your own), `onCue`, `never`. Rules live in a row only the
  host (template) or asker (their question) writes, and cannot be updated.
- **Removal** deletes the membership; the person loses every read and write
  at once, and everything they wrote drops off the page (`composeNight` shows
  members only). Their rows remain in the database — re-inviting restores them.

The migration is **`docs/product/hockey/migration.sql`** — a _proposal_ for
`supabase/migrations/`, which is a shared contract this lane does not change.

## What the night does

All the lab's interactions, shared: the pregame vote (and nominations), the
hard-out vote, seven sealed picks in a deck (final score, first goal,
overtime, total goals, **"Will {host} buy a $19 arena beer before puck
drop?"**, first to complain about the refs, pick-a-side forfeit), the toy box
(predictions, sealed picks, secret missions, dares, side quests, photo
challenges, the vault, group quests, forfeits, "ask the group"), curator
brief, personal edge, consent, feed, reactions, Passport's derived voice,
quiet mode during periods, intermission bursts, leaderboard, awards, receipts,
recap. Plus, new: **guest list**, **call it** (host records results once picks
lock — Passport has no scores feed and will not pretend to), **you tonight**
(name, emoji, a vibe line), **leave**, and **What's near the arena?**

Points are bragging rights only. Nothing involves money.

### Restaurant nominations (Phase 4)

Discovery's own candidates, filtered by Discovery's own **Eat & drink**
subtypes, within 1.6 km of the arena, nearest first — an _offer_, not a
ranking. The client sends only an Atlas id; the server looks the place up and
measures it, so a nomination cannot claim a distance. Labels read
`200 m straight line · 3+ min walk (estimate)`: there is no routing anywhere
in Passport, so nothing is ever called a walking route. Places whose position
Atlas only _derived_, or measured from a town centre, are excluded rather
than given a fictional distance. The winning option is the group's plan; it
is not yet written into an itinerary block (see open items).

## Verification — `verification/`

| What                                                                                                                                                          | Result                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `stack.mjs` — real PostgreSQL + **GoTrue** + **PostgREST** + proxy, Supabase's default grants                                                                 | used by everything below              |
| `rls-attack.mjs` — 48 attacks over PostgREST as real signed-up users                                                                                          | **48/48 refused/correct**             |
| `plan-and-results.spec.ts` — the plan, ties, sealed picks, host-only results (added 2026-10-13)                                                               | **passes, 3/3**                       |
| `acceptance.spec.ts` — two independent browser contexts (desktop host, **mobile** guest), a signed-out visitor, a stranger, the host again in a fresh session | **passes, 7 of 7 runs**               |
| `src/domain/hockey/*.test.ts`                                                                                                                                 | 22/22                                 |
| Migration applied twice                                                                                                                                       | no change (25 policies, RLS on 10/10) |

The acceptance run covers: start → invite → signed-out visitor sees nothing →
guest signs up _through the link_ → joins → both see one roster → simultaneous
votes → nomination appears on the other screen → banter both ways → server
snapshots agree, with attribution → sealed pick invisible to the other →
forged `actorId` ignored, guest cannot set the brief or call results →
reload → fresh session → stranger gets 404 everywhere → forwarded link dead →
host removes guest → guest's open page leaves within one poll → 404 →
guest's comments gone from the host's page.

The **places** in that run come from `atlas-stub.mjs` (every name says
"(synthetic)"). The wiring is proven; the data is not.

To rerun: `node verification/stack.mjs start`, `node verification/atlas-stub.mjs &`,
build and `next start -p 3130` with `/tmp/hockey-stack/env` and
`ATLAS_API_URL=http://127.0.0.1:54340` exported, then
`E2E_PORT=3130 npx playwright test -c docs/product/hockey/verification`.
**Always set `ATLAS_API_URL`** — its default, `localhost:3000`, is Lodge on Metatron.

## Before invitations can be sent

> **Superseded by [`PRODUCTION-READINESS.md`](PRODUCTION-READINESS.md)** — exact
> migration steps, rollback, deploy sequence, smoke tests, GO/NO-GO. The list
> below is the original summary.

1. **Apply `migration.sql` to the production Supabase project** — by a human,
   in the SQL editor (not `supabase db push`; `supabase/README.md` hazard 1).
   Then the `passport-domain` lane should land it in `supabase/migrations/`.
2. **Merge and deploy** `feature/hockey` — by a human. This lane never deploys.
3. **Check Supabase Auth's redirect allow-list** includes the production
   origin's `/auth/callback`, and decide whether email confirmation is on. If
   it is, a coworker signs up, confirms by email, and lands back on the
   invitation (the `next` is carried through) — this path is **untested**
   here because the local GoTrue auto-confirms.
4. **Smoke test on production with two real accounts** before inviting
   anybody: start, invite yourself on a second account, join, vote.

## Not done, and why

- **"Who said this?"** (`story`/`story-guess`) and the toy box's _people_
  family are withheld. They build questions out of answers nobody may read;
  the lab did that in the browser, which on a shared page would expose every
  author to devtools. Needs server-side materialisation.
- **Photos are captions**, as in the lab. No upload, no storage bucket.
- **Run it back** is hidden rather than shown as a dead button.
- **Live updates are 5-second polling**, not Supabase Realtime.
- **The winning restaurant is not written into an itinerary block.** It is
  now shown to the whole group as **The plan** panel (`plan.ts`: leading dinner
  place and leaving time, ties reported as ties), which stays on the page after
  the pregame vote closes. Still not an itinerary.
- **Atlas knows nowhere to eat near Rogers Arena.** Measured against the
  committed Atlas snapshot `atlas-candidates-2026-10-11.json.gz` (2,979
  candidates, on `lane/vision` @ `f617665`): Metro Vancouver holds 143
  entities and **zero** in Discovery's Eat & drink subtypes; the nearest food
  Atlas has is 256 km away in the Okanagan. Rogers Arena is not an entity
  either (BC Place, 220 m away, is). The filter is not the cause — 358 of 479
  food entities have no location at all, and the located ones are Okanagan.
  So in production today the picker says, honestly, that Passport knows
  nowhere nearby, and the group suggests places by name. **This is an Atlas
  knowledge request, not a Passport fix:** food and drink within ~1.5 km of
  Rogers Arena, with observed coordinates — the lab README's "highest-value
  Atlas request" made concrete, and needed by 25 October to matter.
- **Host is trusted.** The host can move the start time, which moves every
  lock with it. Acceptable for a night among coworkers; named so nobody
  mistakes it for a guarantee.
- **Secret-mission scoring is viewer-dependent** (inherited from the lab):
  people who cannot see a mission do not count its points.

## Doctrine — conflicts named, not resolved

- **§15.12 _How group / multi-person experiences work_ is an open question.**
  M216 explicitly asks for a multiplayer experience, so this builds one — but
  only _this one_. Nothing here answers §15.12 for Passport in general, and
  the doctrine has not been edited to say it does.
- **§14 lists "elaborate social games" as not-now.** The toy box, forfeits
  and secret missions arguably are; they were already built in the lab and
  M216 asks for them by name. Recorded so a human can decide whether the
  doctrine should say so.
- **§10 / §15.1 (theme vs composition).** This is a _distinct composition_
  (the lab's engine) on shared capabilities (auth, Discovery, Atlas). That is
  evidence for (b), not a decision.
- **Lab README, _Auth implications_ #4 — guests without accounts.** M216
  requires authentication for everything, so the lab's "just looking, thanks"
  path does not exist here. Deliberate, per the mission.
