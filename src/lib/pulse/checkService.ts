import { createHmac, randomBytes } from "node:crypto";
import {
  ASK_INFO,
  CHECK_LIMITS,
  CONFIRMATIONS,
  DUPLICATE_AT,
  FILE_LIMITS,
  POST_REPORTS_TO_HIDE,
  analyseClaim,
  assessmentProblem,
  evidenceExcerpts,
  fingerprint,
  isAskType,
  isAssessment,
  isForm,
  isPostType,
  isSeenOn,
  isStance,
  limitations as limitationsOf,
  makeSlug,
  missingContext,
  publicTextProblem,
  seenOnFromUrl,
  similarity,
  sniffImage,
  suggestAssessment,
  walledPlatform,
  whereToCheck,
  type Assessment,
  type CheckData,
  type CheckEvent,
  type CheckSource,
  type ClaimForm,
  type ClaimParts,
  type Correction,
  type Lead,
  type PlacedSource,
  type Post,
  type SeenOn,
} from "./check";
import type { CheckListed, CheckStore } from "./checkStore";
import { openSource, sealSource } from "./checkSeal";
import {
  REPORT_REASONS,
  checkDraft,
  checkScope,
  clean,
  cleanUrl,
  newId,
  type Pulse,
  type PulseScope,
} from "./model";
import {
  CREATES_PER_DAY,
  FORM_MIN_AGE_MS,
  ballotProblem,
  netHash,
  type Who,
} from "./service";
import {
  checkableUrl,
  declaredDate,
  fetchPage,
  meta,
  pageSentences,
  pageSite,
  pageTitle,
} from "./sourceCheck";
import type { PulseStore } from "./store";

/**
 * **What Pulse Check does**, independent of HTTP: read a claim, open the
 * pages someone links, publish the check with its poll, take corrections,
 * and hold a discussion that keeps experience, opinion and evidence apart.
 */

export interface Stores {
  readonly pulses: PulseStore;
  readonly checks: CheckStore;
}

const hmac = (key: string, text: string) =>
  createHmac("sha256", key).update(text).digest("base64url").slice(0, 32);

const creatorHash = (key: string, device: string) =>
  hmac(key, `creator|${device}`);
const authorHash = (key: string, device: string) =>
  hmac(key, `post-author|${device}`);
const reporterHash = (key: string, device: string) =>
  hmac(key, `post-reporter|${device}`);

export const isCheckCreator = (
  checks: CheckStore,
  key: string,
  pulseId: string,
  device: string | null,
) =>
  device
    ? checks.isCreator(pulseId, creatorHash(key, device))
    : Promise.resolve(false);

export const authorOf = (key: string, device: string | null) =>
  device ? authorHash(key, device) : null;

// ── Reading the claim ───────────────────────────────────────────────────────

export interface Analysis {
  readonly parts: ClaimParts;
  readonly questions: readonly string[];
  readonly leads: readonly Lead[];
  /** Same or very like an existing check. */
  readonly duplicates: readonly Pick<
    CheckListed,
    "slug" | "claim" | "assessment"
  >[];
}

export async function analyse(
  checks: CheckStore | null,
  input: { claim?: unknown; form?: unknown; url?: unknown; scope?: unknown },
): Promise<Analysis | { error: string }> {
  const text = clean(input.claim, CHECK_LIMITS.claim.max);
  if (text.length < CHECK_LIMITS.claim.min)
    return { error: "Write out what the claim says, in a sentence." };
  const form: ClaimForm = isForm(input.form) ? input.form : "text";
  const url = cleanUrl(input.url);
  const scope = checkScope(input.scope) ?? { kind: "canada" as const };
  const parts = analyseClaim(text);
  const listed = checks ? await checks.list(200).catch(() => []) : [];
  const duplicates = listed
    .filter((c) => similarity(c.claim, text) >= DUPLICATE_AT)
    .slice(0, 3)
    .map(({ slug, claim, assessment }) => ({ slug, claim, assessment }));
  return {
    parts,
    questions: missingContext(text, parts, form, !!url),
    leads: whereToCheck(text, parts, scope),
    duplicates,
  };
}

export type OriginRead =
  | {
      readonly ok: true;
      readonly title: string | null;
      readonly description: string | null;
      readonly site: string;
      readonly seenOn: SeenOn | null;
    }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly seenOn: SeenOn | null;
    };

/**
 * Open the link where the claim was seen, to help the asker write it out.
 * Social platforms that need a sign-in are not fetched at all; we say so.
 */
export async function readOrigin(raw: unknown): Promise<OriginRead> {
  const url = cleanUrl(raw);
  if (!url)
    return { ok: false, reason: "That isn't a web address.", seenOn: null };
  const seenOn = seenOnFromUrl(url);
  const walled = walledPlatform(url);
  if (walled)
    return {
      ok: false,
      seenOn,
      reason: `${walled} doesn't let us read posts. Type or paste what it says below.`,
    };
  if (!checkableUrl(url))
    return {
      ok: false,
      seenOn,
      reason: "That link can't be opened from here. Type what it says below.",
    };
  const page = await fetchPage(url);
  if (!page.ok) return { ok: false, seenOn, reason: page.reason };
  return {
    ok: true,
    seenOn: seenOn ?? "news",
    title: pageTitle(page.html),
    description:
      meta(page.html, [
        "og:description",
        "twitter:description",
        "description",
      ])?.slice(0, 300) ?? null,
    site: pageSite(page.html, page.url),
  };
}

// ── Evidence ────────────────────────────────────────────────────────────────

export type EvidenceRead =
  | { readonly ok: true; readonly source: CheckSource; readonly sealed: string }
  | { readonly ok: false; readonly reason: string };

/**
 * Open one page offered as evidence and copy out what it says about the
 * claim. The result is sealed, so publishing can't change a word of it.
 */
export async function readEvidence(
  key: string,
  raw: unknown,
  claim: unknown,
  now: Date,
): Promise<EvidenceRead> {
  const url = cleanUrl(raw);
  if (!url || !checkableUrl(url))
    return {
      ok: false,
      reason: "Evidence needs an https:// link to a public web page.",
    };
  const walled = walledPlatform(url);
  if (walled)
    return {
      ok: false,
      reason: `${walled} posts can't be opened from here, and a social post is rarely the evidence. Link the report, page or document it points to.`,
    };
  const page = await fetchPage(url);
  if (!page.ok)
    return {
      ok: false,
      reason: `${page.reason} A page that can't be opened can't be used as evidence.`,
    };
  const text = clean(claim, CHECK_LIMITS.claim.max);
  const parts = analyseClaim(text);
  const found = evidenceExcerpts(pageSentences(page.html), parts, text);
  const source: CheckSource = {
    url: page.url.toString(),
    title: pageTitle(page.html),
    site: pageSite(page.html, page.url),
    published: declaredDate(page.html, now),
    readAt: now.toISOString(),
    excerpts: found.excerpts,
    figureFound: found.figureFound,
  };
  return { ok: true, source, sealed: sealSource(key, source) };
}

type Placed =
  { ok: true; sources: PlacedSource[] } | { ok: false; message: string };

/** Sources handed back on publish or correction: each must carry the server's seal. */
function placeSources(
  key: string,
  raw: unknown,
  now: Date,
  already: readonly PlacedSource[] = [],
): Placed {
  const list = Array.isArray(raw) ? raw : [];
  if (list.length + already.length > CHECK_LIMITS.sources)
    return {
      ok: false,
      message: `${CHECK_LIMITS.sources} sources at most on one check.`,
    };
  const out: PlacedSource[] = [];
  const seen = new Set(already.map((s) => s.url));
  for (const item of list) {
    const r = (item ?? {}) as Record<string, unknown>;
    const source = openSource(key, r.sealed);
    if (!source)
      return {
        ok: false,
        message:
          "One of the sources wasn't read by People's Pulse. Add it again with the link.",
      };
    if (seen.has(source.url)) continue;
    seen.add(source.url);
    if (!isStance(r.stance))
      return {
        ok: false,
        message:
          "Say whether each source supports the claim, contradicts it or is context.",
      };
    const note = clean(r.note, CHECK_LIMITS.note + 1) || null;
    if (note && note.length > CHECK_LIMITS.note)
      return {
        ok: false,
        message: "Keep each source note under 240 characters.",
      };
    const problem = note ? publicTextProblem(note) : null;
    if (problem) return { ok: false, message: problem };
    out.push({ ...source, stance: r.stance, note, addedAt: now.toISOString() });
  }
  return { ok: true, sources: out };
}

// ── Publish ─────────────────────────────────────────────────────────────────

export interface CreateCheckInput {
  readonly claim?: unknown;
  readonly why?: unknown;
  readonly scope?: unknown;
  readonly ask?: unknown;
  readonly question?: unknown;
  readonly options?: unknown;
  readonly sources?: unknown;
  readonly assessment?: unknown;
  readonly summary?: unknown;
  readonly confirm?: unknown;
  /** A screenshot or photo, base64. Kept private. */
  readonly file?: unknown;
  readonly website?: unknown;
  readonly openedAt?: unknown;
}

export type CreateCheckResult =
  | { readonly ok: true; readonly pulse: Pulse; readonly check: CheckData }
  | {
      readonly ok: false;
      readonly error: "invalid" | "limited" | "bot";
      readonly field?: string;
      readonly message: string;
    };

const bad = (field: string, message: string): CreateCheckResult => ({
  ok: false,
  error: "invalid",
  field,
  message,
});

const UNSURE = /\b(?:unsure|not sure|don'?t know|no idea)\b/i;

function decodeFile(
  raw: unknown,
):
  | { ok: true; file: { mime: string; bytes: Buffer } | null }
  | { ok: false; message: string } {
  if (raw === undefined || raw === null || raw === "")
    return { ok: true, file: null };
  if (typeof raw !== "string")
    return { ok: false, message: "That picture didn't come through." };
  const b64 = raw.replace(/^data:[^,]*,/, "");
  if (b64.length > Math.ceil((FILE_LIMITS.bytes * 4) / 3) + 8)
    return {
      ok: false,
      message: "That picture is too big. Try a smaller screenshot.",
    };
  const bytes = Buffer.from(b64, "base64");
  if (bytes.length > FILE_LIMITS.bytes)
    return {
      ok: false,
      message: "That picture is too big. Try a smaller screenshot.",
    };
  const mime = sniffImage(bytes);
  if (!mime)
    return {
      ok: false,
      message: "Only JPEG, PNG or WebP pictures can be attached.",
    };
  return { ok: true, file: { mime, bytes } };
}

export async function createCheck(
  stores: Stores,
  key: string,
  input: CreateCheckInput,
  who: Who,
): Promise<CreateCheckResult> {
  const opened = Number(input.openedAt);
  if (
    (typeof input.website === "string" && input.website.trim() !== "") ||
    !Number.isFinite(opened) ||
    who.now.getTime() - opened < FORM_MIN_AGE_MS
  ) {
    console.warn("pulse-check-refused-as-bot", {
      honeypot: typeof input.website === "string" && input.website !== "",
      ageMs: who.now.getTime() - opened,
    });
    return {
      ok: false,
      error: "bot",
      message: "That was quicker than a person types. Give it another go.",
    };
  }

  const c = (input.claim ?? {}) as Record<string, unknown>;
  const text = clean(c.text, CHECK_LIMITS.claim.max + 1);
  if (text.length < CHECK_LIMITS.claim.min)
    return bad("claim", "Write out what the claim says, in a sentence.");
  if (text.length > CHECK_LIMITS.claim.max)
    return bad(
      "claim",
      "Keep the claim under 400 characters — quote the key part.",
    );
  const parts = analyseClaim(text);
  const claimProblem = publicTextProblem(text, {
    links: false,
    health: parts.namesPerson,
  });
  if (claimProblem) return bad("claim", claimProblem);
  const form: ClaimForm = isForm(c.form) ? c.form : "text";
  const url = c.url ? cleanUrl(c.url) : null;
  if (c.url && clean(c.url, 500) && !url)
    return bad("url", "That link doesn't look like a web address.");
  const seenOn: SeenOn = isSeenOn(c.seenOn)
    ? c.seenOn
    : ((url ? seenOnFromUrl(url) : null) ?? "other");
  const pageTitleText = clean(c.pageTitle, 200) || null;

  const why = clean(input.why, CHECK_LIMITS.why + 1) || null;
  if (why && why.length > CHECK_LIMITS.why)
    return bad("why", "Keep your reason under 600 characters.");
  const whyProblem = why ? publicTextProblem(why) : null;
  if (whyProblem) return bad("why", whyProblem);

  const scope: PulseScope | null = checkScope(input.scope);
  if (!scope) return bad("scope", "Pick where this claim is about.");

  const confirm = (input.confirm ?? {}) as Record<string, unknown>;
  for (const k of Object.keys(CONFIRMATIONS))
    if (confirm[k] !== true)
      return bad("confirm", "Tick each confirmation before publishing.");

  const placed = placeSources(key, input.sources, who.now);
  if (!placed.ok) return bad("sources", placed.message);
  const sources = placed.sources;

  const summary = clean(input.summary, CHECK_LIMITS.summary + 1) || null;
  if (summary && summary.length > CHECK_LIMITS.summary)
    return bad("summary", "Keep your explanation under 800 characters.");
  const summaryProblem = summary ? publicTextProblem(summary) : null;
  if (summaryProblem) return bad("summary", summaryProblem);

  const suggested = suggestAssessment(sources, who.now);
  const assessment: Assessment = isAssessment(input.assessment)
    ? input.assessment
    : suggested;
  const aProblem = assessmentProblem(assessment, sources, summary);
  if (aProblem) return bad("assessment", aProblem);

  const ask = isAskType(input.ask) ? input.ask : "fact";
  const info = ASK_INFO[ask];
  let question = info.question;
  let options: readonly string[] = info.options;
  if (ask === "opinion") {
    const q = clean(input.question, CHECK_LIMITS.question + 1);
    if (q) question = q;
    const opts = (Array.isArray(input.options) ? input.options : [])
      .map((o) => clean(o, 61))
      .filter(Boolean);
    if (opts.length >= 2) options = opts;
    // People are allowed not to know.
    if (!options.some((o) => UNSURE.test(o)) && options.length < 6)
      options = [...options, "Unsure"];
  }
  const draft = checkDraft(
    { kind: "check", question, options, scope },
    who.now,
  );
  if (!draft.ok)
    return bad(
      draft.field === "options" ? "options" : "question",
      draft.message,
    );

  const file = decodeFile(input.file);
  if (!file.ok) return bad("file", file.message);

  const now = who.now.toISOString();
  const by = {
    creator: creatorHash(key, who.device),
    net: netHash(key, who.ip, who.now),
  };
  for (let attempt = 0; attempt < 4; attempt++) {
    const id = newId((n) => randomBytes(n));
    const pulse: Pulse = {
      ...draft.draft,
      id,
      status: "live",
      createdAt: now,
    };
    const check: CheckData = {
      slug: makeSlug(text, id),
      claim: { text, form, seenOn, url, pageTitle: pageTitleText },
      why,
      ask,
      parts,
      questions: missingContext(text, parts, form, !!url),
      leads: whereToCheck(text, parts, scope),
      sources,
      assessment,
      suggested,
      summary,
      investigatedAt: now,
      updatedAt: now,
      corrections: [],
      hasFile: file.file !== null,
    };
    const outcome = await stores.checks.create(
      pulse,
      check,
      by,
      CREATES_PER_DAY,
      fingerprint(text),
      file.file,
    );
    if (outcome === "ok") return { ok: true, pulse, check };
    if (outcome === "limited")
      return {
        ok: false,
        error: "limited",
        message: `That's ${CREATES_PER_DAY} new checks and Pulses from here today — come back tomorrow.`,
      };
  }
  throw new Error("could not find a free Pulse id");
}

// ── Corrections ─────────────────────────────────────────────────────────────

export type CorrectResult =
  | { readonly ok: true; readonly check: CheckData }
  | {
      readonly ok: false;
      readonly error: "invalid" | "forbidden" | "missing" | "conflict";
      readonly message: string;
    };

/**
 * Add evidence, change the assessment, or say what changed — by the person
 * who asked (their browser) or a moderator. Every correction is kept and
 * shown; nothing published is silently rewritten.
 */
export async function correctCheck(
  stores: Stores,
  key: string,
  pulseId: string,
  input: {
    note?: unknown;
    assessment?: unknown;
    sources?: unknown;
    summary?: unknown;
  },
  as: { device: string } | "moderator",
  now: Date,
): Promise<CorrectResult> {
  const stored = await stores.checks.get(pulseId);
  const pulse = await stores.pulses.get(pulseId);
  if (!stored || !pulse || pulse.status === "removed")
    return {
      ok: false,
      error: "missing",
      message: "This check isn't here any more.",
    };
  const who =
    as === "moderator" ? "moderator" : { creator: creatorHash(key, as.device) };
  if (
    who !== "moderator" &&
    !(await stores.checks.isCreator(pulseId, who.creator))
  )
    return {
      ok: false,
      error: "forbidden",
      message:
        "Only the person who published this check can correct it, from the same browser.",
    };
  const note = clean(input.note, CHECK_LIMITS.correction + 1);
  if (note.length < 8)
    return {
      ok: false,
      error: "invalid",
      message: "Say what changed, in a sentence.",
    };
  if (note.length > CHECK_LIMITS.correction)
    return {
      ok: false,
      error: "invalid",
      message: "Keep the note under 500 characters.",
    };
  const noteProblem = publicTextProblem(note);
  if (noteProblem) return { ok: false, error: "invalid", message: noteProblem };
  const old = stored.check;
  const placed = placeSources(key, input.sources, now, old.sources);
  if (!placed.ok)
    return { ok: false, error: "invalid", message: placed.message };
  const sources = [...old.sources, ...placed.sources];
  const summaryIn =
    input.summary === undefined
      ? undefined
      : clean(input.summary, CHECK_LIMITS.summary + 1);
  if (summaryIn && summaryIn.length > CHECK_LIMITS.summary)
    return {
      ok: false,
      error: "invalid",
      message: "Keep your explanation under 800 characters.",
    };
  const summaryProblem = summaryIn ? publicTextProblem(summaryIn) : null;
  if (summaryProblem)
    return { ok: false, error: "invalid", message: summaryProblem };
  const summary = summaryIn === undefined ? old.summary : summaryIn || null;
  const assessment = isAssessment(input.assessment)
    ? input.assessment
    : old.assessment;
  const aProblem = assessmentProblem(assessment, sources, summary);
  if (aProblem) return { ok: false, error: "invalid", message: aProblem };
  const correction: Correction = {
    at: now.toISOString(),
    by: who === "moderator" ? "moderator" : "asker",
    note,
    from: old.assessment,
    to: assessment,
    added: placed.sources.map((s) => s.title ?? s.site),
  };
  const check: CheckData = {
    ...old,
    sources,
    summary,
    assessment,
    suggested: suggestAssessment(sources, now),
    updatedAt: now.toISOString(),
    corrections: [...old.corrections, correction],
  };
  const outcome = await stores.checks.update(
    pulseId,
    check,
    stored.version,
    who,
  );
  if (outcome === "ok") return { ok: true, check };
  if (outcome === "conflict")
    return {
      ok: false,
      error: "conflict",
      message: "Someone changed this check a moment ago. Reload and try again.",
    };
  if (outcome === "forbidden")
    return {
      ok: false,
      error: "forbidden",
      message: "Only the person who published this check can correct it.",
    };
  return {
    ok: false,
    error: "missing",
    message: "This check isn't here any more.",
  };
}

// ── Discussion ──────────────────────────────────────────────────────────────

export const POSTS_PER_PULSE_PER_DAY = 6;
export const POSTS_PER_NET_PER_DAY = 30;

export const postToken = (key: string, pulseId: string, now: Date) => {
  const t = now.getTime().toString(36);
  return `${t}.${createHmac("sha256", key).update(`ballot|post-${pulseId}|${t}`).digest("base64url").slice(0, 16)}`;
};

export type PostResult =
  | { readonly ok: true; readonly post: Post }
  | {
      readonly ok: false;
      readonly error: "invalid" | "limited" | "missing" | "bot";
      readonly message: string;
    };

export async function addPost(
  stores: Stores,
  key: string,
  pulseId: string,
  input: {
    type?: unknown;
    body?: unknown;
    url?: unknown;
    token?: unknown;
    website?: unknown;
  },
  who: Who,
): Promise<PostResult> {
  if (
    (typeof input.website === "string" && input.website.trim()) ||
    ballotProblem(key, `post-${pulseId}`, input.token, who.now)
  )
    return {
      ok: false,
      error: "bot",
      message:
        "That didn't look like it came from a person. Reload and try again.",
    };
  if (!isPostType(input.type))
    return {
      ok: false,
      error: "invalid",
      message: "Pick what kind of post this is.",
    };
  const body = clean(input.body, CHECK_LIMITS.post + 1);
  if (body.length < CHECK_LIMITS.postMin)
    return { ok: false, error: "invalid", message: "Write a little more." };
  if (body.length > CHECK_LIMITS.post)
    return {
      ok: false,
      error: "invalid",
      message: "Keep it under 1,000 characters.",
    };
  const problem = publicTextProblem(body, { health: true });
  if (problem) return { ok: false, error: "invalid", message: problem };
  let url: string | null = null;
  if (input.type === "source") {
    url = cleanUrl(input.url);
    if (!url || !checkableUrl(url))
      return {
        ok: false,
        error: "invalid",
        message: "A suggested source needs an https:// link to a public page.",
      };
  }
  const post = {
    id: newId((n) => randomBytes(n)),
    pulseId,
    type: input.type,
    body,
    url,
    author: authorHash(key, who.device),
    net: netHash(key, who.ip, who.now),
  };
  const outcome = await stores.checks.addPost(
    post,
    POSTS_PER_PULSE_PER_DAY,
    POSTS_PER_NET_PER_DAY,
  );
  if (outcome === "ok")
    return {
      ok: true,
      post: {
        id: post.id,
        type: post.type,
        body,
        url,
        at: who.now.toISOString(),
        mine: true,
      },
    };
  if (outcome === "limited")
    return {
      ok: false,
      error: "limited",
      message: "That's a lot of posts from here today. Come back tomorrow.",
    };
  return {
    ok: false,
    error: "missing",
    message: "This check isn't taking posts.",
  };
}

export async function reportPost(
  checks: CheckStore,
  key: string,
  postId: string,
  reason: unknown,
  device: string,
): Promise<"ok" | "duplicate" | "missing" | "invalid"> {
  if (typeof reason !== "string" || !(reason in REPORT_REASONS))
    return "invalid";
  return checks.reportPost(
    postId,
    reporterHash(key, device),
    reason,
    POST_REPORTS_TO_HIDE,
  );
}

// ── Discover ────────────────────────────────────────────────────────────────

export interface CheckShelves {
  readonly recent: readonly CheckListed[];
  readonly trending: readonly CheckListed[];
  readonly local: readonly CheckListed[];
  readonly discussed: readonly CheckListed[];
  readonly updated: readonly CheckListed[];
}

/** A check needs this much activity in a day to trend. */
export const MIN_CHECK_TRENDING = 3;

/** Plain shelves, no recommender: each says in its name how it is ordered. */
export function checkShelves(
  listed: readonly CheckListed[],
  province: string | null,
  size = 6,
): CheckShelves {
  const live = listed.filter((c) => c.status === "live");
  const heat = (c: CheckListed) => c.votesLastDay + 2 * c.postsLastDay;
  return {
    recent: live.slice(0, size),
    trending: [...live]
      .filter((c) => heat(c) >= MIN_CHECK_TRENDING)
      .sort((a, b) => heat(b) - heat(a))
      .slice(0, size),
    local: province
      ? live
          .filter(
            (c) => c.scope.kind !== "canada" && c.scope.province === province,
          )
          .slice(0, size)
      : [],
    discussed: [...live]
      .filter((c) => c.posts > 0)
      .sort(
        (a, b) => b.posts - a.posts || b.createdAt.localeCompare(a.createdAt),
      )
      .slice(0, size),
    updated: [...live]
      .filter((c) => c.corrections > 0)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, size),
  };
}

// ── Counting ────────────────────────────────────────────────────────────────

/** Aggregate only: one more visit or share from a kind of place, per day. */
export async function countCheck(
  checks: CheckStore,
  event: CheckEvent,
  source: string,
): Promise<boolean> {
  try {
    await checks.count(event, source);
    return true;
  } catch (e) {
    console.warn("pulse-check-count-skipped", { event, because: String(e) });
    return false;
  }
}

export const limitations = limitationsOf;
export { CONFIRMATIONS };
