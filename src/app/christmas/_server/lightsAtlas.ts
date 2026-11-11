import "server-only";
import { christmasFinds } from "./corpus";
import { DEFAULT_KM } from "@/domain/christmas/discover";
import { inArea } from "@/domain/christmas/lights/model";
import { CONFIDENCE_LABEL } from "@/domain/christmas/when";
import { subjectHref } from "@/domain/experience/destination";

/** A Christmas thing Atlas holds, with a point Atlas states, inside the map. */
export interface FestiveStop {
  readonly id: string;
  readonly name: string;
  readonly at: { readonly lat: number; readonly lng: number };
  readonly line: string;
  readonly href: string;
  readonly theme: string;
  readonly emoji: string;
}

const THEME_EMOJI: Record<string, string> = {
  markets: "🛍️",
  lights: "✨",
  santa: "🎅",
  festivals: "🎉",
  shows: "🎭",
  food: "☕",
  winter: "⛸️",
};

/**
 * **Markets, Santa and festive food from Atlas**, for the map and the tour —
 * only where Atlas states a coordinate inside the five towns' box and its
 * dates are not last year's. Passport places nothing itself.
 */
export async function festiveStops(today: string): Promise<{
  stops: FestiveStop[];
  outage: boolean;
}> {
  const { finds, outage } = await christmasFinds(
    { km: DEFAULT_KM, ages: [] },
    today,
  );
  const stops: FestiveStop[] = [];
  for (const f of finds) {
    if (!f.reading.christmas || f.when.confidence === "past") continue;
    const e = f.experience;
    const c = e.geography?.coordinates;
    const lng = c?.[0] ?? e.location?.longitude;
    const lat = c?.[1] ?? e.location?.latitude;
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    const at = { lat, lng };
    if (!inArea(at)) continue;
    stops.push({
      id: `atlas:${e.id}`,
      name: e.title,
      at,
      line: [f.when.line, CONFIDENCE_LABEL[f.when.confidence]]
        .filter(Boolean)
        .join(" · "),
      href: subjectHref(e.kind, e.id),
      theme: f.reading.themes[0] ?? "markets",
      emoji: THEME_EMOJI[f.reading.themes[0] ?? ""] ?? "🎁",
    });
  }
  return { stops, outage: !!outage };
}
