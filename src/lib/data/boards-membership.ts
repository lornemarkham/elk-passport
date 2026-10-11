import type { BoardRole } from "@/lib/collaboration/boardAccess";

/**
 * **Leaving is always yours to do. Removing somebody is the owner's.**
 *
 * Joining a board is voluntary — somebody has to follow a link and press
 * *Join* — so staying on one has to be voluntary too. Until now a member had no
 * way off a board short of asking the owner, which made every share link a
 * door that only opened inwards.
 *
 * One route answers both, because they are the same row going away:
 *
 * ```
 * you, on yourself     leave        any member except the owner
 * owner, on somebody   remove       never the owner themselves
 * anybody else         refused
 * ```
 *
 * An owner cannot leave. A board with no owner is one nobody can ever share,
 * rename or delete again; the owner's way out is deleting it.
 */
export type MemberRemoval =
  | { readonly kind: "leave" }
  | { readonly kind: "remove" }
  | {
      readonly kind: "refuse";
      readonly status: 400 | 403;
      readonly error: string;
    };

export function decideRemoval(
  actor: { readonly id: string; readonly role: BoardRole },
  ownerId: string,
  targetId: string,
): MemberRemoval {
  if (targetId === actor.id) {
    return actor.role === "owner"
      ? {
          kind: "refuse",
          status: 400,
          error:
            "A board keeps its owner. Delete the board if you want it gone.",
        }
      : { kind: "leave" };
  }

  if (actor.role !== "owner") {
    return {
      kind: "refuse",
      status: 403,
      error: "Only the board's owner can change who is on it.",
    };
  }

  if (targetId === ownerId) {
    return { kind: "refuse", status: 400, error: "A board keeps its owner." };
  }

  return { kind: "remove" };
}
