import type { Listing } from "./model";

/**
 * **The first listings, researched 2026-11-09** (mission 683) from public
 * pages that were actually read; each listing says which. Nothing here is a
 * date, link or organizer that a page did not state.
 *
 * - **Published** where a public page states what is shown: The Night Pig and
 *   The Squealing Pig (past editions only — no 2027 date is published, so
 *   neither is "upcoming"), the Vernon Jazz Club's monthly jam, and the
 *   Vernon Badminton Club's season.
 * - **Waiting for review** where something is missing: a membership club
 *   with no recorded permission (Vernon Outdoors Club, the Vernon off-road
 *   club), or a lead nobody could read (the Longhorn blues jam, roller derby).
 *
 * Seeds join the network once, by id (`withSeed`), and are then ordinary
 * listings: editing one never re-seeds it.
 */

const RESEARCHED = "2026-11-09T20:00:00.000Z";
const BY = {
  role: "admin",
  who: "Go Have a Day research (mission 683)",
} as const;
const seedNote = (text: string) => [
  { at: RESEARCHED, by: BY.who, kind: "submitted" as const, text },
];

const BCORCS = "https://www.moto-tally.com/BCORCS/Results.aspx";

export const SEED: readonly Listing[] = [
  {
    id: "night-pig",
    kind: "event",
    title: "The Night Pig",
    description:
      "A night round of the BC Off Road Championship Series in Vernon — dirt bikes racing a hare scramble in the dark, the same weekend as The Squealing Pig.",
    place: { town: "Vernon" },
    interests: ["dirt biking", "motorcycles"],
    organizer: "OOMC (as the series lists it)",
    organizerUrl: BCORCS,
    provenance:
      "BC Off Road Championship Series results page (moto-tally), read 2026-11-09. Earlier editions were run by the Premier Off-Road Club (RidersWest, 2014).",
    history: [
      { starts: "2026-10-10", source: BCORCS },
      { starts: "2025-10-11", source: BCORCS },
      { starts: "2024-10-12", source: BCORCS },
      { starts: "2023-10-07", source: BCORCS },
    ],
    access: "public",
    status: "published",
    verification: "source-checked",
    confidence: "high",
    lastVerifiedAt: RESEARCHED,
    lastCheckedAt: RESEARCHED,
    discoveredAt: RESEARCHED,
    submittedBy: BY,
    notes: seedNote(
      "No 2027 date published yet. The venue is not stated on the series page.",
    ),
    updatedAt: RESEARCHED,
  },
  {
    id: "squealing-pig",
    kind: "event",
    title: "The Squealing Pig",
    description:
      "Vernon's long-running off-road motorcycle race, started more than 20 years ago on trails cut by local riders, and a round of the BC Off Road Championship Series.",
    place: { town: "Vernon" },
    interests: ["dirt biking", "motorcycles"],
    organizer: "OOMC (as the series lists it)",
    organizerUrl: BCORCS,
    provenance:
      "BC Off Road Championship Series results page (moto-tally), read 2026-11-09; history from RidersWest (May 22, 2014).",
    history: [
      { starts: "2026-10-10", source: BCORCS },
      { starts: "2025-10-11", source: BCORCS },
      { starts: "2024-10-13", source: BCORCS },
      { starts: "2023-10-08", source: BCORCS },
    ],
    access: "public",
    status: "published",
    verification: "source-checked",
    confidence: "high",
    lastVerifiedAt: RESEARCHED,
    lastCheckedAt: RESEARCHED,
    discoveredAt: RESEARCHED,
    submittedBy: BY,
    notes: seedNote(
      "No 2027 date published yet. The series page lists 2026 on the same day as the Night Pig; earlier years it was the next day. Watch the series page for the 2027 schedule.",
    ),
    updatedAt: RESEARCHED,
  },
  {
    id: "vernon-badminton-club",
    kind: "club",
    title: "Vernon Badminton Club",
    description:
      "Drop-in badminton nights at Coldstream Elementary School gym through the winter season.",
    place: { name: "Coldstream Elementary School gym", town: "Coldstream" },
    interests: ["badminton"],
    organizer: "Vernon Badminton Club",
    organizerUrl: "https://www.facebook.com/vernonbadmintonclub/",
    provenance:
      "The club's season schedule as given for CourtQueue (owner brief, mission 680); the club's public Facebook page.",
    schedule:
      "Mondays 7–9 pm and Thursdays 6:30–8:30 pm, October 5, 2026 to April 15, 2027",
    access: "public",
    status: "published",
    verification: "community-reported",
    confidence: "medium",
    lastVerifiedAt: RESEARCHED,
    lastCheckedAt: RESEARCHED,
    discoveredAt: RESEARCHED,
    submittedBy: BY,
    notes: seedNote(
      "No public web page confirms the times; an ambassador at the club can mark it organizer-confirmed.",
    ),
    updatedAt: RESEARCHED,
  },
  {
    id: "vernon-jazz-jam",
    kind: "community",
    title: "Vernon Jazz Club monthly jam",
    description:
      "An open jazz jam on the first Wednesday of every month, run by the Vernon Jazz Club alongside its concerts.",
    place: { name: "3000 31st Street", town: "Vernon" },
    interests: ["music"],
    organizer: "Vernon Jazz Club (Vernon Jazz Society)",
    organizerUrl: "https://vernonjazz.com/",
    provenance: "vernonjazz.com, read 2026-11-09.",
    schedule: "First Wednesday of each month (time on the club's page)",
    history: [{ starts: "2026-11-04", source: "https://vernonjazz.com/" }],
    access: "public",
    status: "published",
    verification: "source-checked",
    confidence: "high",
    lastVerifiedAt: RESEARCHED,
    lastCheckedAt: RESEARCHED,
    discoveredAt: RESEARCHED,
    submittedBy: BY,
    notes: seedNote(
      "The page names November 4 as the last jam; it states no time and no December date.",
    ),
    updatedAt: RESEARCHED,
  },
  {
    id: "vernon-outdoors-club",
    kind: "club",
    title: "Vernon Outdoors Club",
    description:
      "Vernon's outdoors club since 1976: Sunday hikes, ramble hikes, cycle rides and snowshoeing. Guests can join up to two activities.",
    place: { town: "Vernon" },
    interests: ["hiking", "cycling", "outdoor adventure"],
    organizer: "Vernon Outdoors Club",
    organizerUrl: "https://www.vernonoutdoorsclub.org/",
    provenance:
      "vernonoutdoorsclub.org and its membership page, read 2026-11-09.",
    access: "members",
    status: "submitted",
    verification: "source-checked",
    confidence: "high",
    lastCheckedAt: RESEARCHED,
    discoveredAt: RESEARCHED,
    submittedBy: BY,
    notes: seedNote(
      "Membership club: ask the club before promoting it. The calendar showed no dated events.",
    ),
    updatedAt: RESEARCHED,
  },
  {
    id: "vernon-off-road-motorcycle-club",
    kind: "club",
    title: "Vernon Off Road Motorcycle Club",
    description:
      "A Vernon dirt-bike club that looks after trails near Becker Lake and Noble Canyon and has run hare scrambles, enduros and family days.",
    place: { name: "Becker Lake / Noble Canyon trails", town: "Coldstream" },
    interests: ["dirt biking", "motorcycles"],
    organizer: "Vernon Off Road Motorcycle Club",
    organizerUrl: "https://www.vormc.com/",
    provenance:
      "Vernon Morning Star, June 10, 2017; the club's site did not load on 2026-11-09.",
    access: "members",
    status: "submitted",
    verification: "unverified",
    confidence: "medium",
    discoveredAt: RESEARCHED,
    submittedBy: BY,
    notes: seedNote(
      "Only a 2017 source. Is it the 'OOMC' the race series names? An ambassador who rides should confirm and ask permission.",
    ),
    updatedAt: RESEARCHED,
  },
  {
    id: "longhorn-blues-jam",
    kind: "community",
    title: "Blues jam with the Cat Wells Blues Band",
    description:
      "A blues jam at the Longhorn Pub, reportedly on the last Sunday of the month.",
    place: { name: "Longhorn Pub, 4513 25 Ave", town: "Vernon" },
    interests: ["music"],
    organizer: "Cat Wells Blues Band",
    organizerUrl:
      "https://www.tourismvernon.com/events/blues-jam-hosted-by-cat-wells-blues-band",
    provenance:
      "Search listing only; the Tourism Vernon page refused to load (403) on 2026-11-09.",
    access: "public",
    status: "submitted",
    verification: "unverified",
    confidence: "low",
    discoveredAt: RESEARCHED,
    submittedBy: BY,
    notes: seedNote(
      "Unread: check the schedule with the pub or the band before publishing.",
    ),
    updatedAt: RESEARCHED,
  },
  {
    id: "okanagan-shuswap-roller-derby",
    kind: "club",
    title: "Okanagan-Shuswap Roller Derby Association",
    description:
      "A not-for-profit roller derby league based in Armstrong that has played bouts in Armstrong and Vernon.",
    place: { name: "Hassen Arena", town: "Armstrong" },
    interests: ["roller skating"],
    organizer: "Okanagan-Shuswap Roller Derby Association",
    provenance:
      "Vernon Morning Star, November 24, 2016. Its website no longer resolves.",
    access: "public",
    status: "submitted",
    verification: "unverified",
    confidence: "low",
    discoveredAt: RESEARCHED,
    submittedBy: BY,
    notes: seedNote(
      "Probably inactive. Find out if anyone skates now before listing it.",
    ),
    updatedAt: RESEARCHED,
  },
];
