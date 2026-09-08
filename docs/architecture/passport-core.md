# Passport Core

**Established:** 2026-09-07

What Passport owns, where the boundaries are, and which seams exist so that
future clients and future experiences do not each invent their own. Read
`user-state.md` first — this extends it.

## Passport vs Atlas

```
Atlas      understands the world: places, organizations, events, evidence.
Passport   understands the person: who they are, what they save, who they
           share it with, what they have chosen, and what they are doing now.
```

The split holds even where the data physically sits together. Boards live in
Atlas because it stores what was saved; **who may see a board is Passport's**,
because that is a fact about people. Putting members in Atlas would give the
knowledge backend a model of somebody's friends, which it has no business
holding and no way to authenticate.

Practically: Passport decides access, then asks Atlas for the board **on the
owner's behalf**. Atlas's rule — never cross owners — is untouched, and it never
learns that sharing exists.

## Identity

One seam, `currentUser()` (`src/lib/auth/currentUser.ts`), server-side. The
Supabase user id is the key all durable state hangs off. See `user-state.md`.

## Account facts vs preferences vs learned signals

Three categories, three different authorities, and the separation is enforced by
the database rather than by convention:

```
passport_profiles      what somebody IS      display name, home area, timezone
passport_preferences   what somebody SAID    source = 'explicit' (CHECK constrained)
(does not exist yet)   what Passport NOTICED a future table, a different weight
```

`passport_preferences.source` has a `CHECK (source = 'explicit')`. A learned
signal **cannot** be written there, even by mistake. That is the whole point:

> "Keep it family-friendly while I'm browsing with the kids" is a boundary.
> "They save a lot of hiking ideas" is an observation.
>
> An observation may shape what is shown first. It may never override a boundary.

When learned signals arrive they get their own table. The constraint is what
forces that conversation to happen rather than be skipped.

The preference **vocabulary is closed and lives in code**
(`src/lib/preferences/vocabulary.ts`): a key exists because it is declared with
a type, a default and a sentence saying what it changes. An undeclared key is
refused by the API, not stored and ignored. Everything has a working default, so
nobody is ever required to fill anything in.

## Resources, ownership, membership

```
RESOURCE   a board today
owner      created it; may share, rename, delete
editor     may add and remove items
viewer     may look
```

Three roles. A fourth is a product decision nobody has made; configurable roles
would make this an RBAC system rather than a sharing feature.

Ownership is read from **Atlas**, not from the membership table — a board
somebody made is theirs whether or not a membership row records it, so every
board created before sharing existed still works. Membership only ever _adds_
reach.

## Sharing and invites

A link, and nothing else: no email, no SMS, no invitation inbox. The token is a
32-byte secret and is the credential; it can expire and be revoked, and it can
never name a role above `editor` because the column will not hold one.

Redemption goes through `passport_redeem_board_invite`, a `SECURITY DEFINER`
function, because the person following a link is by definition not yet a member
and so cannot read the invite that would let them become one. Redeeming is
idempotent and never changes an existing role.

`/invite/<token>` describes the invitation **while signed out** — enough to
understand it, never the board's name or contents — and signs somebody in with
`?next=` so accepting is the next thing that happens.

## Sessions and realtime

`passport_events` is one append-only log, written inside the same request that
changed the durable state. Supabase Realtime streams inserts; row-level security
decides who receives them, so subscribing to a board you do not belong to yields
silence.

**The rule for anyone building on this: the state is the truth, the event is the
nudge.** Receive an event, then re-read the canonical state. A client that
reconstructs state from events is wrong the first time a device slept through
one.

`resource_type` is `'board'` today. A shared session is the same shape and needs
no new infrastructure — a `'session'` resource type, a row per participant, and
the same stream. **The generic seam exists; a Session table does not.** Nothing
game-specific (predictions, scores, votes, forfeits) belongs in Passport Core;
those are an Experience's, and the moment one appears here the seam has stopped
being generic.

## Groups — deferred, deliberately

Investigated and **not built**. Every current sharing need is satisfied by
membership on a resource, and a Group would today be a second way to express the
same row. It becomes worth building when the same set of people is used for more
than one resource — at which point `passport_board_members` grows a nullable
`group_id` and the roles stay exactly as they are.

## Native-ready and voice-ready

Neither is being built. What is preserved:

- **Authorization is Postgres's**, via row-level security on `auth.uid()`. A
  native or voice client presenting the same JWT gets the same rows with no
  shared server code and none reimplemented. Authorization that lived in a React
  component could not make that promise.
- **Durable state is server-owned.** `localStorage` holds only per-device
  conveniences (the last active board); nothing that must survive a device
  change is in the browser.
- **Core logic is not in component state.** Identity, profile, preferences,
  access and events are services and HTTP routes. `useResourceEvents` is a thin
  hook over a subscription any client can open directly.
- **Ids are stable** and every resource has a URL: `/boards/:id`,
  `/places/:id`, `/invite/:token`, `/account`.

## Location

Three concepts, deliberately not collapsed:

```
HOME       passport_profiles.home_area — the person's own words, never coordinates
DEVICE     transient, permission-based, NOT STORED and not read today
EXPLORING  Discovery's GeographicScope — belongs to the session, not the person
```

## User-generated media

**Not built.** No storage bucket, no upload path. When one is needed the
ownership seam it must carry is: creator, associated Passport resource, the same
membership visibility rule as `passport_events`, whether it is original or a
generated derivative, and who may delete it. `passport_events.payload` can
reference a media id without a schema change.

## Anonymous

Discovery, search, scope, kinds, detail pages and an invitation's description
all work signed out. Identity is requested at exactly one moment — a durable
save or a join — and the page stays where it is. **Passport gives before it
asks.**
