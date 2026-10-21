# 009 · One foundation for doing things together

**Decided:** 2026-10-12, by mission ("Shared group experiences foundation",
lane `boards`) · **Status:** implemented on `lane/boards`; migration proposed,
not applied

_Numbered 003 on `lane/boards`; renumbered 009 when it reached `integration/release`, where 003 was already the Go-day start decision._

## The problem

Passport was about to ship three group systems:

- **Boards:** `passport_board_*`, live.
- **Hockey Night:** `passport_occasion_*`, proposed on `feature/hockey`.
- **Conference:** `passport_conference_*`, in a release-candidate migration.

Each system had its own:

- membership table;
- "is member" and "role of" functions;
- invite creation and redemption;
- leave and remove;
- roster visibility rule;
- verification stack.

Conference's own architecture document asked which one Passport meant to keep,
and warned against merging two. Every future kind (a birthday, a weekend, a
Discovery-born day) would otherwise have copied one of them again.

## The decision

**One Passport-owned core, `passport_adventures`.** Every group thing uses it:
membership, invitations, removal, a shared plan of Atlas references, and
answers. **Kind-specific facts go in typed extension tables keyed by the
adventure id;** the core never knows what a game or a flight is. The kind is an
open, code-declared vocabulary, so a new kind needs no migration.

Details, the security model and the integration plans are in
`docs/product/group-adventures/README.md`.

## Why a new core rather than extending one of the three

**Boards.** A board's container is an Atlas row, and Atlas answers only to its
owner.

- Making every group thing an Atlas board would put Passport's groups in the
  knowledge backend.
- It would make creating a Hockey Night depend on Atlas being up.
- It would inherit the owner self-claim hole (README §6).

Hockey and Conference rejected boards for the first two reasons, independently.

**Hockey's occasions.** The core is close to generic. But its member rows carry
night-specific presentation (emoji, hue, vibe, edge), its ids are uuids that
Conference's text ids cannot join, and it mixes core with game mechanics.

**Conference's tables.** These are the closest in shape, and their roster
privacy and random member id were adopted here as they are. But they are named
and scoped to conferences, keep a whole conference in `details` jsonb, and store
invite tokens in plaintext.

**The core takes the best of each:**

- Hockey's hashed, single-use-by-default links, and membership made only by
  database functions;
- Conference's text ids, member ids and listed-or-hidden rosters;
- the boards rule of reading as the person, never with a service key.

It adds one thing none of them had: a removal survives the links the removed
person still holds.

## What this does not decide

- **The doctrine's open questions.** It does not answer how group experiences
  should _feel_ (§15.12), whether a group plan needs a commitment state (§2.6,
  §15.14), or whether Experiences are themes or compositions (§10). The answer
  vocabulary is provisional.
- **Boards.** Their sharing stays as it is. Whether a shared board becomes an
  adventure with an attached board is open.
- **When Hockey and Conference adopt it.** Both can adopt it incrementally,
  keeping their ids and links, without blocking their releases.

## Consequences

- **Until Hockey and Conference migrate, Passport has more group tables, not
  fewer.** That is visible and documented. It is better than the alternative,
  which was a fourth copy arriving with the next kind.
- **The migration is a shared contract.** The contracts lane applies it, in the
  SQL editor, never with `supabase db push` (supabase/README.md).
