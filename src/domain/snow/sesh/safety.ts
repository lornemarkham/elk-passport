/**
 * **What Sesh Wars won't reward, in words.**
 *
 * Snow Day's own challenge rules (`../challenges.ts`) refuse "trick", "jump"
 * and "send it" outright, because a snow day has no permitted place to do
 * them. Sesh Wars is the opposite case: it exists for tricks on features the
 * resort built for them. So it keeps a different, narrower line — the thing
 * refused is **escalation and harm**, not the park itself:
 *
 *   - closed or out-of-bounds terrain, ducking ropes, no helmet
 *   - "bigger / faster / higher than" one-upping, dares, gaps the resort
 *     didn't build
 *   - injury as the joke or the prize
 *   - drinking
 *   - contact details in public (numbers, emails, handles, "meet me at")
 *   - a short list of insults; chirps are friendly or they aren't posted
 *
 * Blunt on purpose: a false alarm is a reworded caption; a miss is a prize
 * for someone getting hurt.
 */

const ESCALATION =
  /\b(closed (run|trail|terrain|park|feature)|out[- ]of[- ]bounds|duck(ed|ing)? (the |a )?rope|poach(ed|ing)?|no helmet|without a helmet|helmetless|(bigger|higher|faster|further|longer) than|biggest|fastest|dare[sd]?|double dog|gap(ped|ping)? the|road gap|cliff|backcountry|after hours|at night in the park|drunk|beers?|chug|wasted|high af)\b/i;

const HARM =
  /\b(broke (my|his|her|their)|broken (arm|leg|wrist|collarbone|neck|back)|hospital|ambulance|concuss(ed|ion)|knocked out|blood(y)?|ski patrol (took|carried)|stretcher|injur(y|ed|ies))\b/i;

const UNKIND =
  /\b(loser|idiot|stupid|retard(ed)?|ugly|kill yourself|kys|die|trash human|worthless|f[a@]g(got)?|sl[u*]t|wh[o0]re|b[i!]tch|c[u*]nt)\b/i;

const CONTACT =
  /(\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|[\w.+-]+@[\w-]+\.[\w.]+|(^|\s)@[a-z0-9_.]{2,}|\b(snap(chat)?|insta(gram)?|tiktok|whatsapp|dm me|text me|meet me|my address)\b)/i;

export type Check = { ok: true } | { ok: false; reason: string };

function look(text: string, max: number, min = 1): Check {
  const t = text.trim();
  if (t.length < min) return { ok: false, reason: "Say something first." };
  if (t.length > max)
    return { ok: false, reason: `Keep it under ${max} characters.` };
  let hit = ESCALATION.exec(t);
  if (hit)
    return {
      ok: false,
      reason: `"${hit[0]}" isn't something Sesh Wars rewards. Style wins here, not risk — say what you're proud of instead.`,
    };
  hit = HARM.exec(t);
  if (hit)
    return {
      ok: false,
      reason: `Injuries never score. If someone's hurt, it's not a clip — check on them.`,
    };
  hit = UNKIND.exec(t);
  if (hit)
    return {
      ok: false,
      reason: `Chirp the riding, not the rider. Try that one again.`,
    };
  hit = CONTACT.exec(t);
  if (hit)
    return {
      ok: false,
      reason: `No contact details or handles in public. Meet up on the hill with people you know.`,
    };
  return { ok: true };
}

/** A clip's caption: optional, short, inside the line. */
export const checkCaption = (text: string): Check =>
  text.trim() === "" ? { ok: true } : look(text, 140);

/** A chirp: friendly, short, no contact details. */
export const checkChirp = (text: string): Check => look(text, 280);

/** A rider's display name: a nickname, not a full name or a handle. */
export function checkName(text: string): Check {
  const t = text.trim();
  if (t.length < 2) return { ok: false, reason: "At least two letters." };
  if (t.length > 24) return { ok: false, reason: "24 characters at most." };
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._'-]*$/u.test(t))
    return { ok: false, reason: "Letters, numbers, spaces, dots, dashes." };
  return look(t, 24);
}

/** Proposing a feature: the resort must have built it, and it must be open. */
export const checkProposal = (text: string): Check => look(text, 200, 3);

/** Quick, friendly chirps one tap away. */
export const QUICK_CHIRPS = [
  "Clean! 🧼",
  "Teach me that one",
  "Style for days",
  "Okay that's my new goal",
  "Grabbed it AND stuck it?",
  "Respect. Your move ⚔️",
] as const;
