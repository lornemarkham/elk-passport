# Community contributions — one "+ Suggest something" for every experience

**Owner brief:** "PASSPORT — UNIVERSAL COMMUNITY CONTRIBUTIONS" (2026-11-23,
mission 1005). **Lane:** passport (integration). **Authority:** the
[doctrine](../../PASSPORT-PRODUCT-DOCTRINE.md) (§12, 2026-11-23 paragraph);
storage and identity in [ADR 025](../../architecture/decisions/025-one-suggestion-queue-for-every-experience.md)
(proposed).

The brief, in one line: _build once, improve everywhere._ Anyone on Go Have a
Day, Christmas, Hockey Night, Date Night or Snow Day can say "you're missing
this" in under a minute, with no account; Lorne reviews every suggestion in
one place; contributors are thanked at once and earn the same milestones
wherever they contributed; Atlas gets the facts by hand today and could read
the queue tomorrow.

## Where things are

| What                 | Where                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The button and sheet | `src/components/contributions/SuggestSomething.tsx` — `<SuggestSomething experience="…" />`                                                                                                |
| Mounted on           | Christmas bar (`+ Suggest a Stop`, every Christmas page) · Discovery "From the locals" · `/hockey` · `/snow` · `/datenight`                                                                |
| As a page            | `/contribute?from=<experience>` — the same form, plus **Your contributions** (progress and status)                                                                                         |
| **Admin queue**      | **`/contribute/review`** (phone-first; sign in as an `ADMIN_EMAILS` account); linked from `/admin` and `/christmas/lights/review`                                                          |
| API                  | `POST /api/contributions/submit` · `GET /api/contributions/mine?device=` · `GET /api/contributions/review` · `POST /api/contributions/[id] {action}` · `GET /api/contributions/photo/[id]` |
| Rules (pure)         | `src/domain/contributions/` — `model.ts`, `guard.ts` (pace, cooling-off, flood), `actions.ts`, `milestones.ts`                                                                             |
| Server               | `src/lib/contributions/server.ts` (store, contributor keys, Atlas handoff)                                                                                                                 |
| Email                | `src/app/christmas/_server/notify.ts` (`newSuggestionMail`, same Resend seam as the lights map)                                                                                            |
| Tests                | `src/domain/contributions/contributions.test.ts` · `e2e/contributions.spec.ts`                                                                                                             |

## P0 — the daily cap is gone

The Christmas lights map refused the sixth anonymous pin (tenth signed in)
of a day with _"That's a lot of magic for one day — try again tomorrow."_
Lorne hit it adding ten real displays in one evening. **Why it was there:**
the Pin the Magic brief (2026-11-10) asked for spam protection, and a fixed
per-day count was the simplest guess; it was never a product decision about
how much a person may contribute.

What replaces it, for every community queue (`domain/contributions/guard.ts`,
used by `christmas/lights/actions.ts` too):

| Rule                                                                    | Was (lights)                                          | Now                                                                                                                               |
| ----------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Per person, per day                                                     | 5 anonymous · 10 signed in                            | **none**                                                                                                                          |
| Burst                                                                   | —                                                     | 12 a minute, 60 an hour → _"Give it a minute and keep going"_ with a retry time (429)                                             |
| Per address (route limiter)                                             | 4 a minute · 20 an hour                               | 20 a minute · 100 an hour (looser than the per-person rule, so a household meets the rule about a person first)                   |
| Spam                                                                    | —                                                     | 3 spam declines among the last 5 decisions → paused for a day (moderation, not a quota)                                           |
| Repeats                                                                 | same person, same name, within 40 m → the one waiting | same, plus the suggestion queue returns the one waiting; a lookalike from someone else is flagged for the reviewer, never refused |
| Waiting at once                                                         | 150                                                   | 1000                                                                                                                              |
| Hidden field, minimum time on the form, same-origin, links in the words | kept                                                  | kept                                                                                                                              |

Twenty-five legitimate submissions in one session pass by test
(`moderation.test.ts`, `contributions.test.ts`); the e2e sends twelve in a
few seconds and sees the thirteenth asked to pause for a minute.

**Were any submissions lost?** A refused submission was never stored, so
nothing is recoverable from the store; the owner's eleventh display and
after need to be added again. Nothing already stored was changed.

## P1 — the suggestion

Required: **name**, **kind** (Place · Restaurant or café · Event · Market ·
Activity · Attraction · Christmas lights · Live music or show · Something
else), **where** (words, and/or the phone's position). Optional, behind one
tap: description, date and time in words, website, photo (shrunk in the
browser, as the lights map does). The **experience is captured by the mount**
(`experience="christmas"`), never asked; the remembered town (ADR 020) is
sent when the page knows one. Unknown experience slugs are accepted and
labelled by their slug, so a new experience adds one line of JSX and no
registry.

After sending: _Thanks — it's in!_, **Pending review — not public yet**, the
milestones with where this person stands, and **+ Suggest another** (keeps
the kind and the place; clears the rest). A repeat of their own waiting
suggestion says _Already got it!_.

## P2 — one review queue

`/contribute/review`: Pending · Approved · Rejected. Each card: experience,
kind, name, location (opens a map), when, website, description, photo,
sent-when, this contributor's approved and waiting counts, a **Looks like …**
note when a lookalike exists, and the Atlas state. Actions: **Approve**,
**Edit** (every field), **Reject** (Already have it · Spam or nonsense · Not
a fit · Something else, with a note), **Copy for Atlas** (a labelled text
block for the clipboard; the same facts as JSON are in the API), and **Send
website to Atlas**. Approving a suggestion with a website also queues the
page as an Atlas candidate source — the same seam the Local Insider Network
uses (`queueCandidateSource`), now shared.

**Routing into existing publishing.** Nothing is auto-published. A Christmas
display suggestion still becomes a map pin only through the lights map's own
form and queue (it needs a photo and a precise place); an event or club with
a page can be put through the Local Insider Network; a place goes to Atlas by
copy. The two existing queues are linked from each other.

## P3 — milestones

| Approved | Title              |
| -------- | ------------------ |
| 1        | First Discovery    |
| 5        | Local Explorer     |
| 10       | Community Scout    |
| 25       | Discovery Champion |
| 50       | Local Legend       |

Counted on **approved** contributions across every experience: approved
suggestions plus approved Christmas lights pins by the same person. Pending
earns thanks at once and nothing else; a decline for any reason counts for
nothing.

**Who a contributor is.** A signed-in person is a keyed hash of their email
(their count follows the account). Anyone else is a keyed hash of a random
token the browser keeps (`passport.contributor.device`, adopting the lights
map's `xmas-lights-device` when present so one phone's pins and suggestions
add up), else their address. **Limitation, stated rather than papered over
(brief, Part 4 item 7):** an anonymous contributor is recognised on one
device only; a new phone or cleared storage starts at zero. The UI says
_Counted on this phone — sign in to carry it with you._ No leaderboard, no
account requirement.

## P4 — Atlas, later

Today: Copy for Atlas, and the website queued as a candidate source. The
structured record (`Suggestion` in `model.ts`: name, category, location with
optional coordinates, when, website, description, photo id, provenance via
experience and time) is what a future Atlas reader would take. Not built, by
the brief: research, verification, duplicate detection against Atlas,
publication recommendation, updates to existing records. The follow-up is an
Atlas mission reading `GET /api/contributions/review` (or a dedicated
export) with Atlas's own provenance rules.

## Geography

No community list. A location is words plus an optional coordinate; the town
is whatever the shared place says. Vernon, Coldstream, Lumby, SilverStar,
Kelowna, Vancouver and anywhere else are suggested the same way.

## Storage

One document (`community-suggestions`) plus one document per photo in the
insiders compare-and-swap store (`passport_insider_docs`, migration
20261111000000, already in production). **No new migration, no new table, no
new secret.** Development and tests use memory (`INSIDERS_STORE=memory`).

## Verification

- `npx vitest run src/domain/contributions src/domain/christmas/lights` —
  pace, cooling-off, flood, repeats, lookalikes, review actions, milestones,
  no contributor key in any view; the lights map's 25-in-a-session.
- `e2e/contributions.spec.ts` on a 390 px phone (memory store, test
  identity): Christmas → suggest → thanks → another; Hockey captures
  `hockey`; twelve quick API submissions pass, the thirteenth pauses; visitor
  sees nothing; admin edits, approves, rejects, copies; progress counts one
  approval.

## Christmas and Mission 1000

The Christmas lane's brief (Mission 1000, running as M1003 at the same time)
asks for a Christmas "Suggest a Stop", a Christmas review page and Christmas
rewards. **This is that system**: the Christmas bar already carries
`+ Suggest a Stop`, the review queue already shows Christmas suggestions
first by date, and Christmas lights pins already count toward the shared
milestones. The Christmas lane should extend `SuggestSomething` (a
Christmas-worded label, a default kind) rather than build a second form,
and should not reintroduce a daily cap in `lights/actions.ts`. The
Christmas-specific thanks line from that brief ("🎄 Thanks for spreading
Christmas cheer!") is a `label`/copy change in the mount, not a new system.
Christmas-themed milestone names (that brief's "Christmas Legend") would be
a second set of titles for the same counts — a product call for the owner,
recorded as open below.

## Open for the owner

- **One set of milestone titles or themed sets per experience?** The
  universal brief names five titles; the Christmas brief names five others
  for the same counts. Built: the universal five everywhere.
- **Should the Local Insider Network's form fold into this queue?** Today the
  sheet offers its fuller form one tap behind for a poster or a lot of
  detail; two reviewed queues exist (three with the lights map). Merging is
  a data migration and a review-flow decision, not made here.
- **Should an approved Christmas display suggestion open the lights form
  pre-filled?** Not built: the lights form needs a photo and a precise pin.
