# Passport concept history — inventory

**Evidence, not authority.** This file records where Passport's original
concepts can be found in this repository today. It does not define them, does
not promote any of them into the product, and reconstructs nothing. The
doctrine (`docs/PASSPORT-PRODUCT-DOCTRINE.md`) remains product authority;
promoting a concept into it is a separate decision for a person.

Inventoried 2026-10-11 on Metatron, branch `lane/vision`, at `016854a`
(Lodge mission 132).

## The originals are missing

The two original artifacts were **not found on Metatron** (whole disk, every
repository's git history, `~/Drop`):

- `Fishing_with_Emi_First_Adventure.pdf`
- `001-fishing-with-emi-passport-adventure-page.md`

They live in the ChatGPT Library, which is not reachable from Metatron.
**Lorne needs to export both, unedited, into `docs/history/originals/`**, with
the export date and source in the commit message. Until then, every entry below
is a _later_ artifact than the original concept.

## How to read the entries

- **Earliest artifact** — the earliest real file in this checkout that carries
  the concept, by path.
- **Introduced** — `git log --diff-filter=A --format='%h %ad' -- <path>`.
- `76dde5e` (2026-08-14, "Baseline Entity Template and the Research Missions
  workflow") is a bulk snapshot: it added many files at once, so it dates when
  they entered this history, not when the ideas were first written.
- Quotes are verbatim from the file at `016854a`.

---

## Fishing With Emi

- **Earliest artifact:** `src/app/about/experiment-07-fishing-with-emi/`
  (`page.tsx`, `content.ts`, `FishingWithEmi.tsx`) — the Labs page.
- **Introduced:** `2819edb` 2026-08-15 (`feat(labs): experiment 07 — Fishing With Emi`).
- **Quote** (`page.tsx`):
  > A first fishing adventure from Vernon through Trinity Valley to Hidden Lake. A real outing used as a Passport product prototype.
- **Original:** missing on Metatron — see above.

## Wonder

- **Earliest artifact:** `src/app/about/experiment-04-wonder/` (`content.ts`,
  `WonderExperiment.tsx`, `page.tsx`); also `src/app/about/idea-atlas/content.ts`.
- **Introduced:** `76dde5e` 2026-08-14 (bulk snapshot).
- **Quote** (`experiment-04-wonder/content.ts`):
  > Experiment 04 — "Wonder." Deliberately smaller than the sandboxes before it, on purpose — the brief itself said not to solve everything.

## Analog maps

- **Earliest artifact:** `src/app/about/idea-atlas/content.ts` (the "ANALOG
  PASSPORT" section) and `src/app/about/experiment-06-analog-adventures/`
  (`content.ts` lists "Printable map" and "Offline map").
- **Introduced:** `76dde5e` 2026-08-14 (bulk snapshot), both paths.
- **Quotes:**
  > ANALOG PASSPORT — use technology to enable less technology

  (`idea-atlas/content.ts`)

  > { emoji: "🗺️", title: "Printable Maps", line: "Folded into the glovebox." }

  (`experiment-06-analog-adventures/content.ts`)

## Moments

- **Earliest artifact:** `archive/03-treasure-chest.md`; also the "Moments"
  section of `src/app/about/experiment-07-fishing-with-emi/FishingWithEmi.tsx`.
- **Introduced:** `76dde5e` 2026-08-14 (bulk snapshot) for the archive file;
  `2819edb` 2026-08-15 for the Emi page.
- **Quotes:**
  > Life is measured in moments

  (`archive/03-treasure-chest.md`)

  > Four moments, not a list of directions

  (`FishingWithEmi.tsx`)

## Adventure Builder

- **Earliest artifact:** only inside the Fishing With Emi page,
  `src/app/about/experiment-07-fishing-with-emi/page.tsx` and
  `FishingWithEmi.tsx`. No standalone artifact.
- **Introduced:** `2819edb` 2026-08-15.
- **Quote** (`page.tsx`):
  > The Adventure Builder is the whole argument — 22 modules, 13 on for Emi, and the 9 that are off stay

## Boards

- **Earliest artifact:** `src/app/boards/page.tsx` (the route); described in
  doctrine §9 "The board / saved loop".
- **Introduced:** `76dde5e` 2026-08-14 (bulk snapshot) for the route; the
  doctrine was added in `41d1a6a` 2026-10-10.
- **Quote** (doctrine §9):
  > The board is potentially central, and is currently treated too much like bookmarks.

## Go Have a Day

- **Earliest artifact:** `src/components/design-lab/brand.tsx` (design lab,
  "ONE HELL OF A DAY" round). The product implementation is
  `src/components/ghad/`, introduced a commit later.
- **Introduced:** `b32b87d` 2026-10-10 (`ONE HELL OF A DAY — brand confidence on
  top of the two ideas that worked`) for `brand.tsx`; `6950899` 2026-10-10
  (`GO HAVE A DAY, on the product people actually use`) for `src/components/ghad/`.
  Lodge missions 111–115 carried this work.
- **Quote** (`src/components/ghad/Wordmark.tsx`):
  > **GO HAVE A DAY.**
  >
  > Three words, set tight and heavy in the product's own grotesk, with a short accent rule beneath.

## Digital Detox

- **Missing — not reconstructed.** No artifact in this checkout names the
  concept (`git grep -i detox` finds nothing).
- Nearest related material, recorded only as pointers, not as the concept:
  `src/app/about/experiment-06-analog-adventures/content.ts` (`76dde5e`), which
  says "the best Passport session ends with the phone being put away", and
  doctrine §6 "Less phone, more life".

---

## Still open

- The two originals above, to be exported by Lorne into `docs/history/originals/`.
- Plan step 3 (a pointer from doctrine §17 to `docs/history/`) and step 4 (the
  two untracked Mac files named in §17) are not done here.
