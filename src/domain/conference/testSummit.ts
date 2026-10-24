import { parseDetails } from "./details";
import type { ConferenceDetails } from "./types";
import { AGENDA_FILE_FORMAT } from "./agendaImport";

/**
 * A made-up four-day summit shaped like a real company one — an evening
 * mixer, breakfasts with typed ends, sessions with topics and no ends,
 * breaks, a celebration dinner, travel home — for tests. Invented on
 * purpose: a real company's programme is theirs and lives only in their
 * conference's record, never in this (public) repository.
 */
export const SUMMIT_FILE = {
  format: AGENDA_FILE_FORMAT,
  conference: {
    startsOn: "2026-10-26",
    endsOn: "2026-10-29",
    timeZone: "America/Vancouver",
    venue: { name: "Harbour Hotel", address: "1 Quay Street" },
  },
  dayTitles: [{ day: "2026-10-26", title: "Welcome to town!" }],
  agenda: [
    {
      id: "mon-mixer",
      day: "2026-10-26",
      start: "17:30",
      end: "20:30",
      title: "Welcome Mixer",
      kind: "social",
      note: "Say hello.",
    },
    {
      id: "tue-breakfast",
      day: "2026-10-27",
      start: "07:00",
      end: "08:30",
      title: "Breakfast",
      where: "Room 4-5",
      kind: "meal",
    },
    {
      id: "tue-general",
      day: "2026-10-27",
      start: "08:30",
      title: "General Session",
      where: "Grand Ballroom",
      topics: [
        "Welcome; the year ahead",
        "Values, with a comma",
        "Panel — Q&A",
      ],
    },
    {
      id: "tue-games",
      day: "2026-10-27",
      start: "10:00",
      title: "Break and Icebreaker Game",
      kind: "social",
    },
    {
      id: "tue-general-2",
      day: "2026-10-27",
      start: "10:30",
      title: "General Session",
      where: "Grand Ballroom",
    },
    {
      id: "tue-lunch",
      day: "2026-10-27",
      start: "12:00",
      title: "Lunch",
      where: "Room 4-5",
      kind: "meal",
    },
    {
      id: "tue-skills",
      day: "2026-10-27",
      start: "13:30",
      title: "Skills Session",
      where: "Grand Ballroom",
      kind: "skills",
    },
    {
      id: "tue-break",
      day: "2026-10-27",
      start: "14:30",
      title: "Break",
      kind: "break",
    },
    {
      id: "tue-wrap",
      day: "2026-10-27",
      start: "15:00",
      title: "Wrap-up",
      where: "Grand Ballroom",
    },
    {
      id: "tue-dinner",
      day: "2026-10-27",
      start: "18:00",
      title: "Group Dinners",
      kind: "meal",
      note: "Location: shared on-site.",
    },
    {
      id: "wed-breakfast",
      day: "2026-10-28",
      start: "07:00",
      end: "08:30",
      title: "Breakfast",
      where: "Room 4-5",
      kind: "meal",
    },
    {
      id: "wed-session",
      day: "2026-10-28",
      start: "08:30",
      title: "Morning Session",
      where: "Grand Ballroom",
    },
    {
      id: "wed-wrap",
      day: "2026-10-28",
      start: "17:00",
      title: "Wrap-up",
      where: "Grand Ballroom",
    },
    {
      id: "wed-gala",
      day: "2026-10-28",
      start: "18:30",
      title: "Celebration Dinner",
      where: "Grand Ballroom",
      kind: "celebration",
      featured: true,
    },
    {
      id: "thu-club",
      day: "2026-10-29",
      start: "10:15",
      title: "Hangout: Tea Club",
      where: "Grand Ballroom",
      kind: "social",
      aside: "History is being made.",
    },
    {
      id: "thu-travel",
      day: "2026-10-29",
      start: "13:00",
      title: "Travel Home",
      kind: "travel",
    },
  ],
};

/** A conference as it exists before the import: wrong dates, one test line. */
export const BEFORE: ConferenceDetails = (() => {
  const r = parseDetails({
    name: "Summit",
    place: { label: "Vancouver", townId: "vancouver" },
    timeZone: "America/Vancouver",
    startsOn: "2026-10-24",
    endsOn: "2026-10-26",
    modules: ["schedule", "discover", "arrivals"],
    agenda: [
      { id: "own-line", day: "2026-10-25", start: "09:00", title: "Test line" },
    ],
  });
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.details;
})();
