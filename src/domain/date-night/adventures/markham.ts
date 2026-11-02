import { TOMORROW } from "./tomorrow";
import type { NightConfig } from "./types";

/**
 * **The Markham Adventure ❤️ — Lorne and Jess, 2 November 2026.**
 *
 * The activities are Lorne's list as possibilities, not an itinerary.
 *
 * Atlas check (prod corpus snapshot of 2026-10-24, 10 MB): "King Eddie" is
 * NOT in Atlas — the only near match is the King Edward VII Fountain in
 * Vancouver, which is a different place. It, grouse hunting, fires and
 * snowmobiling stay personal ideas with a caution, never "verified places".
 * The mystery draws from Atlas places Atlas does hold, near Vernon (the same
 * ids Date Night's invitation uses, `nights/lorne-and-jess.ts`).
 */
export const MARKHAM: NightConfig = {
  slug: "datenight",
  title: "The Markham Adventure ❤️",
  adventureTitle: "The Markham Adventure ❤️",
  tagline: "Two people. One vehicle. No particular hurry.",
  invitation: [
    "Monday's taken. You're coming with me. ❤️",
    "Tomorrow we disappear for a little while. Into the wild, your hot pools, or a very cold lake and a warm fire. The details are negotiable. Your company isn't.",
    "Come and make it ours.",
  ],
  activities: [
    {
      id: "king-eddie",
      emoji: "🧊",
      title: "King Eddie",
      line: "Exploring, and possibly a very cold swim. Screaming optional.",
      caution:
        "Not in Atlas, so we know nothing checked about it. Check access, water and weather before going near cold water, and never swim alone.",
    },
    {
      id: "grouse-and-backroads",
      emoji: "🪶",
      title: "Grouse hunting & backroad exploring",
      line: "Quiet trails, sharp eyes, and roads that may or may not end.",
      caution:
        "Check hunting seasons, licences and road conditions yourselves; Passport hasn't.",
    },
    {
      id: "fire-and-food",
      emoji: "🔥",
      title: "Outdoor fire & food",
      line: "Where permitted. Mittens, smoky hair, excellent snacks.",
      caution:
        "Check the current fire restrictions for the area before you light anything.",
    },
    {
      id: "snowmobile-scouting",
      emoji: "🛷",
      title: "Snowmobile adventure scouting",
      line: "Scout the high country before the real snow lands.",
      caution: "Snow, access and avalanche conditions are not checked here.",
    },
    {
      id: "hot-chocolate",
      emoji: "☕",
      title: "Hot chocolate & warming up",
      line: "The reward for everything else on this list.",
    },
    {
      id: "mystery",
      emoji: "🎁",
      title: "Mystery adventure",
      line: "Passport picks somewhere neither of us has been. No complaints.",
      mystery: true,
    },
  ],
  packing: [
    "Chairs",
    "Warm clothes",
    "Towels",
    "Food and snacks",
    "Hot chocolate",
    "Good tunes",
    "Good attitude",
  ],
  day: TOMORROW,
  evenings: ["into-the-wild", "crazy-creek", "cold-water", "surprise"],
  partnerName: "Jess",
  mysteryAtlasIds: [
    "d3c70f99-3412-46d2-87f8-45e4854b7d48", // Kalamalka Lake Park
    "2479e5c4-0493-4217-af06-9293d75419c5", // Rattlesnake Point
    "9340aa8a-cdfa-41e3-874a-9f0da31b5d35", // Ellison Park
    "d9e50732-52d6-4fa1-af9c-789112980f46", // Silver Star Provincial Park
    "b2bde731-e9ab-4f77-b1ab-fc96f43f4891", // Noble Canyon
    "e9ed926f-af06-4109-b527-342f1ed8b152", // Grey Canal Bella Vista
  ],
};
