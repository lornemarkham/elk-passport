import type { Adventure } from "./contracts";

/**
 * **The `/go/print` hand-off, typed once.**
 *
 * The query is the one `printQuery` in `src/components/go/GoHaveADay.tsx`
 * already writes and `src/app/go/print/page.tsx` already reads —
 * `stops, say, hours, age, at, on`, in that order — so adopting this changes
 * no URL anybody has printed from. Neither file uses it yet; that is
 * integration work (see the lane report).
 *
 * The URL carries ids, not the day: the print page re-resolves them against
 * Atlas so the paper says what Atlas says *now*. What the URL cannot carry,
 * it drops, and `printLosses` names it rather than letting it vanish.
 */
export interface PrintRequest {
  /** Subject ids, in the order they will be done. */
  readonly stopIds: readonly string[];
  readonly said: string;
  readonly hours?: number;
  readonly childAge?: number;
  /** A `DiscoveryTown` id. */
  readonly townId?: string;
  /** `YYYY-MM-DD`. */
  readonly on?: string;
}

const firstChildAge = (adventure: Adventure): number | undefined =>
  adventure.constraints.party.companions.find(
    (c) => c.role === "child" && c.age !== undefined,
  )?.age;

export function printRequestFor(adventure: Adventure): PrintRequest {
  const { time, origin } = adventure.constraints;
  const childAge = firstChildAge(adventure);
  return {
    stopIds: adventure.moments.flatMap((m) =>
      m.kind === "subject" ? [m.subject.id] : [],
    ),
    said: adventure.said,
    ...(time.hours !== undefined ? { hours: time.hours } : {}),
    ...(childAge !== undefined ? { childAge } : {}),
    ...(origin?.townId ? { townId: origin.townId } : {}),
    ...(time.on ? { on: time.on } : {}),
  };
}

/** Byte-for-byte what `printQuery` writes for the same day. */
export function printQuery(request: PrintRequest): string {
  const params = new URLSearchParams();
  params.set("stops", request.stopIds.join(","));
  params.set("say", request.said);
  if (request.hours !== undefined) params.set("hours", String(request.hours));
  if (request.childAge !== undefined)
    params.set("age", String(request.childAge));
  if (request.townId) params.set("at", request.townId);
  if (request.on) params.set("on", request.on);
  return params.toString();
}

/** What a printed adventure loses on the way through the URL. */
export function printLosses(adventure: Adventure): string[] {
  const losses: string[] = [];
  const free = adventure.moments.filter((m) => m.kind === "free");
  if (free.length > 0) {
    losses.push(
      `Time kept free (${free.map((m) => m.label).join(", ")}) has no Atlas id and is not printed.`,
    );
  }
  const children = adventure.constraints.party.companions.filter(
    (c) => c.role === "child" && c.age !== undefined,
  );
  if (children.length > 1) {
    losses.push("Only the first child's age is carried to the print.");
  }
  const { time, budget, origin, withinKm } = adventure.constraints;
  if (time.startAt || time.homeBy) {
    losses.push("Leaving and home-by times are not carried to the print.");
  }
  if (origin && !origin.townId) {
    losses.push(`"${origin.name}" is not a known town and is not carried.`);
  }
  // Budget and radius survive only inside `say`, if the person typed them.
  if (budget || withinKm !== undefined) {
    losses.push(
      "Budget and distance limits travel only in the sentence as typed.",
    );
  }
  return losses;
}

type Query =
  URLSearchParams | Readonly<Record<string, string | string[] | undefined>>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Read the hand-off back. Anything malformed is dropped, never coerced — the
 * same rules the print page applies today, plus a date that must look like
 * one and hours that must be a real span.
 */
export function readPrintQuery(query: Query): PrintRequest {
  const get = (key: string): string | undefined => {
    if (query instanceof URLSearchParams) return query.get(key) ?? undefined;
    const v = query[key];
    return typeof v === "string" ? v : undefined;
  };
  const stopIds = (get("stops") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const age = Number(get("age"));
  const hours = Number(get("hours"));
  const townId = get("at");
  const on = get("on");
  return {
    stopIds,
    said: get("say") ?? "",
    ...(get("hours") && Number.isFinite(hours) && hours > 0 && hours <= 24
      ? { hours }
      : {}),
    ...(get("age") && Number.isInteger(age) && age >= 0 && age <= 17
      ? { childAge: age }
      : {}),
    ...(townId ? { townId } : {}),
    ...(on && DATE.test(on) ? { on } : {}),
  };
}
