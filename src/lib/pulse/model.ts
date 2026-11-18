/**
 * **People's Pulse: what a Pulse is, and what may be put in one.**
 *
 * A Pulse is a question, two to six answers, and a few optional facts about
 * where the question came from. Nothing here touches a database or a request;
 * every rule a visitor's words must pass is a pure function, so the API and
 * the tests agree on exactly the same rules.
 */

import { findTemplate, findTopic } from "./templates";

export const BRAND = {
  name: "People's Pulse",
  tagline: "What do people really think?",
  /** The Quick Ideas landing page (/labs/pulse). */
  hub: "What do you want to know?",
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
  claimNote: 240,
  claimPublished: 40,
  url: 500,
  city: 60,
  reportNote: 500,
  reason: 280,
  unit: 40,
  groupLabel: 60,
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
  /** When it was published, as the creator wrote it ("March 2024"). */
  readonly published?: string | null;
  /** What the figure measures, in the creator's words. */
  readonly measures?: string | null;
  /** How it was gathered, in the creator's words. */
  readonly method?: string | null;
}

/**
 * **The interaction mode** — one engine, several ways to ask. Every kind is
 * still one question, two to six answers and one vote per browser; the kind
 * only changes what a vote may carry and how results read:
 *
 *   - `pulse`  — People's Pulse: pick one answer (V1).
 *   - `decide` — Should I Do It?: Yes / No / Not yet, with optional reasons.
 *   - `settle` — Settle This: two to four sides, one winner (or not yet).
 *   - `normal` — Is This Normal?: answers are ordered ranges (never a raw
 *     number), optionally beside one comparison category; small groups hidden.
 *   - `rank`   — Rank These: put three to six things in order.
 *   - `check`  — Pulse Check: the community poll beneath an investigated
 *     claim (`check.ts`). Made only through `/api/pulse/check`, never the
 *     plain create form, so it always has its investigation beside it.
 */
export const KINDS = [
  "pulse",
  "decide",
  "settle",
  "normal",
  "rank",
  "check",
] as const;
export type PulseKind = (typeof KINDS)[number];
export const isKind = (v: unknown): v is PulseKind =>
  typeof v === "string" && (KINDS as readonly string[]).includes(v);

export const DECIDE_OPTIONS = ["Yes", "No", "Not yet"] as const;
export const SETTLE_MAX = 4;
export const RANK_MIN = 3;
export const NORMAL_MIN = 3;

/** Is This Normal?'s optional second question ("Household size"), for comparing groups. */
export interface PulseGroup {
  readonly label: string;
  readonly options: readonly PulseOption[];
}

export interface Pulse {
  readonly id: string;
  /** Absent on V1 and V2 Pulses, which are all `pulse`. */
  readonly kind?: PulseKind;
  /** Voters may add a short written reason, shown anonymously with their answer. */
  readonly reasons?: boolean;
  /** The template it was made from, for counting which ones people use. */
  readonly template?: string | null;
  /** Shared by link only: never on the public shelves. */
  readonly unlisted?: boolean;
  /** Is This Normal? only: the optional comparison category. */
  readonly group?: PulseGroup | null;
  /** Is This Normal? only: what the ranges measure ("per month"). */
  readonly unit?: string | null;
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

export const kindOf = (p: Pick<Pulse, "kind">): PulseKind => p.kind ?? "pulse";

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
  readonly kind?: unknown;
  readonly reasons?: unknown;
  readonly template?: unknown;
  readonly unlisted?: unknown;
  readonly group?: unknown;
  readonly unit?: unknown;
}

export type Draft = Omit<Pulse, "id" | "status" | "createdAt">;

/** Answer labels, cleaned and checked: distinct, short, nothing personal. */
function checkLabels(
  raw: unknown,
  min: number,
  max: number,
  field: string,
): readonly string[] | Checked {
  const labels = (Array.isArray(raw) ? raw : [])
    .map((o) => clean(o, LIMITS.option.max + 1))
    .filter(Boolean);
  const word = field === "group" ? "groups" : "answers";
  if (labels.length < min)
    return fail(
      field,
      min === 2
        ? `Give at least two ${word}.`
        : `Give at least ${min} ${word}.`,
    );
  if (labels.length > max) return fail(field, `${max} ${word} at most.`);
  if (labels.some((l) => l.length > LIMITS.option.max))
    return fail(field, "Keep each one under 60 characters.");
  const seen = new Set<string>();
  for (const l of labels) {
    const k = l.toLowerCase();
    if (seen.has(k)) return fail(field, "Each one must be different.");
    seen.add(k);
    const p = textProblem(l);
    if (p) return fail(field, PROBLEM_MESSAGE[p]);
  }
  return labels;
}

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

  const kind: PulseKind = isKind(input.kind) ? input.kind : "pulse";
  const answerRange: Record<PulseKind, [number, number]> = {
    pulse: [MIN_OPTIONS, MAX_OPTIONS],
    decide: [3, 3],
    settle: [MIN_OPTIONS, SETTLE_MAX],
    normal: [NORMAL_MIN, MAX_OPTIONS],
    rank: [RANK_MIN, MAX_OPTIONS],
    check: [MIN_OPTIONS, MAX_OPTIONS],
  };
  const labels = checkLabels(
    kind === "decide" ? DECIDE_OPTIONS : input.options,
    ...answerRange[kind],
    "options",
  );
  if (!Array.isArray(labels)) return labels as Checked;
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
      const notes: Record<"published" | "measures" | "method", string | null> =
        {
          published: null,
          measures: null,
          method: null,
        };
      for (const k of ["published", "measures", "method"] as const) {
        const max =
          k === "published" ? LIMITS.claimPublished : LIMITS.claimNote;
        const t = clean(c[k], max + 1);
        if (!t) continue;
        if (t.length > max)
          return fail("claim", `Keep "${k}" under ${max} characters.`);
        const problem = textProblem(t);
        if (problem && problem !== "link")
          return fail("claim", PROBLEM_MESSAGE[problem]);
        notes[k] = t;
      }
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
        ...(notes.published ? { published: notes.published } : {}),
        ...(notes.measures ? { measures: notes.measures } : {}),
        ...(notes.method ? { method: notes.method } : {}),
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

  let group: PulseGroup | null = null;
  let unit: string | null = null;
  if (kind === "normal") {
    const g = (input.group ?? null) as Record<string, unknown> | null;
    const groupLabel =
      g && typeof g === "object" ? clean(g.label, LIMITS.groupLabel + 1) : "";
    if (groupLabel) {
      if (groupLabel.length > LIMITS.groupLabel)
        return fail("group", "Keep the category name under 60 characters.");
      if (textProblem(groupLabel))
        return fail("group", PROBLEM_MESSAGE[textProblem(groupLabel)!]);
      const gl = checkLabels(g!.options, MIN_OPTIONS, MAX_OPTIONS, "group");
      if (!Array.isArray(gl)) return gl as Checked;
      group = {
        label: groupLabel,
        options: gl.map((label, i) => ({ id: `g${i + 1}`, label })),
      };
    }
    unit = clean(input.unit, LIMITS.unit) || null;
    if (unit && textProblem(unit))
      return fail("unit", PROBLEM_MESSAGE[textProblem(unit)!]);
  }

  // Only names this file knows, so the usage table can't be written into.
  const template =
    typeof input.template === "string" &&
    (findTemplate(input.template) ||
      (input.template.startsWith("topic-") &&
        findTopic(input.template.slice(6))))
      ? input.template
      : null;
  // A personal decision goes to friends by default; anything can opt out of the shelves.
  const unlisted =
    input.unlisted === undefined ? kind === "decide" : input.unlisted === true;
  const reasons =
    kind === "decide" || (kind !== "rank" && input.reasons === true);

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
      ...(kind === "pulse" ? {} : { kind }),
      ...(reasons ? { reasons } : {}),
      ...(template ? { template } : {}),
      ...(unlisted ? { unlisted } : {}),
      ...(group ? { group } : {}),
      ...(unit ? { unit } : {}),
    },
  };
}

/**
 * A ranking from the ballot: every answer exactly once, as answer numbers
 * ("3142" = o3 first, then o1, o4, o2). Null if it is not a full ranking.
 */
export function checkRanking(
  raw: unknown,
  options: readonly PulseOption[],
): string | null {
  if (!Array.isArray(raw) || raw.length !== options.length) return null;
  const ids = options.map((o) => o.id);
  const seen = new Set<string>();
  let out = "";
  for (const r of raw) {
    if (typeof r !== "string" || !ids.includes(r) || seen.has(r)) return null;
    seen.add(r);
    out += String(ids.indexOf(r) + 1);
  }
  return out;
}

/** A voter's written reason, cleaned; "problem" if it can't be shown. */
export function checkReason(raw: unknown): string | null | "problem" {
  const text = clean(raw, LIMITS.reason);
  if (!text) return null;
  return textProblem(text) ? "problem" : text;
}

export const REASON_PROBLEM =
  "Your reason can't include personal details, links or attacks — edit it or leave it blank.";

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
