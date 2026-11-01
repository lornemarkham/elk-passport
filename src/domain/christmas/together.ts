import { challengeById, satisfies } from "./challenges";
import type { MomentKind } from "./recap";

/**
 * **What a group may post: announcements and moments, checked before the
 * database sees them.** Postgres decides who may (RLS); this decides what is
 * well-formed, so a bad request is a 400 with a reason rather than a refusal.
 *
 * Learned at a real Hockey Night (Canucks v Wild, 2026-10-25): the
 * restaurant was packed, the group moved, and the change got lost in chat.
 * An announcement is the host's, stays at the top until each person has
 * seen it, and can carry a place to go and a "Got it" (owner brief M466).
 */

export type NoticeKind = "change" | "venue" | "meeting" | "time" | "note";

export const NOTICE_KINDS: readonly {
  readonly id: NoticeKind;
  readonly label: string;
  readonly shout: string;
  readonly emoji: string;
}[] = [
  {
    id: "change",
    label: "Change of plans",
    shout: "CHANGE OF PLANS!",
    emoji: "📣",
  },
  { id: "venue", label: "Somewhere else", shout: "NEW PLACE", emoji: "📍" },
  { id: "meeting", label: "Meeting spot", shout: "MEET HERE", emoji: "🧭" },
  { id: "time", label: "New time", shout: "TIME CHANGE", emoji: "⏰" },
  { id: "note", label: "Heads up", shout: "HEADS UP", emoji: "🔔" },
];

export const noticeKind = (id: string) =>
  NOTICE_KINDS.find((k) => k.id === id) ?? NOTICE_KINDS[4]!;

export interface NoticeInput {
  readonly kind: NoticeKind;
  readonly headline: string;
  readonly body: string | null;
  readonly atlasRef: string | null;
  /** Ask everyone to say "Got it". */
  readonly askAck: boolean;
}

export interface MomentInput {
  readonly kind: MomentKind;
  readonly text: string | null;
  /** Base64 JPEG, already shrunk in the browser. */
  readonly photo: string | null;
  readonly challengeId: string | null;
  readonly atlasRef: string | null;
}

export type Parsed<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

const ATLAS_REF = /^[A-Za-z0-9_:.-]{1,128}$/;
/** The same ceiling Hockey's photos use: a 1280px JPEG fits comfortably. */
export const MAX_PHOTO_CHARS = 700_000;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const t = value.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
};

export function parseNotice(body: unknown): Parsed<NoticeInput> {
  if (!body || typeof body !== "object")
    return { ok: false, error: "Say what's changed." };
  const b = body as Record<string, unknown>;
  const kind = NOTICE_KINDS.find((k) => k.id === b.kind)?.id;
  if (!kind) return { ok: false, error: "Pick what kind of announcement." };
  const headline = text(b.headline, 120);
  if (!headline) return { ok: false, error: "Give it a headline." };
  const atlasRef =
    typeof b.atlasRef === "string" && ATLAS_REF.test(b.atlasRef)
      ? b.atlasRef
      : null;
  return {
    ok: true,
    value: {
      kind,
      headline,
      body: text(b.body, 600),
      atlasRef,
      askAck: b.askAck !== false,
    },
  };
}

export function parseMoment(body: unknown): Parsed<MomentInput> {
  if (!body || typeof body !== "object")
    return { ok: false, error: "Share a photo or a few words." };
  const b = body as Record<string, unknown>;
  const kind: MomentKind | undefined =
    b.kind === "moment" || b.kind === "tradition" || b.kind === "challenge"
      ? b.kind
      : undefined;
  if (!kind) return { ok: false, error: "What kind of memory is it?" };
  const words = text(b.text, 600);
  let photo: string | null = null;
  if (b.photo !== undefined && b.photo !== null) {
    // A JPEG, and only a JPEG: base64 of the SOI marker is "/9j/". The
    // browser always sends one (canvas → image/jpeg); anything else is not a
    // photo, and the photo route serves these bytes back as image/jpeg.
    if (
      typeof b.photo !== "string" ||
      b.photo.length > MAX_PHOTO_CHARS ||
      !b.photo.startsWith("/9j/") ||
      !BASE64.test(b.photo)
    )
      return { ok: false, error: "That photo is too big or not a photo." };
    photo = b.photo;
  }
  if (!words && !photo)
    return { ok: false, error: "Share a photo or a few words." };
  let challengeId: string | null = null;
  if (kind === "challenge") {
    const challenge = challengeById(
      typeof b.challengeId === "string" ? b.challengeId : null,
    );
    if (!challenge) return { ok: false, error: "Which challenge?" };
    if (!satisfies(challenge, { text: words, hasPhoto: Boolean(photo) }))
      return {
        ok: false,
        error:
          challenge.proof === "photo"
            ? "This one needs a photo."
            : "Say what happened.",
      };
    challengeId = challenge.id;
  }
  const atlasRef =
    typeof b.atlasRef === "string" && ATLAS_REF.test(b.atlasRef)
      ? b.atlasRef
      : null;
  return {
    ok: true,
    value: { kind, text: words, photo, challengeId, atlasRef },
  };
}
