# GO HAVE A CONFERENCE — Features and their real status

> **Status as of 2026-10-11, branch `feature/go-have-a-conference`.** Not
> merged to `main` and not deployed.
>
> | Word          | Means                                                                          |
> | ------------- | ------------------------------------------------------------------------------ |
> | **Built**     | On this branch, with tests, and driven in a browser at 375 px                  |
> | **Partial**   | Some of it is built. The row says which part                                   |
> | **Prototype** | Working code exists somewhere else, not on this foundation. The row says where |
> | **Proposed**  | Designed or described, with no code                                            |
>
> Oct 24 tier: **Must** / **Stretch** / **Later** (see [`ROADMAP.md`](ROADMAP.md) §3).

## The 27 ideas

| #   | Idea                                         | Status                                                                                                                                     | Workstream           | Oct 24  |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | ------- |
| 1   | Creation by ordinary Passport users          | **Built.** Any signed-in user; guests too where `CONFERENCE_GUEST_ORGANISERS=1` (D2)                                                       | conference           | Must    |
| 2   | Administrator dashboard                      | **Built:** details, branding, modules, code, links, members, delete. Co-organisers are proposed                                            | conference           | Must    |
| 3   | Private membership and invitations           | **Built:** 404 for non-members, hidden by default. Per-person invitations are proposed                                                     | conference           | Must    |
| 4   | Shareable links and access codes             | **Built:** expiring, use-limited and revocable links; rotatable, switch-off-able codes; a brake on wrong guesses                           | conference           | Must    |
| 5   | Branding and customization                   | **Partial:** accent colour (with readable ink), tagline, welcome. Cover image proposed                                                     | conference           | Must    |
| 6   | Schedules and organized activities           | **Proposed.** Module slot and placeholder route exist                                                                                      | events               | Must    |
| 7   | Staff hockey game as featured activity       | **Prototype:** `lane/boards` `62e9900` (_Awaiting confirmation_), Sycle-in-code                                                            | events               | Must    |
| 8   | Flight number entry and arrival dates        | **Prototype:** untracked `/sycle` in the main checkout                                                                                     | flights              | Must    |
| 9   | Shared world map of incoming flights         | **Prototype:** `/sycle` (azimuthal map centred on YVR)                                                                                     | flights              | Must*   |
| 10  | Live positions where provider permits        | **Proposed.** `/sycle` can draw one if reported; no provider reports one there                                                             | flights              | Later   |
| 11  | Arrival countdowns and welcome               | **Partial:** conference countdown built (in the conference's time zone). Per-flight countdown and "You made it" are prototypes in `/sycle` | conference / flights | Must    |
| 12  | Community feed                               | Proposed                                                                                                                                   | social               | Later   |
| 13  | "Where is the best restaurant?"              | Proposed (feed)                                                                                                                            | social               | Later   |
| 14  | "Where can I buy shoes?"                     | Proposed (feed)                                                                                                                            | social               | Later   |
| 15  | "What's everyone doing tonight?"             | Proposed (feed + plans)                                                                                                                    | social / groups      | Later   |
| 16  | Shareable Atlas-backed place cards           | Proposed. `ConferencePlaceRef` contract is built                                                                                           | social / discovery   | Later   |
| 17  | Shared maps of recommended places            | Proposed                                                                                                                                   | discovery            | Later   |
| 18  | "I'm going there at 7. Anyone coming?"       | Proposed                                                                                                                                   | groups               | Stretch |
| 19  | Shared activities, opt-in participation      | **Prototype:** `lane/boards` interest marks (stated, named by choice)                                                                      | groups               | Stretch |
| 20  | Colleagues with similar interests            | **Prototype:** `lane/boards` `kindredColleagues`, on a Board                                                                               | groups               | Later   |
| 21  | Group adventures using GO HAVE A DAY         | Proposed                                                                                                                                   | groups + daybuilder  | Later   |
| 22  | Discovery from conference location and dates | **Partial:** location built (doors into `/go` with `at=<town>`). Dates proposed                                                            | discovery            | Must    |
| 23  | Free time between sessions                   | **Partial:** "Two hours between sessions" door built. Gap-aware timing needs the schedule                                                  | discovery + events   | Must    |
| 24  | Optional real-time chat                      | Proposed                                                                                                                                   | social               | Later   |
| 25  | Privacy controls and attendee visibility     | **Built:** hidden/members per person, a name required to be seen, leave-and-forget, organiser removal, 30-day expiry on read, `noindex`    | conference           | Must    |
| 26  | Preserve personal adventures afterward       | Proposed. The 30-day retention window exists for it; `lane/domain`'s Adventure is the likely vehicle                                       | conference + domain  | Later   |
| 27  | Reusable for retreats, weddings, etc.        | **Partial:** `kind` (6 kinds) changes wording only; Sycle is a config fixture, not code                                                    | conference           | Must    |

\* Cut line 2 in the roadmap: the map goes before the arrivals list does.

## What the foundation actually contains

| Piece                                                                                           | Status                 | Where                                              |
| ----------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------- |
| Domain types, details schema, policies, views                                                   | Built                  | `src/domain/conference/`                           |
| Module contract (`ConferenceContext`, `ConferenceLifecycle`, `MemberRef`, `ConferencePlaceRef`) | Built                  | `src/domain/conference/contracts.ts`               |
| Module registry and placeholder routes                                                          | Built                  | `modules.ts`, `src/app/conferences/[id]/[module]/` |
| `discover` module (first real module, shows the override pattern)                               | Built                  | `src/app/conferences/[id]/discover/`               |
| Identity: Passport user or signed guest cookie                                                  | Built                  | `src/lib/conference/identity.ts`                   |
| Service (create, edit, delete, code, links, join, me, leave, remove, reads)                     | Built                  | `src/lib/conference/service.ts`                    |
| HTTP API (10 endpoints)                                                                         | Built                  | `src/app/api/conferences/`                         |
| Pages: list, new, join, invite landing, home, admin                                             | Built                  | `src/app/conferences/`                             |
| Memory store                                                                                    | Built                  | `src/lib/conference/store.ts`                      |
| Durable store                                                                                   | **Built, not applied** | `migration.sql`, REAL-PEOPLE.md (D3)               |
| Guest → account claim                                                                           | Proposed               | D2                                                 |
| Nav entry                                                                                       | Proposed               | D7. Reachable by URL only                          |
| Co-organisers, per-person invites, cover images                                                 | Proposed               | Roadmap phase 4–5                                  |

## Tests

| Suite                                  | What it pins                                                                                                                                                                                                                                                                                  |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/conference/service.test.ts`   | Sycle from config; strangers can't tell a conference exists; hidden by default; members never see codes, links or identities; code rotation and off; link revoke, expiry, use limits; dead links still take members home; leave/remove/delete reach every module; 30-day expiry and moving it |
| `src/domain/conference/domain.test.ts` | Schema rejections (including CSS injection through the colour); invite states; code alphabet; readable ink; countdown in the conference's zone; registry; `/go` doors                                                                                                                         |
| `src/lib/conference/identity.test.ts`  | Cookie signing; account beats guest; production stays closed without secret and store; code brake                                                                                                                                                                                             |
| `e2e/conference.spec.ts`               | Organiser creates and opens a code and a link; a stranger gets 404; join by link and by sloppy code; choose to be seen; members can't reach admin; revoked link dies. Skips (doesn't pass) without conference env                                                                             |
