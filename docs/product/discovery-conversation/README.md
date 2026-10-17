# Discovery 2.0 — from filtering to understanding (2026-10-16)

What changed, measured against the committed real Atlas fixture
(`docs/product/critic/evidence/atlas-candidates-2026-10-11.json.gz`, 2,979
candidates). Decision record: [ADR 005](../../architecture/decisions/005-discovery-leads-with-a-sentence.md).

## What a person sees

- **"What kind of day are you looking for?"** with one large sentence box
  ("Something fun with the kids, not too far away…") and seven starting points
  — _Surprise me, With the kids, Something different, Get outside, Tonight, A
  great date, Rainy day_ — ordered by the moment (rain first when wet; Tonight
  first late in the day, gone after nine).
- The five old rows sit behind **"Fine-tune it yourself"** on every screen.
- Every sentence stays on screen as part of the conversation, with **Start
  over**. Under the answer: what was heard, at most one question with tap
  replies, the picks with reasons, **Make a day of it**, **Something
  different**, and **Or around here:** other activities.

Screenshots: `desktop-01-arrive.png` … `phone-01-tomorrow.png` (written by
`e2e/discovery-conversation.spec.ts`).

## Why only four activities appeared

`directions.ts` cut Atlas's raw affordance names at four on purpose: past four,
Atlas's spellings of one idea (`hiking`, `walking/hiking`, `hike`, `walking`)
started appearing side by side. And only 224 of 2,979 candidates state an
affordance, so museums, cinemas, wineries, rinks and concerts could never reach
that row. `activities.ts` now gathers affordances, subtypes and play features
into 33 human activities. In the Okanagan default feed in October, 27 have
enough behind them to offer; 1,369 of 2,492 feed candidates belong to at least
one. Counts are no longer shown.

## The twelve sentences, and the conversation

`real-atlas-answers-2026-10-16.txt` is the full output (from Vernon and from
Vancouver): what each sentence was read as, the heading and note, every pick
with its reasons. Summary from Vernon:

| Sentence                                         | Read as                           | Leads with (real Atlas subjects)                                      |
| ------------------------------------------------ | --------------------------------- | --------------------------------------------------------------------- |
| I'm bored.                                       | surprise                          | Civic Memorial Park, Allan Brooks Nature Centre, U-Pick Pumpkins …    |
| Something fun with my five-year-old.             | child, age 5                      | U-Pick Pumpkins (price for a 5-year-old), Paddlewheel Park …          |
| We have three hours and don't want to drive far. | 3 hours, close by                 | things on today within 30 km                                          |
| Something unusual tonight.                       | unusual, today, evening           | Okanagan Skydive, Paraglide Canada, BX Falls (rarest by Atlas)        |
| It's raining. What can we do indoors?            | staying dry                       | Kal Tire Place (hockey), Arts Centre, Museum and Archives of Vernon   |
| A romantic afternoon.                            | the two of you, afternoon         | viewpoint, arts centre, jazz club — evening events pushed down        |
| I want to get outside but not hike.              | outdoors, no hiking               | U-Pick Pumpkins, Civic Memorial Park, Kalamalka Lake (no trails)      |
| Something adventurous near Vancouver.            | adventure, Vancouver              | Capilano Suspension Bridge Park, Mt Seymour, Cypress (from Vancouver) |
| Actually, make that tomorrow.                    | tomorrow, keeps "evening"         | (conversation)                                                        |
| Show me something completely different.          | different: none of what was shown | (conversation)                                                        |
| Something free within 30 minutes.                | free, ≤ 30 min                    | Centennial Outdoor Rink — “free public skating”, quoted               |
| I want to do something I've never tried.         | unusual                           | the rarest things Atlas holds here                                    |

Conversation: _"Something fun with my daughter"_ → asks _How much time?_ →
_"About three hours"_ → asks _How far?_ → _"Maybe 45 minutes"_ (read as a drive
because that was the question) → no more questions → _"Actually, somewhere
indoors"_ keeps child, 3 hours and 45 minutes, and moves the museum, bowling
and the nature centre up.

## Honesty rules this enforces

- **Free** is quoted from a description, never inferred; "free admission on
  Family Day" (Vernon Aquatic Centre) is _not_ claimed. Atlas has no price field
  for Discovery, and the note says so.
- **Drive times** are Atlas's routed estimates only. Without one, a place stays
  with its straight-line distance; only a physical bound (farther in a straight
  line than 100 km/h covers) removes anything, and that is never shown as time.
- **Activities** are Passport's labels over Atlas's words, and the card quotes
  the word ("Kayaking, as Atlas lists it", "A cinema").
- **A named activity Atlas cannot place** is still answered, each card saying it
  cannot be placed: all five cinemas in the fixture have no location.

## Measured

- Reading a four-sentence conversation, answering over the 2,492-candidate
  feed and building activity offers: **median 93 ms, p95 97 ms** in Node.
- In the browser (`next start`, Atlas stand-in): each turn's answer appeared in
  **175–382 ms** after pressing Update (three runs × four turns).
- Failure behaviour: no model key → the deterministic reading is used, nothing
  changes; a sentence with nothing readable says so (_"I didn't catch what
  you're after"_) and offers only real subjects; no origin → the answer asks
  _From where?_ with the town picker in place.

## Not verified here

- **Production Atlas.** No Atlas or token in this checkout; everything above is
  the committed fixture, which is newer than production Atlas (it carries
  `environment.exposure`; production did not as of 2026-10-11). Indoor/outdoor
  ordering degrades to activity tags where exposure is missing.
- **The model path.** No `OPENAI_API_KEY` here; `fillGaps` and the schema are
  unit-tested, the live call is not.
- **Routed drive times.** The stand-in serves no `/travel` routes, so every
  "within N minutes" answer here ran on the physical bound.
