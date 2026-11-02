import type { Experience } from "@/domain/experience/types";
import { statedDay } from "@/domain/experience/eventTime";
import { fitOccasion, readOccasion } from "./occasion";

/**
 * **"You've already found these" — the ones that fit this adventure first.**
 *
 * Saved is the home of somebody's possibilities (ADR 012), and an adventure
 * may offer them (doctrine §15.5). It used to offer the first six, in
 * whatever order they were saved: a summer beach for a December date. This
 * orders them by what the adventure is — where, when, and the occasion its
 * days were asked for — and says why each one leads.
 *
 * Nothing is hidden for good. An event Atlas dates entirely before the
 * adventure, or one far outside its area, is set aside and counted, and
 * "Show everything you saved" still shows it (§2.4: desire is information
 * even when today can't hold it).
 */

export interface SavedPick {
  readonly experience: Experience;
  /** Why it leads, in a few words. Absent where it is only "you saved it". */
  readonly why?: string;
}

export interface SavedForAdventure {
  readonly fits: readonly SavedPick[];
  /** Saved, but not for this one — over, or far away. Still browsable. */
  readonly elsewhere: readonly SavedPick[];
}

export interface SavedContext {
  readonly said: string;
  readonly origin?: { readonly latitude: number; readonly longitude: number };
  readonly town?: string;
  readonly from?: string;
  readonly to?: string;
}

const FAR_KM = 80;

function kmTo(
  origin: { latitude: number; longitude: number },
  e: Experience,
): number | undefined {
  const c = e.geography?.coordinates;
  if (!c) return undefined;
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(c[1] - origin.latitude);
  const dLon = toRad(c[0] - origin.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(origin.latitude)) *
      Math.cos(toRad(c[1])) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** An Event's stated days, where Atlas holds them. */
function eventDays(e: Experience): { from: string; to: string } | undefined {
  if (e.kind !== "Event" || !e.startTime) return undefined;
  const from = statedDay(e.startTime, e.timePrecision);
  const to = e.endTime ? statedDay(e.endTime, e.timePrecision) : from;
  return from && to ? { from, to } : undefined;
}

export function savedForAdventure(
  saved: readonly Experience[],
  context: SavedContext,
): SavedForAdventure {
  const occasion = readOccasion(context.said);
  const scored = saved.map((experience, index) => {
    const reasons: string[] = [];
    let score = 0;
    let away = false;
    const days = eventDays(experience);
    if (days && context.from) {
      const end = context.to ?? context.from;
      if (days.to < context.from) away = true;
      else if (days.from <= end && days.to >= context.from) {
        score += 8;
        reasons.push("On during your dates");
      } else score -= 2;
    }
    const km = context.origin ? kmTo(context.origin, experience) : undefined;
    if (km !== undefined) {
      if (km > FAR_KM) away = true;
      else if (km <= 15) {
        score += 4;
        reasons.push(
          context.town
            ? `Close to ${context.town}`
            : `${Math.round(km)} km away`,
        );
      } else score += 2 * (1 - km / FAR_KM);
    } else if (
      context.town &&
      (experience.geography?.locality ?? "").toLowerCase() ===
        context.town.toLowerCase()
    ) {
      score += 3;
      reasons.push(`In ${context.town}`);
    }
    if (occasion) {
      const fit = fitOccasion(experience, occasion, {
        ...(context.from ? { on: context.from } : {}),
      });
      score += fit.score / 2;
      if (fit.score >= 5 && fit.why) reasons.push(fit.why.replace(/\.$/, ""));
      if (fit.against) score -= 4;
    }
    return { experience, index, score, away, reasons };
  });

  const pick = (s: (typeof scored)[number]): SavedPick => ({
    experience: s.experience,
    ...(s.reasons.length > 0 ? { why: s.reasons.slice(0, 2).join(" · ") } : {}),
  });
  return {
    fits: scored
      .filter((s) => !s.away)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map(pick),
    elsewhere: scored.filter((s) => s.away).map(pick),
  };
}
