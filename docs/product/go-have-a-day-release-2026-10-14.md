# Go Have a Day — integration pass, 2026-10-14

An integration and verification pass on `integration/release` at `1d09b18`.
No feature work. Read with `go-have-a-day-release-candidate.md` (what the
candidate is) and `docs/architecture/travel-times.md` (what routing needs).

## Where everything is

- **`integration/release` is the newest and most complete implementation.**
  Every Go Have a Day candidate branch is an ancestor of it except two:
  - `fix/ghad-understand-intent` — **obsolete.** Its two substantive commits
    (`dfdaf5d`, `548476d`) are in release as `a304b23` / `0ec23f8`, and
    release's `intent.ts` has since moved on (`b5d074e`, "a day asked for after
    its part of the day is over says so"). Merging it would conflict in seven
    files and regress `intent.ts`. Do not merge it.
  - `lane/boards` — **deliberately partial.** Its board-ownership and
    first-share fixes are in release (`17779a5`); the Adventures work is held
    back on purpose. See `group-adventures/`.
- Local `main` (`016854a`) is 94 commits behind release.
- **Production** (`gohaveaday.com/go`, `elk-passport.vercel.app/go`) serves an
  older build: `/labs` and `/labs/conference` are 404 and the homepage has no
  Conference link, both of which release has. Which release commit production
  is exactly could not be read (no Vercel access here).

## Gates on `1d09b18`

| Gate                     | Result                                                     |
| ------------------------ | ---------------------------------------------------------- |
| `tsc --noEmit`           | clean                                                      |
| `vitest run`             | 2911 passed, 3 skipped                                     |
| `eslint src e2e scripts` | 0 errors, 39 warnings (the M122 baseline)                  |
| `prettier --check`       | one file, fixed in this pass                               |
| `next build`             | clean                                                      |
| Playwright, `next start` | 133 passed, 12 failed, 38 skipped — all 12 explained below |

`eslint .` and `prettier --check .` also walk untracked `playwright-report/`
and `.claude/worktrees/`, which produced an 85 MB lint log and filled the
disk quota. Scope them to tracked source.

### The 12 e2e failures

- **Known baseline (3):** `core-loop:26`, `october:554`, `october:570`.
- **Load flakes (7):** `daybuilder:41/65/77/195`, `october-door:286`,
  `october-rooms:199`, `october:241` — all pass when re-run alone
  (`daybuilder.spec.ts` 15/15).
- **Environmental (2):** `labs:80` (desktop + phone) expects Atlas absent;
  the stand-in made it present.

## Real versus mocked — read this before believing a number

**Nothing in this pass touched live Atlas.** There is no `.env.local` and no
token in this checkout, by design.

- _Real data, not a real service:_ the committed 2026-10-11 snapshot of an
  actual `GET /discovery/candidates` body, served by a local stand-in. Places,
  coordinates and `schedule.onDate` readings are Atlas's.
- _Mocked:_ everything about Atlas the service. `/travel/legs` was answered
  404, which is what Atlas answered on 2026-10-11.
- _Probed read-only:_ `https://elk-atlas.vercel.app` answers `401` for every
  path, including nonsense ones, before routing. **So whether production Atlas
  serves `/travel/legs` cannot be determined without a token.**

## Scenarios (stand-in Atlas, snapshot 2026-10-11, planned for 2026-10-17/18)

| Scenario                       | Stops                                                                       | Notes                                              |
| ------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------- |
| Vernon family afternoon, age 5 | Civic Memorial Park → Allan Brooks Nature Centre → Paddlewheel Park         | 4 h, "only just works", says nobody measured roads |
| Kelowna day                    | McMillan Farms → City Park → Okanagan Lake → Jack Seaton Park → Cedar Creek | "Okanagan Lake" as a stop is vague                 |
| Rainy day, age 7, near Kelowna | Downtown Library → Winfield Arena → Gerni's Farmhouse → Allan Brooks        | indoors means indoors; Allan Brooks is 60 km out   |
| Short adventure close to home  | Civic Memorial Park → Polson Park                                           | no summary line rendered for this request          |
| Longer weekend, up to 90 min   | Polson Park → Kalamalka Lake → Kalamalka Lake Park → Pelmewash → Fintry     | five stops, distances shown as search estimates    |

Every travel figure is labelled as the plan's own allowance or a straight
line. None is presented as a measured road. That is correct behaviour while
legs are unserved, and it is also the product's biggest remaining weakness:
"home by 5 only just works" is the honest answer to a question Atlas could
settle.

## What is open

1. **Routing is not live.** Passport's side is built and tested; whether
   deployed Atlas serves `travel-legs/1` is unverified.
2. **Two small product observations**, not fixed here (no feature work):
   "Okanagan Lake" is a poor stop on its own, and the short-adventure request
   renders no summary line. Both want a Discovery look, not a patch.
3. **Deploy was not attempted.** This checkout forbids it (`CLAUDE.local.md`).

## Bounded Atlas mission to hand over

**Verify and, if absent, deploy `GET /travel/legs` (`travel-legs/1`).**

Acceptance:

- With the Passport service token, `GET /travel/legs?stops=<a>,<b>&mode=driving`
  for two real Vernon candidate ids returns `200` in the `travel-legs/1`
  envelope, with a real provider named and minutes that are plausible
  (Vernon → Kalamalka Lake Park is minutes, not hours).
- `mode=walking` and `mode=transit` each either answer or say they are not
  served; neither returns driving minutes under another name.
- An unknown id returns `404 { code: "unknown-stops" }`.
- No invented numbers: when the provider is down, the response says so.
- Passport's fixture `src/lib/domains/travel/__fixtures__/travel-legs-1.json`
  still validates against the live response.

## Addendum, 2026-10-15 — the homepage

Production still served Passport's static landing page ("Go have a day in the
Okanagan.") at `gohaveaday.com/`, with Discovery one click away at
`/discovery`. The cause is that production is behind this branch, not a bug in
this branch: `65c7f1a` already rewrites the domain's root to `/discovery`, and
Vercel has never been given it.

Found and fixed on top of it in this pass: the rewrite resolved its target
with `new URL("/discovery", request.url)`, which drops the request's query
string, so `gohaveaday.com/?age=5` reached Discovery without the age. The
target is now the request URL with only its path swapped (`middleware.ts`),
which also fixes the same loss on `iamoctober.com/`. `e2e/gohaveaday-door.spec.ts`
drives the real middleware with a `Host` header and pins the root, `www.`,
the query string, `/go`, `/discovery`, Passport's own host and
`iamoctober.com`.

Live state when checked (2026-10-15, read-only): `gohaveaday.com/` → 200, old
landing page; `www.gohaveaday.com/` → 308 to the apex (Vercel's domain
setting; the middleware no longer redirects either way, so no loop under
either setting); `gohaveaday.com/discovery` → 200 Discovery;
`iamoctober.com/` → 308 to `www.`. Deploy was not attempted from this
checkout (`CLAUDE.local.md`); the fix is live once `integration/release` is
deployed with `npx vercel deploy --prod` from a checkout that may.

## Addendum, 2026-10-15 — the experiences are findable

Owner decision: Passport is the platform, Go Have a Day is the flagship, and
Conference, Hockey Night and October are specialised experiences powered by
Passport. Until now the only ways into them from Go Have a Day were one
sentence on the Day Builder (Conference) or a link somebody sent you.

The shared bar (`PassportNav`) now carries an **Experiences** item between
Saved and the right-hand group. It is a button that opens a row under the bar
with three plain links to the existing routes: `/conferences`, `/hockey`,
`/october`. The row closes on a second press, on Escape, on a press outside
the bar, and on navigation. It opens _under_ the bar rather than floating over
it because the bar scrolls sideways on a phone, and a scrolling container
clips anything positioned past its edge. No access rule changed: `/hockey`
still sends a visitor to sign in and returns them, `/conferences` still
decides for itself whether it is open and whether a code or an account is
needed, and the middleware is untouched. Doctrine §10 records the decision;
the architecture question in §15 stays open. `e2e/experiences-nav.spec.ts`
drives the menu on desktop and on a phone.

Verified on `integration/release` with `next start` on port 3120 and the
Atlas stand-in: typecheck clean, 2918 unit tests, lint 0 errors (the 39
baseline warnings), build clean, and `experiences-nav`, `gohaveaday-door`,
`labs` and `release-navigation` green on desktop. Two environment facts from
the run, neither caused by this change: a `next-server` from an earlier
session was still answering port 3120 with an old build and had to be stopped
by PID before anything new could be measured (the `reuseExistingServer` trap
again); and under Pixel 7 emulation, this host's headless Chromium crashes its
GPU process a few seconds into an idle Discovery page with no interaction,
which takes down tests that linger there. The phone half of
`experiences-nav` therefore follows the three doors from the homepage, which
carries the same bar, and keeps two short tests on Discovery itself.
`/places` could not be checked locally because the stand-in serves
candidates and legs only; on production it is unchanged by this pass.
