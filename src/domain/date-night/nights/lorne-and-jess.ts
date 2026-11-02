import type { DateNight } from "../types";

/**
 * **Lorne ❤️ Jess — 2 November 2026.** The first Date Night, and the only
 * thing in the engine that knows their names.
 *
 * The ideas are Lorne's own list (owner brief "Date Night — Lorne & Jess",
 * 2026-11-01), as possibilities, not an itinerary. Where an idea is about a
 * place Atlas holds, it points at Atlas's id and the page shows Atlas's facts;
 * King Eddie and Crazy Creek are not in Atlas (checked against the
 * 2026-10-24 corpus), so the invitation says it has nothing on them.
 *
 * The area is Vernon, the city Environment Canada publishes a forecast for
 * and the anchor for sunset arithmetic. It is not anybody's address.
 */
export const LORNE_AND_JESS: DateNight = {
  slug: "lorne-and-jess",
  vanityPath: "/lorne-and-jess",
  from: "Lorne",
  to: "Jess",
  headline: "Lorne ❤️ Jess",
  on: "2026-11-02",
  timeZone: "America/Vancouver",
  invitation: "Tomorrow, November 2, we're going on an adventure.",
  area: { label: "around Vernon", latitude: 50.267, longitude: -119.272 },
  ideas: [
    {
      id: "cold-plunge",
      emoji: "🧊",
      title: "Cold plunge at King Eddie",
      line: "Scream, laugh, get out fast, never feel more alive.",
      cautions: ["cold-water", "unverified-place"],
      placeAtlasDoesNotKnow: "King Eddie",
    },
    {
      id: "crazy-creek",
      emoji: "🌊",
      title: "Crazy Creek adventure",
      line: "Waterfalls, a wobbly bridge and whatever we find.",
      cautions: ["unverified-place", "forest-roads"],
      placeAtlasDoesNotKnow: "Crazy Creek",
    },
    {
      id: "bird-hunting",
      emoji: "🪶",
      title: "Bird hunting",
      line: "Quiet trails, sharp eyes, the two of us.",
      cautions: ["hunting", "forest-roads"],
    },
    {
      id: "fire-hot-chocolate",
      emoji: "🔥",
      title: "Outdoor fire & hot chocolate",
      line: "Mittens, marshmallows, the good kind of smoky.",
      cautions: ["fire"],
    },
    {
      id: "snowmobile-scouting",
      emoji: "🛷",
      title: "Snowmobile backcountry scouting",
      line: "Scout the high country before the real snow lands.",
      cautions: ["backcountry-snow", "forest-roads"],
    },
    {
      id: "backcountry-bbq",
      emoji: "🌭",
      title: "Backcountry BBQ",
      line: "Lunch somewhere with no tables and a great view.",
      cautions: ["fire", "forest-roads"],
    },
    {
      id: "somewhere-new",
      emoji: "🧭",
      title: "Explore somewhere neither of us has been",
      line: "Pick a road we've never taken and see what's there.",
      cautions: ["forest-roads"],
    },
    {
      id: "viewpoint",
      emoji: "🏔️",
      title: "Find an amazing viewpoint",
      line: "Somewhere high, with the whole valley below.",
      atlasIds: [
        "2479e5c4-0493-4217-af06-9293d75419c5", // Rattlesnake Point
        "65c5da2d-099f-4ffb-a4cd-d5ab79c12701", // Silver Star Foothills
        "44116250-dcec-4fd9-afee-c371c26500b1", // Middleton Mountain
        "651ecb3c-33e1-408a-95be-1daa40c28004", // Okanagan Lake Viewpoint
      ],
    },
    {
      id: "sunset",
      emoji: "🌅",
      title: "Sunset adventure",
      line: "Be somewhere beautiful when the light goes gold.",
      aboutSunset: true,
    },
    {
      id: "cook-together",
      emoji: "🍲",
      title: "Cook dinner together afterward",
      line: "Cold cheeks, warm kitchen, something delicious.",
    },
  ],
  suggestPlaceIds: [
    "d3c70f99-3412-46d2-87f8-45e4854b7d48", // Kalamalka Lake Park
    "2479e5c4-0493-4217-af06-9293d75419c5", // Rattlesnake Point
    "9340aa8a-cdfa-41e3-874a-9f0da31b5d35", // Ellison Park
    "d9e50732-52d6-4fa1-af9c-789112980f46", // Silver Star Provincial Park
    "b2bde731-e9ab-4f77-b1ab-fc96f43f4891", // Noble Canyon
    "e9ed926f-af06-4109-b527-342f1ed8b152", // Grey Canal Bella Vista
    "1d8a002c-a7ac-41d5-9a3e-73ab0849e702", // Kekuli Bay Provincial Park
    "d3697a18-79fb-49de-9085-567553d5dac1", // Fintry Provincial Park
  ],
  food: [
    "Hot chocolate",
    "Coffee",
    "Smokies on the fire",
    "Burgers",
    "Charcuterie",
    "Soup in a thermos",
    "Wine",
    "Beer",
    "Something spicy",
    "Dessert first",
  ],
  thanks: "Lorne has it. See you tomorrow, adventurer. ❤️",
};
