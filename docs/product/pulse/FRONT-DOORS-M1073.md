# People's Pulse front doors (M1073)

Verified live 2026-11-24 on https://gohaveaday.com (prod 74859c9): `/labs/pulse`,
`/labs/pulse/new`, `/check`, `/check/new` all 200. On a phone, an unlisted
Pulse was created (201, 0.4 s), voted on (results shown at once), and the count
survived on the server (`/api/pulse/<id>` total 1). The public shelves were
empty: production had no listed Pulses, so the landing page was three
"nothing yet" lines above an 8,600 px page of ways and templates.

Changed (no new data, no migration, nothing invented):

- **Landing leads with what exists.** Shelves: Trending, Worth sharing (5+
  answers), Local questions (a province or town), Recent. A shelf with nothing
  on it is not shown. The five ways to ask and the templates now come after.
- **Questions worth asking** (`STARTERS`): shown only while fewer than three
  Pulses are recent. They are prompts, not Pulses: no votes, no implied result.
  Tapping one opens `/labs/pulse/new?q=…` with the words in, editable.
- **Pulse Check: "Is this true?"** on `/check` is one box. A pasted link goes
  into the wizard's link field, anything else into its claim field
  (`/check/new?q=`). Evidence, assessment and votes stay separate and nothing
  is verified automatically; empty Check shelves collapse to one honest line.

Not done / limits: Trending needs 3 votes in a day; "Worth sharing" is a vote
threshold, not a measure of spread; Local is by what a question is about, never
where anyone is; the live test Pulse `zcytdka4` is unlisted and remains.
