# Follow-up brief for Atlas — community listings and early event discovery

_Written by Passport mission 683 (2026-11-09). Atlas work; Passport did not
write to Atlas._

**Workspace:** atlas. **Why:** Go Have a Day's Local Insider Network (Passport
ADR 018) now queues each published listing's organizer page to Atlas as a
candidate source (`sourceType: "community-listing"`, `discoveryBasis:
"first-party-url"`). The owner wants local events discovered **before** they
happen ("The Squealing Pig should never be something we only discover after
race weekend").

**Asks (each needs its own acceptance test in Atlas):**

1. Read `community-listing` candidates with the existing queue runner,
   respecting robots.txt and access restrictions, and say per candidate what
   was learned (entity, event dates with the sentence that states them) or why
   nothing was.
2. A **re-check cadence** for the pages behind community listings (club
   sites, public calendars, organizer announcements, official listings):
   record `lastChecked`, and for every newly stated event date the day Atlas
   first saw it, so Passport can report discovery lead time from Atlas's side.
3. Expose read-only to Passport: per candidate URL, its status and any entity
   ids it produced, so a Passport reviewer can link the listing to the Atlas
   entity instead of copying the id by hand.
4. Watch first: `https://www.moto-tally.com/BCORCS/Results.aspx` (BC Off Road
   Championship Series — Night Pig and Squealing Pig; no 2027 date published
   on 2026-11-09), `https://vernonjazz.com/`,
   `https://www.vernonoutdoorsclub.org/`.

**Out of scope:** Atlas creating entities from Passport's structured fields
without reading a source (that would make a submitter's words a fact).
