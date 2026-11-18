# 021 · People's Pulse keeps its own small store — PROPOSED (2026-11-18)

**Proposed:** 2026-11-18, by mission 906 for the owner's brief _P0 — BUILD
PEOPLE'S PULSE_ ("Build it inside the existing Passport application, under
Labs, using existing infrastructure"; "Create only the minimum required data
model"; "Use server-side vote validation"; "Do not store unnecessary personal
data"). **Status:** implemented on local `main`; migration
`20261118000000_passport_pulse.sql` not applied anywhere real. **Follows:**
[ADR 017](017-courtqueue-is-its-own-small-room.md)'s security model.
**Departs from:** [ADR 009](009-one-group-foundation.md), as 017 did.

## Context

People's Pulse (`/labs/pulse`) lets anyone ask a question and anyone vote,
without an account, from a shared link. Votes must be checked on the server,
duplicates refused atomically, and nothing personal kept. Product detail:
[`docs/product/pulse/PEOPLES-PULSE.md`](../../product/pulse/PEOPLES-PULSE.md).

## Decision

1. **Four tables in the Passport Supabase project** — `passport_pulse_keys`,
   `passport_pulses`, `passport_pulse_votes`, `passport_pulse_reports` — with
   RLS on, no policies and every grant revoked. The only way in is
   `passport_pulse_*` SECURITY DEFINER functions that require the server's key,
   whose sha256 is claimed on first use (exactly ADR 017's pattern).
2. **The rules that must be atomic live in those functions**: one vote per
   (Pulse, voter hash) by primary key; the per-network cap under an advisory
   lock; a closed, paused or removed Pulse refusing votes; three distinct
   reports pausing a Pulse; the daily creation limit.
3. **Identity is a random device cookie, stored only as a keyed hash.** The
   network address is stored only as a keyed hash that rotates daily. Referral
   codes are derived from the device and the Pulse, so they are not stored
   until a vote is.
4. **Results are computed in the app** from anonymous rows (answer, place,
   time, codes), so the privacy rules (minimum group of 5, release in steps of 5) are pure, tested TypeScript rather than SQL.
5. **Polling, not Realtime**, for the same reason as ADR 017: the tables are
   not readable by the anon key.
6. **The key defaults to an HMAC of `ATLAS_SERVICE_TOKEN`** (`PULSE_STORE_KEY`
   overrides), so the feature needs no new secret.

## The conflict

ADR 009 says group things share one Passport-owned core. A Pulse's voters are
not Passport users and a Pulse is not an adventure; the brief asked for no
account. Like CourtQueue this is a second small, isolated store. **Not
resolved here** — if People's Pulse outlives Labs, the owner decides whether
creators should get Passport accounts.

## Alternatives not taken

- **CourtQueue's document table** (no migration at all): would mix two
  products' data under one key, and a popular Pulse as one compare-and-swap
  document would make every vote contend.
- **Fairview 3's temporary Redis**: expires in 48 hours; Pulses must last.

## Reversibility

Additive: four new tables and eleven functions, nothing existing touched.
Rollback SQL in the product doc.
