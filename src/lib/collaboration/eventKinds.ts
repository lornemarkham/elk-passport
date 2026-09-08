/**
 * **The shared vocabulary of "something changed", readable from anywhere.**
 *
 * Deliberately free of `server-only`: the writer runs on the server, the
 * subscriber runs in a browser — and later in a native or voice client — and
 * both have to agree on these strings. Keeping them in the same module as
 * `recordEvent` meant a client component importing one constant pulled a
 * server module into its bundle, which Next correctly refused to build.
 *
 * A shape both ends share belongs in a file neither end owns.
 */
export type PassportResourceType = "board";

export interface PassportEvent {
  readonly id: number;
  readonly resourceType: PassportResourceType;
  readonly resourceId: string;
  readonly actorId: string | null;
  readonly kind: string;
  readonly payload: Record<string, unknown>;
  readonly createdAt: string;
}

/** The channel name the writer and the subscriber must agree on. */
export const channelFor = (
  resourceType: PassportResourceType,
  resourceId: string,
): string => `passport:${resourceType}:${resourceId}`;

/** Kinds Passport Core itself emits. An Experience may define its own. */
export const CORE_EVENT_KINDS = {
  itemAdded: "item-added",
  itemRemoved: "item-removed",
  boardRenamed: "board-renamed",
  memberJoined: "member-joined",
  memberRemoved: "member-removed",
} as const;
