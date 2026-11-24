import type { Experience } from "@/domain/experience/types";
import { subjectHref } from "@/domain/experience/destination";
import { readChristmas, themeById } from "./themes";
import { readWhen, type Confidence, type Phase } from "./when";

/**
 * **The Christmas things a person saved, as My Christmas List shows them.**
 *
 * Saving is Passport's one collection (Atlas boards). My Christmas List does
 * not keep a second one: it reads what the person saved — their ideas, every
 * board they own — and shows the Christmas ones, in Atlas's words (`themes`)
 * and with Atlas's dates (`when`). A thing whose dates have gone is **kept and
 * said so** (doctrine §2.4: wanting it is still true), but it is not offered
 * to a plan as if it were on this year.
 */
export interface SavedFind {
  readonly id: string;
  readonly title: string;
  readonly emoji: string;
  readonly href: string;
  readonly confidence: Confidence;
  readonly phase?: Phase;
  /** What the card prints: Atlas's dates, or the organiser's words. */
  readonly line?: string;
  /** Dates gone: kept, shown apart, not carried into a plan. */
  readonly over: boolean;
}

export function savedChristmas(
  ideas: readonly Experience[],
  today: string,
): SavedFind[] {
  const seen = new Set<string>();
  const out: SavedFind[] = [];
  for (const e of ideas) {
    if (seen.has(e.id)) continue;
    const reading = readChristmas(e);
    if (!reading?.christmas) continue;
    seen.add(e.id);
    const when = readWhen(e, today);
    out.push({
      id: e.id,
      title: e.title,
      emoji: reading.themes[0] ? themeById(reading.themes[0]).emoji : "🎄",
      href: subjectHref(e.kind, e.id),
      confidence: when.confidence,
      ...(when.phase ? { phase: when.phase } : {}),
      ...(when.line ? { line: when.line } : {}),
      over: when.confidence === "past" || when.phase === "finished",
    });
  }
  // What can still happen leads; what has gone follows.
  return out.sort((a, b) => Number(a.over) - Number(b.over));
}
