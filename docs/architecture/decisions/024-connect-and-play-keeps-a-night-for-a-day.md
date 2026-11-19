# 024 · Connect & Play keeps a night for a day — PROPOSED (2026-11-19)

**Proposed** by mission 940 for the owner's brief _Date Night: Connect & Play_
("no mandatory account", "avoid retaining sensitive answers unnecessarily").
**Departs from** [ADR 009](009-one-group-foundation.md), as 017 and 021 did.

## Decision

1. A night is one hash in a temporary Redis (Fairview 3's transport), expiring
   24 h after last write; memory outside production. No table, no migration.
2. Two people, no accounts: an 80-bit code in the URL, a per-night httpOnly
   cookie, only its hash stored. Join is an atomic claim on the second seat.
3. Every read goes through `viewFor`, which redacts the other person's
   unrevealed answers and unasked questions. Answers are deleted as the night
   moves on; leaving deletes your side.
4. The game is pure (`src/domain/date-night/connect/`), so the store is swappable.

## The conflict

ADR 009 wants one membership core. Like CourtQueue and Pulse this is a second
small store, and a second no-account invitation (§15.12). Not resolved here.

## Reversibility

Additive: new routes and files only. Delete them; nothing else changes.
