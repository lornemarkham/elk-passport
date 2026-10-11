import type { ConferenceLifecycle } from "@/domain/conference/contracts";

/**
 * **Every module that keeps data about people in a conference, listed.**
 *
 * The foundation calls each one when somebody leaves or is removed, and when
 * a conference is deleted or expires. A module that stores anything keyed on
 * `(conferenceId, memberId)` registers here in the same change that starts
 * storing it. See ARCHITECTURE.md §6.2.
 *
 * Empty today: the only built module, `discover`, keeps nothing.
 */
export const LIFECYCLE: readonly ConferenceLifecycle[] = [];
