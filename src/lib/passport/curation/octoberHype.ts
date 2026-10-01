/**
 * **October's editorial opinion about what deserves attention.**
 *
 * This is the admin surface for Hype, and it is a file on purpose. A CMS for
 * six entries is a CMS nobody asked for; an editor changes October's mind by
 * editing this map and the change is a reviewable diff rather than a row
 * somebody altered at midnight.
 *
 * ## This is taste, and it is labelled as taste
 *
 * Nothing here is a fact about the world and none of it belongs in Atlas.
 * Atlas says a meteor shower runs from the 6th to the 10th; *this* says
 * October finds it worth clearing an evening for. Putting `isHype: true` on
 * an Atlas entity would be asserting an objective property that does not
 * exist — see the workspace constitution on Atlas owning truth and Passport
 * owning composition.
 *
 * ## How an admin changes it
 *
 * Add or edit a line. The key is the Atlas entity id, the value is the
 * intensity, and a short note says why — the note is for whoever reads this
 * next, never for a user.
 *
 * Context can still raise or lower what is *expressed*: a clear sky lets the
 * Draconids reach a takeover, and a rained-out night pulls them back to
 * nothing at all. Editorial sets the ceiling; the world decides what is used.
 */
import type { HypeLevel } from "@/domain/october/hype";

export interface EditorialHype {
  readonly level: HypeLevel;
  /** Why an editor set this. Internal; never rendered. */
  readonly note: string;
}

export const OCTOBER_EDITORIAL_HYPE: Record<string, EditorialHype> = {
  // The Draconids. A five-night window, a near-new moon, and a radiant that
  // is highest in the evening rather than at three in the morning.
  "ddf146c6-7117-4520-a9fe-8326209fd5db": {
    level: 4,
    note: "Rare short window, evening radiant, dark sky this year. Earns the sky.",
  },
  // FrightCrawl. Thirty-seven photographs, three nights, and the only thing
  // in the corpus that is explicitly a Halloween-night crawl.
  "feacf882-a98f-4803-9ef6-70f488f00472": {
    level: 3,
    note: "Media-rich and squarely Halloween. Warrants a livelier card.",
  },
  // Field of Screams. Thin media, but it is the valley's main haunt and a
  // plain row does it no favours.
  "exp-field-of-screams-okeefe-ranch": {
    level: 2,
    note: "The valley's flagship haunt. Treatment has to carry it; media will not.",
  },
};

export const editorialHypeFor = (entityId: string): EditorialHype | undefined =>
  OCTOBER_EDITORIAL_HYPE[entityId];
