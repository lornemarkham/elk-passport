# Discovery performance and intelligence — 2026-10-15

Forge mission "DISCOVERY PERFORMANCE AND INTELLIGENCE". Measured on
`integration/release` 56f7247 (before) and the working tree built from it
(after), `next start`, against the committed Atlas fixture
(`docs/product/critic/evidence/atlas-candidates-2026-10-11.json.gz`, 2,979
candidates) served by `scripts/critic/atlas-mock.mjs`. **Local, not production:**
no production Atlas, Vercel or network was involved.

## Measured

| `/discovery`, signed out                         | before                                     | after                                                                            |
| ------------------------------------------------ | ------------------------------------------ | -------------------------------------------------------------------------------- |
| Document, uncompressed                           | 6.52 MB                                    | 4.10 MB (−37%)                                                                   |
| Document, gzip                                   | 790 KB                                     | 507 KB (−36%)                                                                    |
| Candidate data inside it (flight)                | 5.64 MB                                    | 4.60 MB                                                                          |
| First byte, cold instance, Atlas read = 8 s      | 0.12 s                                     | 0.13 s                                                                           |
| …what that first byte is                         | a cream page, "What could you do?", no bar | the real bar, "What do you feel like doing?", the date, the question box's shape |
| Page ready (question box usable), same cold read | 8.54 s                                     | 8.52 s                                                                           |
| Warm request                                     | 0.13 s                                     | 0.14 s                                                                           |

The 8 s is a synthetic delay in front of the mock (`Atlas` measured 8–19 s in
`atlas-repo.ts`); **the cold wait itself is unchanged** — it is Atlas's, and
nothing here makes Atlas faster. What changed is what the person looks at
during it, and how much has to arrive afterwards. The same-corpus "before"
raw size (6.5 MB here) differs from the 5.7 MB reported from production
because the production corpus is a different snapshot.

## What was done

**First paint** — `app/discovery/{page,loading,error}.tsx`,
`DiscoverySkeleton`, `DiscoveryFailure`, `PassportNav pending`.
The page awaits only `searchParams`. The bar and a page-shaped frame are in
the first bytes; the corpus and the reader's identity stream in behind them in
separate `<Suspense>` boundaries. The frame renders the heading and date with
`FeelLikeHeading`, the same component the real page uses, on the same white
ground and container, so the two cannot drift. The bar's reader slot reserves
its width rather than saying "Sign in" to someone about to be greeted by name.
`error.tsx` keeps the bar and the page's type instead of a cream card. Verified
by `e2e/discovery-journeys.spec.ts` ("a slow Atlas shows Discovery's own bar
and frame…", desktop and phone) with screenshots `10-slow-atlas-waiting.png`.

**Payload** — `domain/discovery/wire.ts`. Drops what no Discovery surface
reads (`environment.season`, `knowledge.practical`/`conditions`,
`schedule.statements`, suitability provenance, `slug`, geography evidence, the
duplicate description) and, separately, keys holding `undefined`, which cross
the server boundary as the literal `"$undefined"`. `wire.test.tsx` renders the
real view from the full and the lean pool and requires identical markup,
requires identical `answerAsk` output for five questions, and asserts by name
that no Discovery source reads a dropped field.

**Cold-start dependence on Atlas** — `atlas-repo.ts`.

1. `listRegions()` was an uncached Atlas request on every page view, on the
   critical path. It now shares the corpus's cache (successes only).
2. A warm instance whose refresh _fails_ now serves what it holds for up to six
   hours (`STALE_IF_ERROR_MS`) and says so in its log, instead of the error
   page. A cold instance still reports `AtlasUnavailableError` exactly as
   before. **This is a decision for the owner:** it trades freshness for
   availability; the constant is one line.
3. The weather read now runs beside the corpus read instead of after it.

**Ask** — `/api/discovery/ask`: same-origin only and a per-client limit (12 a
minute, 100 an hour; 429 + `Retry-After`), counted after validation and before
the model is reached. The browser keeps its own reading when refused. A
sentence nothing could be read from ("blorp zxq", "take me to Atlantis",
"waterfall") used to get "Picked from what fits your answers, each for a reason
you can check"; it now says "I didn't catch what you're after", names what it
can read, and says Passport only offers places Atlas knows about. The model
cannot name a place — its output has no field for one, a verb must be one Atlas
offers, a town must be in `towns.ts` — and a test now pins that against a model
that returns a destination, picks and a made-up town.

## What was not done, and why

- **Lead/tail split of the pool (smaller initial result, rest loaded after
  hydration).** Investigated, not built. On this corpus `defaultFeed` keeps
  2,492 of 2,979, so "ship the feed first" saves almost nothing, and the page's
  own _counts_ ("Hiking 60", "N more in …", the kind chips, "the only llama farm
  in Okanagan") are computed over the whole pool: a partial pool would show
  wrong numbers and then jump, and `?ask=`, a pending save replay and the saved
  sidebar would each need a "not complete yet" state. That is a change to what
  the page claims, not a payload tweak. **Needs a decision:** server-side
  paging/search with counts supplied by Atlas, or accept the whole pool.
- **Shared cache across instances.** Not implementable here. The Next/Vercel
  Data Cache refuses items over 2 MB and the corpus is ~4–7 MB; a CDN cache
  needs the data behind a public, cookieless route (`/api/discovery/pool`) that
  does not exist; anything else (KV, Blob, a Supabase table) needs a store and
  credentials this checkout is forbidden to create. The per-instance cache stays.
- **Prerender or snapshot of the corpus** to remove the cold read: rejected. It
  would put a stale copy of Atlas's facts (events, closures) in the repo or
  the build.

## Is OpenAI active in production?

**Unknown from here.** In code: `OPENAI_API_KEY` set means
`/api/discovery/ask` asks `OPENAI_DISCOVERY_MODEL` (default `gpt-4o-mini`) to
fill gaps the words left, 4 s timeout, any failure falls back to the words; it
is also read by `/api/recommend`. Whether the key is set on Vercel could not be
checked: reading project env was previously denied, and a probe of the public
endpoint was denied by the auto-mode classifier in this session. No key was
read, printed or written. To settle it without touching secrets:

```
curl -s -X POST https://gohaveaday.com/api/discovery/ask -H 'content-type: application/json' \
  --data '{"said":"something to burn off the kids energy before dinner","today":"2026-10-15","verbs":["Hiking"]}'
```

`"by":"model"` means active; `"by":"words"` means no key, a timeout or an
old deploy. (Production may predate this route's rate limit — it will answer
the same either way.)

## Atlas dependencies still on Discovery

- `GET /discovery/candidates` — per `(childAge, on)` key, per instance; 8–19 s
  cold. Every distinct `?on=` is its own cold read.
- `GET /admin/regions` — now cached; needs `ADMIN_TOKEN`; without it the page
  has no scope.
- On user action: `/api/discovery/distance`, `/api/discovery/travel`.
- Not Atlas: weather (Environment Canada), boards and identity (Supabase).
