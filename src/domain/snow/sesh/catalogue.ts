/**
 * **The real features Sesh Wars lists**, each one a park the resort itself
 * publishes, with the page and the day Passport read it.
 *
 * Read 2026-11-10 from the resorts' own sites only. Parks rebuild their
 * individual jumps and rails through a season, so a feature here is a park or
 * a lane as the resort names it — never a jump Passport made up, and never a
 * position. A rider's caption says what they hit in it.
 *
 * SilverStar publishes no park names in any page Passport could read (its
 * trail map is a PDF, not read), so it has none here: the mountain page says
 * so and offers the demo and a way to propose one. Proposals wait for a
 * moderator, who checks them against the resort.
 *
 * The same rows are seeded by docs/product/snow/sesh-wars-migration.sql; a
 * test pins the two together.
 */
import type { Feature, FeatureSource } from "./model";

const BW_PARK = "https://www.bigwhite.com/events-activities/telus-park";
const BW_COND = "https://www.bigwhite.com/mountain-conditions/park-conditions";
const WB =
  "https://www.whistlerblackcomb.com/the-mountain/about-the-mountain/terrain-parks.aspx";
const CHECKED = "2026-11-10";

const src = (url: string, quote: string): FeatureSource => ({
  url,
  quote,
  checked: CHECKED,
});

export const REAL_FEATURES: readonly Feature[] = [
  {
    id: "bw-telus-sm",
    mountainId: "big-white",
    name: "TELUS Park — Small & Medium lane",
    kind: "park-lane",
    sizes: ["small", "medium"],
    where: "TELUS Park, Big White",
    description:
      "Big White's progression lane: rails, jumps and taps with progressive takeoffs and landings. The place to start.",
    status: "approved",
    opens: "2026-11-26",
    source: src(BW_COND, "Small & Medium Terrain Park Lane"),
    note: "Big White supports the Burton Smart Style program. Ride within your ability and check the park every day before riding it.",
  },
  {
    id: "bw-telus-lxl",
    mountainId: "big-white",
    name: "TELUS Park — Large & XL lane",
    kind: "park-lane",
    sizes: ["large", "xl"],
    where: "TELUS Park, Big White",
    description:
      "The bigger lane at TELUS Park, for riders who already own the smalls and mediums.",
    status: "approved",
    opens: "2026-11-26",
    source: src(BW_COND, "Large & Extra Large Terrain Park Lane"),
    note: "Big White supports the Burton Smart Style program. Ride within your ability and check the park every day before riding it.",
  },
  {
    id: "bw-halfpipe",
    mountainId: "big-white",
    name: "TELUS Park halfpipe",
    kind: "halfpipe",
    sizes: [],
    where: "TELUS Park, Big White",
    description:
      "Big White's halfpipe, listed on the resort's park conditions page.",
    status: "approved",
    opens: "2026-11-26",
    source: src(BW_COND, "Halfpipe"),
  },
  {
    id: "wb-ego",
    mountainId: "whistler-blackcomb",
    name: "Ego Park",
    kind: "park-lane",
    sizes: ["small"],
    where: "Whistler Mountain",
    description:
      "Small features on Whistler — the resort's own words for where to start.",
    status: "approved",
    source: src(WB, "We have opened small features at Ego Park on Whistler"),
  },
  {
    id: "wb-choker",
    mountainId: "whistler-blackcomb",
    name: "Choker Park",
    kind: "park-lane",
    sizes: ["small"],
    where: "Blackcomb Mountain",
    description: "Small features on Blackcomb.",
    status: "approved",
    source: src(WB, "…and Choker Park on Blackcomb"),
  },
  {
    id: "wb-terrain-park",
    mountainId: "whistler-blackcomb",
    name: "Terrain Park",
    kind: "park-lane",
    sizes: ["medium", "large"],
    where: "Whistler Blackcomb",
    description:
      "Intermediate and advanced features mixed together — tables, hips, rails and techy jibs. The stepping stone to the Highest Level Park.",
    status: "approved",
    source: src(
      WB,
      "packed with intermediate and advanced features mixed together",
    ),
  },
  {
    id: "wb-highest-level",
    mountainId: "whistler-blackcomb",
    name: "Highest Level Terrain Park",
    kind: "park-lane",
    sizes: ["xl"],
    where: "Whistler Blackcomb",
    description:
      "Jumps, spines, rails and jibs designed with the expert rider in mind.",
    status: "approved",
    source: src(
      WB,
      "Massive jumps, spines, rails and jibs designed with the expert rider in mind",
    ),
    note: "Helmets are mandatory in this zone (Whistler Blackcomb).",
  },
];

/** Why a mountain has no real features yet, when it hasn't. */
export const NO_FEATURES_BECAUSE: Record<string, string> = {
  silverstar:
    "SilverStar doesn't name its park features on any page Passport could read yet (the trail map is a PDF). Until a moderator checks them with the resort, SilverStar has no real features here — the demo's SilverStar features are fictional.",
};

export const BW_PARK_PAGE = BW_PARK;
