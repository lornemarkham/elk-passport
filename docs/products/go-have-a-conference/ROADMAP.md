# GO HAVE A CONFERENCE — Roadmap

> **Status:** plan, 2026-10-11. **Nothing here is approved** until the
> decisions in §1 are made. Dates are targets, worked back from the first real
> conference on **Saturday, October 24, 2026**. Today is Sunday, October 11,
> so there are 13 days.
>
> The order of work changes for the deadline. **The vision does not.** Every
> idea in [`VISION.md`](VISION.md) §5 has a place below, including the ones
> that aren't for October.

---

## 1. Decisions a human has to make

These block the October 24 plan. Each one is a product or spending call, not
an engineering one.

| #      | Decision                                                                                                                | Why it matters                                                                                                         | Options                                                                                                                                                                                                                                                | Needed by |
| ------ | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| **D1** | **Is a conference a Board?** ([ARCHITECTURE §2](ARCHITECTURE.md#2-the-big-unresolved-question-is-a-conference-a-board)) | `lane/boards` and this foundation model the same group two ways. Merging both gives Passport two membership systems.   | (a) adopt the foundation, and `lane/boards`' gathering work seeds `passport-events` and `passport-groups`; (b) build conferences on Boards; (c) other                                                                                                  | Oct 13    |
| **D2** | **Do participants need a Passport account?**                                                                            | 160 sign-ups before the welcome page, against guest cookies that are lost with a phone.                                | Foundation default: participants **no**, organisers **yes** in production. Alternatives: accounts for everyone; or guests now and _claim to account_ later                                                                                             | Oct 13    |
| **D3** | **Durable store**                                                                                                       | Memory only exists today. Production is closed until this is decided.                                                  | (a) **Built, not applied:** Supabase tables in [`migration.sql`](migration.sql), run as the signed-in person under RLS, so no privileged key and no guests ([REAL-PEOPLE.md](REAL-PEOPLE.md)); (b) Vercel KV / Upstash; (c) one long-running Node host | Oct 13    |
| **D4** | **Can organisers see hidden members?**                                                                                  | The foundation says yes (so they can remove people), and tells members so on the screen.                               | yes (current) / counts only / opt-in                                                                                                                                                                                                                   | Oct 16    |
| **D5** | **Flight provider and spend**                                                                                           | Arrivals needs real data. Research is in `docs/sycle/flight-data.md` in the main checkout, which is untracked.         | AeroDataBox ~$19–40 for the month (recommended there); FlightAware ~$100+                                                                                                                                                                              | Oct 14    |
| **D6** | **Sycle's facts**                                                                                                       | The brief gives only "Vancouver" and "October 24". The foundation stores nothing it wasn't told.                       | From Sycle organisers: last day, arrival airport(s), the hockey game's date, time, venue and how to take part, and who confirms them                                                                                                                   | Oct 16    |
| **D7** | **Where it lives**                                                                                                      | `/conferences` on the Passport host, linked from nowhere yet. The nav (`src/components/shell/`) is a shared contract.  | URL only (current) / in the nav / its own experience domain (doctrine §15.1 is open)                                                                                                                                                                   | Oct 18    |
| **D8** | **Deploy approval**                                                                                                     | Nothing in this work deploys. Someone has to say yes, with the env set.                                                | n/a                                                                                                                                                                                                                                                    | Oct 19    |
| **D9** | **What happens to the untracked `/sycle` prototype**                                                                    | ~4,200 lines in the integration checkout's working tree, **not committed anywhere**, so one `git clean` would lose it. | Commit it to its own branch now (recommended), as the seed for `passport-flights`                                                                                                                                                                      | **Today** |

---

## 2. Workstreams

### 2.1 What exists before any new lane is made

Dispatcher lanes on Metatron (`/home/lorne-markham/passport/lanes/*`, one
`lane/<name>` branch each), inspected 2026-10-11:

| Lane                        | Relevant to conferences?                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `lane/boards`               | **Yes, directly.** `62e9900`: Sycle in Vancouver as a gathering on a Board (D1)                                   |
| `lane/discovery`            | **Yes.** Owns Discovery and `/go` changes (`?with=`, ask). It's the natural home of `passport-discovery`          |
| `lane/domain`               | Yes, for contracts. `src/lib/domains/adventure/`: the Adventure a built day becomes (idea 26: keep it afterwards) |
| `lane/daybuilder`           | Indirectly. Group adventures (idea 21) need `/go` to plan for several people                                      |
| `lane/maps`                 | Indirectly. Shared map of recommended places (idea 17)                                                            |
| `lane/vision`               | Docs only                                                                                                         |
| `lane/analog`, `lane/detox` | No                                                                                                                |

### 2.2 Proposed lanes

**Don't create six lanes at once.** Three serve October 24. Discovery work
goes to the lane that already owns Discovery. The rest start after the
pilot.

| Workstream              | Branch                                                    | Owns                                                                                                                                                                      | Starts from                                                            | For Oct 24?                                        |
| ----------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------- |
| **passport-conference** | `feature/go-have-a-conference` (this) → `lane/conference` | `src/{domain,lib}/conference/`, `src/app/conferences/` (not module folders), `src/app/api/conferences/` (not module folders), `src/components/conference/`, durable store | This foundation                                                        | **Yes**: harden it, durable store (D3), claim (D2) |
| **passport-flights**    | `lane/flights`                                            | `conferences/[id]/arrivals`, `src/{domain,lib,components}/conference-arrivals/`                                                                                           | The untracked `/sycle` prototype (D9), re-keyed on `ConferenceContext` | **Yes**                                            |
| **passport-events**     | `lane/events`                                             | `conferences/[id]/schedule`, `…/conference-schedule/`                                                                                                                     | `lane/boards`' `StaffActivity` and _awaiting confirmation_ rule        | **Yes**: the hockey game                           |
| **passport-groups**     | `lane/groups`                                             | `conferences/[id]/plans`, `…/conference-plans/`                                                                                                                           | `lane/boards`' interest marks                                          | Stretch                                            |
| **passport-social**     | `lane/social`                                             | `conferences/[id]/community`, `…/conference-community/`                                                                                                                   | Nothing yet                                                            | No                                                 |
| **passport-discovery**  | **existing `lane/discovery`**                             | `conferences/[id]/discover` (built baseline here)                                                                                                                         | `doorsFor` here, plus that lane's `?with=` and ask                     | Baseline is built                                  |

**Rules for every module lane:**

1. Build against `src/domain/conference/contracts.ts`. If it needs to
   change, propose the change in the report. Don't edit it.
2. Store data keyed on `(conferenceId, memberId)`. Never key on identity.
3. Register a `ConferenceLifecycle` in the same change that first stores
   anything.
4. Your page calls `conferenceContext(id)` and `notFound()` on `null`.
5. Flip your entry in `modules.ts` to `built` in your own change. That one
   line is the only foundation file a module lane edits.
6. Places are Atlas ids. Facts are read from Atlas. Absent means unknown.
7. Sycle is configuration. If your module needs a Sycle fact (YVR, the
   rink), it's a setting on the conference, not a constant.

---

## 3. October 24 MVP integration plan

**The MVP:** one private conference for Sycle that colleagues can get into
with a link or a code. It shows who's coming and when they land, features
the hockey game honestly, and opens Go Have A Day from Vancouver.

| When (2026)      | What                                                                                                                                                                                                                                                | Who                      |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| **Oct 11** (Sun) | Foundation built on `feature/go-have-a-conference` (this). **Commit the `/sycle` prototype to a branch (D9).**                                                                                                                                      | done / human             |
| **Oct 12–13**    | Decide D1, D2, D3, D5. Create `lane/flights` and `lane/events` (dispatcher).                                                                                                                                                                        | Lorne                    |
| **Oct 13–16**    | `passport-conference`: durable store, production config. `passport-flights`: port `/sycle` onto `ConferenceContext`, arrival airport from config, lifecycle registered. `passport-events`: activities and the featured hockey game, per conference. | lanes                    |
| **Oct 16**       | Sycle's facts in (D6). Organiser access tested on a phone.                                                                                                                                                                                          | Sycle organisers         |
| **Oct 17**       | **Integration:** merge `feature/go-have-a-conference` → `main`, then flights, then events. Full verify: tsc, eslint, prettier, vitest, playwright, build.                                                                                           | integration (`passport`) |
| **Oct 18–19**    | Real flight-provider key: one live flight diffed against the adapter's fixture. Preview deploy **with approval (D8)**. Walk-through on a phone at 375 px.                                                                                           | Lorne + integration      |
| **Oct 20**       | **Production.** The Sycle organiser creates the conference in the real UI (not a seed), turns on a code, and makes a link.                                                                                                                          | Sycle organiser          |
| **Oct 20–21**    | Invitations go out. **Arrivals has to be live before anyone flies.** People fly ~Oct 22–23.                                                                                                                                                         | Sycle                    |
| **Oct 22–26**    | Live. Someone watches it. Hot fixes go through integration only.                                                                                                                                                                                    | everyone                 |
| **~Nov 23**      | Data erases itself (30 days after the last day; the date moves if `endsOn` does).                                                                                                                                                                   | automatic                |

**Cut lines.** If the plan slips, cut in this order, and the
conference still works:

1. `plans` ("I'm going there at 7"). It's a stretch goal anyway.
2. Arrivals' world map. Keep the arrivals list and countdowns.
3. Arrivals entirely. Then the MVP is home, schedule, free time and people.

**Never cut:** privacy defaults, the 404-for-strangers rule, leave-and-forget,
expiry, or the _awaiting confirmation_ honesty.

---

## 4. After the pilot

The order is proposed and will be informed by what actually happened in
Vancouver. That's the reason to run a pilot.

| Phase                        | Ideas (VISION §5 numbers)                                                                                                 | Notes                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Phase 2: the community**   | 12–16 feed and Atlas place cards; 18–19 "anyone coming?" and shared activities                                            | `passport-social` + `passport-groups`. The feed is judged by how many people it gets into the same room (doctrine §6) |
| **Phase 3: the city**        | 17 shared map; 22–23 discovery on dates and between-session gaps; 20 kindred interests; 21 group adventures               | `lane/discovery`, `lane/maps`, `lane/daybuilder`                                                                      |
| **Phase 4: the person**      | 26 keep your adventures (via `lane/domain`'s Adventure); guest → account claim; per-person invitations                    | Has to land before the first conference's data expires                                                                |
| **Phase 5: everyone**        | 27 retreats, weddings, reunions, festivals, trips, beyond wording; 5 cover images; co-organisers; organiser announcements | The `kind` field is already there                                                                                     |
| **Phase 6: optional / live** | 24 chat; 10 live flight positions where a provider permits; VISION §5.6 in-the-room play                                  | Each needs its own privacy and cost decision. §5.6 is fenced by doctrine §14                                          |
