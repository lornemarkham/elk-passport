import type { Experience } from "@/domain/experience/types";
import { readWhen, type WhenReading } from "./when";

/**
 * **Do this again — from today's Christmas, not last year's.**
 *
 * A finished adventure's stops are not copied blindly: an event whose dates
 * have gone (or that Atlas lists only for an earlier year) cannot be done
 * again, and carrying it into a new plan would put a fiction on a day. Each
 * stop is read against today with the same `readWhen` the Discover cards use:
 *
 * - a place, or a thing still on or coming → **kept**;
 * - dates gone, and Atlas now lists the same thing (same name) for dates that
 *   haven't passed → **swapped** for the current listing, said so;
 * - dates gone, nothing current → **left out**, said so, with why. It is not
 *   deleted from the old adventure, and the person can still add it by hand.
 *
 * Pure: the caller reads the old stops and today's finds.
 */
export interface AgainStop {
  readonly id: string;
  /** What the old plan called it; empty when nothing can name it any more. */
  readonly title: string;
  /** Atlas's possibility, when its feed still holds it (a place often isn't in it). */
  readonly experience?: Experience;
}

export interface CurrentFind {
  readonly id: string;
  readonly title: string;
  readonly when: WhenReading;
}

export interface Again {
  readonly keep: readonly { id: string; title: string }[];
  readonly swapped: readonly { from: string; to: string; id: string }[];
  readonly left: readonly { title: string; why: string }[];
  /** The earliest day a kept thing is on, never before today. */
  readonly from?: string;
}

const norm = (t: string) =>
  t
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Not on any more: the dates Atlas holds are over. */
const over = (w: WhenReading) =>
  w.confidence === "past" || w.phase === "finished";

export function planAgain(
  stops: readonly AgainStop[],
  current: readonly CurrentFind[],
  today: string,
): Again {
  const keep: { id: string; title: string }[] = [];
  const swapped: { from: string; to: string; id: string }[] = [];
  const left: { title: string; why: string }[] = [];
  const dates: string[] = [];
  const taken = new Set<string>();

  const add = (id: string, title: string, when?: WhenReading) => {
    if (taken.has(id)) return;
    taken.add(id);
    keep.push({ id, title });
    if (when?.from && when.to && when.to >= today)
      dates.push(when.from > today ? when.from : today);
  };

  for (const stop of stops) {
    const was = stop.experience ? readWhen(stop.experience, today) : undefined;
    if (!was) {
      // A place Atlas still names (it just isn't a dated possibility): no
      // dates is not closed, so it stays. Nothing names it: an ended event
      // leaves Discovery's pool, so look for it listed again, else say so.
      if (stop.title) {
        add(stop.id, stop.title);
        continue;
      }
      left.push({
        title: "A stop Atlas no longer lists",
        why: "It isn't in Atlas any more, so we can't say it's on this year.",
      });
      continue;
    }
    if (!over(was)) {
      add(stop.id, stop.title, was);
      continue;
    }
    const again = current.find(
      (f) =>
        f.id !== stop.id && norm(f.title) === norm(stop.title) && !over(f.when),
    );
    if (again) {
      swapped.push({ from: stop.title, to: again.title, id: again.id });
      add(again.id, again.title, again.when);
    } else
      left.push({
        title: stop.title,
        why: was.line
          ? `Its dates (${was.line}) have gone and nothing newer is listed.`
          : "Its dates have gone and nothing newer is listed.",
      });
  }
  const from = dates.sort()[0];
  return { keep, swapped, left, ...(from ? { from } : {}) };
}
