import { OPPONENTS } from "./schedule";

/**
 * **Team-inspired, not team-branded.**
 *
 * The night page dresses each side in its club's colours and a three-letter
 * code, the way a scoreboard does. No logo, crest, wordmark or photograph of
 * anybody's jersey: those are licensed marks, and Passport holds no licence.
 * Two colours and an abbreviation are how every broadcast graphic, pub
 * chalkboard and fantasy app already refers to a team.
 *
 * `ink` is the colour that reads on top of `primary` — chosen per team, not
 * computed, because "white on Bruins gold" is wrong and a contrast formula
 * would happily pick it.
 */
export interface TeamColours {
  readonly abbr: string;
  readonly primary: string;
  readonly secondary: string;
  readonly ink: string;
}

const TEAMS: Readonly<Record<string, TeamColours>> = {
  Canucks: {
    abbr: "VAN",
    primary: "#00205B",
    secondary: "#00843D",
    ink: "#FFFFFF",
  },
  Avalanche: {
    abbr: "COL",
    primary: "#6F263D",
    secondary: "#236192",
    ink: "#FFFFFF",
  },
  Blackhawks: {
    abbr: "CHI",
    primary: "#CF0A2C",
    secondary: "#111111",
    ink: "#FFFFFF",
  },
  "Blue Jackets": {
    abbr: "CBJ",
    primary: "#002654",
    secondary: "#CE1126",
    ink: "#FFFFFF",
  },
  Blues: {
    abbr: "STL",
    primary: "#002F87",
    secondary: "#FCB514",
    ink: "#FFFFFF",
  },
  Bruins: {
    abbr: "BOS",
    primary: "#FFB81C",
    secondary: "#111111",
    ink: "#111111",
  },
  Canadiens: {
    abbr: "MTL",
    primary: "#AF1E2D",
    secondary: "#192168",
    ink: "#FFFFFF",
  },
  Capitals: {
    abbr: "WSH",
    primary: "#C8102E",
    secondary: "#041E42",
    ink: "#FFFFFF",
  },
  Devils: {
    abbr: "NJD",
    primary: "#CE1126",
    secondary: "#111111",
    ink: "#FFFFFF",
  },
  Ducks: {
    abbr: "ANA",
    primary: "#F47A38",
    secondary: "#111111",
    ink: "#111111",
  },
  Flames: {
    abbr: "CGY",
    primary: "#C8102E",
    secondary: "#F1BE48",
    ink: "#FFFFFF",
  },
  Flyers: {
    abbr: "PHI",
    primary: "#F74902",
    secondary: "#111111",
    ink: "#111111",
  },
  "Golden Knights": {
    abbr: "VGK",
    primary: "#B4975A",
    secondary: "#333F42",
    ink: "#111111",
  },
  Hurricanes: {
    abbr: "CAR",
    primary: "#CE1126",
    secondary: "#111111",
    ink: "#FFFFFF",
  },
  Islanders: {
    abbr: "NYI",
    primary: "#00539B",
    secondary: "#F47D30",
    ink: "#FFFFFF",
  },
  Jets: {
    abbr: "WPG",
    primary: "#041E42",
    secondary: "#004C97",
    ink: "#FFFFFF",
  },
  Kings: {
    abbr: "LAK",
    primary: "#111111",
    secondary: "#A2AAAD",
    ink: "#FFFFFF",
  },
  Kraken: {
    abbr: "SEA",
    primary: "#001628",
    secondary: "#99D9D9",
    ink: "#FFFFFF",
  },
  Lightning: {
    abbr: "TBL",
    primary: "#002868",
    secondary: "#FFFFFF",
    ink: "#FFFFFF",
  },
  Mammoth: {
    abbr: "UTA",
    primary: "#111111",
    secondary: "#69B3E7",
    ink: "#FFFFFF",
  },
  "Maple Leafs": {
    abbr: "TOR",
    primary: "#00205B",
    secondary: "#FFFFFF",
    ink: "#FFFFFF",
  },
  Oilers: {
    abbr: "EDM",
    primary: "#041E42",
    secondary: "#FF4C00",
    ink: "#FFFFFF",
  },
  Panthers: {
    abbr: "FLA",
    primary: "#C8102E",
    secondary: "#B9975B",
    ink: "#FFFFFF",
  },
  Penguins: {
    abbr: "PIT",
    primary: "#111111",
    secondary: "#FCB514",
    ink: "#FFFFFF",
  },
  Predators: {
    abbr: "NSH",
    primary: "#FFB81C",
    secondary: "#041E42",
    ink: "#111111",
  },
  Rangers: {
    abbr: "NYR",
    primary: "#0038A8",
    secondary: "#CE1126",
    ink: "#FFFFFF",
  },
  "Red Wings": {
    abbr: "DET",
    primary: "#CE1126",
    secondary: "#FFFFFF",
    ink: "#FFFFFF",
  },
  Sabres: {
    abbr: "BUF",
    primary: "#003087",
    secondary: "#FFB81C",
    ink: "#FFFFFF",
  },
  Senators: {
    abbr: "OTT",
    primary: "#C52032",
    secondary: "#C2912C",
    ink: "#FFFFFF",
  },
  Sharks: {
    abbr: "SJS",
    primary: "#006D75",
    secondary: "#EA7200",
    ink: "#FFFFFF",
  },
  Stars: {
    abbr: "DAL",
    primary: "#006847",
    secondary: "#8F8F8C",
    ink: "#FFFFFF",
  },
  Wild: {
    abbr: "MIN",
    primary: "#154734",
    secondary: "#A6192E",
    ink: "#FFFFFF",
  },
};

/**
 * Every opponent the night can be started against has colours. A function,
 * not a constant: `schedule.ts` → `night.ts` → … → this file is a cycle, and
 * `OPPONENTS` is not there yet while the cycle is still loading.
 */
export function dressed(): readonly string[] {
  return OPPONENTS.map((o) => o.name).filter((name) => name in TEAMS);
}

/**
 * A team's colours, or a plain slate kit for a name Passport does not know —
 * an old night, or a typo — with the first three letters as its code.
 */
export function teamColours(name: string): TeamColours {
  return (
    TEAMS[name.trim()] ?? {
      abbr: name.trim().replace(/\s+/g, "").slice(0, 3).toUpperCase() || "???",
      primary: "#2A3342",
      secondary: "#8A94A6",
      ink: "#FFFFFF",
    }
  );
}

/**
 * The two sides from the night's subtitle, which `composeNight` writes as
 * `"{home} vs {opponent}"`. Anything else is one side against nobody named.
 */
export function matchupOf(subtitle: string): {
  readonly home: string;
  readonly away: string;
} {
  const [home, ...rest] = subtitle.split(/\s+vs\.?\s+/i);
  return {
    home: home?.trim() || "Home",
    away: rest.join(" vs ").trim() || "Away",
  };
}
