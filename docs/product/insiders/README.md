# Local Insider Network

**Owner brief:** _P0: Local Insider Network_ (mission 683, 2026-11-09). "The
coolest stuff happens off the beaten path." Start in Vernon and the North
Okanagan. Architecture: [ADR 018](../../architecture/decisions/018-local-insiders-queue-in-front-of-atlas.md) (proposed).

## Where it lives

| Route                         | Who                                 | What                                                                                                                                                                                                                |
| ----------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discovery (`/`, `/discovery`) | everyone                            | "From the locals": published listings that fit what was said (dirt biking → the Pigs; badminton → the club), and **Know something we're missing?**                                                                  |
| `/local`                      | everyone                            | every published listing, filtered by interest (`?interest=`)                                                                                                                                                        |
| `/local/share`                | everyone                            | the submission form: type, say it (browser speech where supported), or add a poster; "Fill in the details for me"; check; send                                                                                      |
| `/local/[id]`                 | everyone                            | one listing, where it came from, **Something wrong?** and **Is this yours? Claim it**                                                                                                                               |
| `/ambassadors`                | invited ambassadors, administrators | contributions and status, update details, suggest corrections, profile; reviewers: queue, check dates against pages, record permission, publish, watch list, lead time; administrators: invite / retire ambassadors |

## The rules (from the brief)

- **Four kinds:** event, club, experience, community.
- **Every listing has** location, kind and interests, provenance, organizer
  when known, dates when applicable, verification status and last verified
  date (`src/domain/insiders/model.ts`).
- **Do not invent dates, registration links or organizers.** The rules reader
  copies only what the text states; the AI reader's values are dropped unless
  they appear in the text; dates and links are hidden until a person checks
  them against a page.
- **Do not publish unverified events as upcoming.** Past events show "Last
  held … · next date not announced yet" with the page to watch.
- **Permission before promoting members-only or private activities:** such a
  listing cannot be published until an administrator records who gave it.
- **Duplicates:** same page, or same name in the same town, joins the
  existing listing as a correction.
- **Moderation:** visitor submissions wait for review; trusted ambassadors'
  complete listings publish directly; reports and claims reach a reviewer and
  change no fact.

## Success metric: discovery lead time

`leadTimeDays` = days between first hearing of an event (`discoveredAt`) and
its checked start. The portal lists it per published event, and an
ambassador's median on their profile. The watch list puts every published
event and club with no announced next date in front of a reviewer, least
recently checked first, with the page to open. The Squealing Pig and the
Night Pig are on it: their 2027 date is not published as of 2026-11-09.

## Seed (researched 2026-11-09, `src/domain/insiders/seed.ts`)

Published: The Night Pig, The Squealing Pig (past editions from the BC Off
Road Championship Series page), Vernon Jazz Club monthly jam, Vernon Badminton
Club (season from the CourtQueue brief). Waiting for review: Vernon Outdoors
Club and Vernon Off Road Motorcycle Club (membership — permission needed),
the Longhorn blues jam (page unreadable), Okanagan-Shuswap Roller Derby
(probably inactive). Not found: a Vernon street-motorcycle club, a roller rink
or regular skate night, a recurring drum circle.

## What is not built

- Automated crawling of club sites and calendars: Atlas's job, through the
  queue it already runs — see [ATLAS-BRIEF.md](ATLAS-BRIEF.md).
- Interest-based recommendations beyond matching a sentence's interests (no
  personal profile is learned; doctrine §5).
- Organizer accounts: a claim is a note with contact details; a reviewer
  confirms it and corrects the listing.
