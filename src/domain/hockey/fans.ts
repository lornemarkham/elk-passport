import { teamColours, type TeamColours } from "./teams";

/**
 * **Who you bleed for.**
 *
 * A person's favourite NHL team — their allegiance — which is a different
 * thing from the two teams playing tonight. A Calgary fan at a Canucks game
 * is still a Calgary fan, and that is the point: it gives everybody something
 * to argue about. Nothing here ever reads tonight's matchup.
 *
 * Stored as the three-letter code on the person's membership row
 * (`passport_occasion_members.nhl_team`, `docs/product/hockey/chirp-migration.sql`)
 * and copied to every night the person is in, so it is one allegiance per
 * person rather than per night. Dressed with the same two colours and code as
 * the matchup (`teams.ts`) — no logos, for the same licensing reason.
 */
export interface NhlTeam {
  /** The league's three-letter code. What is stored. */
  readonly abbr: string;
  readonly city: string;
  /** The nickname, as `teams.ts` and the schedule spell it. */
  readonly name: string;
  readonly emoji: string;
  readonly colours: TeamColours;
}

const RAW: readonly [
  abbr: string,
  city: string,
  name: string,
  emoji: string,
][] = [
  ["ANA", "Anaheim", "Ducks", "🦆"],
  ["BOS", "Boston", "Bruins", "🐻"],
  ["BUF", "Buffalo", "Sabres", "🗡️"],
  ["CGY", "Calgary", "Flames", "🔥"],
  ["CAR", "Carolina", "Hurricanes", "🌀"],
  ["CHI", "Chicago", "Blackhawks", "🪶"],
  ["COL", "Colorado", "Avalanche", "🏔️"],
  ["CBJ", "Columbus", "Blue Jackets", "💣"],
  ["DAL", "Dallas", "Stars", "⭐"],
  ["DET", "Detroit", "Red Wings", "🪽"],
  ["EDM", "Edmonton", "Oilers", "🛢️"],
  ["FLA", "Florida", "Panthers", "🐆"],
  ["LAK", "Los Angeles", "Kings", "👑"],
  ["MIN", "Minnesota", "Wild", "🌲"],
  ["MTL", "Montréal", "Canadiens", "🔴"],
  ["NSH", "Nashville", "Predators", "🐯"],
  ["NJD", "New Jersey", "Devils", "😈"],
  ["NYI", "New York", "Islanders", "🏝️"],
  ["NYR", "New York", "Rangers", "🗽"],
  ["OTT", "Ottawa", "Senators", "🎖️"],
  ["PHI", "Philadelphia", "Flyers", "🟠"],
  ["PIT", "Pittsburgh", "Penguins", "🐧"],
  ["SJS", "San Jose", "Sharks", "🦈"],
  ["SEA", "Seattle", "Kraken", "🦑"],
  ["STL", "St. Louis", "Blues", "🎵"],
  ["TBL", "Tampa Bay", "Lightning", "⚡"],
  ["TOR", "Toronto", "Maple Leafs", "🍁"],
  ["UTA", "Utah", "Mammoth", "🦣"],
  ["VAN", "Vancouver", "Canucks", "🐋"],
  ["VGK", "Vegas", "Golden Knights", "⚔️"],
  ["WSH", "Washington", "Capitals", "🏛️"],
  ["WPG", "Winnipeg", "Jets", "✈️"],
];

/** All 32, by city — the order a person scans for their own. */
export const NHL_TEAMS: readonly NhlTeam[] = RAW.map(
  ([abbr, city, name, emoji]) => ({
    abbr,
    city,
    name,
    emoji,
    colours: teamColours(name),
  }),
);

const BY_ABBR = new Map(NHL_TEAMS.map((t) => [t.abbr, t]));

export function teamByAbbr(abbr: string | null | undefined): NhlTeam | null {
  return abbr ? (BY_ABBR.get(abbr) ?? null) : null;
}

/** A team by its nickname ("Wild"), as the schedule and matchup spell it. */
export function teamByName(name: string): NhlTeam | null {
  const said = name.trim().toLowerCase();
  return NHL_TEAMS.find((t) => t.name.toLowerCase() === said) ?? null;
}

export function isTeamAbbr(value: unknown): value is string {
  return typeof value === "string" && BY_ABBR.has(value);
}

export const TEAM_ABBRS = NHL_TEAMS.map((t) => t.abbr) as [string, ...string[]];

/** "Calgary Flames 🔥" — how a person's allegiance reads beside their name. */
export function fanLabel(team: NhlTeam): string {
  return `${team.city} ${team.name} ${team.emoji}`;
}

/** The team a nickname or city in a sentence refers to, if any. */
export function teamsMentioned(text: string): NhlTeam[] {
  const said = ` ${text.toLowerCase().replace(/[^a-zé.' ]+/g, " ")} `;
  return NHL_TEAMS.filter((t) =>
    (ALIASES[t.abbr] ?? []).some((word) => said.includes(` ${word} `)),
  );
}

/**
 * How people actually say a team in a chat. Deliberately short: a nickname
 * that is also an ordinary word ("wild", "stars", "kings", "lightning") only
 * counts with its city or "the", so "that was wild" is not a rivalry.
 */
const ALIASES: Readonly<Record<string, readonly string[]>> = {
  ANA: ["anaheim", "ducks"],
  BOS: ["boston", "bruins", "b's"],
  BUF: ["buffalo", "sabres"],
  CGY: ["calgary", "flames"],
  CAR: ["carolina", "canes", "hurricanes"],
  CHI: ["chicago", "hawks", "blackhawks"],
  COL: ["colorado", "avs", "avalanche"],
  CBJ: ["columbus", "jackets", "cbj"],
  DAL: ["dallas", "the stars"],
  DET: ["detroit", "wings", "red wings"],
  EDM: ["edmonton", "oilers", "oil"],
  FLA: ["florida", "panthers", "cats"],
  LAK: ["la kings", "los angeles"],
  MIN: ["minnesota", "the wild"],
  MTL: ["montreal", "montréal", "habs", "canadiens"],
  NSH: ["nashville", "preds", "predators"],
  NJD: ["new jersey", "devils"],
  NYI: ["islanders", "isles"],
  NYR: ["rangers", "blueshirts"],
  OTT: ["ottawa", "sens", "senators"],
  PHI: ["philadelphia", "philly", "flyers"],
  PIT: ["pittsburgh", "pens", "penguins"],
  SJS: ["san jose", "sharks"],
  SEA: ["seattle", "kraken"],
  STL: ["st. louis", "st louis", "blues"],
  TBL: ["tampa", "bolts"],
  TOR: ["toronto", "leafs", "maple leafs"],
  UTA: ["utah", "mammoth"],
  VAN: ["vancouver", "canucks", "nucks"],
  VGK: ["vegas", "knights", "golden knights", "vgk"],
  WSH: ["washington", "caps", "capitals"],
  WPG: ["winnipeg", "jets"],
};

/**
 * **Real rivalries**, with the reason in a few words. Symmetric. Used to tell
 * a Calgary fan and a Vancouver fan apart from two people who merely like
 * different teams, and to give Chirp Bot something true to say about it.
 */
const RIVALRIES: readonly [string, string, string][] = [
  ["CGY", "EDM", "the Battle of Alberta"],
  ["CGY", "VAN", "1989 and 2004: two Game 7s in overtime, both won by Calgary"],
  ["EDM", "VAN", "the 2024 second round, all seven games of it"],
  ["VAN", "BOS", "2011, Game 7, and a riot"],
  ["VAN", "CHI", "three straight playoff meetings, 2009 to 2011"],
  ["VAN", "SEA", "Cascadia, and who actually owns the Pacific Northwest"],
  ["VAN", "MIN", "Quinn Hughes, traded to Minnesota in December 2025"],
  ["TOR", "MTL", "the oldest rivalry in hockey"],
  ["TOR", "OTT", "the Battle of Ontario"],
  ["TOR", "BOS", "Game 7s in Boston, plural"],
  ["MTL", "BOS", "more playoff meetings than any two teams in the league"],
  ["MTL", "OTT", "a three-hour drive and a lot of opinions"],
  ["NYR", "NYI", "the Battle of New York"],
  ["NYR", "NJD", "the Hudson River rivalry"],
  ["PIT", "PHI", "the Battle of Pennsylvania"],
  ["PIT", "WSH", "Crosby versus Ovechkin, for twenty years"],
  ["CHI", "DET", "Original Six, and they both remember"],
  ["CHI", "STL", "the Central's oldest feud"],
  ["COL", "DET", "the late-'90s brawls"],
  ["DAL", "COL", "Central Division playoff wars"],
  ["LAK", "ANA", "the Freeway Faceoff"],
  ["LAK", "SJS", "California, and four playoff series from 2011 to 2016"],
  ["FLA", "TBL", "the Battle of Florida"],
  ["EDM", "FLA", "two straight Stanley Cup Finals, 2024 and 2025"],
  ["CAR", "VGK", "the 2026 Stanley Cup Final"],
  ["BUF", "MTL", "Game 7, overtime, May 2026"],
  ["WPG", "MIN", "neighbours who share a time zone and nothing else"],
  ["SEA", "VGK", "the two newest teams in the West"],
  ["UTA", "COL", "Rocky Mountain neighbours"],
  ["CBJ", "TBL", "the 2019 sweep"],
  ["NSH", "PIT", "the 2017 Final"],
];

const RIVALRY = new Map<string, string>();
for (const [a, b, why] of RIVALRIES) {
  RIVALRY.set(`${a}-${b}`, why);
  RIVALRY.set(`${b}-${a}`, why);
}

/** Why these two teams' fans should not agree on anything, or null. */
export function rivalry(a: string, b: string): string | null {
  return a === b ? null : (RIVALRY.get(`${a}-${b}`) ?? null);
}

/** A stable key for a pair of teams, order-free: "CGY-VAN". */
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join("-");
}
