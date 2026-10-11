import type {
  ConferenceDetails,
  ConferenceRole,
  ModuleId,
  Visibility,
} from "./types";

/**
 * **What a conference module builds against.**
 *
 * The foundation owns who is in a conference and how they got there. Every
 * module — arrivals, schedule, community, plans, discover — is handed a
 * `ConferenceContext` for a member and nothing else, keys its own data on
 * `(conferenceId, memberId)`, and registers a `ConferenceLifecycle` so that
 * leaving, removal, deletion and expiry reach its data too.
 *
 * Changing this file changes every workstream's contract. Propose it; don't
 * just do it. See ARCHITECTURE.md §6.
 */

/** A conference as members see it. No access code, no invites, no ids of people. */
export interface ConferenceSummary extends ConferenceDetails {
  readonly id: string;
}

/** The person looking, as this conference knows them. */
export interface ConferenceViewer {
  readonly memberId: string;
  readonly role: ConferenceRole;
  readonly displayName: string | null;
  readonly visibility: Visibility;
}

export interface ConferenceContext {
  readonly conference: ConferenceSummary;
  readonly viewer: ConferenceViewer;
  readonly now: Date;
}

/**
 * Another member, as the viewer may know them. `displayName` is `null` when
 * that person has not chosen to be named to other members.
 */
export interface MemberRef {
  readonly memberId: string;
  readonly displayName: string | null;
}

/**
 * A place, in any module. An Atlas subject id and the name the person saw.
 * Facts — hours, address, photos — are read from Atlas when shown, never
 * copied here, and a place Atlas does not have is an Atlas gap to report,
 * not a record to invent (doctrine §15.15).
 */
export interface ConferencePlaceRef {
  readonly atlasId: string;
  readonly name: string;
}

/**
 * The promise every data-keeping module makes. Without it, "delete everything
 * about me" is a lie in whichever module forgot.
 */
export interface ConferenceLifecycle {
  readonly module: ModuleId;
  forgetMember(conferenceId: string, memberId: string): Promise<void>;
  forgetConference(conferenceId: string): Promise<void>;
}
