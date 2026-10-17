# One search, one conversation (2026-10-16)

Decision record: [ADR 006](../../architecture/decisions/006-one-search-box.md).
Measured with `next start` against the Atlas stand-in serving the committed
real fixture (`docs/product/critic/evidence/atlas-candidates-2026-10-11.json.gz`).

## Before and after

|                             | before (bf46045) | after  |
| --------------------------- | ---------------- | ------ |
| text boxes on the page      | 2                | 1      |
| first result card, 1440×900 | y = 1,039 px     | 603 px |
| first result card, Pixel 7  | y = 951 px       | 539 px |

`before-desktop.png`, `before-phone.png` — the old page.
`desktop-01-arrive.png`, `phone-01-arrive.png` — the new one.
`desktop-02-four-sentences.png` — _"Something fun with my daughter." →
"Somewhere indoors." → "Within 30 minutes." → "Actually, somewhere we can eat
too."_ read as: eat & drink · with a kid · up to 30 min away · from Vernon ·
staying dry. `phone-02-answer.png` — a sentence answered on a phone.

## What the second box did, and where it went

| it did                                | now                                                                                                 |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| find a place by name                  | the sentence box (`findByName`), named place first                                                  |
| search inside the answers above       | names are matched inside them first                                                                 |
| "Search everywhere"                   | automatic when nothing inside matches, said on the card; "Everywhere — N more" when browsing a kind |
| filter by type                        | _Refine → What kind of thing?_                                                                      |
| mood / activity / season / companions | removed — never rendered (Atlas states none of them)                                                |

## Verified here

- `e2e/discovery-one-search.spec.ts`, 12/12: one box, results on the first
  screen (desktop and phone), name search, old `?q=` links, four-sentence
  conversation, changing a constraint, results updating, clearing, an activity
  said and tapped, Refine's kind row, entity navigation carrying the
  conversation back, the ask route down (the words alone answer).
- Atlas down (stand-in stopped, fresh server): the page says _"Passport
  couldn't reach Atlas"_ with _Try again_, and shows no box and no invented
  results.

## Not verified here

- **Production Atlas, the model path and routed drive times** — no Atlas
  token, no `OPENAI_API_KEY`, and the stand-in serves no `/travel` or
  distance routes in this checkout. With a town picked, the "Or around here"
  activities are empty against the stand-in for that reason (unchanged from
  before).
- **Imagery** is unchanged: cards already use Atlas's `heroUrl` and a venue's
  `contextualMedia` labelled as the venue's. The candidates contract carries no
  image credit, so cards have none to show; coverage (≈21%) is Atlas's subject
  evidence rule — the Atlas image mission's work, not this page's.
