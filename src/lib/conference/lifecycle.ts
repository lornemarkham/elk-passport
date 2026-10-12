import type { ConferenceLifecycle } from "@/domain/conference/contracts";
import { arrivalsLifecycle } from "@/lib/conference-arrivals/service";
import { arrivalsStore } from "@/lib/conference-arrivals/store";

/**
 * **Every module that keeps data about people in a conference, listed.**
 *
 * The foundation calls each one when somebody leaves or is removed, and when
 * a conference is deleted or expires. A module that stores anything keyed on
 * `(conferenceId, memberId)` registers here in the same change that starts
 * storing it. See ARCHITECTURE.md §6.2.
 *
 * `discover` keeps nothing. `arrivals` keeps each member's flight.
 */
export const LIFECYCLE: readonly ConferenceLifecycle[] = [
  arrivalsLifecycle(arrivalsStore),
];
