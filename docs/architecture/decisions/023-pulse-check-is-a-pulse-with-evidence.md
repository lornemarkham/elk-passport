# 023 · A Pulse Check is a Pulse with evidence beside it — PROPOSED (2026-11-18)

**Proposed:** 2026-11-18, by mission 928 for the owner's brief _P0 —
PEOPLE'S PULSE: PULSE CHECK_ ("This is an extension of the existing People's
Pulse product. DO NOT build a separate application."; "Never invent evidence
or citations."; "Never treat an AI-generated assessment as independently
verified fact."; "Votes must never determine whether a factual claim is
true."). **Builds on:** [ADR 021](021-peoples-pulse-keeps-its-own-small-store.md)
and [ADR 022](022-quick-ideas-are-kinds-of-pulse.md), both still proposed.
Product detail: [`docs/product/pulse/PULSE-CHECK.md`](../../product/pulse/PULSE-CHECK.md).

## Decision

1. **The poll is a Pulse of kind `check`.** Votes, circles, results, reports
   and moderation are People's Pulse's own. A `check` Pulse can only be made
   with its investigation (the plain create route refuses the kind).
2. **The investigation is its own row**, `passport_pulse_checks` (JSON with a
   version for safe edits), because sources and corrections outgrow the
   Pulse's 20 KB JSON and change after publishing while a Pulse does not.
   Posts, post reports, a private file and aggregate events get their own
   closed tables, reached through key-checked SECURITY DEFINER functions.
3. **Evidence is only what the server read**, sealed with the server's key
   between reading and publishing. The assessment is the asker's, labelled as
   such, and allowed only when a source of its own kind is attached.
4. **No AI and no search service** in this slice. Their absence is stated on
   every page rather than worked around.
5. **The screenshot is private** to its publisher's browser and
   administrators; it is never public and never in a preview.
6. **The public address is `/check/<claim-words>-<id>`**, as the brief asked,
   outside `/labs`, so a link pasted under a post reads cleanly.

## Named conflicts, not resolved

- Doctrine §9 places People's Pulse in Labs, outside the day loop (§1).
  `/check` is a top-level public route at the brief's request; the Labs
  status and the §1 question are unchanged and remain the owner's call.
- Doctrine §5 does not authorise telemetry. The brief asks for link visits,
  shares and referral sources. Built: daily aggregate counts by kind of site
  or channel only, for this Labs experiment — as ADR 022 did — not Passport
  telemetry.
- The brief's "VERIFIED EVIDENCE" label is not used: no one verifies the
  sources, so the section is called **Evidence** and says "not
  independently verified". Using the word "verified" would contradict the
  brief's own rule against presenting an assessment as verified fact.

## Reversibility

Additive: five tables and thirteen functions, nothing existing changed.
Rollback SQL in the product doc.
