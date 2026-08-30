# Discovery report fixtures — two contract eras, kept apart on purpose

Atlas's serialized `DiscoveryReport` gained required fields **after** some of these
reports were captured. Rather than edit old captures until they look current, the
fixtures are split by the contract they were produced under, and each era is used
for the questions it can actually answer.

Both directories hold **real producer output**. Nothing here is hand-authored, and
no evidence-bearing field (`publisherAccounts`, `knownNames`, `corroboration`,
`identity`, `structuredRecords`) has been written by hand in either directory.

---

## `historical/` — captured 2026-08-16, before ADR 039 and ADR 040

Five reports from `NamedDiscoveryService` as it stood on 2026-08-16.

They **do not satisfy today's contract**, and that is not damage — it is the
contract having moved:

| Field they lack         | Added by                                                                      |
| ----------------------- | ----------------------------------------------------------------------------- |
| `leads[].corroboration` | **ADR 040** — Corroboration is a property of every lead (accepted 2026-08-17) |
| `publisherAccounts`     | **ADR 039** — A strategy outcome belongs to a publisher (accepted 2026-08-17) |
| `knownNames`            | the bounded-lake workflow                                                     |

Both ADRs were accepted the **day after** these captures.

### Why they were not migrated forward

`publisherAccounts` requires a per-publisher `outcome` of
`found | nothing | failed | not-asked`. These reports cannot supply it. Their
`strategies[]` carry `number, name, status, detail, bounding, nextAction` and **no
`publisher`** — that field is exactly what ADR 039 added — so no rung's outcome can
be attributed to a publisher.

Wikipedia is the case that settles it. It has `participated: true` and produced two
leads, but both are `basis: "constructed"`, and ADR 040 is explicit that a
constructed URL is not evidence a page exists — so `found` is false. The only rung
that consults Wikipedia's _index_ (3.5, Wikipedia search) is `skipped`, so `nothing`
would convert an unasked index into an authoritative negative. `failed` invents a
failure that never happened, and `not-asked` contradicts `participated: true`.

**Every available value would be a claim the report does not make.** So none is
written. See `RegionDiscovery.contract.test.tsx`, _"the historical contract"_.

### What they are still evidence of

`beaverLake.json` and `swalwellLake.json` record a **three-publisher convergence** —
OpenStreetMap `relation/1697950`, BC Geographical Names `bcgnis/20899`, BC Freshwater
Atlas `fwa/705020305` — the worked example in **ADR 036**. That evidence is live and
official; what has changed is the door Atlas uses to reach it. The BC Geographical
Names MapServer layer serves an incomplete ~5,000-record extract that no longer
contains the record, so a current run of the same investigation converges on **two**
publishers. Tracked in `atlas/docs/open-investigations.md` — _"Atlas's BC gazetteer
source is a 5,000-record sample"_. These fixtures are the preserved record of the
three-publisher case and must not be regenerated.

---

## `current/` — captured 2026-08-30, from the running Atlas

Captured by `POST /admin/discovery/named` against the Atlas API on `:3000`, with
`regionId` = the Okanagan (`e88d6cf2-5588-439d-ae69-0d089487503b`). Saved verbatim;
only whitespace is normalised.

| File                            | Subject                                                            | Exercises                                                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `beaverLake-proposed.json`      | _Beaver Lake_ → `identity: proposed`, `nextMove: confirm-identity` | the identity proposal panel and the verdict headline — both _"I think I found your place"_ surfaces — and _confirm the identity, don't read an invented URL_ |
| `swalwellLake-constructed.json` | _Swalwell Lake_ → `nextMove: read-constructed`                     | the subject-specific CTA, _Try “<subject>” on <publisher>_                                                                                                   |

Both are used by `RegionDiscovery.contract.test.tsx`, _"the current contract"_ and
_"rendering, against current producer output"_.

**To refresh one:** re-run the same call and overwrite that file. Never overwrite
anything in `historical/`, and never move a field between the two directories.
