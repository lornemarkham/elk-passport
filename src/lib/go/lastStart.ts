import { townById } from "@/domain/discovery/towns";

/**
 * **The town a person last chose to start a day from, on this device.**
 *
 * Only a town they tapped in "Where does the adventure begin?" — never a
 * position, never a town worked out from one without the tap, never sent
 * anywhere. It is *offered* back the next time a day has no start, as one
 * button among the others; it is not applied silently, because the person
 * may be somewhere else today (ADR 003: Passport never picks a start).
 */
export const LAST_START_KEY = "ghad.last-start";

/** The remembered town's id, if it is still a town Passport covers. */
export function readLastStart(): string | undefined {
  try {
    const id = window.localStorage.getItem(LAST_START_KEY) ?? undefined;
    return townById(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

export function writeLastStart(townId: string): void {
  if (!townById(townId)) return;
  try {
    window.localStorage.setItem(LAST_START_KEY, townId);
  } catch {
    // Private mode or full storage: it will simply be asked again.
  }
}
