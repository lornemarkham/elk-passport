/**
 * **Pulse Check: a public claim, the evidence for it, and what people think.**
 *
 * Someone sees a claim ("Kelowna General Hospital is operating at 147%
 * capacity"), brings it here, reads what the linked sources actually say,
 * publishes it, and shares the page back into the conversation it came from.
 *
 * Three kinds of thing are kept apart all the way down:
 *
 *   - **Evidence**: sources a server opened itself, with the sentences copied
 *     word for word from the page and the date it was read. Nothing else is
 *     shown as evidence; nothing is ever summarised into a fact.
 *   - **Public opinion**: the Pulse's votes. A vote never decides what is true.
 *   - **Personal experience**: what visitors say happened to them, unchecked.
 *
 * The assessment (SUPPORTED … OUTDATED) is the reading of the person who
 * asked, constrained by rules over the sources they attached, and labelled as
 * such. It is never presented as independent verification, and there is no
 * automatic web search: the limits say so on every page.
 *
 * Everything here is pure, so the API, the pages and the tests agree.
 */

import { PROVINCES, clean, textProblem, type PulseScope } from "./model";

// ── Vocabulary ──────────────────────────────────────────────────────────────

export const CHECK_BRAND = {
  name: "Pulse Check",
  line: "Seen a claim? Check what the evidence says.",
} as const;

export const ASSESSMENTS = [
  "supported",
  "partly",
  "contradicted",
  "insufficient",
  "outdated",
] as const;
export type Assessment = (typeof ASSESSMENTS)[number];
export const isAssessment = (v: unknown): v is Assessment =>
  typeof v === "string" && (ASSESSMENTS as readonly string[]).includes(v);

export const ASSESSMENT_INFO: Record<
  Assessment,
  { readonly label: string; readonly line: string; readonly color: string }
> = {
  supported: {
    label: "Supported",
    line: "The sources listed back the claim up.",
    color: "#127a52",
  },
  partly: {
    label: "Partially supported",
    line: "Some of it holds up; some of it is missing context or doesn't.",
    color: "#a15c00",
  },
  contradicted: {
    label: "Contradicted",
    line: "The sources listed say something different.",
    color: "#b42318",
  },
  insufficient: {
    label: "Insufficient evidence",
    line: "There isn't enough in the sources listed to say either way.",
    color: "#4b5563",
  },
  outdated: {
    label: "Outdated",
    line: "It may once have been true; newer information says otherwise or is missing.",
    color: "#6d28d9",
  },
};

/** What the community poll asks. */
export const ASK_TYPES = ["fact", "opinion", "experience"] as const;
export type AskType = (typeof ASK_TYPES)[number];
export const isAskType = (v: unknown): v is AskType =>
  typeof v === "string" && (ASK_TYPES as readonly string[]).includes(v);

export const ASK_INFO: Record<
  AskType,
  {
    readonly name: string;
    readonly line: string;
    readonly question: string;
    readonly options: readonly string[];
  }
> = {
  fact: {
    name: "Fact check",
    line: "What does the evidence support?",
    question: "Having read the sources, what do you think they show?",
    options: [
      "The claim holds up",
      "Partly true",
      "The claim is wrong",
      "Unsure",
    ],
  },
  opinion: {
    name: "Opinion",
    line: "What do people think?",
    question: "Do you believe this claim?",
    options: ["Yes", "No", "Unsure"],
  },
  experience: {
    name: "Experience",
    line: "What have people personally experienced?",
    question: "Does this match what you've seen yourself?",
    options: [
      "Yes, it matches what I've seen",
      "No, I've seen something different",
      "I haven't experienced it",
      "Unsure",
    ],
  },
};

/** Where the claim was seen. */
export const SEEN_ON = {
  facebook: "Facebook",
  instagram: "Instagram",
  x: "X (Twitter)",
  tiktok: "TikTok",
  reddit: "Reddit",
  news: "A news site",
  messaging: "A group chat or message",
  video: "A video",
  other: "Somewhere else",
} as const;
export type SeenOn = keyof typeof SEEN_ON;
export const isSeenOn = (v: unknown): v is SeenOn =>
  typeof v === "string" && v in SEEN_ON;

/** How the claim came in. */
export const FORMS = [
  "url",
  "screenshot",
  "photo",
  "text",
  "headline",
] as const;
export type ClaimForm = (typeof FORMS)[number];
export const isForm = (v: unknown): v is ClaimForm =>
  typeof v === "string" && (FORMS as readonly string[]).includes(v);

export const STANCES = ["supports", "contradicts", "context"] as const;
export type Stance = (typeof STANCES)[number];
export const isStance = (v: unknown): v is Stance =>
  typeof v === "string" && (STANCES as readonly string[]).includes(v);

export const STANCE_LABEL: Record<Stance, string> = {
  supports: "Supports the claim",
  contradicts: "Contradicts the claim",
  context: "Context only",
};

export const CHECK_LIMITS = {
  claim: { min: 12, max: 400 },
  why: 600,
  summary: 800,
  correction: 500,
  note: 240,
  sources: 8,
  post: 1000,
  postMin: 3,
  question: 200,
} as const;

/** Screenshots and photos: re-encoded on the phone, checked again here. */
export const FILE_LIMITS = {
  bytes: 1_500_000,
  types: ["image/jpeg", "image/png", "image/webp"] as const,
} as const;

/** The four things the asker must confirm before anything is public. */
export const CONFIRMATIONS = {
  accurate:
    "I've written the claim as it was said, without changing its meaning.",
  publicSubject:
    "It's about a public organisation, a public figure or a public statement — not a private person.",
  noPersonal:
    "I've left out anyone's personal details, health information and private messages.",
  notVerified:
    "I understand this check is my reading of the sources, not independent verification.",
} as const;
export type ConfirmKey = keyof typeof CONFIRMATIONS;

// ── Reading a claim ─────────────────────────────────────────────────────────

export interface ClaimParts {
  /** The figures it states, as written ("147%", "$2.4 million"). */
  readonly figures: readonly string[];
  /** Dates or times it names ("2024", "last week"). */
  readonly dates: readonly string[];
  /** Provinces and towns it names. */
  readonly places: readonly string[];
  /** Organisations or public bodies it names. */
  readonly organisations: readonly string[];
  /** Words whose meaning decides whether it is true ("capacity"). */
  readonly terms: readonly string[];
  /** It seems to name a person, not an organisation. */
  readonly namesPerson: boolean;
}

const FIGURE =
  /(?<![A-Za-z\d])(?:[$€£]\s?)?\d[\d,]*(?:\.\d+)?\s?(?:%|per\s?cent|percent|x\b|times\b|million\b|billion\b|thousand\b|k\b|hours?\b|days?\b|weeks?\b|months?\b|years?\b|beds?\b|patients?\b|people\b|cases?\b|deaths?\b)?/gi;

const MONTHS =
  "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";
const DATE = new RegExp(
  `\\b(?:(?:${MONTHS})\\.?\\s+\\d{1,2}(?:,\\s*\\d{4})?|(?:${MONTHS})\\s+\\d{4}|\\d{4}-\\d{2}-\\d{2}|(?:19|20)\\d{2}|today|yesterday|tonight|this (?:week|month|year|morning)|last (?:week|month|year|night)|right now|currently)\\b`,
  "gi",
);

/** Towns a Canadian claim is likely to name; provinces come from the model. */
const TOWNS = [
  "Kelowna",
  "Vernon",
  "Penticton",
  "Kamloops",
  "West Kelowna",
  "Lake Country",
  "Salmon Arm",
  "Peachland",
  "Summerland",
  "Osoyoos",
  "Oliver",
  "Nelson",
  "Cranbrook",
  "Prince George",
  "Nanaimo",
  "Victoria",
  "Vancouver",
  "Surrey",
  "Burnaby",
  "Richmond",
  "Abbotsford",
  "Chilliwack",
  "Langley",
  "Coquitlam",
  "Whistler",
  "Calgary",
  "Edmonton",
  "Red Deer",
  "Lethbridge",
  "Saskatoon",
  "Regina",
  "Winnipeg",
  "Toronto",
  "Ottawa",
  "Mississauga",
  "Hamilton",
  "London",
  "Kingston",
  "Windsor",
  "Sudbury",
  "Montreal",
  "Montréal",
  "Quebec City",
  "Halifax",
  "Moncton",
  "Fredericton",
  "Saint John",
  "Charlottetown",
  "St. John's",
  "Whitehorse",
  "Yellowknife",
  "Iqaluit",
  "Okanagan",
  "Canada",
];

const ORG_WORDS =
  "Hospital|Health|Authority|Ministry|Ministry of|Government|Council|City|Town|District|Regional District|Police|RCMP|University|College|School|Board|Agency|Department|Services?|Society|Foundation|Clinic|Centre|Center|Commission|Bank|Party|Association|Union|Corporation|Company|Inc\\.?|Ltd\\.?|Canada|BC|Office|Institute|Court|Parliament|Legislature|Airport|Transit";
const ORG = new RegExp(
  `\\b(?:[A-Z][\\w'’.-]*\\s+){0,5}(?:${ORG_WORDS})(?:\\s+(?:of|for|and)\\s+[A-Z][\\w'’.-]*(?:\\s+[A-Z][\\w'’.-]*){0,3})?\\b`,
  "g",
);
const ACRONYM = /\b[A-Z]{2,6}\b/g;
const NOT_ACRONYMS = new Set(["I", "OK", "AM", "PM", "TV", "US", "UK", "EU"]);

/**
 * Words that decide whether a claim is true, each with the question a careful
 * reader asks. These are questions, not facts: nothing here says what the
 * answer is.
 */
export const TERMS: Readonly<Record<string, string>> = {
  capacity:
    "Capacity of what — funded beds, staffed beds or all space — and who measured it?",
  occupancy:
    "Occupancy of which beds, on which day, and is it a daily figure or an average?",
  "wait time":
    "Which wait — to be seen, to be admitted, or for a procedure — and measured how?",
  average:
    "Average over what period, and is the middle value (median) very different?",
  median: "Median over what period and which group?",
  rate: "A rate per how many people, and over what period?",
  "per capita": "Per person counted how, and in which year's population?",
  record: "A record since when, and measured the same way all that time?",
  highest: "Highest compared with what, and over what period?",
  lowest: "Lowest compared with what, and over what period?",
  doubled: "Doubled from what starting figure, and over what period?",
  tripled: "Tripled from what starting figure, and over what period?",
  increase: "An increase from when to when?",
  decrease: "A decrease from when to when?",
  crisis: "What measure makes it a crisis, and who said so?",
  unemployment: "Which unemployment measure, for which area and month?",
  inflation: "Which price index, for which months, and which region?",
  crime: "Reported crime or all crime, for which area and year?",
  survey: "Who ran the survey, how many answered, and how were they chosen?",
  poll: "Who ran the poll, how many answered, and how were they chosen?",
  study: "Who ran the study, is it published, and was it reviewed?",
  closed: "Closed when, for how long, and according to whom?",
  cancelled: "Cancelled according to whom, and is it confirmed?",
  banned: "Banned by whom, under which rule, and since when?",
  free: "Free for whom, and are there conditions?",
};

const SENSITIVE_HEALTH =
  /\b(?:hiv|aids|cancer diagnosis|diagnosed with|psychiatric|schizophreni\w*|bipolar|overdosed?|miscarr\w*|abortion|std|sti|chlamydia|herpes|terminal(?:ly)? ill|suicid\w*|rehab|dementia)\b/i;

const unique = (xs: readonly string[]) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    const t = x.trim().replace(/[.,;:]+$/, "");
    const k = t.toLowerCase();
    if (t && !seen.has(k)) {
      seen.add(k);
      out.push(t);
    }
  }
  return out;
};

const WEEKDAYS =
  /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December|The|This|That|A|An|It|Is|In|On|At|My|Our|Their|They|We|I|You|He|She|Breaking|Update|News)$/;

/** Read what a claim states. Deterministic: rules, not AI. */
export function analyseClaim(text: string): ClaimParts {
  const figures = unique(
    [...text.matchAll(FIGURE)]
      .map((m) => m[0])
      // A bare year or a single digit is not a figure here.
      .filter(
        (f) =>
          !/^(?:19|20)\d{2}$/.test(f.trim()) && /\d\d|\d\s?\D/.test(f.trim()),
      ),
  ).slice(0, 6);
  const dates = unique([...text.matchAll(DATE)].map((m) => m[0])).slice(0, 4);
  const lower = text.toLowerCase();
  const places = unique([
    ...PROVINCES.filter((p) => lower.includes(p.name.toLowerCase())).map(
      (p) => p.name,
    ),
    ...TOWNS.filter((t) =>
      new RegExp(`\\b${t.replace(/[.]/g, "\\.")}\\b`, "i").test(text),
    ),
  ]).slice(0, 4);
  const orgs = unique([
    ...[...text.matchAll(ORG)]
      .map((m) => m[0])
      .filter((o) => o.split(/\s+/).length >= 2 && /^[A-Z]/.test(o)),
    ...[...text.matchAll(ACRONYM)]
      .map((m) => m[0])
      .filter(
        (a) => !NOT_ACRONYMS.has(a) && !PROVINCES.some((p) => p.code === a),
      ),
  ])
    .filter((o) => !places.some((p) => p.toLowerCase() === o.toLowerCase()))
    .slice(0, 4);
  const terms = Object.keys(TERMS)
    .filter((t) => new RegExp(`\\b${t}\\b`, "i").test(text))
    .slice(0, 5);
  // Two capitalised words together that are not a place, an organisation or a
  // calendar word read like a person's name. A guess, used only to ask.
  const namesPerson = [
    ...text.matchAll(/\b([A-Z][a-z]+)\s+([A-Z][a-z]+(?:-[A-Z][a-z]+)?)\b/g),
  ].some(
    ([whole, a, b]) =>
      !WEEKDAYS.test(a!) &&
      !WEEKDAYS.test(b!) &&
      !orgs.some((o) => o.includes(whole)) &&
      !places.some((p) => whole.includes(p) || p.includes(whole)) &&
      !new RegExp(`\\b(?:${ORG_WORDS})\\b`).test(whole),
  );
  return { figures, dates, places, organisations: orgs, terms, namesPerson };
}

/**
 * The questions a careful reader would ask about this claim before believing
 * it. Rules over the claim's own words; each one is a question, never an
 * answer.
 */
export function missingContext(
  text: string,
  parts: ClaimParts,
  form: ClaimForm,
  hasUrl: boolean,
): string[] {
  const out: string[] = [];
  if (parts.figures.length && !parts.dates.length)
    out.push(
      "When was this measured? A figure without a date can be out of date.",
    );
  if (
    !/\b(?:according to|reports?|reported|data|figures|says|said|states?|study|survey|statistics|announced|confirmed)\b/i.test(
      text,
    )
  )
    out.push("Who measured or reported this? The claim doesn't say.");
  if (parts.figures.some((f) => /%|per\s?cent|percent/i.test(f)))
    out.push(
      "A percentage of what? The same figure can mean very different things.",
    );
  if (!parts.places.length && !parts.organisations.length)
    out.push("Where, or who, does this apply to?");
  for (const t of parts.terms) out.push(TERMS[t]!);
  if (form === "screenshot" || form === "photo")
    out.push(
      hasUrl
        ? "Does the original post still say exactly this? Screenshots can be cropped or edited."
        : "Where is the original post? A screenshot alone can be cropped or edited.",
    );
  return unique(out).slice(0, 7);
}

// ── Where to look ───────────────────────────────────────────────────────────

export interface Lead {
  readonly name: string;
  readonly why: string;
  readonly url: string;
}

const search = (site: string, q: string) =>
  `https://www.google.com/search?q=${encodeURIComponent(`site:${site} ${q}`)}`;

/** Interior Health's towns, for pointing a BC health claim at its authority. */
const INTERIOR = [
  "Kelowna",
  "West Kelowna",
  "Vernon",
  "Penticton",
  "Kamloops",
  "Salmon Arm",
  "Lake Country",
  "Peachland",
  "Summerland",
  "Osoyoos",
  "Oliver",
  "Nelson",
  "Cranbrook",
  "Okanagan",
];

/**
 * **Places a person could look**, by topic. These are links to search the
 * publisher's own site; they are never evidence and never claim to contain an
 * answer. People's Pulse has no automatic web search.
 */
export function whereToCheck(
  text: string,
  parts: ClaimParts,
  scope: PulseScope,
): Lead[] {
  const q =
    [
      ...parts.organisations.slice(0, 1),
      ...parts.terms.slice(0, 2),
      ...parts.places.slice(0, 1),
    ]
      .join(" ")
      .trim() || clean(text, 80);
  const bc =
    (scope.kind !== "canada" && scope.province === "BC") ||
    /british columbia|\bB\.?C\.?\b/i.test(text) ||
    parts.places.some((p) => INTERIOR.includes(p) || p === "Vancouver");
  const out: Lead[] = [];
  if (
    /hospital|emergency|\ber\b|icu|patients?|beds?|health|nurses?|doctors?|clinic|surgery|wait/i.test(
      text,
    )
  ) {
    if (parts.places.some((p) => INTERIOR.includes(p)))
      out.push({
        name: "Interior Health",
        why: "The health authority that runs hospitals in the Interior publishes news and service notices.",
        url: search("interiorhealth.ca", q),
      });
    if (bc)
      out.push({
        name: "BC Government News",
        why: "The Ministry of Health's announcements and statements.",
        url: search("news.gov.bc.ca", q),
      });
    out.push({
      name: "Canadian Institute for Health Information",
      why: "National hospital and wait-time statistics, with methods.",
      url: search("cihi.ca", q),
    });
  }
  if (/crime|police|rcmp|assault|theft|murder|homicide|stolen/i.test(text))
    out.push({
      name: "Statistics Canada — crime",
      why: "Police-reported crime by area and year.",
      url: search("statcan.gc.ca", `crime ${q}`),
    });
  if (/rent|housing|home prices?|mortgage|vacancy/i.test(text))
    out.push({
      name: "CMHC",
      why: "Canada Mortgage and Housing Corporation's rental and housing data.",
      url: search("cmhc-schl.gc.ca", q),
    });
  if (/price|inflation|cost|grocer|gas|interest rate/i.test(text))
    out.push({
      name: "Statistics Canada — prices",
      why: "The Consumer Price Index and price data, by month and province.",
      url: search("statcan.gc.ca", `price ${q}`),
    });
  if (
    /elect|vote|ballot|mp\b|mla\b|premier|minister|parliament|legislat|bill\b/i.test(
      text,
    )
  )
    out.push({
      name: bc ? "Elections BC and the BC Legislature" : "Elections Canada",
      why: "Official results, rules and the record of what was said.",
      url: bc ? search("leg.bc.ca", q) : search("elections.ca", q),
    });
  if (
    /fire|wildfire|evacuat|flood|smoke|road|highway|closure/i.test(text) &&
    bc
  )
    out.push({
      name: "BC Wildfire Service, EmergencyInfoBC and DriveBC",
      why: "Official status of fires, evacuations and road closures.",
      url: search("gov.bc.ca", q),
    });
  if (/weather|snow|rain|temperature|heat|cold|storm/i.test(text))
    out.push({
      name: "Environment Canada",
      why: "Official observations, warnings and climate records.",
      url: search("weather.gc.ca", q),
    });
  if (/school|teacher|student|education/i.test(text))
    out.push({
      name: bc
        ? "BC Ministry of Education"
        : "The provincial education ministry",
      why: "Announcements and school data.",
      url: bc
        ? search("gov.bc.ca", `education ${q}`)
        : search("canada.ca", `education ${q}`),
    });
  out.push({
    name: "Statistics Canada",
    why: "Canada's national statistics office: most official figures start here.",
    url: search("statcan.gc.ca", q),
  });
  out.push({
    name: "News coverage",
    why: "Reporting from news outlets — check who they quote and when.",
    url: `https://news.google.com/search?q=${encodeURIComponent(q)}&hl=en-CA&gl=CA`,
  });
  const seen = new Set<string>();
  return out.filter((l) => !seen.has(l.name) && seen.add(l.name)).slice(0, 5);
}

// ── Social platforms we can't read ──────────────────────────────────────────

const WALLED: readonly [RegExp, string][] = [
  [/(^|\.)(facebook\.com|fb\.com|fb\.watch|messenger\.com)$/, "Facebook"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)(x\.com|twitter\.com|t\.co)$/, "X"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)threads\.net$/, "Threads"],
  [/(^|\.)linkedin\.com$/, "LinkedIn"],
];

/** The platform's name when its posts need a sign-in to read, else null. */
export function walledPlatform(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return WALLED.find(([r]) => r.test(host))?.[1] ?? null;
  } catch {
    return null;
  }
}

export function seenOnFromUrl(url: string): SeenOn | null {
  const p = walledPlatform(url);
  if (p === "Facebook") return "facebook";
  if (p === "Instagram") return "instagram";
  if (p === "X") return "x";
  if (p === "TikTok") return "tiktok";
  try {
    const host = new URL(url).hostname;
    if (/reddit\.com$/.test(host)) return "reddit";
    if (/youtube\.com$|youtu\.be$/.test(host)) return "video";
  } catch {
    return null;
  }
  return null;
}

// ── Evidence ────────────────────────────────────────────────────────────────

/** A page the server opened, and what it says in its own words. */
export interface CheckSource {
  readonly url: string;
  readonly title: string | null;
  readonly site: string;
  /** A date the page declares for itself, YYYY-MM-DD. */
  readonly published: string | null;
  /** When the server read it. */
  readonly readAt: string;
  /** Sentences copied word for word from the page. */
  readonly excerpts: readonly string[];
  /** Whether a figure from the claim appears in the page's text. */
  readonly figureFound: boolean;
}

/** A source as the asker placed it. */
export interface PlacedSource extends CheckSource {
  readonly stance: Stance;
  /** The asker's own words about it, shown as theirs. */
  readonly note: string | null;
  /** Who added it: the asker at first, or later as a correction. */
  readonly addedAt: string;
}

/** Number forms that should match across writing styles: "147%", "147 per cent". */
function figurePatterns(figures: readonly string[]): RegExp[] {
  return figures
    .map((f) => /\d[\d,]*(?:\.\d+)?/.exec(f)?.[0]?.replace(/,/g, ""))
    .filter((n): n is string => !!n && n.length >= 2)
    .map((n) => {
      const withCommas = n.replace(/\B(?=(\d{3})+(?!\d))/g, ",?");
      return new RegExp(
        `(?<![\\d.])${withCommas.replace(".", "\\.")}(?![\\d])`,
      );
    });
}

/**
 * The sentences of a page that bear on the claim: any that state one of its
 * figures, then any that use two or more of its key words. Copied verbatim.
 */
export function evidenceExcerpts(
  sentences: readonly string[],
  parts: ClaimParts,
  claim: string,
): { excerpts: string[]; figureFound: boolean } {
  const figs = figurePatterns(parts.figures);
  const keys = unique([
    ...parts.terms,
    ...parts.organisations.flatMap((o) =>
      o.split(/\s+/).filter((w) => w.length > 3),
    ),
    ...parts.places,
    ...clean(claim, 400)
      .toLowerCase()
      .split(/[^a-z0-9à-ÿ'-]+/)
      .filter((w) => w.length > 5),
  ]).map((k) => k.toLowerCase());
  const withFigure = sentences.filter((s) => figs.some((r) => r.test(s)));
  const withWords = sentences.filter(
    (s) =>
      !withFigure.includes(s) &&
      keys.filter((k) => s.toLowerCase().includes(k)).length >= 2,
  );
  const clip = (s: string) => (s.length > 320 ? `${s.slice(0, 317)}…` : s);
  return {
    excerpts: [...withFigure.slice(0, 3), ...withWords.slice(0, 2)]
      .slice(0, 4)
      .map(clip),
    figureFound: withFigure.length > 0,
  };
}

// ── The assessment ──────────────────────────────────────────────────────────

const MONTH_MS = 30.44 * 86_400_000;

/** What the rules would say from the sources as placed. A suggestion only. */
export function suggestAssessment(
  sources: readonly Pick<PlacedSource, "stance" | "published">[],
  now: Date,
): Assessment {
  const sup = sources.filter((s) => s.stance === "supports");
  const con = sources.filter((s) => s.stance === "contradicts");
  if (sup.length && con.length) return "partly";
  if (con.length) return "contradicted";
  if (sup.length) {
    const dated = sup.filter((s) => s.published);
    const allOld =
      dated.length === sup.length &&
      dated.every(
        (s) =>
          now.getTime() - new Date(`${s.published}T12:00:00Z`).getTime() >
          18 * MONTH_MS,
      );
    return allOld ? "outdated" : "supported";
  }
  return "insufficient";
}

/**
 * Whether the asker may choose this assessment from these sources. An
 * assessment needs evidence of its own kind: nobody can call a claim
 * contradicted without a source that contradicts it.
 */
export function assessmentProblem(
  a: Assessment,
  sources: readonly Pick<PlacedSource, "stance">[],
  summary: string | null,
): string | null {
  const has = (s: Stance) => sources.some((x) => x.stance === s);
  if (a === "insufficient") return null;
  if (a === "supported" && !has("supports"))
    return "Supported needs at least one source that supports the claim.";
  if (a === "supported" && has("contradicts"))
    return "A source contradicts it, so it can't be called simply supported — try Partially supported.";
  if (a === "partly" && !has("supports"))
    return "Partially supported needs a source that supports part of it.";
  if (a === "contradicted" && !has("contradicts"))
    return "Contradicted needs at least one source that contradicts the claim.";
  if (a === "outdated" && sources.length === 0)
    return "Outdated needs a source showing when it was true, or what changed.";
  if (a === "outdated" && !summary)
    return "Say in your own words what changed, so readers can follow.";
  return null;
}

// ── A whole check ───────────────────────────────────────────────────────────

export interface Correction {
  readonly at: string;
  readonly by: "asker" | "moderator";
  readonly note: string;
  readonly from: Assessment;
  readonly to: Assessment;
  /** Sources added with this correction, by title or address. */
  readonly added: readonly string[];
}

export interface CheckData {
  readonly slug: string;
  readonly claim: {
    /** The claim, as it was said, in the asker's transcription. */
    readonly text: string;
    readonly form: ClaimForm;
    readonly seenOn: SeenOn;
    /** Where it was seen, if public. Shown as a link, never as evidence. */
    readonly url: string | null;
    /** The page title read from that link, when it could be read. */
    readonly pageTitle: string | null;
  };
  /** The asker's own explanation, kept apart from the claim. */
  readonly why: string | null;
  readonly ask: AskType;
  readonly parts: ClaimParts;
  readonly questions: readonly string[];
  readonly leads: readonly Lead[];
  readonly sources: readonly PlacedSource[];
  readonly assessment: Assessment;
  /** What the rules suggested when it was published or last corrected. */
  readonly suggested: Assessment;
  /** The asker's explanation of the assessment, in their own words. */
  readonly summary: string | null;
  readonly investigatedAt: string;
  readonly updatedAt: string;
  readonly corrections: readonly Correction[];
  /** A screenshot or photo was attached. It is private and never shown publicly. */
  readonly hasFile: boolean;
}

/** The limits of this check, said on its page. */
export function limitations(
  c: Pick<CheckData, "claim" | "sources" | "hasFile">,
): string[] {
  const out = [
    "People's Pulse has no automatic web search. Only the pages listed here were opened and read.",
    "The assessment is the reading of the person who asked, checked against rules about the sources they listed. It is not independent verification.",
  ];
  if (c.sources.length === 0)
    out.push(
      "No source has been added yet, so there is no evidence either way.",
    );
  if (c.claim.url && walledPlatform(c.claim.url))
    out.push(
      `${walledPlatform(c.claim.url)} doesn't let us read posts, so the original post was not opened here.`,
    );
  if (c.hasFile || c.claim.form === "screenshot" || c.claim.form === "photo")
    out.push(
      "The claim was transcribed from a screenshot or photo, which has not been checked against the original post. Screenshots can be cropped or edited.",
    );
  if (c.sources.some((s) => s.excerpts.length === 0))
    out.push(
      "Some sources had no sentence matching the claim's figures or words; figures in charts, images or PDFs can't be read here.",
    );
  return out;
}

// ── What a visitor may write ────────────────────────────────────────────────

const TEXT_PROBLEM: Record<string, string> = {
  "personal-info":
    "Please take out personal details — emails, phone numbers, addresses.",
  link: "Put links in the link field, not in the text.",
  abuse:
    "That reads as an attack on people. Talk about the claim, not to hurt anyone.",
  health:
    "Please leave out medical details about anyone — describe what you saw in general terms.",
};

/** A sentence for what's wrong with public text, if anything. */
export function publicTextProblem(
  text: string,
  { links = false, health = true }: { links?: boolean; health?: boolean } = {},
): string | null {
  const p = textProblem(text);
  if (p && !(p === "link" && links)) return TEXT_PROBLEM[p]!;
  if (health && SENSITIVE_HEALTH.test(text)) return TEXT_PROBLEM.health!;
  return null;
}

export const POST_TYPES = [
  "experience",
  "question",
  "comment",
  "source",
] as const;
export type PostType = (typeof POST_TYPES)[number];
export const isPostType = (v: unknown): v is PostType =>
  typeof v === "string" && (POST_TYPES as readonly string[]).includes(v);

export const POST_INFO: Record<
  PostType,
  { readonly label: string; readonly section: string; readonly note: string }
> = {
  experience: {
    label: "My experience",
    section: "Personal experiences",
    note: "What people say happened to them. Not checked, and not evidence.",
  },
  question: {
    label: "A question",
    section: "Questions",
    note: "What people still want to know.",
  },
  comment: {
    label: "My opinion",
    section: "Opinions",
    note: "What people think. Opinion, not evidence.",
  },
  source: {
    label: "A source to look at",
    section: "Sources suggested by visitors",
    note: "Links visitors suggested. Not read or reviewed until the asker adds one as evidence.",
  },
};

export interface Post {
  readonly id: string;
  readonly type: PostType;
  readonly body: string;
  readonly url: string | null;
  readonly at: string;
  readonly mine?: boolean;
}

export const POST_REPORTS_TO_HIDE = 3;

// ── Sharing ─────────────────────────────────────────────────────────────────

/** The suggested comment, exactly as the brief words it, for the asker to edit. */
export function suggestedComment(url: string): string {
  return `🤔 Is this true?\n\nI came across this claim and wanted to know what the evidence actually says.\n\n🔎 Check the sources and have your say on People's Pulse:\n\n${url}`;
}

/** "/check/kelowna-general-hospital-is-operating-at-147-capacity-k3m9xq2p" */
export function makeSlug(claim: string, id: string): string {
  const words = claim
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/%/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  let out = "";
  for (const w of words) {
    if ((out + "-" + w).length > 60) break;
    out = out ? `${out}-${w}` : w;
  }
  return out ? `${out}-${id}` : id;
}

/** The Pulse id at the end of a slug, or null. */
export function idFromSlug(slug: unknown): string | null {
  if (typeof slug !== "string" || slug.length > 120) return null;
  const m = /(?:^|-)([a-z2-9]{8})$/.exec(slug);
  return m ? m[1]! : null;
}

/** A claim's fingerprint for spotting the same claim asked twice. */
export function fingerprint(claim: string): string {
  return claim
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9% ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 || /\d/.test(w))
    .sort()
    .join(" ")
    .slice(0, 300);
}

/** How alike two claims are, 0–1, by their words (and figures, which must agree). */
export function similarity(a: string, b: string): number {
  const A = new Set(fingerprint(a).split(" ").filter(Boolean));
  const B = new Set(fingerprint(b).split(" ").filter(Boolean));
  if (!A.size || !B.size) return 0;
  const numsA = [...A].filter((w) => /\d/.test(w));
  const numsB = [...B].filter((w) => /\d/.test(w));
  if (numsA.length && numsB.length && !numsA.some((n) => B.has(n))) return 0;
  let both = 0;
  for (const w of A) if (B.has(w)) both++;
  return both / (A.size + B.size - both);
}

export const DUPLICATE_AT = 0.6;

// ── Where visitors came from ────────────────────────────────────────────────

export const VISIT_SOURCES = [
  "facebook",
  "instagram",
  "x",
  "reddit",
  "tiktok",
  "messaging",
  "email",
  "search",
  "pulse",
  "other",
  "direct",
] as const;
export const SHARE_CHANNELS = [
  "copy-link",
  "copy-comment",
  "native",
  "facebook",
  "x",
  "whatsapp",
  "sms",
  "email",
] as const;
export type VisitSource = (typeof VISIT_SOURCES)[number];
export type ShareChannel = (typeof SHARE_CHANNELS)[number];
export const CHECK_EVENTS = ["visit", "share"] as const;
export type CheckEvent = (typeof CHECK_EVENTS)[number];

/** The kind of place a visit came from, from the referring address only. */
export function visitSource(referrer: string, ownHost: string): VisitSource {
  if (!referrer) return "direct";
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "other";
  }
  if (host === ownHost) return "pulse";
  if (/(^|\.)(facebook\.com|fb\.com|messenger\.com)$/.test(host))
    return /messenger/.test(host) ? "messaging" : "facebook";
  if (/(^|\.)instagram\.com$/.test(host)) return "instagram";
  if (/(^|\.)(x\.com|twitter\.com|t\.co)$/.test(host)) return "x";
  if (/(^|\.)reddit\.com$/.test(host)) return "reddit";
  if (/(^|\.)tiktok\.com$/.test(host)) return "tiktok";
  if (/(^|\.)(whatsapp\.com|telegram\.org|t\.me|discord\.com)$/.test(host))
    return "messaging";
  if (/mail\./.test(host) || /outlook/.test(host)) return "email";
  if (/(^|\.)(google|bing|duckduckgo|yahoo|ecosia)\./.test(host))
    return "search";
  return "other";
}

export const isVisitSource = (v: unknown): v is VisitSource =>
  typeof v === "string" && (VISIT_SOURCES as readonly string[]).includes(v);
export const isShareChannel = (v: unknown): v is ShareChannel =>
  typeof v === "string" && (SHARE_CHANNELS as readonly string[]).includes(v);

// ── Uploads ─────────────────────────────────────────────────────────────────

/** The image type from its first bytes, or null. Never trusts a filename. */
export function sniffImage(
  bytes: Uint8Array,
): (typeof FILE_LIMITS.types)[number] | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return "image/png";
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}
