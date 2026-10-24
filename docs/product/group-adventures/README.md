# Group adventures: one foundation for doing things together

**Status:** implemented and verified on lane `boards`, 2026-10-12. The
migration is **proposed, not applied** anywhere real. The decision is recorded in
`docs/architecture/decisions/009-one-group-foundation.md`.

> Atlas knows what's out there. Passport knows who's going, what they're doing,
> and who they're doing it with.

An **adventure** is any group thing in Passport: a Hockey Night, a conference, a
day out, a birthday, a weekend. The core gives each one the same pieces:

- an owner and participants
- invitation links
- removal and leaving
- a shared plan
- people's answers on it

Kind-specific facts live in typed extension tables. The core never learns what a
flight number or a hockey game is.

The name is "adventure", not "experience", for two reasons:

- `Experience` already means an Atlas entity in code (`src/domain/experience`).
- "Experiences" already means October, Skiing and the others in the doctrine
  (§10).

A third meaning would make every conversation ambiguous. The name is a product
decision and can be changed. A rename is mechanical.

---

## 1. What already existed

Three membership and invitation systems, built independently:

| System     | Tables (where)                                                                                              | Container                                    | Invites                                                                             | Status                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Boards     | `passport_board_members`, `_invites`, `_events` (baseline)                                                  | Atlas `boards` row (owner-scoped Atlas REST) | Token in plaintext, multi-use, editor/viewer                                        | **Live in production**                                    |
| Hockey     | `passport_occasion_*`, 10 tables (`feature/hockey`, `docs/product/hockey/migration.sql`)                    | Passport row, `template` + `details` jsonb   | SHA-256, single-use by default, host/guest                                          | Proposed; verified on a local stack (48 RLS checks)       |
| Conference | `passport_conference_*`, 4 tables (`release/conference-labs-rc`, `20261012000000_passport_conferences.sql`) | Passport row, `details` jsonb                | Plaintext, `max_uses`, typed join codes, organiser/member, hidden-by-default roster | In a release-candidate migration; arrivals in memory only |

**Implemented more than once:**

- the membership table and its role helper
- the SECURITY DEFINER "is member" / "role of" functions
- invite creation, description and redemption
- leave and remove
- "who can see the roster"
- a local verification stack (`stack.mjs` exists in hockey _and_ conference, and now here)

Conference's own `ARCHITECTURE.md §2` names the problem and asks for a
decision. It warns: "do not merge both into `main`".

**Board-side group work (lane `boards`, 62e9900 and f5e20a6):**

- interest marks (`passport_board_interest`)
- shared `/go` days (`passport_board_plans`)
- leave (`members/me`)
- a gathering declared in code (`GATHERINGS`)

All of it is proposed SQL; none of it is migrated.

**Can Hockey and Conference already support independent groups?** In their
schemas, yes. Every row on both branches is keyed per occasion or conference.

- **Hockey's content is hardcoded to one game.** `createSycleNight` always
  writes `SYCLE_HOCKEY_NIGHT`.
- **Conference supports many independent conferences**, created at
  `/conferences/new`.

The problem was never "groups cannot be independent". It is that each product
was about to ship its own copy of the same core.

## 2. What was built

### Data model (`migration.sql`)

```
passport_adventures            id (text), kind, title, owner_id, optional days,
                               time zone, destination label + town id, timestamps
passport_adventure_members     (adventure_id, user_id), member_id (random, the only
                               id a browser sees), role owner|participant,
                               display_name, visibility members|hidden
passport_adventure_invites     token_hash (SHA-256), label, max_uses (NULL = open),
                               uses, expires_at, revoked_at
passport_adventure_removals    who an owner removed, when — read only by redeem
passport_adventure_items       the shared plan: atlas_ref | label | note,
                               proposed|confirmed, day, time, position, added_by
passport_adventure_responses   (item, person) → in | maybe | out
passport_adventure_days        a planned day: how it was asked for (the /go
                               day query without stops); owner writes (ADR 010)
passport_adventure_hockey      TYPED EXTENSION, 1:1: puck drop, teams,
                               arena atlas_ref and/or label
```

**Why `id` is text:** Hockey's uuids and Conference's 12-character ids can be
carried across unchanged. New ids are 32 random hex characters, so they are not
guessable either.

**Why the `kind` vocabulary is open:** it is validated by pattern, so a new kind
needs no migration. The list lives in code (`src/lib/adventures/kinds.ts`).

### Security (all enforced by Postgres)

- **Every table has RLS, and `anon` holds no privileges on any of them.** The
  app talks to PostgREST as the signed-in person. No service-role key is used.
- **Membership can't be written directly.** Adventures and owner rows come only
  from `passport_create_adventure`. Participant rows come only from
  `passport_redeem_adventure_invite`. Neither table has an INSERT grant or
  policy, so nobody can write themselves into a group. The boards baseline
  can't say that; see §6.
- **Owner:** edits the adventure, invites, removes participants, confirms and
  edits any item, deletes the adventure.
- **Participant:** reads, proposes items in their own name, edits or withdraws
  their own proposals while they are still proposals, answers for themselves,
  and leaves.
- **Column grants pin what can change.** Nobody can change a kind, an owner, a
  role, an item's adventure or an invite's `uses`.
- **A link reveals only its state and kind.** It never shows the title, the
  owner or who is in.
- **Removal sticks.** A person the owner removed can't come back through any
  link made before the removal. Leaving voluntarily doesn't block a return.
- **Leaving or removal takes the person's answers with them.** Items they
  proposed stay with the group.
- **The roster:** you always see yourself and the owner sees everyone. Members
  see the members who chose `visibility = 'members'`. The default comes from
  the kind; for a conference that default is unlisted, matching the conference
  lane's rule.

### Application API (`src/lib/adventures/store.ts`)

Every function takes the caller's Supabase client, so the same code runs:

- in route handlers, as the cookie session;
- in tests, as real GoTrue users;
- in any future native or voice client holding the same JWT.

The functions:

- `createAdventure`, `adventuresOf`, `adventureFor`, `updateAdventure`, `deleteAdventure`
- `createInvite`, `invitesOf`, `revokeInvite`, `describeInvite`, `redeemInvite`
- `removeMember`, `updateMe`
- `addItem`, `updateItem`, `removeItem`, `respond`
- `setHockeyFacts`

A write that Postgres silently refuses (zero rows changed) is `Refused`, never
success.

### HTTP routes

| Route                                                      | What                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| `GET/POST /api/adventures`                                 | mine / start one (`kind`, `title`, optional days, place, `hockey`) |
| `GET/PATCH/DELETE /api/adventures/{id}`                    | view / owner edits / owner deletes                                 |
| `GET/POST/DELETE /api/adventures/{id}/invites`             | owner: list / make (single-use default) / `?invite=` revoke        |
| `POST /api/adventures/join`                                | `{token, visibility?}`: 401 signed out, 410 dead link              |
| `DELETE/PATCH /api/adventures/{id}/members/{memberId\|me}` | remove or leave / change your name or listing                      |
| `POST /api/adventures/{id}/items`                          | propose (or add confirmed, owner)                                  |
| `PATCH/DELETE /api/adventures/{id}/items/{itemId}`         | confirm or edit / withdraw                                         |
| `PUT /api/adventures/{id}/items/{itemId}/response`         | `{response: in\|maybe\|out\|null}`                                 |
| `PUT /api/adventures/{id}/hockey`                          | the hockey extension (owner; hockey nights only)                   |

`404` covers "missing" and "not yours" alike. `503` means Passport couldn't
ask, which is different from no.

### UI

- `/adventures`: your adventures, and a form to start one.
- `/adventures/{id}`: the facts, the plan (`AdventurePlan`), and who's going
  plus invitations (`AdventurePeople`).
- `/adventures/join/{token}`: the invite landing. It says what kind of thing
  the invite is for and nothing else, and sign-in returns to it.

The components are kind-agnostic. **The pages are a reference composition, not
a claim about how Hockey or Conference must look** (doctrine §10: "shared
capability is not shared UI").

## 3. Atlas and Passport

**An item holds an Atlas id (`atlas_ref`), never a copy of Atlas knowledge.**
The page asks Atlas for names (`atlas-names.ts`, the same reads the board page
uses). When Atlas is down, the page says "can't name right now".

**Two adventures can point at the same entity and stay strangers.** The
acceptance suite has two hockey nights on one arena reference.

**`label` is the group's own words**, for something Atlas doesn't hold yet.
Rogers Arena isn't an Atlas entity today; see the hockey README.

**Membership is independent of Atlas.** No core table references Atlas, and the
whole suite runs with no Atlas at all.

**Boards are different on purpose:** a board's container _is_ an Atlas row.
That arrangement was already live and is left as it is (§6).

## 4. Integration plans

### Hockey (`feature/hockey`, M216). Adopt incrementally; do not rewrite the night.

Hockey's `passport_occasion_*` core is the same shape as this one. Its game
mechanics are its own and stay its own: prompts, sealed answers, cues, options,
moments, reactions and the brief.

1. **Membership.** Make `passport_occasion_members` an extension keyed by
   adventure. Then:
   - the host is `role = 'owner'` on `passport_adventure_members`;
   - per-night presentation (`emoji`, `hue`, `vibe`, `edge`) moves to
     `passport_adventure_hockey_members (adventure_id, user_id, emoji, hue,
vibe, edge)`;
   - `passport_occasion_role` / `passport_is_occasion_member` become thin
     wrappers over `passport_adventure_role` / `passport_is_adventure_member`,
     so its 25 policies keep working unchanged.
2. **Ids.** `occasion_id uuid` → `adventure_id text`, holding `uuid::text`.
   Existing `/hockey/{uuid}` URLs keep resolving, because the id _is_ the uuid.
3. **Invites.** Hockey's invites already store SHA-256 hashes, so rows copy
   across into `passport_adventure_invites` as they are (`max_uses` → `max_uses`)
   and links already sent keep working. `passport_redeem_occasion_invite`'s emoji
   ring becomes a step after `passport_redeem_adventure_invite`.
4. **Night facts.** `starts_at`, `details.opponent`, `details.venue` and
   `venueAt` move to `passport_adventure_hockey`, and `template` to `kind`
   (`hockey-night`).
   - `venueAt` coordinates are Atlas's knowledge. Prefer an `arena_atlas_ref`
     once Atlas has the arena; until then, keep the coordinates in Hockey's
     extension, not the core.
5. **Nominated places.** `passport_occasion_options.place` (Atlas id + name +
   distance) stays Hockey's: it is a poll option. The _winner_ can be written
   to `passport_adventure_items` as a confirmed item with `atlas_ref`. That is
   the thing Hockey's README says is missing today ("the winning place is not
   written to any itinerary").
6. **New nights first.** Write new nights through `createAdventure` plus the
   hockey extension, and migrate existing nights in one SQL statement after
   that. No release blocks on this.

**What Hockey can use immediately, with no Hockey code changed:**

- `/adventures` with kind Hockey Night, any game: a second, third or fourth
  night with different people. Today's `/hockey` can only start Sycle's game.
- Invitations and removal.
- A shared plan referencing the arena.

### Conference (`release/conference-labs-rc` and `conference/live`). Do not block the Labs release.

Conference's model is closest to this one and was a direct input: hidden-by-default
rosters, random `member_id`, `max_uses`. Conference keeps:

- typed join codes (`passport_conference_codes`)
- `retain_until` purge
- branding
- module selection
- arrivals

These are conference concerns. They become extensions keyed by `adventure_id`.

1. **Ids.** `passport_conferences.id` (text, 8–64 characters) →
   `passport_adventures.id` with the same value. `/conferences/{id}` URLs keep
   working.
2. **Details.** `details` jsonb splits in two:
   - `name`, `startsOn`, `endsOn`, `timeZone`, `place.label` and
     `place.townId` → core columns;
   - `kind`, `tagline`, `welcome`, `branding` and `modules` →
     `passport_adventure_conference (adventure_id PK, subtype, tagline, welcome,
accent, modules text[], retain_until)`.
3. **Members.** Map Conference's roles: `organiser` → `owner`, and `member` →
   `participant`. `member_id`, `display_name` and `visibility` map one-to-one;
   these columns were modelled on Conference's. Conference's `via` column
   (`created`/`code`/`link`) has no core equivalent; keep it in the
   conference extension if it is still wanted.
4. **Invites.** Conference stores plaintext tokens. Migrate with
   `token_hash = encode(sha256(convert_to(token,'UTF8')),'hex')` so links
   already sent keep working, then drop the plaintext.
5. **Codes.** A code redeem function in the conference extension calls the
   same member insert as invite redemption. The core needs nothing new.
6. **Arrivals and flights.** These are in memory today (`ARRIVALS_STORE_DURABLE
= false`). The first durable table should be the per-person extension
   pattern:

   ```sql
   create table passport_adventure_arrivals (
     adventure_id text references passport_adventures(id) on delete cascade,
     user_id uuid references auth.users(id) on delete cascade,
     flight_ident text, flight_date date, shared boolean not null default false,
     primary key (adventure_id, user_id));
   -- read: own row, or shared and the author is listed and the reader is a member
   -- write: own row, member
   ```

   Nothing in the core changes for it.

7. **Meetups.** These are items on the plan, with `on_day` and `starts_at`.

**What Conference can use immediately:**

- Starting a conference at `/adventures`, inviting colleagues, an unlisted
  roster by default, and a shared plan with in/maybe/out.
- A durable home for arrivals (point 6), once a migration adds it.

### Go Have A Day

A day built in `/go` is a list of Atlas stops. To take it to a group:

- **The day itself:** create a `day` adventure (or use an existing one) and add
  each stop as an item with `atlas_ref`, `position` and `starts_at`. The
  Day Builder stays the Day Builder. The adventure holds the group's copy of
  _which_ stops, never what Atlas knows about them.
- **The print link** (`passport_board_plans.day_query` on lane `boards`) can
  become an item `note`, or a small `passport_adventure_day` extension holding
  the canonical `/go/print` query, if re-running the guide is wanted.

### Boards

**Boards stay as they are.** They are live, their containers are Atlas rows,
and nothing here changes them. There are now two ways to share in Passport:

- **sharing a collection**: a board;
- **doing something together**: an adventure.

That split is named here rather than hidden. Whether board sharing should
eventually become an adventure with an attached board is open.

The board-side proposals from 62e9900 and f5e20a6 (interest marks, shared days,
self-leave) overlap with items, responses and leave here. **Pick one before
either migrates.** The recommendation is to keep the board-side ones for
boards, and use adventures for anything that has a group, a date or a plan.

## 5. Adding a new kind of adventure (the Discovery path)

1. Add an entry to `ADVENTURE_KINDS` (`src/lib/adventures/kinds.ts`): an id
   matching `^[a-z][a-z0-9-]{1,39}$`, a label, a blurb, and the roster
   default. **That's a working kind.** No migration and no new permission code:
   membership, invitations, removal, the plan and responses all work.
2. **Facts the core doesn't have?** Add one table keyed by `adventure_id`,
   cascading with it, and copy the `passport_adventure_hockey` block from the
   end of `migration.sql`:
   - **read:** `passport_is_adventure_member`;
   - **write:** `passport_is_adventure_owner`, plus a kind check;
   - **per-person facts:** key the table `(adventure_id, user_id)` instead,
     with own-row policies.

   Then add a route like `/api/adventures/{id}/hockey`.

3. **Your own page?** Compose `AdventurePlan` and `AdventurePeople`, or build
   your own UI over `store.ts`. The core doesn't dictate the page.
4. **Starting from a Discovery card:** `POST /api/adventures`, then
   `POST /api/adventures/{id}/items {atlasRef}`.

**What a kind must never do:**

- add its own membership or invite table;
- read people's rows with a service key;
- put people in Atlas.

## 6. Live security holes found in boards (not in this foundation)

`accessToBoard` asks Atlas for a shared board **on behalf of the
`board_owner_id` the membership row names**. Whoever can write a row or invite
naming somebody reaches that person's Atlas board. Two baseline policies,
**live in production**, let a stranger do that:

1. **Claiming a shared board.** `passport_board_members_self_claim` lets any
   signed-in person insert an `owner` row for **any** board id. They then read
   its members, invites, events and interest, and mint invites.
2. **Naming somebody else as owner.** The owner-writes policies on members and
   invites never pin `board_owner_id`. Self-claim a board nobody is on yet,
   then repoint your own row at the real owner, or mint an invite naming them:
   `accessToBoard` serves the real board to you, or to whoever redeems it, with
   read and write access.

**What it takes:** a board id and its owner's user id. A member the owner
removed has both.

**First shares are refused today.** `ensureOwnerMembership`'s upsert is always
refused for a board with no rows: Postgres applies the SELECT policy to an
upsert's new row, and the policy can't see a row not yet written. The error is
swallowed, so the invite that follows fails its owner check. A plain insert,
which an attacker can send, passes. So in production most boards probably have
no rows, which makes hole 2 reachable on most boards. This is a product bug, separate from the security fix. Its fix needs an app deploy; the security fix does not.

- **Proven** against the baseline: `src/lib/data/boards-claim.stack.test.ts`
  (hole 1). `src/lib/data/boards-owner-forgery.stack.test.ts` proves hole 2
  against the first fix (d1ba0be), which closed hole 1 only:
  `BOARDS_FIX_SQL=<that version>` makes it fail.
- **Fix:** `boards-owner-claim-fix.sql`, SQL only, one transaction, idempotent,
  changes no rows. An owner row may be self-claimed only for a board nobody is
  on yet, and every row or invite an owner writes must name the writer as
  owner.
- **Verified:** both holes are refused, while the owner's own sharing still
  works (owner row, upsert, invite, redeem, revoke, remove). Each new clause is
  mutation-checked: drop either and the suite fails.
- **Residual:** somebody who learns the id of a board nobody is on can still
  pre-claim it in their own name. That reaches nothing, but it stops the real
  owner sharing it. This is denial, not disclosure.
- **Audit:** `boards-ownership-audit.sql`, read-only. Run it before and after.
  It has no false positives on genuine sharing, and it flags several owners,
  owner rows that name someone else, member rows and invites that name a
  non-owner, and live forged invites.

**Apply it independently of everything else here.** It is a shared contract,
so it is proposed rather than applied.

## 7. Verification

Prerequisites: no Docker, no cloud, and nothing deployable.

- **Binaries** (GoTrue, PostgREST, embedded-postgres) are copied from a hockey
  stack: `cp -r /tmp/hockey-stack/{bin,node_modules,package.json}
/tmp/adventures-stack/`.
- **Ports:** this stack uses 555xx. Hockey uses 543xx and Conference 544xx.

```bash
node docs/product/group-adventures/verification/stack.mjs start   # applies baseline + migration twice
ADVENTURES_STACK_ENV=/tmp/adventures-stack/env \
  npx vitest run src/lib/data/boards-claim.stack.test.ts   # first: needs the bare baseline
ADVENTURES_STACK_ENV=/tmp/adventures-stack/env \
  npx vitest run src/lib/data/boards-owner-forgery.stack.test.ts src/lib/adventures/acceptance.stack.test.ts

# Browser, through the real app (NEXT_PUBLIC_* are inlined at build):
set -a; . /tmp/adventures-stack/env; set +a; export ATLAS_API_URL=http://127.0.0.1:9
npm run build && npx next start -p 3126 &
E2E_PORT=3126 npx playwright test -c docs/product/group-adventures/verification
node docs/product/group-adventures/verification/stack.mjs stop
```

- `ATLAS_API_URL` must be set: its default, `localhost:3000`, is another service
  on Metatron.
- **ADR 012 (2026-10-23)** adds `extraordinary.spec.ts` (the brief's scenarios
  A–F, 320/375/390 px, touch targets, keyboard; `E2E_ATLAS_DOWN=1` against a
  server with no Atlas for the last one) and `src/lib/adventures/origin.stack.test.ts`
  (suggestions, Undo, swap, and the `origin` column's RLS). `stack.mjs` applies
  the origin migration too; `ADVENTURES_WITHOUT_ORIGIN=1` leaves it out to prove
  the fallback. See `docs/product/adventures/RELEASE.md`.
- The boards-claim suite applies the fix to the stack, so its "hole" half runs
  only on a freshly started stack.

**What the suites prove** (Alice, Bob and Charlie are real GoTrue accounts and
nothing is mocked):

- Alice creates Hockey Night A; Bob joins through a single-use link; both see
  it.
- Bob proposes and answers. He can't confirm, invite, remove, rename or delete.
- Charlie creates Hockey Night B on the same Atlas arena.
  - He can't read A through any of the six tables, or through the API.
  - He can't write to A in any way.
  - Alice can't read or edit B.
- Alice is in A and C at once. Bob joining A gives him nothing in C until he
  joins C. One person owns several adventures and is a participant in several.
- **Invitations:**
  - a spent link is dead for others and idempotent for the person who used it;
  - mangled, revoked and expired links fail;
  - `uses` can't be reset by hand.
- **Removal:** a removed member loses access at once, through all six tables.
  Neither the open link nor his old link gets him back. A new link does.
  Leaving is self-service.
- **Unauthorised access fails:**
  - **anon:** gets 42501 on every table, and can't create or redeem;
  - **forged rows:** forged adventures, owner claims and items or answers in
    another person's name;
  - **escalation:** self-promotion, owner or kind changes, moving items between
    adventures, reading the removal ledger.
- **Restart:** state survives restarting Postgres, GoTrue and PostgREST on the
  same data. People sign in again by password.
- **Browser:** the whole Alice → link → Bob signs up → joins → proposes → Alice
  confirms → Charlie gets "Not found" and a dead link → visitor gets 401 →
  Bob removed flow, through `/auth`.
- **Mutation-checked.** With the items read policy weakened, 3 tests fail;
  with the removal ledger removed, 1 fails.

## 8. Open — named, not resolved

- **Answer vocabulary.** `in | maybe | out` is the group-chat vocabulary and is
  **provisional**. It does not answer the doctrine's WANTED / PLANNED / DID
  question (§15.14), or whether a group plan needs a stronger commitment state
  (§2.6).
- **Co-owners.** There is one owner. A conference may want several organisers;
  a third role is a decision, and the role check is the only place it would
  land.
- **Transferring ownership.** There is none. An owner can't leave, only delete.
- **Who may invite.** Owner only, the same open question the boards record
  names.
- **What a link reveals.** Kind only. Conference's landing shows the
  conference's details; Hockey's shows nothing. This picks the middle; either
  lane may want more.
- **Retention.** There is no automatic expiry. Conference's `retain_until`
  purge belongs in its extension, or in core if every kind wants it.
- **Realtime.** `passport_events.resource_type` is CHECK-limited to `'board'`,
  so adventures don't stream changes. Allowing `'adventure'` is a one-line
  contract change; until then, pages re-read on refresh.
- **Navigation.** `/adventures` isn't in `PassportNav` (shell is a shared
  contract).
