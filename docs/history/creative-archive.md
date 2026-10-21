# ELK Creative Archive — inventory record (2026-10-20)

**Evidence, not authority.** The record itself is
[`src/app/creative/archive.ts`](../../src/app/creative/archive.ts), shown at
`/creative`. This file only records what the first inventory found and what
still needs a person. Inventoried on Metatron, `integration/release` at
`c0867aa`.

## Counts at the first inventory

|                                                                         |                                                                                                            |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Originals recorded                                                      | 69                                                                                                         |
| Open from a full environment (Atlas configured), verified in a browser  | 50 of 50 linked, 0 broken                                                                                  |
| Present but not linkable here (Labs closes them, or they are documents) | 15                                                                                                         |
| Found only in git history                                               | 1 — Sycle prototype, branch `sycle-prototype` `6ae9ab2`                                                    |
| Never committed, need manual recovery                                   | 3 — `future-passport-experience.md`, `brand-principles.md`, the two Fishing With Emi originals (one entry) |

"Working" was checked in a browser (`e2e/creative.spec.ts`): each link
renders words or media, throws no uncaught error, and is not an error page. A
200 alone was not accepted.

## What was found

- **Christmas.** The only HTML original anywhere in git history is
  `public/labs/discovery-space/christmas-passport.html`. Its own `<title>`
  calls it "Experiment 04"; it was later ported to React as Experiment 05
  (`/about/experiment-05-christmas`). Both are kept.
- **October.** Rooms first built under `/labs/october/*` moved to `/october/*`
  on 2026-10-12 (`6a65849`, `6016b19`). The old URLs still forward
  (`next.config.ts`). `/october/discovery/legacy` keeps the lane-based Discover
  the synthesis replaced.
- **Hockey Night.** The creative original is the Experience Lab fixture
  `sycle-hockey-night` (`974e1d6`, 2026-09-06; round two `e960687`). The shared
  `/hockey` night (`aded7ff`, 2026-10-11 onward) is a later adaptation, not the
  same experience. See `docs/product/hockey/ORIGINAL-VISION.md`. No standalone
  hockey HTML prototype was ever committed.
- **Design evolution.** Four rounds, twelve directions, all on 2026-10-10:
  `27ca52d`, `5adda07`, `45e8ca8`, `b32b87d`.
- **Dates.** Most `/about` work first appears in `76dde5e` (2026-08-14), a
  bulk baseline snapshot. That dates entry into git, not creation; the archive
  says so on each card.

## Open — for a person

1. **Recover the two foundational documents.** `future-passport-experience.md`
   (last known at `Businesses/Websites/elk-passport/docs/future/`) and
   `brand-principles.md` (`Businesses/Websites/elk-passport/project-management/`)
   were never committed to any branch. Copy the originals, unedited, into
   `docs/history/originals/` and commit them; then point their archive entries
   there and change their status.
2. **Export the Fishing With Emi originals** from the ChatGPT Library into
   `docs/history/originals/` (already asked in `docs/history/concepts.md`).
3. **Conflict, not resolved here:** `src/app/labs/experiments.ts` says shared
   Hockey Night is "not in this build", while `/hockey` ships and the
   Experiences menu links it. The archive follows Labs, so it shows no link to
   `/hockey`.
4. **Sycle prototype** lives only on `sycle-prototype`; restoring it is a
   deliberate merge, not a file copy. An untracked `scripts/sycle/` sits in the
   main checkout's working tree.
