import { FEEDBACK_MAX_CHARS, QA_NAME_MAX_CHARS } from "./show";

/**
 * **What a feedback submission may contain, before a person ever reads it.**
 *
 * The room is ~140 colleagues typing on phones, anonymously. Two things must
 * never land in the inbox, let alone on the stage: anything that looks like a
 * patient (names we cannot detect, but identifiers, dates of birth, phone
 * numbers and emails we can), and anything that is a link. Refused text is
 * refused with a reason the phone can show, so a person can rephrase. A
 * presenter still moderates everything that gets through.
 */
export type Screen =
  | { readonly ok: true; readonly body: string }
  | { readonly ok: false; readonly reason: string };

const RULES: readonly { readonly test: RegExp; readonly reason: string }[] = [
  {
    test: /[\w.+-]+@[\w-]+\.[\w.-]+/i,
    reason: "Please leave out email addresses — this is anonymous.",
  },
  {
    test: /https?:\/\/|www\./i,
    reason: "Links can't be shown on the stage. Say it in words.",
  },
  {
    test: /(?:\d[\s().-]*){7,}/,
    reason: "That looks like a phone number or an ID. Please leave it out.",
  },
  {
    test: /\b(mrn|ssn|sin|dob|date of birth|health card|chart ?#|patient id)\b/i,
    reason: "Nothing that could identify a patient, please.",
  },
  {
    test: /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/,
    reason: "Please leave out dates that could identify someone.",
  },
];

export function screenFeedback(raw: unknown, max = FEEDBACK_MAX_CHARS): Screen {
  if (typeof raw !== "string") return { ok: false, reason: "Say something." };
  const body = raw.replace(/\s+/g, " ").trim();
  if (body.length < 3) return { ok: false, reason: "A few more words?" };
  if (body.length > max)
    return {
      ok: false,
      reason: `Keep it under ${max} characters.`,
    };
  for (const rule of RULES)
    if (rule.test.test(body)) return { ok: false, reason: rule.reason };
  return { ok: true, body };
}

/** One shape for "the same thing, typed twice": case and punctuation blind. */
export const feedbackFingerprint = (body: string): string =>
  body
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isParticipantId = (s: unknown): s is string =>
  typeof s === "string" && UUID.test(s);

/**
 * A Hot Seat display name: a name, not an account. Empty becomes "Anonymous";
 * a link or an address in it is refused the way it is in the text.
 */
export function screenName(raw: unknown): Screen {
  if (raw === undefined || raw === null) return { ok: true, body: "Anonymous" };
  if (typeof raw !== "string") return { ok: false, reason: "Use a name." };
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length === 0) return { ok: true, body: "Anonymous" };
  if (name.length > QA_NAME_MAX_CHARS)
    return {
      ok: false,
      reason: `Keep your name under ${QA_NAME_MAX_CHARS} characters.`,
    };
  if (/@|https?:\/\/|www\.|(?:\d[\s().-]*){7,}/i.test(name))
    return { ok: false, reason: "Just a first name or a nickname, please." };
  return { ok: true, body: name };
}
