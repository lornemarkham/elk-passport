import type { Discipline } from "./ability";
import { MOUNTAINS, type Mountain } from "./mountains";
import { dateChoices, resortFacts, type DateChoice } from "./resorts";

/**
 * **"We're going to SilverStar opening weekend. Four people. Two skiers, one
 * snowboarder and someone who doesn't ski."**
 *
 * Read by rules, not a model: the mountain (Passport's list only), the date
 * (opening weekend only when the resort published it, this/next weekend,
 * an ISO date or "December 12"), and who's coming. Everything it reads is
 * echoed back before anything is made, and anything it can't place stays
 * unsaid rather than guessed.
 */
export interface Ask {
  readonly mountain?: Mountain;
  readonly date?: DateChoice | { key: "date"; label: string; date: string };
  /** Opening weekend was asked for and the resort hasn't published it. */
  readonly openingUnknown?: boolean;
  readonly crew: {
    readonly ski: number;
    readonly snowboard: number;
    readonly apres: number;
  };
  /** "Four people" — may be more than the riders named. */
  readonly total?: number;
}

const NUM: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  someone: 1,
  somebody: 1,
  two: 2,
  couple: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};
const n = (w: string) => (/^\d+$/.test(w) ? Number(w) : (NUM[w] ?? 0));
const COUNT = String.raw`(\d{1,2}|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|couple of)`;

const squash = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
/** The words people actually say for each mountain. */
function namesOf(m: Mountain): string[] {
  const core = m.name
    .replace(
      /\b(Mountain Resort|Ski Resort|Alpine Resort|Mountain|Resort)\b/g,
      "",
    )
    .trim();
  const out = [m.name, core];
  if (m.id === "whistler-blackcomb") out.push("Whistler", "Blackcomb");
  if (m.id === "sunshine") out.push("Sunshine Village", "Sunshine");
  if (m.id === "red-mountain") out.length = 1; // "red" alone is a colour
  if (m.id === "apex") out.length = 1;
  return out.map(squash).filter((s) => s.length >= 4);
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

export function readAsk(text: string, today: string): Ask {
  const t = ` ${text.toLowerCase().replace(/[’']/g, "'")} `;
  const flat = squash(text);
  const mountain = MOUNTAINS.find((m) =>
    namesOf(m).some((w) => flat.includes(w)),
  );

  let date: Ask["date"];
  let openingUnknown = false;
  const choices = dateChoices(today, resortFacts(mountain?.id));
  if (/opening (weekend|day)/.test(t)) {
    date = choices.find((c) => c.key === "opening");
    openingUnknown = !date;
  } else if (/next weekend/.test(t))
    date = choices.find((c) => c.key === "next-weekend");
  else if (/this weekend/.test(t))
    date = choices.find((c) => c.key === "this-weekend");
  else {
    const iso = t.match(/\b(20\d\d-\d\d-\d\d)\b/);
    const md = t.match(
      new RegExp(String.raw`\b(${MONTHS.join("|")}) (\d{1,2})\b`),
    );
    if (iso) date = { key: "date", label: iso[1], date: iso[1] };
    else if (md) {
      const mm = String(MONTHS.indexOf(md[1]) + 1).padStart(2, "0");
      const dd = md[2].padStart(2, "0");
      let y = Number(today.slice(0, 4));
      if (`${y}-${mm}-${dd}` < today) y += 1;
      date = {
        key: "date",
        label: `${md[1][0].toUpperCase()}${md[1].slice(1)} ${Number(dd)}`,
        date: `${y}-${mm}-${dd}`,
      };
    }
  }

  const count = (re: string) => {
    let sum = 0;
    for (const m of t.matchAll(new RegExp(String.raw`\b${COUNT} ${re}`, "g")))
      sum += m[1] === "couple of" ? 2 : n(m[1]);
    return sum;
  };
  const ski = count(String.raw`(?:skiers?|people (?:are )?skiing)\b`);
  const snowboard = count(
    String.raw`(?:snowboarders?|boarders?|riding a board)\b`,
  );
  let apres =
    count(
      String.raw`(?:non-?skiers?|people (?:who|that) (?:don't|doesn't|won't) ski)\b`,
    ) +
    count(
      String.raw`(?:person|friend|one|who|guy|girl|kid)? ?(?:who|that) (?:doesn't|does not|won't|can't|isn't going to) ski`,
    );
  if (
    apres === 0 &&
    /(someone|somebody|one person|a friend) (who|that) (doesn't|does not|won't|can't) ski/.test(
      t,
    )
  )
    apres = 1;
  const total = t.match(
    new RegExp(String.raw`\b${COUNT} (?:people|of us|friends|in the crew)\b`),
  );
  return {
    mountain,
    date,
    openingUnknown,
    crew: { ski, snowboard, apres },
    total: total ? (total[1] === "couple of" ? 2 : n(total[1])) : undefined,
  };
}

/** Everyone the ask names, as disciplines — the host's own place taken out. */
export function crewFromAsk(ask: Ask, host: Discipline): Discipline[] {
  const want: Record<Discipline, number> = { ...ask.crew };
  if (want[host] > 0) want[host] -= 1;
  const out: Discipline[] = [
    ...Array<Discipline>(want.ski).fill("ski"),
    ...Array<Discipline>(want.snowboard).fill("snowboard"),
    ...Array<Discipline>(want.apres).fill("apres"),
  ];
  // "Four people" with only three described: the fourth is coming, how they
  // ride is unsaid. They're added as a skier the crew can correct.
  const described = 1 + out.length;
  if (ask.total && ask.total > described)
    out.push(
      ...Array<Discipline>(Math.min(ask.total - described, 23)).fill("ski"),
    );
  return out.slice(0, 23);
}

export const PLACEHOLDER_NAME: Record<Discipline, string> = {
  ski: "Skier",
  snowboard: "Snowboarder",
  apres: "Not skiing",
};

/** One line echoing what was understood — shown before anything is made. */
export function askLine(ask: Ask): string[] {
  const out: string[] = [];
  if (ask.mountain) out.push(ask.mountain.name);
  if (ask.date) out.push(ask.date.label);
  const { ski, snowboard, apres } = ask.crew;
  const parts = [
    ski && `${ski} skiing`,
    snowboard && `${snowboard} snowboarding`,
    apres && `${apres} not skiing`,
  ].filter(Boolean);
  const total = Math.max(ask.total ?? 0, ski + snowboard + apres);
  if (total)
    out.push(`${total} people${parts.length ? ` (${parts.join(", ")})` : ""}`);
  return out;
}
