# Conference — mobile first (2026-10-24)

> **Status:** `feature/conference-mobile`, on GitHub main d542503. **Not
> merged, not deployed.** No migration, no new environment variable, no
> change to who can see what.

**The brief:** make Conference a beautiful, mobile-first companion for
people attending an event together. Hockey Night is the reference for
navigation, interaction quality and social participation — not for its
look. Keep the light editorial design, every piece of data and function,
Explore's Atlas reading, and every permission and privacy rule.

---

## 1. What changed, screen by screen

| Screen         | Before (executive overhaul, phone)                                                                                                                | Now                                                                                                                                                                                                                                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Every page** | Go Have a Day's bar (scrolling sideways) stacked on the conference bar: ~150 px of chrome. Bottom tabs with a bold icon as the only active state. | Inside a conference on a phone, Go Have a Day's bar steps aside (it is an item in the profile menu). Bottom bar: **Home · Arrivals · Agenda · Explore · People**, each a fifth of the width and 64 px tall, the current one lit by a pill behind its icon, `aria-current="page"`, clear of the home indicator. Page heads and gutters tightened. |
| **Home**       | A tall hero, then the organiser's four-step checklist and the venue map in the side column, which on a phone fell below everything else.          | In the order an attendee asks: **what's on now and next** (the Now card), **who's here**, **what's next today**, **what we're doing together**, Explore, **where to go** (venue + directions), then messages and memories. The organiser's checklist moved to Organiser settings; Home keeps one line ("4 things left to set up · Settings →").  |
| **Arrivals**   | Headline, counts, a horizontal timeline whose labels overlapped at 390 px, a full-height dark map, the board, and _your flight_ at the very end.  | Phone order: headline and counts → a **vertical timeline** (time, person, flight, scheduled / estimate / landed, a _Now_ rule) → **your flight** ("Optional… remove it any time") → who's here and next → **share the ride in** → the live map (300 px) and board. Wide screens unchanged.                                                       |
| **Agenda**     | Day cards, then a 16-line timeline you scroll past to find _now_.                                                                                 | Day tabs fill the width; the venue with **Directions** sits on top; finished sessions fold behind _Show 3 earlier today_, so today opens on **Now** (charcoal) and **Next · in 1 h 10 min**; every line carries a pin and its room.                                                                                                              |
| **Explore**    | 4:3 photographs, a card per screen, buttons wrapping onto three lines.                                                                            | 16:10 photographs with a **walk-time badge** on the picture, tighter cards, _Plan this_ and _Add to a plan_ side by side as the two main actions, shelves that swipe without a scrollbar.                                                                                                                                                        |
| **People**     | One large card per person (~230 px each).                                                                                                         | One compact list (~64 px a person): monogram (a green dot when sharing location), name, status, flight. Above it, ways to coordinate that already exist: **Message the group**, **Find my people**, **Meet at arrivals** — each shown only when its module is on.                                                                                |

### Arrivals: sharing the ride in, even alone

Coordination already offered _Meet at arrivals_ when two people land
within 45 minutes of each other. When nobody lands near you, there was
nothing to do. Now, if your own landing is still to come and you're in no
group, Arrivals offers **Offer a ride from YVR**: the same prefilled plan
(`/plans?kind=custom&title=Ride in from YVR&meeting=YVR arrivals hall&…`),
which colleagues can join and talk about in its thread. No new system,
no invented company.

## 2. What did not change

- Data, APIs, stores, migrations, RLS: untouched. Membership, visibility
  (hidden by default), who sees a flight, Find my people's consent and
  expiry — all exactly as before; the five-account suite and its 76 + 68 +
  33 attacks pass unchanged.
- Explore still reads Atlas under Passport's photo rule; _Details & save_
  still opens `/passport/<id>`.
- Wide screens keep the executive layout (one column order on a phone is
  done with CSS `order` and `display: contents`, so there is one copy of
  each panel and no duplicated form).
- Hockey and generic Passport: no file of theirs changed. `PassportNav` is
  untouched; it is wrapped in `.cf-global-nav` only inside `/conferences`.

## 3. Verified

| Check                                                                                                                                                                                                                                                                               | Result                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/conference-stack/together.spec.ts` — five **real accounts** (GoTrue + PostgREST + Postgres, `next start` production build). New: Ana's phone walks all five tabs at **320, 375 and 390 px**: tab is `aria-current`, ≥ 44 px tall, no sideways scroll, a screenshot of each | **passes**                                                                                                                                                                                                                                                                                                               |
| `together-attack.mjs`, `rls-attack.mjs`, `arrivals-attack.mjs`                                                                                                                                                                                                                      | 76/76, 68/68, 33/33                                                                                                                                                                                                                                                                                                      |
| `e2e/conference-executive.spec.ts` (updated: _Home_ tab; organiser checklist on settings, one line on Home), `conference.spec.ts`, `conference-mobile.spec.ts` (375 px), `conference-arrivals.spec.ts`                                                                              | 6/6 (memory store, next dev)                                                                                                                                                                                                                                                                                             |
| Repo Playwright (`next start`, critic Atlas mock, `E2E_ATLAS=1`, 2 workers)                                                                                                                                                                                                         | 251 passed, 5 failed, 4 skipped. Four are the recorded baseline (core-loop:26, october:554/570, discovery-natural:102); conference-executive:87 can't seed under `next start` (memory-store Arrivals is off in a production build) and passes on `next dev` above. conference-mobile:23, on the old baseline, now passes |
| vitest                                                                                                                                                                                                                                                                              | 3,758 passed, 0 failed                                                                                                                                                                                                                                                                                                   |
| tsc, eslint (0 errors; 40 pre-existing warnings), prettier, `next build`                                                                                                                                                                                                            | clean                                                                                                                                                                                                                                                                                                                    |

Screenshots: [`mobile/`](mobile/) — the seeded demo conference (Sycle
Vancouver 2026, pinned to day one at 10:50) at 320, 375 and 390 px for all
five tabs, plus desktop, the organiser's view and the empty conference.
`mobile/real-accounts/` are the five tabs from the real-account run (taken before the last People tweak, which moves the status pill to its own line below 370 px).

## 4. Named, not resolved

| Where                                                     | Tension                                                                                                                                       | What this work does                                                                                                                                                                                       |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Doctrine §10 (_How a person finds them_, the GHAD bar)    | The bar carries Experiences on every screen. On a phone inside a conference it is now hidden; _Go Have a Day_ is in the profile menu instead. | Reachability of Conference is unaffected (you are already in it), and desktop keeps the bar. Hockey Night shows no GHAD bar at all. A human should confirm an experience may take the whole phone screen. |
| "Five tabs, consistent across pages" vs organiser modules | An organiser can switch Arrivals, Agenda or Explore off; their tabs disappear (the pages 404). So a conference may show three or four tabs.   | Kept: permissions over symmetry. The bar always shows exactly the modules that exist.                                                                                                                     |
| EXECUTIVE.md §3–4                                         | "Overview" and "no form on the overview; the organiser's empty-state checklist on the overview".                                              | Renamed **Home**; checklist moved to Organiser settings. EXECUTIVE.md carries a pointer here.                                                                                                             |
| Doctrine §15.12 (group experiences)                       | _Offer a ride_ alone, and the People page's coordination row, are small answers for one kind of group.                                        | Informs, doesn't answer.                                                                                                                                                                                  |
| Doctrine §16 (register)                                   | Unchanged from EXECUTIVE.md §12: Conference still speaks calmly.                                                                              | Not edited.                                                                                                                                                                                               |

## 5. Limitations and blockers

- **Not deployed.** GitHub main (= production) is d542503; this branch is
  two commits on it. Local `main` (a2038a8, the unpushed Adventures /
  Discovery-speed / Vancouver superset) merges with it cleanly
  (`git merge-tree`, no conflicts). Production still lacks
  `CONFERENCE_TOGETHER=on`, so on gohaveaday.com the Together parts (plans,
  chat, find my people, memories, ride offers) stay dark whatever ships.
- **Atlas photographs are uneven**: Steve's Poke Bar's "photo" is a
  membership advert; P2B's is its logo. The photo rule passes them.
- **Direct messages** don't exist; People offers the group chat, not a
  private line to one person.
- The full-page screenshots of the real-account run catch the tab pill
  mid-transition; the demo screenshots wait for it.
