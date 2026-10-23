import { z } from "zod";
import { PhotoInputSchema } from "@/domain/hockey/memories";

/**
 * **Memories: the conference's shared album.**
 *
 * Hockey Night's Memories, reused: the same picture rule
 * (`PhotoInputSchema` — a JPEG the phone already shrank to 1280 px, about
 * 600 KB at most, base64), stored the same way (in Postgres, private to the
 * group, served only through a members-only route, never a public URL).
 * Added for a conference: a photo can belong to a plan ("the morning walk"),
 * people react to photos, and anyone in the album can download one.
 *
 * Who sees a photo: everyone in the conference; a photo attached to a plan
 * for selected coworkers, only the people who can see that plan. Who may
 * take one down: the person who took it, and an organiser.
 *
 * How long it lasts: as long as the conference, which is erased 30 days
 * after its last day (ARCHITECTURE §7). "Memories remain available after the
 * conference ends" is true for that month and no longer; keeping them past
 * it is an open decision (FEATURES.md, Shared Memories), not made here.
 */

export const ALBUM_SIZE = 300;

export const PHOTO_REACTIONS = ["❤️", "😂", "🔥", "🙌", "😮"] as const;
export type PhotoReaction = (typeof PHOTO_REACTIONS)[number];

export const AddPhotoSchema = PhotoInputSchema.extend({
  planId: z.string().max(64).nullable().optional(),
});

export interface Photo {
  readonly id: string;
  readonly conferenceId: string;
  readonly memberId: string;
  readonly planId: string | null;
  readonly caption: string;
  readonly at: string;
}

export interface PhotoReactionRow {
  readonly photoId: string;
  readonly memberId: string;
  readonly emoji: PhotoReaction;
}

export interface PhotoView {
  readonly id: string;
  readonly by: { readonly name: string; readonly you: boolean };
  readonly caption: string;
  readonly at: string;
  readonly plan: { readonly id: string; readonly title: string } | null;
  readonly reactions: readonly {
    readonly emoji: PhotoReaction;
    readonly count: number;
    readonly mine: boolean;
  }[];
  readonly canRemove: boolean;
}

/** Newest first. */
export function albumView(
  photos: readonly Photo[],
  reactions: readonly PhotoReactionRow[],
  plans: ReadonlyMap<string, string>,
  you: { memberId: string; role: "organiser" | "member" },
  named: ReadonlyMap<string, string>,
): PhotoView[] {
  return [...photos]
    .filter((p) => p.planId === null || plans.has(p.planId))
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((p) => {
      const these = reactions.filter((r) => r.photoId === p.id);
      return {
        id: p.id,
        by: {
          name:
            p.memberId === you.memberId
              ? "You"
              : (named.get(p.memberId) ?? "A coworker"),
          you: p.memberId === you.memberId,
        },
        caption: p.caption,
        at: p.at,
        plan: p.planId ? { id: p.planId, title: plans.get(p.planId)! } : null,
        reactions: PHOTO_REACTIONS.map((emoji) => {
          const r = these.filter((x) => x.emoji === emoji);
          return {
            emoji,
            count: r.length,
            mine: r.some((x) => x.memberId === you.memberId),
          };
        }).filter((r) => r.count > 0),
        canRemove: p.memberId === you.memberId || you.role === "organiser",
      };
    });
}

/** `sycle-vancouver-2026-morning-walk-3.jpg`: a file name a person would keep. */
export function downloadName(
  conferenceName: string,
  caption: string,
  id: string,
): string {
  const slug = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
  return `${[slug(conferenceName), slug(caption), id.slice(0, 6)].filter(Boolean).join("-")}.jpg`;
}
