import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NightDay } from "@/domain/date-night/adventures";
import { instantOf } from "@/domain/date-night/adventures/itinerary";
import {
  addItem,
  adventureFor,
  Refused,
  removeItem,
  updateAdventure,
  updateItem,
} from "@/lib/adventures/store";
import { ATLAS_REF } from "@/lib/adventures/rules";

/**
 * **Saving the night's one itinerary** (`itinerary.ts`): the whole list,
 * written as the adventure's own day — one item per stop, in order, with its
 * time. Stops the page knew about and left out are removed; anything that
 * arrived meanwhile (the other person's stop) is left alone. The adventure's
 * name for the choice (`destinationLabel`) and its day travel with it.
 * Runs as the signed-in person: Postgres decides they may (the owner).
 */

type Db = SupabaseClient;

export interface PlanWrite {
  readonly label: string;
  readonly stops: readonly {
    readonly id?: string;
    readonly title: string;
    readonly line: string;
    readonly at: number;
    readonly atlasRef?: string;
  }[];
  /** The item ids the page was showing, so only those may be removed. */
  readonly base: readonly string[];
}

const ID = /^[0-9a-f-]{36}$/i;

export function parsePlan(body: unknown): PlanWrite | string {
  const b = body as Partial<Record<keyof PlanWrite, unknown>> | null;
  if (
    !b ||
    typeof b.label !== "string" ||
    !b.label.trim() ||
    b.label.length > 120
  )
    return "Which adventure?";
  if (!Array.isArray(b.stops) || b.stops.length === 0 || b.stops.length > 24)
    return "A plan has between one and 24 stops.";
  const stops: PlanWrite["stops"][number][] = [];
  for (const raw of b.stops as unknown[]) {
    const s = raw as Record<string, unknown>;
    if (
      typeof s.title !== "string" ||
      !s.title.trim() ||
      s.title.length > 120 ||
      typeof s.line !== "string" ||
      s.line.length > 1000 ||
      typeof s.at !== "number" ||
      !Number.isInteger(s.at) ||
      s.at < 0 ||
      s.at > 30 * 60 ||
      (s.id !== undefined && (typeof s.id !== "string" || !ID.test(s.id))) ||
      (s.atlasRef !== undefined &&
        (typeof s.atlasRef !== "string" || !ATLAS_REF.test(s.atlasRef)))
    )
      return "One of those stops isn't a stop.";
    stops.push({
      ...(s.id ? { id: s.id as string } : {}),
      title: s.title.trim(),
      line: s.line,
      at: s.at,
      ...(s.atlasRef ? { atlasRef: s.atlasRef as string } : {}),
    });
  }
  const base = Array.isArray(b.base)
    ? (b.base as unknown[]).filter(
        (x): x is string => typeof x === "string" && ID.test(x),
      )
    : [];
  return { label: b.label.trim(), stops, base };
}

export async function savePlan(
  db: Db,
  id: string,
  me: string,
  day: NightDay,
  plan: PlanWrite,
): Promise<void> {
  const view = await adventureFor(db, id, me);
  if (!view || view.role !== "owner") throw new Refused();
  await updateAdventure(db, id, {
    startsOn: day.on,
    endsOn: null,
    timeZone: day.timeZone,
    destinationTownId: day.townId,
    destinationLabel: plan.label,
  });
  const onDay = new Map(
    view.items.filter((i) => i.onDay === day.on).map((i) => [i.id, i]),
  );
  const kept = new Set<string>();
  for (const [position, stop] of plan.stops.entries()) {
    const fields = {
      label: stop.title,
      note: stop.line || null,
      atlasRef: stop.atlasRef ?? null,
      startsAt: instantOf(day, stop.at),
    };
    if (stop.id && onDay.has(stop.id)) {
      kept.add(stop.id);
      await updateItem(db, id, stop.id, { ...fields, position });
    } else {
      await addItem(db, id, me, {
        ...fields,
        status: "confirmed",
        onDay: day.on,
      }).then((itemId) => updateItem(db, id, itemId, { position }));
    }
  }
  for (const gone of plan.base)
    if (onDay.has(gone) && !kept.has(gone)) await removeItem(db, id, gone);
}
