import { z } from "zod";
import type { Moment, Participant } from "@/experience-lab/core/types";

/**
 * **"CHANGE OF PLANS!" — the host's word, above the conversation.**
 *
 * On 25 October 2026 the restaurant the group had voted for was packed and
 * the host moved everyone to Boston Pizza. The chat carried it, and the chat
 * also carried forty other things, so the one line that mattered scrolled
 * away. An announcement is a moment the host posts with a tag — what kind of
 * change — that the page keeps in front of every member, on every tab and
 * even when the phone is "away" in a period, until that person taps
 * **Got it!** (a ✅ reaction, the table the chat already has) or puts it away
 * on their own phone.
 *
 * It is still a moment: the same table, the same members-only reading, the
 * same reactions, the same removal. Only the host may post one
 * (`announce-migration.sql`). Passport never writes one on its own.
 */

export const ANNOUNCE_TAGS = ["update", "venue", "meeting", "time"] as const;
export type AnnounceTag = (typeof ANNOUNCE_TAGS)[number];

/** How each kind of change introduces itself. The host's words follow. */
export const ANNOUNCE_HEADLINE: Readonly<Record<AnnounceTag, string>> = {
  update: "HEADS UP",
  venue: "CHANGE OF PLANS!",
  meeting: "NEW MEETING SPOT",
  time: "TIME CHANGE",
};

export const ANNOUNCE_LABEL: Readonly<Record<AnnounceTag, string>> = {
  update: "Important update",
  venue: "Venue change",
  meeting: "Meeting spot",
  time: "Time change",
};

export const ANNOUNCE_EMOJI: Readonly<Record<AnnounceTag, string>> = {
  update: "📣",
  venue: "🍕",
  meeting: "📍",
  time: "⏰",
};

/** The reaction that means "I've seen this". One per person, like any reaction. */
export const ACK = "✅";

/** A link an announcement may carry: Passport's own page, or https. Nothing else. */
export const hrefSchema = z
  .string()
  .trim()
  .max(300)
  .regex(
    /^(https:\/\/[^\s]+|\/[A-Za-z0-9][^\s]*)$/,
    "A link starts with https:// or /",
  );

export const announceSchema = z.object({
  type: z.literal("announce"),
  tag: z.enum(ANNOUNCE_TAGS),
  text: z.string().trim().min(1).max(500),
  href: hrefSchema.optional(),
});

export interface Announcement {
  readonly id: string;
  readonly at: string;
  readonly by: string;
  readonly tag: AnnounceTag;
  readonly headline: string;
  readonly text: string;
  readonly href?: string;
  /** Members who tapped Got it!, in the order the rows came. */
  readonly ackedBy: readonly string[];
}

export function isAnnounceTag(value: unknown): value is AnnounceTag {
  return (
    typeof value === "string" &&
    (ANNOUNCE_TAGS as readonly string[]).includes(value)
  );
}

/** Every announcement on the night, newest first, with who has seen it. */
export function announcementsOf(
  moments: readonly Moment[],
  members: readonly Pick<Participant, "id">[],
): Announcement[] {
  const ids = new Set(members.map((m) => m.id));
  return moments
    .filter((m) => m.kind === "announce" && m.by && isAnnounceTag(m.tag))
    .map((m) => ({
      id: m.id,
      at: m.at,
      by: m.by!,
      tag: m.tag as AnnounceTag,
      headline: ANNOUNCE_HEADLINE[m.tag as AnnounceTag],
      text: m.text ?? "",
      ...(m.href ? { href: m.href } : {}),
      ackedBy: (m.reactions?.[ACK] ?? []).filter((id) => ids.has(id)),
    }))
    .sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * The announcements still in front of this person: not acknowledged, not put
 * away on this device, and the host's own excepted (they wrote it). Newest
 * first; the page shows the top one large and counts the rest.
 */
export function pendingFor(
  all: readonly Announcement[],
  meId: string | null,
  dismissed: ReadonlySet<string>,
): Announcement[] {
  if (!meId) return [];
  return all.filter(
    (a) => a.by !== meId && !a.ackedBy.includes(meId) && !dismissed.has(a.id),
  );
}

/** "3 of 5 got it" — for the host, who wants to know who still hasn't. */
export function ackLine(
  a: Announcement,
  members: readonly Pick<Participant, "id" | "name">[],
): string {
  const others = members.filter((m) => m.id !== a.by);
  if (others.length === 0) return "Nobody else is on the night yet.";
  const seen = others.filter((m) => a.ackedBy.includes(m.id));
  if (seen.length === others.length) return "Everyone got it.";
  const waiting = others
    .filter((m) => !a.ackedBy.includes(m.id))
    .map((m) => m.name);
  const list =
    waiting.length <= 3
      ? waiting.join(", ")
      : `${waiting.slice(0, 2).join(", ")} and ${waiting.length - 2} more`;
  return `${seen.length} of ${others.length} got it · waiting on ${list}`;
}

/** The moment a reply points at, if it is on the page; else nothing to quote. */
export function repliedTo(
  moments: readonly Pick<Moment, "id" | "by" | "text" | "kind">[],
  replyTo: string | undefined,
): Pick<Moment, "id" | "by" | "text" | "kind"> | undefined {
  return replyTo ? moments.find((m) => m.id === replyTo) : undefined;
}

/** One line of what was said, for the quote above a reply. */
export function quoteOf(text: string | undefined, max = 90): string {
  const one = (text ?? "").replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
}
