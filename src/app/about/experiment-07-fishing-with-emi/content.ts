/**
 * **Fishing With Emi — the data behind the page.**
 *
 * Every claim on this page lives here, and every claim carries the
 * category it belongs to. That is the point of the experiment as much as
 * the fishing is: a family adventure page mixes three *completely
 * different kinds of statement* and most travel content renders them
 * identically.
 *
 * - `verified` — read off a primary source, quoted, cited, dated.
 * - `live-check` — genuinely unknowable in advance. Weather, wildfire,
 *   road status, in-season regulation changes. The page must never show
 *   a green light for these, because it is not retrieving them.
 * - `prototype` — Passport's own suggestion. Module picks, the "chosen
 *   for Emi" default, the memory fields. Invented, and labelled so.
 *
 * The rule the whole file exists to enforce: **a legal statement and a
 * suggested activity must not look alike.** One of them can end a trip
 * badly.
 *
 * ## Why the prose lives in a `.ts` file
 *
 * Partly lint hygiene — apostrophes in JSX fight `react/no-unescaped-
 * entities`. Mostly because separating the *claims* from the *layout*
 * means a claim can be reviewed without reading JSX, and every claim
 * sits next to the `sourceId` that backs it.
 */

// ============================================================
// Sources — nothing on this page may cite anything not in here
// ============================================================

export interface Source {
  readonly id: string;
  readonly label: string;
  readonly publisher: string;
  readonly url: string;
  /** ISO date this URL was actually fetched and read. */
  readonly checked: string;
}

const CHECKED = "2026-08-15";

export const SOURCES: Readonly<Record<string, Source>> = {
  synopsis: {
    id: "synopsis",
    label: "BC Freshwater Fishing Regulations Synopsis 2025-2027",
    publisher: "Province of British Columbia",
    url: "https://www2.gov.bc.ca/assets/gov/sports-recreation-arts-and-culture/outdoor-recreation/fishing-and-hunting/freshwater-fishing/pw_regulations_guide.pdf",
    checked: CHECKED,
  },
  region8: {
    id: "region8",
    label: "Region 8 — Okanagan, water-specific tables",
    publisher: "Province of British Columbia",
    url: "https://www2.gov.bc.ca/assets/gov/sports-recreation-arts-and-culture/outdoor-recreation/fishing-and-hunting/freshwater-fishing/region_8_okanagan.pdf",
    checked: CHECKED,
  },
  regsHome: {
    id: "regsHome",
    label: "Freshwater fishing regulations in B.C. (in-season changes)",
    publisher: "Province of British Columbia",
    url: "https://www2.gov.bc.ca/gov/content/sports-culture/recreation/fishing-hunting/fishing/fishing-regulations",
    checked: CHECKED,
  },
  licence: {
    id: "licence",
    label: "Fishing Licence & Regulations",
    publisher: "Freshwater Fisheries Society of BC",
    url: "https://www.gofishbc.com/learn/fishing-licence-regulations/",
    checked: CHECKED,
  },
  wild: {
    id: "wild",
    label: "WILD — licence purchase and Fish and Wildlife ID",
    publisher: "Province of British Columbia",
    url: "https://www2.gov.bc.ca/gov/content/sports-culture/recreation/fishing-hunting/wild-system/wild-login",
    checked: CHECKED,
  },
  stocking: {
    id: "stocking",
    label: "Where to Fish — stocking records by lake",
    publisher: "Freshwater Fisheries Society of BC",
    url: "https://www.gofishbc.com/where-to-fish/",
    checked: CHECKED,
  },
  wildfire: {
    id: "wildfire",
    label: "BC Wildfire Service — current wildfire map and bans",
    publisher: "BC Wildfire Service",
    url: "https://wildfiresituation.nrs.gov.bc.ca/map",
    checked: CHECKED,
  },
  recsites: {
    id: "recsites",
    label: "Recreation Sites and Trails BC — site status and alerts",
    publisher: "Province of British Columbia",
    url: "https://www.sitesandtrailsbc.ca/",
    checked: CHECKED,
  },
  driveBC: {
    id: "driveBC",
    label: "DriveBC — road events and conditions",
    publisher: "Province of British Columbia",
    url: "https://www.drivebc.ca/",
    checked: CHECKED,
  },
  weather: {
    id: "weather",
    label: "Environment Canada forecast — Vernon",
    publisher: "Environment and Climate Change Canada",
    url: "https://weather.gc.ca/city/pages/bc-77_metric_e.html",
    checked: CHECKED,
  },
};

// ============================================================
// Evidence tiers — the page's central honesty device
// ============================================================

export type Tier = "verified" | "live-check" | "prototype";

export const TIER_META: Readonly<
  Record<Tier, { label: string; short: string; blurb: string }>
> = {
  verified: {
    label: "Verified snapshot",
    short: "Verified",
    blurb: `Read off a primary source on ${CHECKED}, quoted and linked. Still a snapshot — the source can change after the date shown.`,
  },
  "live-check": {
    label: "Check before you leave",
    short: "Check live",
    blurb:
      "Passport is not retrieving this. It changes daily or hourly, and this page deliberately shows no status for it — an unchecked box is honest, a green checkmark would be a lie.",
  },
  prototype: {
    label: "Prototype personalization",
    short: "Prototype",
    blurb:
      "Passport's own suggestion, invented for this prototype. Not sourced, not a fact about the world. This is the part that would one day come from Atlas.",
  },
};

// ============================================================
// The traveller — Lorne's stated context, not Atlas's inference
// ============================================================

export const TRIP = {
  title: "Fishing With Emi",
  subtitle:
    "A first fishing adventure from Vernon through Trinity Valley to Hidden Lake",
  mission:
    "Have fun. Learn how to fish. Explore somewhere new. Maybe catch a rainbow trout.",
  successNote:
    "Catching a fish is not the success condition. A five-year-old who casts once, finds a weird stick and asks to come back has had a perfect day.",
  facts: [
    { label: "Who", value: "Uncle + Emi, age 5" },
    { label: "Occasion", value: "First fishing trip" },
    { label: "Start", value: "Vernon, B.C." },
    { label: "Route", value: "Backroads via Lumby and Trinity Valley" },
    { label: "Destination", value: "Hidden Lake" },
    { label: "Difficulty", value: "Casual — no experience needed" },
    { label: "Fishing time", value: "About 2-3 hours at the lake" },
  ],
  timingCaveat:
    "Two to three hours is the fishing, not the day. Backroad driving, a scout stop and a treat on the way home make this a half-day at least. Passport is not estimating drive time — nothing on this page has measured it.",
} as const;

// ============================================================
// Moments — each one explains why it earns its place
// ============================================================

export interface Moment {
  readonly id: string;
  readonly index: number;
  readonly name: string;
  readonly kind: string;
  readonly why: string;
  readonly detail: string;
  readonly tier: Tier;
  readonly sourceIds?: readonly string[];
  readonly caution?: string;
}

export const MOMENTS: readonly Moment[] = [
  {
    id: "drive",
    index: 1,
    name: "The backroad drive",
    kind: "Vernon → Lumby → Trinity Valley Road",
    why: "The drive is not the gap between the fun parts — for a five-year-old it is one of the fun parts. Pavement gives way to valley, then to forestry road, and the change is visible through the window.",
    detail:
      "Fuel and snacks in Lumby — it is the last reliable stop before the valley. Past Lumby the route follows Trinity Valley Road north.",
    tier: "prototype",
    caution:
      "Passport has not verified road surface, distance, or driving time. Trinity Valley and the Hidden Lake access road are rural/forestry roads — check DriveBC and expect active logging traffic.",
  },
  {
    id: "seidner",
    index: 2,
    name: "Seidner Lake",
    kind: "Scout stop — not a fishing stop",
    why: "A short stop to look at water, stretch, and take a photo. It is on the way, and treating it as a scouting mission is more fun for a kid than treating it as a rest break.",
    detail:
      "Seidner Lake sits near Trinity Valley in the North Okanagan Regional District. Passport is deliberately not presenting it as a fishing destination.",
    tier: "live-check",
    caution:
      "Seidner Lake does NOT appear in the Region 8 water-specific tables, and Passport holds no authoritative evidence about its access, ownership, road status or suitability for fishing. Only what you can see from the road. Do not plan to fish here on the strength of this page.",
  },
  {
    id: "hidden",
    index: 3,
    name: "Hidden Lake",
    kind: "The fishing moment — primary destination",
    why: "A stocked rainbow trout lake with recreation sites and boat launches, which means somewhere to park, somewhere to stand, and a shoreline a small person can fish from without a boat.",
    detail:
      "Hidden Lake is in Management Unit 8-25, Region 8 (Okanagan). Recreation Sites and Trails BC describes three recreation sites totalling 48 campsites, each with a boat launch, accessed off Trinity Valley Road via Hidden Lake Road.",
    tier: "verified",
    sourceIds: ["region8", "recsites", "stocking"],
    caution:
      "Access detail is from Recreation Sites and Trails BC listings, not from a Passport site visit. Confirm the current road and site status before relying on it — and note the site charges fees seasonally.",
  },
  {
    id: "treat",
    index: 4,
    name: "The victory treat",
    kind: "Unresolved — you pick",
    why: "The treat is the part Emi will describe first when someone asks how it went. It is worth deciding on purpose rather than by accident, and it works whether or not a fish was caught.",
    detail:
      "Passport has not selected a business for this. Atlas holds no verified hours, location or open status for anywhere on this route, and inventing a plausible-sounding ice cream shop is exactly the failure this project refuses.",
    tier: "prototype",
    caution:
      "Pick this yourself, ideally before leaving — most small-town options close earlier than you would expect on a weekday.",
  },
];

// ============================================================
// Legal — verified, quoted, dated. The highest-stakes block.
// ============================================================

export interface LegalRule {
  readonly id: string;
  readonly heading: string;
  readonly plain: string;
  readonly quote?: string;
  readonly sourceId: string;
  readonly where: string;
  readonly emphasis?: boolean;
  readonly caveat?: string;
}

export const LEGAL_RULES: readonly LegalRule[] = [
  {
    id: "adult-licence",
    heading: "You need a licence. Emi does not.",
    plain:
      "Anyone 16 or older must hold a valid basic freshwater licence to fish in non-tidal water in B.C.",
    quote:
      "If you are 16 years of age or older you must have a valid basic freshwater licence to recreationally fish for any species (including salmon) in non-tidal waters in B.C.",
    sourceId: "licence",
    where: "Freshwater Fisheries Society of BC",
    emphasis: true,
  },
  {
    id: "child-resident",
    heading: "Emi fishes free — and gets her own quota",
    plain:
      "A B.C. resident under 16 may fish with no licence and no stamp, does not need to be accompanied by a licence holder, and is entitled to her own quota of fish.",
    quote:
      "You may sport fish without any licence or stamp (but must abide by the regulations). You do not need to be accompanied by a licence holder. You are entitled to your own quota of fish.",
    sourceId: "synopsis",
    where: "Synopsis, Buying a Licence (p. 6)",
    emphasis: true,
    caveat:
      "This applies because Emi is a B.C. resident. A child under 16 who is NOT a B.C. resident still needs no licence, but must be accompanied by a licensed adult, and anything they keep counts against that adult's quota — not their own.",
  },
  {
    id: "one-line",
    heading: "One line, one hook",
    plain:
      "Your licence entitles you to one fishing line with only one hook, one artificial lure, or one artificial fly attached. Two rods in the water at once is not allowed from shore.",
    quote:
      "angle with one fishing line to which only one hook, one artificial lure OR one artificial fly is attached.",
    sourceId: "synopsis",
    where: "Synopsis, Allowable Fishing Methods (p. 8)",
    caveat:
      "One narrow exception: a person alone in a boat on a lake may angle with two lines. Not relevant from shore, and not relevant with two people.",
  },
  {
    id: "quota",
    heading: "Region 8 trout quota: 5 per day",
    plain:
      "The Region 8 daily quota for trout and char is 5, of which not more than 1 may be over 50 cm. You and Emi each have your own quota.",
    quote: "Trout/char: 5, but not more than 1 over 50 cm",
    sourceId: "region8",
    where: "Region 8 — Okanagan, Region 8 Daily Quotas (p. 67)",
    caveat:
      "Realistically irrelevant on a first trip with a five-year-old. It is here because a quota you did not know about is the one you break.",
  },
  {
    id: "hidden-specific",
    heading: 'Hidden Lake\'s only special rule is "No towing"',
    plain:
      "Hidden Lake appears in the Region 8 water-specific table with exactly one exception, and it is a boating rule, not a fishing rule: do not tow a person on water skis, a surfboard or another water toy. No bait ban, no gear restriction, no quota change, no ice-fishing restriction.",
    quote: "HIDDEN LAKE | 8-25 | No towing",
    sourceId: "region8",
    where: "Region 8 — Okanagan, water-specific table (p. 69)",
    emphasis: true,
    caveat:
      "Because no other exception is listed, the Provincial and Region 8 regulations are what govern your day at this lake.",
  },
  {
    id: "bait",
    heading: "Bait is not banned here",
    plain:
      "Many Region 8 lakes carry an explicit bait ban. Hidden Lake does not — its only listed exception is the towing rule — so the provincial bait rules apply. Worms are named in the provincial definition of bait.",
    quote:
      "Bait Ban: the use of natural bait is prohibited in waters with a bait ban.",
    sourceId: "synopsis",
    where: "Synopsis, How to Read the Tables (p. 4) and Rules on Bait (p. 8)",
    caveat:
      "One provincial rule is worth reading yourself: freshwater invertebrates — aquatic insects, crayfish, nymphs — may not be used as bait at a lake. Garden worms and nightcrawlers are terrestrial, and bait is defined to include worms. If you are buying anything other than worms, read page 8 before you do.",
  },
  {
    id: "barbs",
    heading: "Barbed hooks are legal in lakes — pinch them anyway",
    plain:
      "Barbless hooks are required in every river, stream and creek in B.C., and Region 8 requires a single barbless hook in all of its streams year-round. Hidden Lake is a lake with no gear exception listed, so barbed hooks are legal there.",
    quote:
      "the use of barbed hooks in lakes is permitted, unless noted in the Regional Water-Specific Tables",
    sourceId: "synopsis",
    where: "Synopsis, It Is Unlawful To (p. 8)",
    caveat:
      "Pinching the barb flat with pliers is a recommendation, not a law. It comes out of a fish in about two seconds instead of thirty, and out of a jacket, a thumb or a five-year-old far more easily. There is no legal reason not to.",
  },
  {
    id: "fwid",
    heading: "New this year: FWID and WILD",
    plain:
      "Freshwater licensing moved to the WILD system for the 2026-27 licence year, which began April 1, 2026. Since April 1, 2026 you may state your Fish and Wildlife ID number instead of producing a basic licence when asked.",
    quote:
      "Effective April 1, 2026 when fishing or transporting dead fish, anglers can state their Fish and Wildlife ID (FWID) number",
    sourceId: "synopsis",
    where: "Synopsis, Regulation Changes for 2025-2027 (p. 2)",
    caveat:
      "Carry photo ID regardless. Stamps still require the paper or digital licence, and a paper copy is required where a retention record applies.",
  },
];

export const LEGAL_WARNING =
  "Regulations can change. In-season changes are published after the synopsis is printed, and the Regulations — not the synopsis — are the final authority. Re-check the official rules before fishing.";

// ============================================================
// Before you go — nothing here gets a green light
// ============================================================

export interface CheckItem {
  readonly id: string;
  readonly label: string;
  readonly why: string;
  readonly tier: Tier;
  readonly sourceId?: string;
}

export const LIVE_CHECKS: readonly CheckItem[] = [
  {
    id: "regs",
    label: "Re-check fishing regulations for in-season changes",
    why: "The synopsis is a two-year document. Changes land mid-season and are only published online.",
    tier: "live-check",
    sourceId: "regsHome",
  },
  {
    id: "wildfire",
    label: "Check the wildfire map and current fire restrictions",
    why: "August in the Okanagan. Fires close forestry roads and recreation sites with no notice, and campfire bans are common.",
    tier: "live-check",
    sourceId: "wildfire",
  },
  {
    id: "recsite",
    label: "Check recreation site status, alerts and fees",
    why: "Hidden Lake's sites are seasonally fee-charging and can close for maintenance or fire.",
    tier: "live-check",
    sourceId: "recsites",
  },
  {
    id: "road",
    label: "Check road events on the route",
    why: "Forestry and rural roads change condition fast, and active logging is normal here on a weekday.",
    tier: "live-check",
    sourceId: "driveBC",
  },
  {
    id: "weather",
    label: "Check the forecast",
    why: "A five-year-old's tolerance for wind and rain on an exposed shoreline is roughly zero.",
    tier: "live-check",
    sourceId: "weather",
  },
];

export const PACK_LIST: readonly CheckItem[] = [
  {
    id: "licence-doc",
    label: "Fishing licence or FWID number, plus photo ID",
    why: "You must produce a licence and photo ID on request of an officer.",
    tier: "verified",
    sourceId: "synopsis",
  },
  {
    id: "pfd",
    label: "Child life jacket / PFD for Emi",
    why: "Unfamiliar shoreline, unknown drop-off, one adult who will at some point be untangling a hook instead of watching. This is the single most important item on the page.",
    tier: "prototype",
  },
  {
    id: "offline-map",
    label: "Offline map downloaded before leaving town",
    why: "Assume no cell service in the valley. Download it while you still have signal.",
    tier: "prototype",
  },
  {
    id: "told",
    label: "Someone knows the route and expected return time",
    why: "Standard backroad practice, and the one people skip on short trips.",
    tier: "prototype",
  },
  {
    id: "fuel",
    label: "Full tank — fuel up in Vernon or Lumby",
    why: "There is no fuel in the valley.",
    tier: "prototype",
  },
  {
    id: "water",
    label: "Water and more snacks than seem necessary",
    why: "Snacks are the actual currency of a five-year-old's patience.",
    tier: "prototype",
  },
  {
    id: "firstaid",
    label: "First aid kit — including tweezers",
    why: "Hooks find fingers. It is not an if.",
    tier: "prototype",
  },
  {
    id: "phone",
    label: "Charged phone and a car charger",
    why: "Camera, map, and the only emergency option once you are off pavement.",
    tier: "prototype",
  },
  {
    id: "layers",
    label: "Warm layer and a change of clothes for Emi",
    why: "She will get wet. Plan for it and it stays funny.",
    tier: "prototype",
  },
];

// ============================================================
// Gear — the Passport pattern: what you own vs what you buy
// ============================================================

export interface GearItem {
  readonly id: string;
  readonly name: string;
  readonly note: string;
}

export const GEAR_OWNED: readonly GearItem[] = [
  { id: "rods", name: "Two fishing rods", note: "Already have them." },
  {
    id: "licence-have",
    name: "Valid adult freshwater licence",
    note: "Already held. Emi needs none.",
  },
];

export const GEAR_BUY: readonly GearItem[] = [
  {
    id: "hooks",
    name: "Small bait hooks, #8-#10",
    note: "Small enough for a trout to actually take. One hook on the line.",
  },
  {
    id: "bobbers",
    name: "Small bobbers",
    note: "The entire user interface of this trip. Small ones show a bite; big ones hide it.",
  },
  {
    id: "shot",
    name: "Split-shot weights",
    note: "Sinks the worm and stops the bobber lying flat.",
  },
  {
    id: "worms",
    name: "Worms / nightcrawlers",
    note: "Buy in Vernon or Lumby. Bait is not banned at Hidden Lake.",
  },
  {
    id: "pliers",
    name: "Needle-nose pliers or forceps",
    note: "Hook removal, and pinching barbs flat before you start.",
  },
  {
    id: "clippers",
    name: "Line clippers or small scissors",
    note: "You will retie more often than you expect.",
  },
];

export const GEAR_RECOMMENDED: readonly GearItem[] = [
  {
    id: "net",
    name: "Small landing net",
    note: "Turns the most likely moment of loss into the most likely moment of success.",
  },
  {
    id: "pfd-buy",
    name: "Child PFD / life jacket",
    note: "If you do not already own one that fits her now.",
  },
  {
    id: "cooler",
    name: "Cooler and ice",
    note: "Only if you might keep one. A kept fish needs to get cold immediately.",
  },
];

export const GEAR_OPTIONAL: readonly GearItem[] = [
  {
    id: "spinner",
    name: "Small inline spinner, around 1/8 oz",
    note: "Plan B when the bobber has done nothing for twenty minutes.",
  },
  {
    id: "powerbait",
    name: "PowerBait",
    note: "Works on stocked rainbow trout. Buy one jar, not four.",
  },
  {
    id: "box",
    name: "Small tackle container",
    note: "So the hooks are not loose in a pocket.",
  },
];

// ============================================================
// Adventure Builder — the personalization demonstration
// ============================================================

export type ModuleGroup = "fishing" | "nature" | "learning" | "games";

export interface AdventureModule {
  readonly id: string;
  readonly group: ModuleGroup;
  readonly title: string;
  readonly blurb: string;
  /** On by default for Emi's version. */
  readonly forEmi: boolean;
  /** Why this one was or was not chosen for a five-year-old. */
  readonly reason: string;
  /** What this module contributes to the printed packet. */
  readonly packet?: readonly string[];
}

export const MODULE_GROUPS: Readonly<
  Record<ModuleGroup, { label: string; blurb: string }>
> = {
  fishing: { label: "Fishing", blurb: "The actual skill." },
  nature: {
    label: "Nature",
    blurb: "What to do when the fish are not biting.",
  },
  learning: {
    label: "Learning",
    blurb: "Education that does not feel like school.",
  },
  games: { label: "Games", blurb: "For the drive and the quiet stretches." },
};

export const MODULES: readonly AdventureModule[] = [
  // Fishing
  {
    id: "cast",
    group: "fishing",
    title: "Learn to cast",
    blurb: "Short underhand lobs, not overhead casting. Ten feet is plenty.",
    forEmi: true,
    reason: "The one skill she will remember learning.",
    packet: [
      "Stand her side-on to the water with the rod tip low.",
      "Underhand lob — the weight does the work, not the arm.",
      "Ten feet from shore is a real cast. Distance is not the point.",
      "Let her press the button. Getting it wrong is part of it.",
    ],
  },
  {
    id: "bobber",
    group: "fishing",
    title: "Bobber and worm lesson",
    blurb: "The whole setup, taught once, simply.",
    forEmi: true,
    reason: "The simplest setup that genuinely catches trout.",
  },
  {
    id: "identify",
    group: "fishing",
    title: "Fish identification",
    blurb: "What a rainbow trout looks like, and how to be sure.",
    forEmi: true,
    reason: "You legally need to know what you caught before keeping it.",
    packet: [
      "Rainbow trout: pink or red stripe along the side, small dark spots over the body and tail.",
      "If you are not certain what it is, release it. Quotas are species-specific.",
    ],
  },
  {
    id: "release",
    group: "fishing",
    title: "Catch and release lesson",
    blurb: "How to let one go so it swims away strongly.",
    forEmi: true,
    reason:
      "Most likely outcome of the day, and the version of the lesson that teaches care.",
  },
  {
    id: "keep",
    group: "fishing",
    title: "If we keep one",
    blurb: "Confirm, dispatch, cool. Handled plainly.",
    forEmi: false,
    reason:
      "Off by default. Worth having available, but a first trip does not need to end in a dispatched fish unless you decide it should.",
  },
  // Nature
  {
    id: "ispy",
    group: "nature",
    title: "Tree I-Spy",
    blurb: "Spot and name three different trees before the lake.",
    forEmi: true,
    reason: "Turns the drive into a game rather than a wait.",
    packet: [
      "Find a tree with bark like puzzle pieces.",
      "Find a tree with needles in bundles.",
      "Find the tallest tree you can see from where you are standing.",
    ],
  },
  {
    id: "wildlife",
    group: "nature",
    title: "Wildlife spotting",
    blurb: "Quiet counting. Deer, osprey, chipmunks, anything that moves.",
    forEmi: true,
    reason: "Rewards the stillness that fishing needs anyway.",
  },
  {
    id: "photo",
    group: "nature",
    title: "Nature photo challenge",
    blurb: "She takes the photos. All of them. However they turn out.",
    forEmi: true,
    reason:
      "A five-year-old's photo set is the single best souvenir of a day like this.",
  },
  {
    id: "skip",
    group: "nature",
    title: "Rock skipping",
    blurb: "Flat rock, low throw, sideways flick.",
    forEmi: true,
    reason: "Perfect for the stretch when nothing is biting.",
  },
  {
    id: "stick",
    group: "nature",
    title: "Weirdest stick",
    blurb: "Find the strangest stick at the lake. It comes home.",
    forEmi: true,
    reason: "Costs nothing, wins the day, guaranteed to work.",
  },
  // Learning
  {
    id: "coldwater",
    group: "learning",
    title: "Why trout like cold water",
    blurb: "Cold water holds more oxygen. Trout need a lot of it.",
    forEmi: true,
    reason: "One idea, one sentence, answers a real question she will ask.",
    packet: [
      "Cold water holds more oxygen than warm water.",
      "Trout need a lot of oxygen, so they stay where it is cold.",
      "On a hot day they move deeper — which is why early and late are better.",
    ],
  },
  {
    id: "watershed",
    group: "learning",
    title: "What a watershed is",
    blurb: "Every drop around us runs to the same place.",
    forEmi: false,
    reason:
      "Off by default — abstract for five. Left visible because it is exactly right for an eight-year-old.",
  },
  {
    id: "trees",
    group: "learning",
    title: "Tree identification",
    blurb: "Naming a few species properly, not just spotting them.",
    forEmi: false,
    reason: "Off by default. Tree I-Spy covers the same ground more playfully.",
  },
  {
    id: "geography",
    group: "learning",
    title: "Local geography",
    blurb: "Where the valley sits, where the water goes.",
    forEmi: false,
    reason: "Off by default. Better on the drive home than the drive out.",
  },
  {
    id: "forestry",
    group: "learning",
    title: "Forestry and logging",
    blurb: "What the trucks are doing and why the roads exist.",
    forEmi: false,
    reason:
      "Deliberately off for Emi, and deliberately still here. Another family on this exact route would turn it on first — that is the whole point of the builder.",
  },
  {
    id: "geology",
    group: "learning",
    title: "Geology",
    blurb: "Why the rocks by the lake look the way they do.",
    forEmi: false,
    reason: "Off by default. Available for an older or rock-obsessed kid.",
  },
  {
    id: "birds",
    group: "learning",
    title: "Bird identification",
    blurb: "Naming what you spot rather than just spotting it.",
    forEmi: false,
    reason: "Off by default. Wildlife spotting already covers the fun part.",
  },
  {
    id: "history",
    group: "learning",
    title: "Local history",
    blurb: "Who was here, and when.",
    forEmi: false,
    reason:
      "Off by default, and honestly flagged: Passport holds no sourced local history for this valley. Turning it on would produce nothing rather than something invented.",
  },
  // Games
  {
    id: "bingo",
    group: "games",
    title: "Nature bingo",
    blurb: "A card of things to find. First to four wins.",
    forEmi: true,
    reason: "Works in the truck and at the shoreline.",
    packet: [
      "Something red",
      "A bird",
      "A rock shaped like an animal",
      "Water you can hear but not see",
      "A tree bigger around than you can hug",
      "Something soft",
    ],
  },
  {
    id: "trivia",
    group: "games",
    title: "Fish trivia",
    blurb: "Questions with surprising answers.",
    forEmi: true,
    reason: "Good drive filler, and it seeds the learning cards.",
  },
  {
    id: "firstspot",
    group: "games",
    title: "Who spotted it first?",
    blurb: "Running tally, all day, loser buys the treat.",
    forEmi: true,
    reason: "Keeps the drive competitive without a screen.",
  },
  {
    id: "trucks",
    group: "games",
    title: "Count the logging trucks",
    blurb: "Tally every loaded truck that passes.",
    forEmi: false,
    reason:
      "Off for Emi on purpose. It rewards watching for heavy traffic on an active forestry road, which is the opposite of what you want from a five-year-old on this route.",
  },
];

// ============================================================
// Fishing 101 — one setup, taught once
// ============================================================

export const RIG_STEPS: readonly { part: string; note: string }[] = [
  { part: "Rod and line", note: "Whatever you already own is fine." },
  { part: "Bobber", note: "Clipped on 2-4 feet above the hook to start." },
  { part: "Split shot", note: "One or two, about a foot above the hook." },
  { part: "Hook", note: "Size 8-10. Pinch the barb flat with pliers." },
  { part: "Worm", note: "Threaded on, with a little left wriggling free." },
];

export const FISHING_101: readonly { step: string; detail: string }[] = [
  {
    step: "Set the depth",
    detail:
      "Start with the bait 2-4 feet below the bobber. This is the single thing you will change most often.",
  },
  {
    step: "Cast somewhere with structure",
    detail:
      "Aim for weed edges, drop-offs, fallen wood — not the middle of open water, and not deep into thick weed where the hook fouls.",
  },
  {
    step: "Watch the bobber",
    detail:
      "A dip, a twitch, or a slow slide sideways all mean the same thing. Emi's only job is to watch it, which is a job she can do.",
  },
  {
    step: "Lift, do not yank",
    detail:
      "A smooth lift of the rod tip sets the hook. A hard yank pulls it straight out of the fish.",
  },
  {
    step: "Let her reel",
    detail:
      "Hand the rod over the moment it is safe to. Reeling in the fish is the memory, not hooking it.",
  },
  {
    step: "Nothing for 10-15 minutes? Change something.",
    detail:
      "Move the bobber deeper or shallower, walk 50 metres along the shore, or tie on the spinner. Changing one thing beats waiting.",
  },
];

// ============================================================
// Catch flow
// ============================================================

export const CATCH_FLOW: readonly {
  phase: string;
  tone: "neutral" | "release" | "keep";
  steps: readonly string[];
}[] = [
  {
    phase: "Land it",
    tone: "neutral",
    steps: [
      "Keep the line tight — a slack line loses the fish.",
      "Use the landing net if you brought one.",
      "Decide fast. The clock starts the moment it is out of the water.",
    ],
  },
  {
    phase: "Releasing it",
    tone: "release",
    steps: [
      "Wet your hands first — dry hands strip the protective slime.",
      "Handle as little as possible and keep it in or near the water.",
      "Never squeeze it, and never touch the gills.",
      "Back the hook out with pliers. A pinched barb makes this quick.",
      "Hold it upright in the water until it swims off on its own.",
    ],
  },
  {
    phase: "Keeping it",
    tone: "keep",
    steps: [
      "Confirm the species and check it against the quota before anything else.",
      "Dispatch it promptly and humanely rather than letting it suffocate.",
      "Get it on ice immediately.",
      "Leave the head, tail and fins on until you are home — that is a legal requirement, not a preference.",
    ],
  },
];

// ============================================================
// Emi's learning cards
// ============================================================

export const LEARNING_CARDS: readonly {
  id: string;
  question: string;
  answer: string;
  moduleId: string;
}[] = [
  {
    id: "why-cold",
    question: "Why do trout like cold water?",
    answer:
      "Cold water holds more oxygen, and trout need a lot of it. On a hot day they swim deeper to find it.",
    moduleId: "coldwater",
  },
  {
    id: "bobber-tells",
    question: "What does a bobber tell us?",
    answer:
      "It is a messenger. When it dips, twitches or slides sideways, something down there touched the worm.",
    moduleId: "bobber",
  },
  {
    id: "can-fish-see",
    question: "Can fish see us from the shore?",
    answer:
      "They can see shapes and movement above the water, which is why walking softly and standing back from the edge actually helps.",
    moduleId: "identify",
  },
  {
    id: "bark",
    question: "Find three different kinds of tree bark",
    answer: "Puzzle-piece bark, papery bark, deeply grooved bark.",
    moduleId: "ispy",
  },
  {
    id: "bird-high",
    question: "Spot a bird higher than the truck",
    answer:
      "Then a bird higher than the trees. Then the highest thing you can see.",
    moduleId: "wildlife",
  },
  {
    id: "best-photo",
    question: "Take the best nature photo of the day",
    answer: "Winner gets chosen at the treat stop. No takebacks.",
    moduleId: "photo",
  },
  {
    id: "weird-stick",
    question: "Find the weirdest stick",
    answer: "It has to come home in the truck. That is the rule.",
    moduleId: "stick",
  },
  {
    id: "skip-three",
    question: "Skip a rock three times",
    answer: "Flattest rock you can find, thrown low and sideways.",
    moduleId: "skip",
  },
];

// ============================================================
// Memory layer — UI-only, and says so
// ============================================================

export const MEMORY_FIELDS: readonly {
  id: string;
  label: string;
  kind: "check" | "text";
}[] = [
  { id: "cast", label: "Emi made a cast", kind: "check" },
  { id: "fish", label: "Fish caught", kind: "text" },
  { id: "wildlife", label: "Wildlife seen", kind: "text" },
  { id: "photo", label: "Best photo", kind: "text" },
  { id: "funny", label: "Funniest moment", kind: "text" },
  { id: "snack", label: "Favourite snack", kind: "text" },
  { id: "return", label: "Would we come back?", kind: "text" },
];

export const MEMORY_NOTE =
  "Nothing typed here is saved. Passport has no memory layer yet, and this prototype does not pretend otherwise — close the tab and it is gone. It is here to show what the field set would be, not to store anything.";
