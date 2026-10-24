# Conference — a company summit, made unforgettable (2026-10-24)

> **Status:** `feature/sycle-summit`, on `feature/conference-mobile` (aa0090b),
> itself on GitHub main d542503. No migration and no new environment variable.
> Decisions are recorded in [ADR 013](../../architecture/decisions/013-a-programme-is-data.md).

**The brief:** make Sycle Summit 2026 (October 26–29, JW Marriott Parq,
Vancouver) a companion people want to open: what's on, where to go, the next
session, a calendar entry, a reminder, something nearby, and each other.
Preserve every published time, title and room. Invent nothing.

**The repository is public.** The summit's real programme is internal to the
company, so none of it is in this repository: no source file, fixture, test
expectation or screenshot. It reaches production the way any organiser's
does — imported in Organiser settings into the conference's own record —
and it was verified outside the repository (see §6).

---

## 1. What was built

| Area                     | What a person sees                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Home, during**         | _Good morning, Vancouver_ · the date and the agenda's own day heading · at most one line of personality · the charcoal card: **Now** (until/since), **Up next** with its time, topics, room and a live countdown (_Starts in 12 minutes_), **View session** and **Remind me** · **Your day** · **Tonight** · when the agenda leaves a gap, **You have 29 minutes** with coffee that fits the walk there and back.                                                                                                                  |
| **Home, before / after** | The organiser's welcome first, a countdown (_Begins in 2 days_), your arrival, day one, the venue with directions, who's here, Explore, and **Why we're here** (the organiser's objectives as five swipeable tiles). Afterwards: _Four days. A lot of conversations. Let's keep the good stuff going._, the album, _What we came to do_.                                                                                                                                                                                           |
| **Agenda**               | Four day selectors (**MON 26 · TUE 27 · WED 28 · THU 29**, today dotted) · a vertical timeline by kind: sessions clean, skills marked, **breaks one quiet line**, meals warm, socials playful, the **celebration in its own evening dress** (charcoal, brass glow, a slow gold shimmer), travel dashed · Now / Next / done (done folds away on a phone) · every line opens in place (topics, note, _the agenda gives no end time_, save, remind, add to calendar, session page) · **Jump to now** · **Full agenda / My schedule**. |
| **Session page**         | `/conferences/{id}/schedule/{line}`: kind, title, when (and that no end was given), where (+ venue, directions), topics in order, note, before and after, actions. The link inside each calendar entry.                                                                                                                                                                                                                                                                                                                            |
| **My schedule**          | Starred lines plus plans you said _I'm in_ to, by day, with _Add my schedule to calendar_. Says plainly that nobody needs to save anything to know where to be.                                                                                                                                                                                                                                                                                                                                                                    |
| **Calendar**             | `.ics` for one line, a day, the whole agenda or My schedule (RFC 5545, `TZID=America/Vancouver` with a `VTIMEZONE` read from the platform's zone data, stable UIDs, alarms from your reminder choices). See §3.                                                                                                                                                                                                                                                                                                                    |
| **Reminders**            | One lead time (off / 5 / 15 / 30 min), any line overridden from its card; breaks quiet by default. A banner at the top of every Conference tab, an optional notification from the open tab, and alarms in calendar files. See §4.                                                                                                                                                                                                                                                                                                  |
| **People**               | **Meet someone new**: Bingo (when on), **Coffee crew**, **Walk & talk** (prefilled to the next published break), **Dinner plans** — each opens a prefilled plan. Shown only when the modules behind them are on.                                                                                                                                                                                                                                                                                                                   |
| **Bingo** (module, off)  | A 3×3 get-to-know-you card on your own phone: Passport's game, labelled as separate from the organiser's Bingo; nothing sent, scored or ranked; no sensitive squares. Organisers switch it on in Organiser settings.                                                                                                                                                                                                                                                                                                               |
| **Explore**              | Unchanged reading of Atlas; now measured from **JW Marriott Parq** (added to the curated Vancouver list, the same entry as local main's Vancouver launch), and led by the free-time card when the agenda leaves a gap.                                                                                                                                                                                                                                                                                                             |
| **Organiser settings**   | **Import an agenda file** (paste or choose; preview of new / changed / unchanged / kept lines and any change to dates, time zone, venue, welcome, objectives; optional "make the file the whole agenda"). The line editor gains **kind**, **topics** and a **line of personality**.                                                                                                                                                                                                                                                |
| **Navigation**           | Bottom bar in the brief's order: **Home · Agenda · Arrivals · Explore · People** (was Home · Arrivals · Agenda…).                                                                                                                                                                                                                                                                                                                                                                                                                  |

## 2. The data (no migration)

All in the conference's existing `details` jsonb, optional and additive:
`agenda[].kind | topics | aside`, `dayTitles`, `objectives`; `welcome` and
`venue` already existed. A new module id `bingo`. The import file format is
`passport-conference-agenda/1` (`src/domain/conference/agendaImport.ts`);
the invented example is `e2e/fixtures/summit.agenda.json`.

How the organiser's agenda is carried, line by line: every start time,
title and room as published; an end only where the agenda typed one; a
line the agenda gives no location is stored with none and shown as
_Location not given_ — never a room; a location "to be shared on-site" is
kept as the organiser's note; a surprise stays a title and nothing more.
Nobody is assigned to anything, and no outcome (an award, a winner) exists
anywhere. The file was checked against the organiser's agenda outside this
repository.

## 3. End times, honestly

The agenda gives most lines a start only. On screen that is said: _Starts
8:30 AM · the agenda gives no end time_. "Now" lasts until the next
published line (or an hour, for the day's last) — a display rule only.

Calendar apps need an end to draw a block, so a calendar entry without a
typed end ends when the next line that day begins (or after an hour), and
its description says _"The agenda gives this a start time only. This
calendar entry ends when the next item begins; that is not an official end
time."_ The stored agenda never gains an end.

**Time zone:** the platform's zone data (tzdata 2026c) has British Columbia
on permanent UTC−7 from November 1, 2026. The summit week is UTC−7 either
way; the `VTIMEZONE` is built from the platform's offsets, not recalled
rules, so it follows whatever the data says.

## 4. Reminders: what actually reaches a person

| Channel                         | Works when                                                                                                                            | Verified                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Banner at the top of Conference | Conference is open (any tab)                                                                                                          | unit (`sessionReminders.test.ts`) + local walkthrough                                       |
| Notification from the open tab  | the person ticked it, the browser granted permission, Conference is open                                                              | code path only — **not verified on a real phone**                                           |
| `VALARM` in the calendar file   | the person exported after choosing; Apple Calendar and Outlook honour it                                                              | parsed by Python `icalendar` 7.3 (alarms present, right offsets); **not tried in each app** |
| Push to a closed app            | **does not exist.** No service worker, subscription or push keys; none was added (brief: no unnecessary infrastructure before launch) | —                                                                                           |

Google Calendar ignores alarms in imported files and applies its own
defaults; the reminder settings say so.

## 5. Little moments (Passport's voice, at most one per screen)

| When                                                 | Line                                                                  |
| ---------------------------------------------------- | --------------------------------------------------------------------- |
| First morning with sessions (conferences only)       | _Time to meet the people behind the Slack avatars._                   |
| A social line on now or next (with Bingo on: a link) | _Your mission: meet someone new._                                     |
| A celebration later today                            | _Tonight, we celebrate._                                              |
| A line with its own aside                            | the organiser's aside, on its card                                    |
| Afterwards                                           | _Four days. A lot of conversations. Let's keep the good stuff going._ |

## 6. Verified

| Check                                                                                                                                                                                                                                                                                                                                                          | Result                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| **Real agenda, pinned clock** (outside the repo): Monday 6:10 pm, Tuesday 8:18 am, Tuesday 12:10, Wednesday 5:40 pm, Thursday 12:40, plus Saturday before and Friday after — greeting, date, Now, Next, room, countdown, moment, gala treatment, agenda's `#now`/`#next`, selected day, no sideways scroll at 390 px                                           | 7/7                          |
| **Real agenda on real accounts** (local GoTrue + PostgREST + Postgres, `next start`): organiser imports the file through the screen (32 added), reload and re-import → _32 unchanged_; member joins by code on a phone, sees the welcome, Wednesday's agenda and the celebration, the session's topics; calendar 32 events; stranger 404 on pages and calendar | pass                         |
| `e2e/conference-summit.spec.ts` (invented summit): import + idempotent re-import, no duplicate line, tab order at 320/375/390 with no sideways scroll, topics, save → My schedule → remove, reminder default + override carried into the `.ics`, 16-event export, strangers 404, Bingo 404 until switched on                                                   | pass                         |
| Calendar file parsed by Python `icalendar` 7.3: 32 events, every start right in America/Vancouver, typed ends kept, alarms −15 min (−30 on the overridden celebration), none on breaks, unique UIDs                                                                                                                                                            | pass                         |
| `together.spec.ts` (five real accounts), `together-attack` / `rls-attack` / `arrivals-attack`                                                                                                                                                                                                                                                                  | pass · 76/76 · 68/68 · 33/33 |
| `conference-executive.spec.ts` (updated: day tabs, tab order), `conference.spec.ts`, `conference-mobile.spec.ts`, `conference-arrivals.spec.ts` on `next dev`                                                                                                                                                                                                  | pass                         |
| vitest (new: `agendaImport`, `calendar`, `moments`, `sessionReminders`, `bingo`)                                                                                                                                                                                                                                                                               | see the release record       |

## 7. Named, not resolved

| Where                                            | Tension                                                                                                                          | What this work does                                                                  |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Doctrine §16 vs EXECUTIVE.md §12 (calm register) | The brief asks for personality "with restraint"; EXECUTIVE kept Conference calm.                                                 | A handful of lines, one per screen, all generic Passport voice; doctrine not edited. |
| Doctrine §2.6 / §15.14 (save vs commit)          | Conference's **Save** marks a session; it is not Passport's Saved and not a commitment state.                                    | Kept separate and device-local; vocabulary question untouched.                       |
| Doctrine §6 (less phone)                         | A countdown and reminders invite phone use.                                                                                      | Reminders are opt-in, breaks quiet, one banner per line, shown once.                 |
| `contracts.ts` ("propose it")                    | `ConferenceDetails` gains optional `dayTitles`, `objectives` and line fields.                                                    | Additive and optional; named here as the proposal.                                   |
| Two Parq coordinates                             | The curated entry (49.27539, −123.11277, OSM) and local main's Discovery origin (49.2752, −123.1134, Wikidata) are ~450 m apart. | Explore uses the OSM point; not reconciled.                                          |

## 8. Owner steps (in order)

1. Deploy this branch (it is a fast-forward of GitHub main d542503).
2. On gohaveaday.com, open the Sycle conference → **Organiser settings → Agenda
   → Import an agenda file** → choose `sycle-summit-2026.agenda.json` (kept
   outside the repository) → check the preview (dates Oct 26–29, America/
   Vancouver, JW Marriott Parq Vancouver, 32 lines; any existing test lines
   listed as _kept_ — tick _make the file the whole agenda_ to remove them) →
   **Import and publish**. Re-importing later is safe.
3. The import switches the **Agenda** module on if it was off (the preview
   says so). Tick **Get-to-know-you Bingo** in **Details** if wanted.
4. Optional: set `CONFERENCE_TOGETHER=on` in Vercel (still unset) so plans,
   chat, memories, Coffee crew / Walk & talk / Dinner plans appear.

**Rollback:** older code ignores the new fields but rejects the `bingo`
module id — switch Bingo off before rolling back.
