import type { ConferenceLifecycle } from "@/domain/conference/contracts";
import { arrivalsLifecycle } from "@/lib/conference-arrivals/service";
import { arrivalsStore } from "@/lib/conference-arrivals/store";
import { chatLifecycle } from "@/lib/conference-chat/service";
import { chatStore } from "@/lib/conference-chat/store";
import { memoriesLifecycle } from "@/lib/conference-memories/service";
import { memoriesStore } from "@/lib/conference-memories/store";
import { peopleLifecycle } from "@/lib/conference-people/service";
import { peopleStore } from "@/lib/conference-people/store";
import { plansLifecycle } from "@/lib/conference-plans/service";
import { plansStore } from "@/lib/conference-plans/store";

/**
 * **Every module that keeps data about people in a conference, listed.**
 *
 * The foundation calls each one when somebody leaves or is removed, and when
 * a conference is deleted or expires. A module that stores anything keyed on
 * `(conferenceId, memberId)` registers here in the same change that starts
 * storing it. See ARCHITECTURE.md §6.2.
 *
 * `discover` keeps nothing. `arrivals` keeps each member's flight; `plans`,
 * `community`, `people` and `memories` keep plans and answers, messages,
 * shared positions and photos. On the durable store the database cascades
 * the same erasures, so these are belt and braces there.
 */
export const LIFECYCLE: readonly ConferenceLifecycle[] = [
  arrivalsLifecycle(arrivalsStore),
  plansLifecycle(plansStore),
  chatLifecycle(chatStore),
  peopleLifecycle(peopleStore),
  memoriesLifecycle(memoriesStore),
];
