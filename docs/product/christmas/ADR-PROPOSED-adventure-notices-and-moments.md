# Proposed ADR — Announcements and shared moments belong to the adventure core

**Status:** PROPOSED by lane christmas (brief M470), 2026-11-01. Not
accepted. When accepted, the integration owner gives it the next number in
`docs/architecture/decisions/`, moves `together-migration.sql` into
`supabase/migrations/`, and edits the doctrine as below.

## Context

Three owner briefs written the same week ask for the same group capabilities:

- **Hockey Night (M466)** — after a real night out (2026-10-25): host
  announcements that survive the chat ("Shark Club is packed, Boston Pizza
  instead"), with a place and _Got it_; memories and recaps. _"Do not create a
  Hockey-only announcement system if a shared implementation is appropriate."_
- **Christmas (M470)** — invitations, group planning, voting, important
  announcements, challenges, memories, a recap.
- **Snow (M471)** — group chat, important announcements, challenges, shared
  photos, recap.

ADR 009 made `passport_adventures` the one group core. It has membership,
invites, the shared plan and in / maybe / out — and no announcements and no
shared memories. Hockey's photos live in `passport_occasion_photos`;
Conference's in its own tables. ADR 012 kept Done marks on the device and left
**where memories live (D-9)** open.

## Proposal

1. **Two core capabilities, keyed by `adventure_id`:**
   `passport_adventure_notices` (+ `_acks`) and `passport_adventure_moments`.
   Open, code-declared vocabularies for `kind` and `challenge`, like
   `passport_adventures.kind`, so a new Experience needs no migration.
2. **Security is the core's:** members read; the owner announces; anyone
   acknowledges for themselves; you share in your own name; you delete yours,
   the owner may delete anything in their adventure; nothing is edited or
   re-homed (column grants). Grants explicit — production has no defaults.
3. **D-9, answered narrowly for adventures:** memories a person _chooses to
   share with their group_ live with the adventure, visible to its members
   only. Done marks stay on the device. Nothing is shared without the person
   sharing it.
4. **Code ships first.** Christmas detects the missing tables and says
   sharing isn't switched on; planning, voting and invites keep working.

## Consequences

- Hockey and Snow can adopt announcements and moments without a migration
  of their own. Hockey's existing photos are not moved by this.
- The store currently lives in `src/app/christmas/_server/together.ts` (lane
  boundary). On acceptance it belongs in `src/lib/adventures/`, beside
  `store.ts`, with the routes under `/api/adventures/[id]/…`.
- Photos are base64 text in Postgres, as Hockey's are. Moving all group photos
  to object storage is a later, separate decision.

## Doctrine edits on acceptance

- §15.12, add: _"Informed 2026-11-01 by Go Have a Christmas
  (`docs/product/christmas/README.md`): a group's host can announce a change
  that leads the page until each member has it, and members can share
  photos, traditions and finished challenges with the group. One composition;
  the general question stays open."_
- §10 _How a person finds them_: add Christmas to the Experiences menu (or
  record that it stays off the menu, if that is the decision).
- ADR 012 _Consequences_: mark D-9 as answered narrowly for shared memories.
