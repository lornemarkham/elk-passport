/**
 * **The shelves October actually has.**
 *
 * Each one is a human naming a handful of subjects that belong together, by
 * id, in version control. Not a keyword lens: a previous pass shipped shelves
 * built by matching words in descriptions, and they produced five wineries
 * under "Kids October" and a snowmobile ride. Membership is a judgement, and a
 * judgement should be reviewable in a diff rather than re-derived from a
 * regular expression every render.
 *
 * ## The corpus decided these, not a template
 *
 * Counted across the 35 subjects October currently surfaces:
 *
 * ```
 * haunts / Halloween     5   enough for a shelf, and the reason for October
 * live music & comedy   13   the largest group by a distance
 * daytime & fall          6   markets, festivals, a swap, an expo
 * night sky               1   not a shelf — one subject, given a feature
 * sport                   2   too few to name, left to the calendar
 * ```
 *
 * A group of one does not become a shelf by being interesting; it becomes a
 * feature. A group of two does not become a shelf at all.
 *
 * ## Nothing here overrides truth
 *
 * A shelf may only *show* what Discovery already selected as on in October.
 * An id listed here whose dates have passed renders nothing, because the page
 * intersects these lists with the lanes it already computed. Order within a
 * shelf is the lane's order — soonest first — not this file's.
 */

export interface OctoberShelf {
  readonly id: string;
  readonly title: string;
  /** One line, written by a human. Never a claim about any single subject. */
  readonly blurb?: string;
  readonly entityIds: readonly string[];
}

export const OCTOBER_SHELVES: readonly OctoberShelf[] = [
  {
    id: "haunted",
    title: "Haunted October",
    blurb: "The ones built to frighten you.",
    entityIds: [
      "exp-field-of-screams-okeefe-ranch",
      "exp-black-mountain-haunted-house",
      "561087f0-b228-4841-af24-f00dd9fabb13", // Haunted Halloween Trail at Sagebrush Ranch
      "exp-usher-caravan-farm-theatre", // The Fall of the House of Usher
      "3c8a83c1-063a-4ae8-ab88-5662c9f210d0", // Shrek Rave Swamp-O-Ween
    ],
  },
  {
    id: "daytime",
    title: "Out in the daylight",
    blurb: "Markets, mazes and afternoons that do not try to scare anybody.",
    entityIds: [
      "1a188a25-5320-4eab-9c4e-953f727682a2", // Fall Fest
      "f7aef3df-e6aa-4f09-afa6-7ae451d14929", // Kelowna Harvest Scarecrow Festival
      "7b815b4c-b32d-4fed-9751-e7672e8f77be", // Okanagan Coffee Fest
      "4956e694-2b0f-4eca-86ae-ff5868c3949f", // Oktoberfest at Howling Bluff Winery
      "2332c0c2-b501-4740-9f01-6d58e0830a19", // Miniature Expo
      "3fd77b0e-f1ac-49de-b4bd-a4dd9adcb61c", // Craft Supply Swap
      "0b73ec70-c473-4741-b4f2-ade30cb78e32", // 2026 Salute to the Sockeye Festival
    ],
  },
  {
    id: "live",
    title: "Live and loud",
    blurb: "Somebody on a stage, most nights of the month.",
    entityIds: [
      "22ee5c51-7dc8-49a1-b752-d6785fda6c2b", // Valdy
      "9075b0d9-0c18-4f85-b638-622e2ccf1bd8", // Default with Wide Mouth Mason
      "515d2ebf-be34-4ede-a228-d2ba4d77f991", // The Australian Bee Gees Show
      "d481f08f-7c23-40d6-bbc0-2e64e57ae4b1", // Maiden Vancouver
      "bc1ddbbb-15d0-426c-8708-b5e7270bf423", // Bad Moon Riders
      "47fe1f43-29f8-40f7-9460-9b4cb59d3cfb", // Little Miss Higgins
      "91864cf9-f924-45dc-b2a7-946c2defec55", // John Reischman and the Jaybirds
      "0f0ee3c4-3f66-4e0c-8251-a419ae321c17", // Honeybear, the Band
      "dce0cacf-2763-4f10-bcfd-5c356bda3b6b", // Music That Shimmers Live
      "4553741d-e506-4560-968d-86491386031e", // Carson Thompson comedy special
      "4ff2b8e3-cf47-4c38-93c0-bc8a3310a916", // Swipe Right Comedy Night
      "1391fd5d-a468-41a9-a039-61d4cd8d3e22", // Top 3 Comedy Night
      "31faeba0-0a71-47c9-a6d8-7c9a69bf7176", // Comedy for a Cause
      "c2750906-15dc-4836-a2d0-3d59444671ea", // HillBilly Wedding Murder Mystery
    ],
  },
];

/**
 * **The one subject that earns a page to itself.**
 *
 * The Draconids are the only night-sky subject Atlas holds for October, and a
 * shelf of one is a heading with a card under it. A feature is the honest
 * shape: it is genuinely different from everything else October offers, and it
 * is the only thing on the page that costs nothing and needs no ticket.
 *
 * If a second verified sky subject ever arrives this becomes a shelf. It is
 * not one now, and inventing a companion to justify the heading would be
 * exactly the fabrication this whole product refuses.
 */
export const OCTOBER_FEATURE = {
  entityId: "ddf146c6-7117-4520-a9fe-8326209fd5db",
  eyebrow: "Look up",
  title: "The sky has something on too",
  blurb:
    "One night in October, the Draconids. No ticket, no drive, nothing to book — just darkness and somewhere to stand.",
} as const;
