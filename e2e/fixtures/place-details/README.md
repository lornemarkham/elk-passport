# Place details acceptance fixtures (M1041)

Composed Organization reads (`GET /organizations/:id/detail`) served by
`e2e/support/place-details-standin.mjs` for `e2e/place-details.spec.ts`.

- `long-johns.json`, `alexanders.json`: the thin records production Atlas held
  on 2026-11-23 (description and Tourism Vernon sources only), so the specs
  show what the shared page makes of them plus the local-favourite overlay.
- `roster.json`: **a fixture, not Atlas data.** Production Atlas held no
  record for The Roster Sports Club Bar & Grill on 2026-11-23 (Atlas mission
  1040 was adding it). It is shaped like a text-heavy record read from a
  business website — long passages, publisher headings — using the venue's
  public listings (address, phone, site, what it offers) so the page can be
  judged on realistic content. Its id is `e2e-roster-sports-club`. Replace it
  with the real composition once Atlas serves one.
- `places/kalamalka-lake.json`: an Atlas Place read (`GET /places/:id/detail`)
  built from the real Kalamalka Lake candidate in the critic's 2026-10-11
  snapshot (name, type, point, description, lead photo), with one Wikipedia
  source. It shows the shared frame around the Place page's own sections.
