# Dream — a Labs experiment (M1130)

> **Discover when you know. Dream when you don't. Go when you're ready.**

Owner brief: _GoHaveADay — Dream Experience_ (mission 1130, 2026-11-26).
Status: **Experimental, Labs only, behind `GHAD_DREAM`.** It is not merged or
deployed, and in production it is a 404 until the flag is set.

Route: `/labs/dream`. Endpoint: `POST /api/labs/dream`.

---

## What it is

A single page that takes a person from "I know exactly what I want" or "I have
no idea" to a real day they can go and do, without forcing either kind of
person through the other's interface.

1. **The opening.** A slow reel of real places near you, each one Atlas's own
   photograph, named, with its distance, and a tap away. Over it are the three
   lines, one box (typed, or spoken where the browser can listen), and two
   doors: **Surprise me** and **Help me figure it out**. There's also a "Try"
   row with the five intentions from the brief, the place you're looking from,
   and plain links to Discover, Build a day by hand and Christmas for anyone
   who would rather browse.
2. **Say it.** The sentence becomes **scenes**, one for each thing named
   (_the rinks, the lights, the cafés_). Each scene has a lead photograph, what
   Atlas lists that puts it there (quoted), the publisher's own hours or
   prices, the distance, **Directions**, **Hours & details** (the one shared
   place page) and **Not this one**. The other real choices sit on a shelf
   beside it; tapping one makes it the lead and puts it in the day.
3. **Go.** The Day Builder joins the scenes into one day, built around what
   the scenes chose. What it could not do is said first. **Plan it, save it,
   start it** opens the same day in Go Have a Day (`/go?say=…&with=…&at=…&on=…`),
   where it is kept, shared, printed and started (Live). **The whole route in
   Maps** and **Print the guide** sit beside it.
4. **Change anything.** A box docked at the bottom, plus contextual
   refinements ("Make it free", "Closer to home", "Keep us indoors", "Add
   dinner", "Worth the drive — look further"). A later sentence changes what
   it mentions and leaves the rest alone (doctrine §2.5): "skip the lights"
   drops one scene and keeps the day, the budget and the radius.
5. **Help me figure it out.** Four pairs of real photographs near you, one
   question and one tap each: _Out in it, or somewhere warm? · Move, or be
   moved? · Daylight, or after dark? · Stay close, or worth the drive?_ The taps
   write a sentence ("A walk in the woods and skating, this afternoon, close to
   home"), which is shown as what you said and answered by the same reader.
   The places on the photographs picked are kept for the day. Nothing is
   remembered.

The conversation is the state, kept in the URL (`?say=…&say=…&at=…`), so
Back, refresh and a shared link all land on the same answer.

## How it is built: reuse first

| Need                               | Reused                                                                               | New                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Read a sentence                    | `readBrief` / `reviseBrief` (`/go`), `readAsk` (Discovery: "tomorrow", lenses)       | Intent modes: ask · surprise · unsure                       |
| Know what a place offers           | ADR 007 activities, `activityEvidence` (Atlas's words)                               | Five Passport-side ingredients (below)                      |
| Christmas lights, dates, prices    | `readChristmas`, `readWhen`, `priceOf`, `directionsOf` (Christmas)                   | —                                                           |
| Hours and admission                | `usefulFacts` (occasion / Day Builder)                                               | —                                                           |
| Compose a day                      | `buildDay` (the one planner), with `keep` / `order` / `without`                      | The stay is appended as the night's end                     |
| Corpus, hygiene                    | `listDiscoveryCandidates` (same cache entry as `/go`), `dayPool`, `forDiscoveryPool` | Atlas's `onDate` is dropped when the day asked is not today |
| Photos                             | `cardPictures` (never a stand-in)                                                    | Skip URLs that say they are logos                           |
| Place pages, planning, live, print | `destinationFor`, `/go`, `/go/print`                                                 | —                                                           |
| Where you are                      | `useLocation()` (ADR 020 shared place), `PLACE_COOKIE`                               | —                                                           |
| Voice                              | the Web Speech API pattern from `insiders/ShareForm`                                 | `useSpeech` hook                                            |

The ingredients kept on the Passport side, and why:

- **Christmas lights** are read by Christmas's own reader, so a lights display
  means the same thing here as on `/christmas`.
- **Somewhere to stay** is offered only when it is asked for (§12: "a bed is
  asked for, never offered").
- **Hot springs** must be a place that says _hot spring_. ADR 007 files "hot
  springs" under Spa, which would hand a resort spa to someone who asked for a
  free soak in the woods. That is a substitution, so it is not done here.
- **A campfire** must be a place that states campfires or fire pits.
- **An incredible dinner**: Atlas rates no restaurant and lists no menus or
  price bands for them. When someone says money is no object, the ranking
  prefers restaurants that describe themselves in occasion words (_upscale,
  fine dining, chef, lakeside, seasonal menu…_) and quotes those words on the
  card. Cafés and quick bites are never offered as dinner.

## The five intentions, as answered (production corpus, Vernon, 2026-11-26)

| Said                                               | What comes back                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _I'm bored. Surprise me._                          | Three pictured places within 30 km: the big thing (Museum and Archives of Vernon / Caravan Farm Theatre…), then outside (Silver Star Foothills…), then to finish (Okanagan Spirits…). A day of all three. **Surprise me again** re-deals.                                                                                                                                                                                                                                   |
| _Two kids tomorrow, $40, four hours… within 10 km_ | Heard: kids · 4 hours · $40 · within 10 km · tomorrow. Rinks that say "Free public skating" (Centennial Outdoor Rink, Priest Valley, Kal Tire Place). Coldstream Light-Up, shown as **not on the day you asked** (it is Sun Nov 29), and kept out of the day. Cafés, called cafés. Day: rink → café, with "Atlas has no light display listed near Vernon for that day" said first.                                                                                          |
| _Impress someone… restaurant, lights, hotel_       | For two, no budget. Dinner leads with **The Edge** ("upscale", "locally sourced") and **The Edge Restaurant & Bar** ("fine dining"). Light-ups further out, labelled. Resorts and lodges. Day: The Edge → _A 1940s Radio Christmas Carol_ (dated to that day) → **The Rise Resort** to end the night ("Atlas lists no rates or rooms; book it yourself").                                                                                                                   |
| _Broke… woods, stars, campfires, free hot springs_ | Free. Trails and a nature centre, then BX Falls. Stars: nothing within 30 km; **Dominion Radio Astrophysical Observatory, 110 km, further than you asked**. Campfires: Fintry and Kekuli Bay provincial parks and Ellison Park, which state "Campfires". Hot springs: _"Atlas doesn't hold a single hot spring in this part of BC. Passport won't swap in a spa and call it one."_ Every card with no stated price says _No price listed — check before you count on free._ |
| _I don't know what I want…_                        | The four photo pairs, then the answer to the sentence they made.                                                                                                                                                                                                                                                                                                                                                                                                            |

These shapes are pinned by `src/domain/dream/dream.test.ts` against the committed
Atlas fixture of 2026-11-14 (24 tests: real ids only, budgets respected, no
spa as a hot spring, no café as dinner, dated things not on the day kept out
of it, the hotel last, refinement leaves the rest alone).

## Performance (measured 2026-11-26)

`next build` + `next start`, local Atlas stand-in serving the production
corpus snapshot of 2026-11-25 (7,039 candidates). Phone: 390×844, 4× CPU
slowdown, 1.6 Mbps down, 150 ms RTT.

| Page          | TTFB   | FCP    | LCP        | CLS   | Transferred               |
| ------------- | ------ | ------ | ---------- | ----- | ------------------------- |
| `/labs/dream` | 11 ms  | 2.12 s | **3.09 s** | 0.051 | 3.2 MB (1.3 MB is photos) |
| `/discovery`  | 17 ms  | 2.07 s | 10.03 s    | 0.058 | 11.3 MB                   |
| `/go`         | 271 ms | 2.02 s | 2.02 s     | 0.002 | 2.1 MB                    |

- **An answer:** 220–245 ms from Enter to scenes on the throttled phone.
  On the server it is ~30–80 ms of composition on a warm corpus (it sends a
  `server-timing` header) and **9–14 KB of JSON**. The figure deal is ~6 KB.
- **Why it is fast:** the pool never goes to the browser (`/go` serialises
  its pool; Dream sends only the chosen cards). The page shell streams before
  Atlas answers, and the reel streams in behind it.
- **Motion** is transform and opacity only, and stops under
  `prefers-reduced-motion`. Only the first reel frame is fetched eagerly; the
  rest load as they come up.
- Unthrottled locally: FCP 108 ms, LCP 108 ms.

Not measured: a real phone, a cold production Atlas read (8–19 s, shared with
`/go`; the shell is unaffected, but the reel and the first answer wait), or
real remote photo hosts at production distance.

## Atlas integration assessment

**What worked:** every place, picture, date, price and hour comes from Atlas
through existing Passport readers. Atlas's activity words (ADR 007) answered
skating, hiking, coffee, restaurants and stargazing well. Christmas's lights
reader answered "lights". Campfires were found from stated features.

**Gaps that limit Dream (Atlas missions, not Passport code):**

1. **No hot springs at all** in the corpus. Free BC hot springs are among the
   most desired destinations a person can name (doctrine §2.3).
2. **No restaurant quality signal**: no ratings, price bands or menus. "An
   incredible restaurant" can only be ranked from the restaurant's own words.
3. **No hotel rates, availability or star class.** Hotel cards say so.
4. **Christmas light displays near Vernon**: one dated light-up (Coldstream,
   Nov 29) and none for other days. The community Lights Map is not in this
   corpus.
5. **Wrong or non-photographs held as the place's own picture:** Centennial
   Outdoor Rink's photo is a meadow with a child; Okanagan Rail Trail's is the
   City of Kelowna logo (`city-of-kelowna.jpg`, so no URL rule can catch it).
   Six more logos are caught by a URL rule (`NOT_A_PHOTOGRAPH`).
6. **Stargazing**: one stargazing listing and a few observatories. Dark-sky
   places are not modelled.
7. **Video**: Atlas holds none. The brief asked for "appropriate video". There
   is no licensed footage of these places, and Passport will not use unrelated
   stock (§12, 2026-11-13). The reel's slow movement stands in for it.

## AI cost assessment

**Current cost: $0.** There is no model call anywhere on the route. The
reading is Passport's deterministic readers. There is no key, no network call
to a model provider and nothing metered, so traffic cannot create spend.

If a model were added later, the place it would earn its keep (§3) is reading
sentences the rules don't understand. The obvious seam is to call the existing
`readAskWithModel` (Discovery, OpenAI `gpt-4o-mini`, closed-set output, never
naming a place) **only when the rules read nothing**, behind its own flag and
a daily call cap. At roughly 600 input and 150 output tokens per call, that
is a fraction of a cent per call: on the order of $1–2 a day per 10,000
model-read sentences. That estimate uses the model's published rates at the
time it was chosen; check current pricing before switching it on. This is
**not built**: it needs a key, and spending needs the owner (Build mode,
"spending outside a budget").

## Doctrine and conflicts (named, not resolved)

- **§13 Inspiration is fenced off** ("DO NOT DESIGN OR IMPLEMENT INSPIRATION
  YET"). The brief asks for cinematic, emotional discovery for people who
  don't know what they want, which is close to that fence. Dream was built
  because the owner asked for it by name, as an isolated Labs experiment. It
  stays grounded: it recommends only real Atlas places and builds a real day.
  It uses no personalised media, no stored taste and no immersive video.
  Whether this is "generic Discovery made beautiful" (§12) or the start of
  Inspiration (§13) is the owner's call.
- **§3 AI is not a tab.** Dream is not a chatbot. It is one sentence box
  among photographs, doors and ordinary controls, and every reading is shown
  back ("Heard", with assumptions marked).
- **§5 Signals are not truth.** Figure-it-out picks and "Not this one" live
  only in this page's state and URL. Nothing is stored.
- **§2.1 No questionnaire.** The figure flow is optional, skippable at every
  step, and four taps long.
- **§15.3 / §15.14 stay open.** "Not this one" is a refusal for this answer,
  not a taste signal. Dream does not save anything. Saving and starting happen
  in Go Have a Day.

## Known limitations

- A day is one day. "This weekend" is read as its Saturday (Discovery's
  reader), so a two-day ask is answered as the Saturday. With no day named, it
  is today, shown as _today · assumed_.
- Party size is not counted ("two kids" is a family, not three people), so
  "$40" is the whole budget, as `/go` reads it.
- Travel is straight-line km, not routed time (the same as `/go`).
- The opening reel needs the corpus. On a cold Atlas read it is dark until
  the read finishes, while the box and doors work at once.
- Voice uses the browser's speech service (Chrome or Safari). Firefox shows
  no microphone, and the text box is always there.
- Some remote photo hosts refuse cross-site embedding. Those cards fall back
  to the text treatment.

## Reversing it

Unset `GHAD_DREAM` (production default: off). To remove it entirely, delete
`src/app/labs/dream`, `src/app/api/labs/dream`, `src/components/dream`,
`src/domain/dream`, `src/lib/dream`, this folder, the `dream` entry in
`src/app/labs/experiments.ts` and the `dream` entry in
`src/app/creative/archive.ts`. No migration, no store, no shared contract
changed.
