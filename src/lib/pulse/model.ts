/**
 * **People's Pulse: what a Pulse is, and what may be put in one.**
 *
 * A Pulse is a question, two to six answers, and a few optional facts about
 * where the question came from. Nothing here touches a database or a request;
 * every rule a visitor's words must pass is a pure function, so the API and
 * the tests agree on exactly the same rules.
 */

export const BRAND = {
  name: "People's Pulse",
  tagline: "What do people really think?",
  footer: "Powered by ELK",
} as const;

/** Below this many votes a subset (a circle, a province, a city) is not shown. */
export const MIN_GROUP = 5;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;
export const LIMITS = {
  question: { min: 8, max: 200 },
  option: { min: 1, max: 60 },
  description: 500,
  claimText: 240,
  claimSource: 120,
  url: 500,
  city: 60,
  reportNote: 500,
} as const;

export const PROVINCES = [
  { code: "AB", name: "Alberta" },
  { code: "BC", name: "British Columbia" },
  { code: "MB", name: "Manitoba" },
  { code: "NB", name: "New Brunswick" },
  { code: "NL", name: "Newfoundland and Labrador" },
  { code: "NS", name: "Nova Scotia" },
  { code: "NT", name: "Northwest Territories" },
  { code: "NU", name: "Nunavut" },
  { code: "ON", name: "Ontario" },
  { code: "PE", name: "Prince Edward Island" },
  { code: "QC", name: "Quebec" },
  { code: "SK", name: "Saskatchewan" },
  { code: "YT", name: "Yukon" },
] as const;

export type ProvinceCode = (typeof PROVINCES)[number]["code"];

export const isProvince = (v: unknown): v is ProvinceCode =>
  typeof v === "string" && PROVINCES.some((p) => p.code === v);

export const provinceName = (code: string): string =>
  PROVINCES.find((p) => p.code === code)?.name ?? code;

export type PulseStatus = "live" | "review" | "removed";

export interface PulseOption {
  readonly id: string;
  readonly label: string;
}

/** Where the question is about: all of Canada, one province, or one place. */
export type PulseScope =
  | { readonly kind: "canada" }
  | { readonly kind: "province"; readonly province: ProvinceCode }
  | {
      readonly kind: "city";
      readonly province: ProvinceCode;
      readonly city: string;
    };

/** A statistic someone else published, always with who published it. */
export interface PulseClaim {
  readonly text: string;
  /** The published share, 0–100, for the answer it is about. */
  readonly percent: number | null;
  /** Which answer the published share is for. */
  readonly optionId: string | null;
  readonly source: string;
  readonly url: string;
}

export interface Pulse {
  readonly id: string;
  readonly question: string;
  readonly description: string | null;
  readonly options: readonly PulseOption[];
  readonly claim: PulseClaim | null;
  readonly sourceUrl: string | null;
  readonly scope: PulseScope;
  readonly expiresAt: string | null;
  readonly status: PulseStatus;
  readonly createdAt: string;
}

export function scopeLabel(scope: PulseScope): string {
  if (scope.kind === "canada") return "Canada";
  if (scope.kind === "province") return provinceName(scope.province);
  return `${scope.city}, ${scope.province}`;
}

export function isOpen(pulse: Pulse, now: Date): boolean {
  if (pulse.status !== "live") return false;
  return !pulse.expiresAt || new Date(pulse.expiresAt) > now;
}

// ── What a visitor may write ────────────────────────────────────────────────

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/;
const STREET =
  /\b\d{1,5}\s+(?:[A-Z][a-z]+\s){1,3}(?:street|st|avenue|ave|road|rd|drive|dr|crescent|cres|boulevard|blvd|lane|ln|court|ct|way|place|pl)\b\.?/i;
const LINK = /\bhttps?:\/\/|\bwww\.|\b[\w-]+\.(?:com|ca|net|org|io|ly|co)\b\//i;
const POSTAL =
  /\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d\b/i;

/**
 * Words that make a Pulse about attacking people rather than asking them.
 * Deliberately short: reports and review catch what a list cannot, and a long
 * list mostly catches innocent words.
 */
const ABUSE = [
  /\bk[i1]ll\s+(?:yo)?ur?self\b/i,
  /\bkys\b/i,
  /\bn[i1]gg(?:er|a)s?\b/i,
  /\bf[a@]gg?(?:ot)?s?\b/i,
  /\bretard(?:s|ed)?\b/i,
  /\btr[a@]nn(?:y|ies)\b/i,
  /\bch[i1]nks?\b/i,
  /\bk[i1]kes?\b/i,
  /\bspics?\b/i,
  /\bwhores?\b/i,
  /\bsluts?\b/i,
  /\bshould\s+(?:be\s+)?(?:die|shot|hanged|killed)\b/i,
];

export type TextProblem = "personal-info" | "link" | "abuse";

/** What is wrong with a piece of a visitor's text, if anything. */
export function textProblem(text: string): TextProblem | null {
  if (ABUSE.some((r) => r.test(text))) return "abuse";
  if (
    EMAIL.test(text) ||
    PHONE.test(text) ||
    STREET.test(text) ||
    POSTAL.test(text)
  )
    return "personal-info";
  if (LINK.test(text)) return "link";
  return null;
}

const PROBLEM_MESSAGE: Record<TextProblem, string> = {
  "personal-info":
    "Please take out personal details — emails, phone numbers, addresses.",
  link: "Links go in the source field, not here.",
  abuse:
    "That reads as an attack on people. Ask about ideas, not to hurt anyone.",
};

/** Collapse whitespace and trim; strips control characters. */
export function clean(text: unknown, max: number): string {
  if (typeof text !== "string") return "";
  return text
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function cleanUrl(raw: unknown): string | null {
  const text = clean(raw, LIMITS.url);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** "vernon" → "Vernon"; "NORTH vancouver" → "North Vancouver". */
export function cleanCity(raw: unknown): string | null {
  const text = clean(raw, LIMITS.city).replace(/[^\p{L}\p{M}\s.'-]/gu, "");
  if (text.length < 2) return null;
  if (textProblem(text)) return null;
  return text
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export interface CreateInput {
  readonly question?: unknown;
  readonly options?: unknown;
  readonly description?: unknown;
  readonly claim?: unknown;
  readonly sourceUrl?: unknown;
  readonly scope?: unknown;
  readonly expiresAt?: unknown;
}

export type Draft = Omit<Pulse, "id" | "status" | "createdAt">;

export type Checked =
  | { readonly ok: true; readonly draft: Draft }
  | {
      readonly ok: false;
      readonly field: string;
      readonly message: string;
    };

const fail = (field: string, message: string): Checked => ({
  ok: false,
  field,
  message,
});

/**
 * **The one gate every new Pulse goes through.** Returns the cleaned draft,
 * or the first field that needs fixing with a sentence a person can act on.
 */
export function checkDraft(input: CreateInput, now: Date): Checked {
  const question = clean(input.question, LIMITS.question.max + 1);
  if (question.length < LIMITS.question.min)
    return fail("question", "Ask a full question — a few words at least.");
  if (question.length > LIMITS.question.max)
    return fail("question", "Keep the question under 200 characters.");
  const qp = textProblem(question);
  if (qp) return fail("question", PROBLEM_MESSAGE[qp]);

  const rawOptions = Array.isArray(input.options) ? input.options : [];
  const labels = rawOptions
    .map((o) => clean(o, LIMITS.option.max + 1))
    .filter(Boolean);
  if (labels.length < MIN_OPTIONS)
    return fail("options", "Give at least two answers.");
  if (labels.length > MAX_OPTIONS)
    return fail("options", `Six answers at most.`);
  if (labels.some((l) => l.length > LIMITS.option.max))
    return fail("options", "Keep each answer under 60 characters.");
  const seen = new Set<string>();
  for (const l of labels) {
    const k = l.toLowerCase();
    if (seen.has(k)) return fail("options", "Each answer must be different.");
    seen.add(k);
    const p = textProblem(l);
    if (p) return fail("options", PROBLEM_MESSAGE[p]);
  }
  const options = labels.map((label, i) => ({ id: `o${i + 1}`, label }));

  const description = clean(input.description, LIMITS.description + 1) || null;
  if (description && description.length > LIMITS.description)
    return fail("description", "Keep the description under 500 characters.");
  if (description) {
    const p = textProblem(description);
    if (p) return fail("description", PROBLEM_MESSAGE[p]);
  }

  const sourceUrl = input.sourceUrl ? cleanUrl(input.sourceUrl) : null;
  if (input.sourceUrl && clean(input.sourceUrl, LIMITS.url) && !sourceUrl)
    return fail(
      "sourceUrl",
      "That source link doesn't look like a web address.",
    );

  let claim: PulseClaim | null = null;
  const c = (input.claim ?? null) as Record<string, unknown> | null;
  if (c && typeof c === "object") {
    const text = clean(c.text, LIMITS.claimText + 1);
    const hasPercent =
      c.percent !== undefined && c.percent !== null && c.percent !== "";
    const percent = hasPercent ? Number(c.percent) : null;
    const source = clean(c.source, LIMITS.claimSource + 1);
    const url = cleanUrl(c.url);
    if (text || hasPercent || source || clean(c.url, LIMITS.url)) {
      if (!text)
        return fail("claim", "Say what the original claim was, in a sentence.");
      if (text.length > LIMITS.claimText)
        return fail("claim", "Keep the claim under 240 characters.");
      const p = textProblem(text);
      if (p && p !== "link") return fail("claim", PROBLEM_MESSAGE[p]);
      if (
        percent !== null &&
        (!Number.isFinite(percent) || percent < 0 || percent > 100)
      )
        return fail("claim", "The published figure is a percentage, 0 to 100.");
      if (!source)
        return fail(
          "claim",
          "Name who published it — a published figure needs its source.",
        );
      if (!url)
        return fail(
          "claim",
          "Link to where it was published, so people can check it.",
        );
      const optionId =
        percent === null
          ? null
          : (options.find((o) => o.id === c.optionId)?.id ?? options[0]!.id);
      claim = {
        text,
        percent: percent === null ? null : Math.round(percent * 10) / 10,
        optionId,
        source,
        url,
      };
    }
  }

  const scope = checkScope(input.scope);
  if (!scope) return fail("scope", "Pick where this question is about.");

  let expiresAt: string | null = null;
  if (input.expiresAt) {
    const at = new Date(String(input.expiresAt));
    if (Number.isNaN(at.getTime()))
      return fail("expiresAt", "That end date isn't a date.");
    if (at.getTime() < now.getTime() + 60 * 60 * 1000)
      return fail("expiresAt", "End it at least an hour from now.");
    if (at.getTime() > now.getTime() + 366 * 24 * 60 * 60 * 1000)
      return fail("expiresAt", "End it within a year.");
    expiresAt = at.toISOString();
  }

  return {
    ok: true,
    draft: {
      question,
      description,
      options,
      claim,
      sourceUrl,
      scope,
      expiresAt,
    },
  };
}

export function checkScope(raw: unknown): PulseScope | null {
  if (!raw || typeof raw !== "object") return { kind: "canada" };
  const s = raw as Record<string, unknown>;
  if (s.kind === undefined || s.kind === "canada") return { kind: "canada" };
  if (!isProvince(s.province)) return null;
  if (s.kind === "province") return { kind: "province", province: s.province };
  if (s.kind === "city") {
    const city = cleanCity(s.city);
    if (!city) return null;
    return { kind: "city", province: s.province, city };
  }
  return null;
}

export const REPORT_REASONS = {
  misleading: "Misleading or false framing",
  harassment: "Targets or harasses someone",
  personal: "Shares personal information",
  spam: "Spam or advertising",
  hateful: "Hateful or abusive",
  other: "Something else",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;
export const isReportReason = (v: unknown): v is ReportReason =>
  typeof v === "string" && v in REPORT_REASONS;

/** Distinct reports that take a Pulse off the air until someone reviews it. */
export const REPORTS_TO_REVIEW = 3;

const ID_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/** A short, unambiguous id for a URL: 8 characters, ~40 bits. */
export function newId(random: (n: number) => Uint8Array): string {
  const bytes = random(8);
  let out = "";
  for (const b of bytes) out += ID_ALPHABET[b % ID_ALPHABET.length];
  return out;
}

export const isPulseId = (v: unknown): v is string =>
  typeof v === "string" && /^[a-z2-9]{8}$/.test(v);

export const isCircleCode = (v: unknown): v is string =>
  typeof v === "string" && /^[a-z2-9]{8}$/.test(v);
