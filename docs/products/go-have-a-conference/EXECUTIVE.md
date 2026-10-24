# Conference — the executive overhaul (2026-10-23)

> **Status:** built on `feature/conference-executive` (from
> `feature/conference-adventure` 3de2b72). **Not merged, not deployed.** No
> database migration: the agenda and venue live in the conference's existing
> `details` record.

**The brief:** Conference looked like a prototype — a giant bright-blue
header, empty grey placeholders, dead-end navigation cards, the name/privacy
form on the home page, no arrivals board worth showing, no event overview,
nothing of the city. Rebuild it as a premium product a company could share
with its leadership: _professional first, intelligent second, delightful
throughout_. Never invent flights, places, statuses or activity.

---

## 1. What was working, and what wasn't

| Kept, as it was                                                                     | Rebuilt                                                                   |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Membership, invitations, codes, links, roles, privacy (hidden by default), RLS      | The home page (now the **Overview**), its hierarchy and every empty state |
| Arrivals' honest model: three kinds of time, evidence before a name goes on a plane | Arrivals' page header, board rows (avatars, origin), and a **timeline**   |
| Plans, RSVPs, votes, chat, find my people, memories, reminders                      | Navigation: one **conference bar** instead of module cards                |
| Explore's Atlas reading and photo rule                                              | Explore's presentation (curated grid; no 📍 placeholders)                 |
| —                                                                                   | **Agenda** (the `schedule` module was a placeholder; now built)           |
| —                                                                                   | **Venue** (a field; the overview, Explore and maps use it)                |

## 2. Design direction

_Premium hospitality × executive conference × intelligent travel companion._

- **Colour:** charcoal `#17181b`, warm white `#f7f5f0`, slate `#5c6370`, a
  brass accent `#a5814a` for the organiser's own voice ("For you, as
  organiser", reminders, featured lines) and sage `#3f7d5c` for _now_ and
  _live_. Tokens are `--color-cf-*` in `globals.css`.
- **The organiser's colour is a detail, not a banner:** the dot by the name
  in the bar, the hairline under the title. No primary-colour rectangles.
- **Type:** Fraunces, light, at a high optical size (`cf-display`) for
  conference names and page titles; Fraunces at text size (`cf-serif`) for
  card titles; Plus Jakarta Sans for everything else. Small-caps eyebrows
  (`cf-eyebrow`) carry the hierarchy.
- **One charcoal card per screen at most** — the overview's _Now_ card, the
  arrivals board — so the eye knows where "now" is.
- **People are monograms** (initials, a muted tint per name, charcoal for
  you). Nobody uploads a photo and Passport fetches none.
- **Motion is restrained:** a 420 ms rise on the hero, a slow pulse on
  _live_ and _now_, image zoom on hover; all off under
  `prefers-reduced-motion`.
- The kit is `src/components/conference/kit.tsx`: `Panel`, `PanelHead`,
  `PageHead`, `Eyebrow`, `Avatar`, `AvatarStack`, `Pill`, `EmptyNote`, `btn`.

## 3. Information architecture

```
Overview · Arrivals · Agenda · Explore · People        [Messages] [Profile ▾]
                                                                    Your profile & privacy
                                                                    Plans
                                                                    Memories
                                                                    Organiser settings (organisers)
                                                                    All your conferences
```

- Desktop: the bar sits under Go Have a Day's own bar. Phone: name, messages
  and profile on top; the five tabs along the bottom edge.
- **Plans** are reached where they matter: the overview's _With colleagues_,
  the agenda (dashed lines), Explore's _Plan this_ / _Add to a plan_,
  arrivals' _Meet at arrivals_. **Messages** is the icon in the bar and each
  plan's _Talk about it_. **Memories** is on the overview (first, afterwards).
- **No form on the overview.** The name/privacy form moved, unchanged, to
  `/conferences/{id}/you`, with reminders on this device and a summary of
  what you share. Settings are only in Organiser settings.
- **People** is a tab for every member (it used to be _Find my people_ only,
  when that module was on): the directory of people who chose to be seen,
  what each chose to share, an honest count of the rest; then Find my people
  when the organiser switched it on.

## 4. The overview, by journey phase

`journeyPhase` (`src/domain/conference/agenda.ts`) decides what leads; it
never hides anything, only orders it.

| Phase       | When (conference's zone)                     | The _Now_ card says                                                 | Then                                |
| ----------- | -------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------- |
| **before**  | more than a day out, nobody landing today    | your arrival (or _Add your flight_), what day one opens with        | Day one at a glance, plans, Explore |
| **arrival** | the eve of day one, or flights landing today | your arrival, how many landed / still to land, day one's first line | same; arrivals panel moves up       |
| **during**  | a conference day                             | **Now** and **Next**, with where, and how many more today           | _Later today_, plans, Explore       |
| **after**   | after the last day                           | _That's a wrap_ — the album, and saving what you loved              | memories first                      |

The hero: the name **exactly as typed** (a conference called "test" is called
"test"), the organiser's tagline, and four facts — dates, city, venue,
participants. A missing venue reads _To be announced_ (or _Add the venue_ for
an organiser). A missing agenda reads _The agenda hasn't been published yet_.

**The organiser's empty state:** _It's just you in here so far_ with _Invite
people_, and a checklist — venue, agenda, invite, a line of welcome — each
linking to the exact settings section. It disappears when done.

## 5. The agenda

- Published by organisers in Organiser settings → _Agenda_: day, start,
  optional end, title, optional place and note, and _Featured_ (the one thing
  everybody is talking about). Saved as each line is added.
- Stored in `ConferenceDetails.agenda` (≤ 40 lines, validated; days within
  three of the conference's). The details form leaves it untouched: the
  service keeps the stored agenda when an edit doesn't mention it.
- The **Agenda** tab: day tabs, a timeline per day; on today, what's on now is
  the charcoal card and what's done steps back. Colleagues' plans appear as
  **dashed** lines marked _planned by colleagues_, never as the organiser's.
- A line with no end runs until the next published line, or an hour if it's
  the last — a display rule; "until …" is shown only for an end that was typed.

## 6. Arrivals

Unchanged honesty, new presentation: a serif headline from the board's own
words, three counts, and a **timeline** of the day — each person at the
minute the board gives, labelled scheduled / estimate / landed (screen
readers hear which), a _Now_ mark. The dark map and board stay (now 680 px,
not full height), rows gain monograms. The overview and People say
**Expected** for a booked time still to come and **Not confirmed** for a
booked time that has passed with no aircraft seen — never _Landed_ without
an observation. Times not on today carry their weekday.

## 7. Shared plans: choosing the place is choosing where we meet

`chooseVenue` now sets the meeting point to the chosen place unless somebody
typed their own ("Hotel lobby, then we walk") or picked a separate meeting
place; un-choosing takes it away again (`meetingAfterChoice`, tested). The
plan then shows one line — _Meet at: Chambar_ — not _Meet_ and _Going to_.

## 8. Explore

A curated grid (three across on desktop), photographs from Atlas under
Passport's photo rule; a place Atlas has no usable photograph for gets a
typographic tile that says so, not a pin emoji. Each card: _Plan this_, _Add
to a plan_, _Directions_, and, for Atlas places, _Details & save_ — the place's
Passport page, where it can be saved to your own Saved and Adventures. The
overview's editorial strip shows only places whose photographs actually load.

_Details & save_ links to `/passport/<id>`, not `/places/<id>`: most of
Explore's restaurants, cafés and bars are Atlas organisations, and
`/places/<id>` answers 404 for them. Found in production on 2026-10-24
(18 of 30 links dead); `/passport/<id>` resolves every kind and forwards
places to `/places/`.

## 9. Venue

`ConferenceDetails.venue` (`name`, optional `address`), set in the details
form. Explore measures walks from it **only when its words name a place
Passport already knows** (the curated Vancouver list); the overview's venue
map and directions appear only then. An address is never geocoded.

## 10. Verified

| Check                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Result                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/conference-executive.spec.ts` — a realistic conference seeded through the API (organiser, 3 named + 1 unlisted, 4 flights, 16-line agenda, dinner chosen by vote, recurring walk, chat). Every screen as a participant with **every link in the conference frame followed**; agenda, plan "Meet at", RSVP from the overview, profile menu, people directory, arrivals timeline; organiser adds an agenda line, edits details without losing it; phone tab bar on every tab, no sideways scroll; strangers 404 on all ten screens. Empty state: "test", checklist links, publish, invite | **2/2 pass** (memory store, `next dev`)                                                                                                                                                                           |
| `e2e/conference.spec.ts` (updated: doors on Explore, name on the profile), `e2e/conference-arrivals.spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | pass                                                                                                                                                                                                              |
| `scripts/conference-stack/together.spec.ts` (updated for the new screens) — five real accounts on GoTrue + PostgREST + Postgres                                                                                                                                                                                                                                                                                                                                                                                                                                                              | **passes** on `next start`                                                                                                                                                                                        |
| `together-attack.mjs`, `rls-attack.mjs`, `arrivals-attack.mjs`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 76/76, 68/68, 33/33 (unchanged)                                                                                                                                                                                   |
| Repo Playwright (`next start`, critic Atlas mock, `E2E_ATLAS=1`, 2 workers)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 247 passed, 7 failed, 7 skipped. Five are the recorded baseline (core-loop:26, october:554/570, conference-mobile:23, discovery-natural:102); discovery-conversation:121/184 failed under load and pass 7/7 alone |
| vitest                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 3,680 passed, 0 failed (new: `agenda.test.ts`, agenda case in `service.test.ts`, meeting-follows-venue in `together.test.ts`)                                                                                     |
| tsc, eslint (0 errors; 40 pre-existing warnings, none in Conference), prettier, `next build`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | clean                                                                                                                                                                                                             |

Screenshots (desktop 1440 and phone 390) are in [`executive/`](executive/),
made by `scripts/conference-demo/shoot.mjs` against `seed.mjs`; see its README.

## 11. Limitations, honestly

- **Atlas photographs are uneven.** Some restaurant images are logos (refused),
  some are patterns that pass the size rule (Aureliana's), and Atlas's
  _Stanley Park_ and _Gastown_ carry pictures of New York and Ontario — so no
  Atlas photograph is used as a city hero. The city appears through Explore's
  photographed places and a map of the venue. An Atlas defect to report.
- **No cafés near the venue in Atlas** (unchanged from TOGETHER.md §6).
- **The venue only becomes a point** when its name matches the curated list;
  elsewhere the venue is words, with no map.
- **Avatars are monograms.** Profile photos would need consent, storage and
  retention decisions nobody has made.
- **Notifications** are still in-page reminders and an optional device
  notification while Conference is open (no push service exists).
- **Arrivals without ADS-B** (as in local runs) can only say _Expected_ / _Not
  confirmed_; with ADSB.lol live it says what it observed.
- The overview's hero has no organiser cover image (VISION §5.1 item 5, still
  proposed).
- `CONFERENCE_NOW` (development only; ignored by production builds) pins the
  clock for walkthroughs and screenshots.

## 12. Doctrine and earlier documents — named, not resolved

| Where                                                                                  | Tension                                                                                                        | What this work does                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Doctrine §16 (irreverent register: "hell of a day")                                    | The brief asks for _professional first_, an audience of senior executives, "a little personality".             | Conference's words are calm and plain, with small warmth ("That's a wrap.", "The evening is yours."). Doctrine §16 is not edited; a human should say whether Conference may speak in a quieter register than Passport. |
| `contracts.ts` ("changing this file changes every workstream's contract — propose it") | `ConferenceSummary` extends `ConferenceDetails`, which gained optional `venue` and `agenda`.                   | Additive and optional; every module still compiles unchanged. Named here as the proposal.                                                                                                                              |
| VISION §5.2 (featured activity, _Awaiting confirmation_)                               | The agenda's _Featured_ flag is a lighter version.                                                             | Built as a flag on a published line; confirmation state not built.                                                                                                                                                     |
| Doctrine §15.12 (how group experiences work)                                           | A conference overview ordered by journey phase is one answer for one kind of group.                            | Informs, doesn't answer.                                                                                                                                                                                               |
| `/people` route                                                                        | Was _Find my people_ only (module `people`); now every member's directory, with Find my people inside when on. | The module switch still governs location sharing; the directory shows only what each member chose to share.                                                                                                            |
