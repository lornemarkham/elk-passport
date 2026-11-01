# Snow: the crew is shared by link, not yet by account

## What works

A snow day is one JSON document on the phone that made it. **Share the plan**
puts that document in the part of a link after `#` (`/snow/join#…`), which a
browser never sends to a server. A friend opens it, gets their own copy, and
adds themselves. Photos are left out of the link.

## What that is not

Copies do not merge. Two phones editing independently diverge. Votes cast on
one phone are not seen on another; there is no group chat; points are
per-phone. That is the honest ceiling of a no-backend slice, and the UI says so
under **Share the plan**.

## The real path (needs a contracts / integration decision)

Passport already has one foundation for doing things together
(ADR 009, `passport_adventures`): membership, hashed single-use invites, a
shared plan of items, and one-vote-per-person `in / maybe / out` responses,
enforced by Postgres. Snow should use it rather than grow a fourth group
system. Proposed, **not made** in this lane (shared contracts):

1. `src/lib/adventures/kinds.ts` — add
   `{ id: "snow-day", label: "Snow Day", blurb: "A day on the mountain, with the crew.", joinVisibility: "members", extension: "snow" }`.
   No migration for the kind itself.
2. A typed extension, keyed by adventure id, written as a migration under
   `supabase/migrations/` by the contracts lane — never `db push`, never
   applied from here:
   - `passport_snow_people(adventure_id, member_id, discipline, ability, own_gear, note)`
   - `passport_snow_completions(adventure_id, member_id, challenge_id, at)` —
     one row per person per challenge, so nobody overwrites anybody
   - `passport_snow_moments(adventure_id, member_id, text, at)` and
     `passport_snow_photos` (storage bucket, like Hockey memories)
   - RLS the same as `passport_hockey_*`: members read, you write your own rows.
3. Map the Snow `Action` union onto those calls. `applyAction` is already the
   single place changes are decided, so the server adapter can call the same
   function to refuse nonsense before it writes.
4. `PassportNav` (`src/components/shell/PassportNav.tsx`) — add
   `{ href: "/snow", label: "Snow Day", testId: "snow" }` to `EXPERIENCES`.
   Until then `/snow` is reachable by URL and from nothing else.

Group chat should reuse Hockey's `ChatRoom` once the Snow day is an adventure.

## Privacy

Nothing in this slice leaves the device except what the person explicitly
shares (a link, a recap, a check-in message). Location sharing, if it ever
arrives on the mountain, follows ADR 011: opt-in, time-limited, and stated.
