# GO HAVE A CONFERENCE — Architecture

> **Status:** the contracts in §3–§6 are **built** on branch
> `feature/go-have-a-conference` (see [`FEATURES.md`](FEATURES.md)). The
> durable store (§7) and every module except _discover_ are **proposed**.
> §2 is an **open decision** that a human needs to make.

---

## 1. Shape

```
                         ┌──────────────────────────────────────────┐
                         │ passport-conference  (the foundation)    │
                         │  conference · details · branding         │
                         │  identity · membership · visibility      │
                         │  links · codes · admin · module registry │
                         └──────────────┬───────────────────────────┘
                     ConferenceContext  │  ConferenceLifecycle
          ┌──────────────┬──────────────┼──────────────┬──────────────┐
          ▼              ▼              ▼              ▼              ▼
   passport-flights passport-events passport-social passport-groups passport-discovery
   arrivals         schedule        community       plans           discover
   (flights, map,   (activities,    (feed, place    ("anyone        (/go doors,
    countdowns)      featured,       cards, chat)    coming?",       shared map,
                     hockey)                         interests)      between-sessions)
          │              │              │              │              │
          └──────────────┴──── Atlas (places, events, facts) ─────────┘
                               via Passport's existing Atlas boundary
```

**The foundation knows nothing about flights, feeds or hockey.** A module
knows nothing about codes, cookies or who is an organiser beyond the `role`
it is handed. Each workstream can be built, tested and merged without the
others.

---

## 2. The big unresolved question: is a conference a Board?

`lane/boards` (`62e9900`) answered this one way. This foundation answers it
another way. **Neither answer is canonical yet.**

|                       | **Conference = Board** (`lane/boards`)                     | **Conference = its own record** (this foundation)                                                                |
| --------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Membership            | Board members (`passport_board_members`)                   | Conference memberships (one place, many modules)                                                                 |
| Getting in            | Board invite links                                         | Links **and** codes, both expirable or revocable                                                                 |
| Identity              | A Passport account, required                               | A Passport account, **or** a signed guest cookie (§4)                                                            |
| Roles                 | owner / editor / viewer                                    | organiser / member                                                                                               |
| Branding, dates, kind | Declared in code (`GATHERINGS`), plus an env var per board | Data, editable by the organiser                                                                                  |
| Recommendations       | Board items                                                | Proposed: a conference _may own_ a shared board for recommended places (`passport-discovery`), without being one |
| Runs here today       | No. Needs Supabase and Atlas                               | Yes, on the memory store                                                                                         |

**Why this foundation did not just extend Boards.** The brief requires codes,
an admin dashboard, branding, module selection, attendee visibility, data
expiry, and creation by any Passport user. A Board has none of these, and
adding them would turn a sharing feature into an event platform. That is the
exact move `boardAccess.ts` warns against ("the moment they are configurable
this has become an RBAC system"). Sycle also has to be data, and
`GATHERINGS` keeps it in code.

**What `lane/boards` got right, and the modules should keep:**

- facts about an activity are shown only with a `confirmedBy`, otherwise
  _Awaiting confirmation_ (→ `passport-events`)
- interest is stated, members only, named only by choice, counted otherwise
  (→ `passport-groups`)
- user ids never reach the browser (the foundation's `memberId` exists for
  exactly this reason)
- doors into `/go` from the conference's town (→ `passport-discovery`, built
  here the same way)

**Decision needed:** either (a) adopt this foundation and treat `lane/boards`'
gathering work as the seed for `passport-events` and `passport-groups`, or
(b) keep conferences on Boards and fold codes, admin and branding into the
Board model, or (c) something else. Until someone decides, **do not merge
both** into `main`, because that would give Passport two membership systems
for the same group.

---

## 3. Code layout

```
src/domain/conference/        pure: types, validation, policy, views. No I/O.
  types.ts                    Conference, ConferenceDetails, Membership, Invite, IdentityKey…
  details.ts                  zod schema for details; retention; kind wording
  access.ts                   roles, invite states, code format
  views.ts                    what a member sees vs what an organiser sees (privacy lives here)
  modules.ts                  the module registry (§6)
  branding.ts                 safe accent colour and readable ink
  countdown.ts                before / during / after, in the conference's own time zone
  contracts.ts                ConferenceContext, ConferenceViewer, MemberRef, ConferencePlaceRef,
                              ConferenceLifecycle: what modules build against
  fixtures.ts                 Sycle Vancouver 2026 as plain configuration (test fixture)

src/lib/conference/           server: configuration, identity, store, service
  config.ts                   env → open/closed (production never falls back silently)
  identity.ts                 Passport user or signed guest cookie → IdentityKey
  store.ts                    ConferenceStore + memory implementation (purge on read)
  service.ts                  every operation, as functions over (store, identity, input, now)
  lifecycle.ts                modules register forgetMember / forgetConference here
  rate.ts                     brake on guessing codes
  request.ts                  route-handler gate

src/app/conferences/          pages: list · new · join · join/[token] · [id] · [id]/admin · [id]/[module]
src/app/api/conferences/      route handlers (§5)
src/components/conference/    UI
```

**Paths that belong to other workstreams** (they create them; the foundation
never touches them):

```
src/app/conferences/[id]/<module>/           a module's own page; overrides the placeholder route
src/app/api/conferences/[id]/<module>/       a module's own API
src/domain/conference-<module>/              a module's pure logic
src/lib/conference-<module>/                 a module's server code and store
src/components/conference-<module>/          a module's UI
```

A static `[id]/arrivals` folder takes precedence over the foundation's
`[id]/[module]` placeholder in Next's router, so a module goes live by
existing. **No foundation edit is needed** apart from flipping its registry
`status` to `built`.

---

## 4. Identity

```ts
type IdentityKey = `user:${string}` | `guest:${string}`;
```

| Who                     | IdentityKey          | How                                                                               |
| ----------------------- | -------------------- | --------------------------------------------------------------------------------- |
| Signed-in Passport user | `user:<supabase id>` | `currentUser()`, the one identity function Passport has                           |
| Anyone else             | `guest:<uuid>`       | HMAC-signed, httpOnly cookie `passport_guest`, issued when they join a conference |

**Why guests exist.** 160 colleagues who have to make a Passport account
before they can see the welcome page is the wrong first step. The `/sycle`
prototype reached the same conclusion. A link or code is the gate, and the
cookie is the identity.

**What it costs.** Lose the cookie and you lose your membership: a new
phone, or a cleared browser. Linking a guest identity to an account later
(_claim_) is **proposed, not built**.

**Who may create a conference.** A Passport user, always. A guest, only when
`CONFERENCE_GUEST_ORGANISERS=1`, which is the development default because
this checkout has no Supabase. Production defaults to accounts only. **This
is a provisional default, not a product decision.** See ROADMAP decision D2.

**Membership is keyed on `IdentityKey`, and everything else on `memberId`.**
A `memberId` is a random handle per membership. Modules store data against
`(conferenceId, memberId)`, and browsers only ever see `memberId`. A user
id or guest id never leaves the server.

---

## 5. HTTP contract

All JSON. Every response is `Cache-Control: private, no-store`.

| Method & path                                   | Who       | Does                                                                    |
| ----------------------------------------------- | --------- | ----------------------------------------------------------------------- |
| `POST /api/conferences`                         | creator   | Create. Body: details. The creator becomes organiser.                   |
| `PATCH /api/conferences/:id`                    | organiser | Replace details.                                                        |
| `DELETE /api/conferences/:id`                   | organiser | Delete the conference and every module's data about it.                 |
| `POST /api/conferences/:id/code`                | organiser | `{action:"new"}` issues a fresh code. `{action:"off"}` turns codes off. |
| `POST /api/conferences/:id/invites`             | organiser | New link. `{expiresInDays?, maxUses?}`                                  |
| `DELETE /api/conferences/:id/invites`           | organiser | `{token}` revokes a link (people already in stay in).                   |
| `DELETE /api/conferences/:id/members/:memberId` | organiser | Remove someone. Their module data is forgotten.                         |
| `PATCH /api/conferences/:id/me`                 | member    | `{displayName, visibility}`                                             |
| `DELETE /api/conferences/:id/me`                | member    | Leave, and be forgotten by every module.                                |
| `POST /api/conferences/join`                    | anyone    | `{code}` or `{token}`. Issues a guest cookie if needed. Idempotent.     |

Errors: `{error}` with one of `closed` (503), `signed-out` (401),
`not-found` (404: also returned when the conference exists but you aren't
in it, so its existence never leaks), `forbidden` (403), `invalid` (400,
with `issues`), `wrong-code` / `dead-link` (403), `slow-down` (429),
`last-organiser` (409).

---

## 6. Module contract

### 6.1 What a module receives

```ts
interface ConferenceContext {
  conference: ConferenceSummary; // id, name, kind, place, dates, timeZone, branding, modules
  viewer: ConferenceViewer; // memberId, role, displayName, visibility
  now: Date;
}
```

Server code gets it from `conferenceContext(conferenceId)`
(`src/lib/conference/request.ts`). That returns `null` for anybody who isn't
a member, and a module page calls `notFound()` on `null`. **A module never
reads cookies or `currentUser()` itself.**

### 6.2 What a module must do

```ts
interface ConferenceLifecycle {
  readonly module: ModuleId;
  forgetMember(conferenceId: string, memberId: string): Promise<void>;
  forgetConference(conferenceId: string): Promise<void>;
}
```

Register it in `src/lib/conference/lifecycle.ts`. The foundation calls it
when someone leaves or is removed, and when a conference is deleted or
expires. **"Delete everything about me" has to be true across every module.**
A module that keeps data and doesn't register is a privacy bug, not a
missing feature.

### 6.3 The registry

`src/domain/conference/modules.ts`:

| id          | Workstream           | Status today                                           |
| ----------- | -------------------- | ------------------------------------------------------ |
| `discover`  | `passport-discovery` | **built**: doors into `/go` from the conference town   |
| `arrivals`  | `passport-flights`   | **built**: live ADS-B map ([ARRIVALS.md](ARRIVALS.md)) |
| `schedule`  | `passport-events`    | proposed (prototype: `lane/boards` hockey)             |
| `community` | `passport-social`    | proposed                                               |
| `plans`     | `passport-groups`    | proposed (prototype: `lane/boards` interest)           |

An organiser chooses which modules their conference shows. A proposed module
can be switched on to preview it, and its page says plainly that it isn't
built yet.

### 6.4 Shared references

```ts
interface MemberRef {
  memberId: string;
  displayName: string | null;
} // null: not named to you
interface ConferencePlaceRef {
  atlasId: string;
  name: string;
} // facts are read from Atlas, never stored
```

A place in any module is an **Atlas subject id**. A module stores the id and
the name the person saw, and renders facts from Atlas at read time. If Atlas
doesn't have the place, that's an Atlas gap to report (doctrine §15.15).
It's not licence to store a home-made place.

### 6.5 Proposed, for the module workstreams to finalise

- **`ConferenceActivity`** (`passport-events`): take `lane/boards`'
  `StaffActivity` as the starting point (an `Experience` slice plus
  `confirmedBy`, with every fact absent until confirmed), keyed by
  `conferenceId`. `featured: boolean` makes the hockey game the hockey game.
- **`Participation`** (`passport-groups`): "I'm going there at 7. Anyone
  coming?" = `{ placeRef, at, hostMemberId }` plus opt-in `joiners`.
  "Interested" and "I'm in" are distinct states (doctrine §2.2).
- **Feed post** (`passport-social`): `{ authorMemberId, text, placeRefs[] }`.
  Moderation means an organiser can remove a post, and that is all.
- **Flight entry** (`passport-flights`): the `/sycle` `Participant.flight`,
  keyed by `(conferenceId, memberId)`, with the conference's arrival airport
  coming from configuration rather than a `YVR` constant.

---

## 7. Storage

**Built:** `ConferenceStore` interface plus an in-memory implementation.
Purge runs before every read, so a conference past its `retainUntil` (end
date + 30 days by default) is erased along with its memberships, links and
lifecycle-registered module data. It can't be forgotten because nothing can
be read without running it.

**Not built, and a production blocker:** a durable store. On Vercel each
instance has its own memory. In production, `config.ts` refuses to open
unless `CONFERENCE_STORE` is stated, so this can't ship by accident.

A durable store is now built (`CONFERENCE_STORE=supabase`, see [REAL-PEOPLE.md](REAL-PEOPLE.md)); its tables are in [`20261012000000_passport_conferences.sql`](../../../supabase/migrations/20261012000000_passport_conferences.sql), and the paragraph below describes the earlier privileged-key plan it replaced. They
are deliberately **outside** `supabase/migrations/`, which is a shared
contract. That has the same privileged-key question the `/sycle` prototype
raised: guest identities aren't `auth.users`, so RLS can't key on
`auth.uid()` for them.

---

## 8. Privacy, enforced on the server

| Rule                                                            | Where                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------ |
| Non-members get `404`, never "you're not invited to X"          | `service.homeFor`, `request.conferenceContext`                     |
| A new member is `hidden`: other members don't see them          | `details.ts` default, `views.memberHome`                           |
| Members see only `members`-visible names                        | `views.memberHome`                                                 |
| Organisers see everyone who joined, and whether they're hidden  | `views.organiserView` (needed to remove someone; open question D4) |
| An invite landing shows name, place and dates, but not who's in | `service.describeInvite`                                           |
| No email, phone or employee id is stored                        | `types.ts`: there's no field for it                                |
| Leave = forgotten everywhere                                    | `service.leave` → `lifecycle`                                      |
| Expiry on read                                                  | `store.purge`                                                      |
| Wrong codes slowed down                                         | `rate.ts`                                                          |
| `noindex` on every conference page                              | each page's `metadata`                                             |
