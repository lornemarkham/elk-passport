import { inviteState, type InviteState } from "./access";
import type {
  ConferenceSummary,
  ConferenceViewer,
  MemberRef,
} from "./contracts";
import type { Conference, Invite, Membership, Visibility } from "./types";

/**
 * **What each person is allowed to see. Privacy lives here.**
 *
 * ```
 * a member      the conference, themselves, how many are in, and the names of
 *               people who chose `members` visibility. No access code, no
 *               links, no hidden people, no identity keys.
 * an organiser  all of that, plus the code, the links, and everyone who has
 *               joined — hidden people included, marked hidden, because an
 *               organiser has to be able to remove somebody they can't see.
 * anyone else   nothing. The service answers "not found".
 * ```
 *
 * Whether organisers should see hidden members is open (ROADMAP decision D4).
 * It is written as one line below so that changing the answer is one line.
 */

export const summaryOf = (c: Conference): ConferenceSummary => ({
  id: c.id,
  ...c.details,
});

export const viewerOf = (m: Membership): ConferenceViewer => ({
  memberId: m.memberId,
  role: m.role,
  displayName: m.displayName,
  visibility: m.visibility,
});

export interface MemberHome {
  readonly conference: ConferenceSummary;
  readonly you: ConferenceViewer;
  readonly people: {
    /** Everyone in it, you included. A count names nobody. */
    readonly total: number;
    /** Other members who chose to be seen, by the name they chose. */
    readonly visible: readonly MemberRef[];
  };
}

export function memberHome(
  conference: Conference,
  memberships: readonly Membership[],
  you: Membership,
): MemberHome {
  const visible = memberships
    .filter(
      (m) =>
        m.memberId !== you.memberId &&
        m.visibility === "members" &&
        m.displayName,
    )
    .sort((a, b) => a.displayName!.localeCompare(b.displayName!))
    .map((m) => ({ memberId: m.memberId, displayName: m.displayName }));
  return {
    conference: summaryOf(conference),
    you: viewerOf(you),
    people: { total: memberships.length, visible },
  };
}

export interface OrganiserMember {
  readonly memberId: string;
  readonly displayName: string | null;
  readonly role: Membership["role"];
  readonly visibility: Visibility;
  readonly joinedAt: string;
  readonly via: Membership["via"];
  readonly isYou: boolean;
}

export interface OrganiserInvite {
  readonly token: string;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly maxUses: number | null;
  readonly uses: number;
  readonly state: InviteState;
}

export interface OrganiserView extends MemberHome {
  readonly accessCode: string | null;
  readonly invites: readonly OrganiserInvite[];
  readonly members: readonly OrganiserMember[];
}

/** D4: organisers see hidden members. Flip here if that answer changes. */
const ORGANISERS_SEE_HIDDEN = true;

export function organiserView(
  conference: Conference,
  memberships: readonly Membership[],
  invites: readonly Invite[],
  you: Membership,
  now: Date,
): OrganiserView {
  return {
    ...memberHome(conference, memberships, you),
    accessCode: conference.accessCode,
    invites: invites
      .filter((i) => !i.revokedAt)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((i) => ({
        token: i.token,
        createdAt: i.createdAt,
        expiresAt: i.expiresAt,
        maxUses: i.maxUses,
        uses: i.uses,
        state: inviteState(i, now),
      })),
    members: memberships
      .filter(
        (m) =>
          ORGANISERS_SEE_HIDDEN ||
          m.visibility === "members" ||
          m.memberId === you.memberId,
      )
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
      .map((m) => ({
        memberId: m.memberId,
        displayName: m.displayName,
        role: m.role,
        visibility: m.visibility,
        joinedAt: m.joinedAt,
        via: m.via,
        isYou: m.memberId === you.memberId,
      })),
  };
}
