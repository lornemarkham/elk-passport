import { z } from "zod";

/**
 * **Group chat: the conference's room, and a thread per plan.**
 *
 * The shape is Hockey Night's chat (`passport_occasion_moments` and its
 * reactions): one row per message, one row per person per reaction, a
 * reaction is a toggle, and the page asks again every few seconds while it is
 * visible. What differs is whose group it is: messages hang off the
 * conference's own membership, so leaving or being removed takes your
 * messages with you, and a plan for selected coworkers has a thread only
 * they can read.
 *
 * Posting is a choice to be seen: only members who chose a name and to be
 * visible can speak (VISION principle 6). Reading is for every member.
 */

export const REACTIONS = ["👍", "😂", "❤️", "🔥", "🙌", "😮"] as const;
export type Reaction = (typeof REACTIONS)[number];

export const MESSAGE_MAX = 1000;
/** How many messages a room shows: the recent conversation, not an archive. */
export const ROOM_SIZE = 120;

export const SaySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Say something")
    .max(MESSAGE_MAX, `${MESSAGE_MAX} characters at most`),
  planId: z.string().max(64).nullable().optional(),
});

export interface Message {
  readonly id: string;
  readonly conferenceId: string;
  readonly memberId: string;
  readonly planId: string | null;
  readonly body: string;
  readonly at: string;
}

export interface MessageReaction {
  readonly messageId: string;
  readonly memberId: string;
  readonly emoji: Reaction;
}

export interface MessageView {
  readonly id: string;
  readonly at: string;
  readonly by: { readonly name: string; readonly you: boolean };
  readonly body: string;
  readonly reactions: readonly {
    readonly emoji: Reaction;
    readonly count: number;
    readonly mine: boolean;
  }[];
  readonly canDelete: boolean;
}

/** Oldest first, as a conversation reads. */
export function roomView(
  messages: readonly Message[],
  reactions: readonly MessageReaction[],
  you: { memberId: string; role: "organiser" | "member" },
  named: ReadonlyMap<string, string>,
): MessageView[] {
  return [...messages]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((m) => {
      const mine = reactions.filter((r) => r.messageId === m.id);
      return {
        id: m.id,
        at: m.at,
        by: {
          // Somebody who has since gone quiet is not named again.
          name:
            m.memberId === you.memberId
              ? "You"
              : (named.get(m.memberId) ?? "A coworker"),
          you: m.memberId === you.memberId,
        },
        body: m.body,
        reactions: REACTIONS.map((emoji) => {
          const these = mine.filter((r) => r.emoji === emoji);
          return {
            emoji,
            count: these.length,
            mine: these.some((r) => r.memberId === you.memberId),
          };
        }).filter((r) => r.count > 0),
        canDelete: m.memberId === you.memberId || you.role === "organiser",
      };
    });
}
