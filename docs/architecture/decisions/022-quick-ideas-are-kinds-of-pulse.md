# 022 · Quick Ideas are kinds of Pulse, not new applications — PROPOSED (2026-11-18)

**Proposed:** 2026-11-18, by mission 908 for the owner's brief _P0 — PASSPORT
LABS: QUICK IDEAS EXPANSION_ ("Do NOT create 20 separate applications.
Extend the existing People's Pulse engine into reusable interaction modes";
"Do not duplicate the database or create unnecessary services"). **Builds
on:** [ADR 021](021-peoples-pulse-keeps-its-own-small-store.md) (still
proposed). Product detail:
[`docs/product/pulse/QUICK-IDEAS.md`](../../product/pulse/QUICK-IDEAS.md).

## Decision

1. **A Pulse has a `kind`** (`pulse`, `decide`, `settle`, `normal`, `rank`)
   in its existing JSON. Templates are presets on the one create form, not
   kinds. Absent kind = `pulse`, so every V1/V2 Pulse is unchanged.
2. **A vote may carry three optional parts** — a reason, a ranking, a
   category — as nullable columns on the existing votes table, written by a
   new `passport_pulse_cast` with V1's rules plus format checks. The vote's
   `option` stays a real answer (a ranking's first choice), so every V1/V2
   view still works on every kind.
3. **Ranges, not numbers**, for Is This Normal?, and its results are released
   in steps of five even for Everyone.
4. **Usage is aggregate counters** `(day, event, kind) → n` plus counts
   computed in SQL; no event table keyed by person or Pulse.
5. **Agent-proposed questions are code** (`drafts.ts`) published only by an
   administrator; high-stakes ones need an explicit review confirmation.

## Named conflicts, not resolved

- Doctrine §5 says it "does not authorise building telemetry". The brief asks
  for usage analytics. Built: aggregate counts only, for Labs experiments
  outside the day loop; it does not authorise telemetry for Passport.
- The brief's "Passport Labs homepage" headline was placed on `/labs/pulse`,
  not `/labs`, which the 2026-11-17 decision defines as the catalogue of
  experiences. Moving it is a one-line routing change if the owner wants.

## Reversibility

Additive; rollback SQL in the product doc. V1 functions are untouched and the
app falls back to them for plain votes until the migration is applied.
