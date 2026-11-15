import { isNeed, type Need } from "./request";

/**
 * **The itinerary's address.** Every change made on a plan — the day, a
 * start time, a part dropped, added or swapped for another place — is a
 * query parameter, so the same link opens the same plan on anybody's phone
 * (Christmas's rule: the URL is the state). Small and dependency-free so the
 * browser can build the next address without loading the planner.
 */

/** Changes made on the itinerary; the URL carries them (`writeEdits`). */
export interface Edits {
  readonly day?: string;
  /** Minutes after midnight. */
  readonly start?: number;
  readonly drop?: readonly Need[];
  readonly add?: readonly Need[];
  /** A chosen place for a part: `atlas:<id>` or `map:<pin id>`. */
  readonly pick?: Readonly<Partial<Record<Need, string>>>;
  /** A start time for one stop, minutes after midnight. */
  readonly times?: Readonly<Partial<Record<Need, number>>>;
}

export function clockText(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, "0")} ${h24 >= 12 ? "PM" : "AM"}`;
}

export function durationText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

// ------------------------------------------------------------- the address

/** `drop=movie&add=coffee&pick=dinner:atlas:…&t=dinner:1800&day=…&start=1730` */
export function readEdits(
  params: Readonly<Record<string, string | string[] | undefined>>,
): Edits {
  const one = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v.join(",") : (v ?? "");
  };
  const needs = (k: string) =>
    one(k)
      .split(",")
      .map((s) => s.trim())
      .filter(isNeed);
  const clock = (s: string) => {
    const m = s.match(/^(\d{1,2}):?(\d{2})$/);
    if (!m) return undefined;
    const v = Number(m[1]) * 60 + Number(m[2]);
    return v >= 0 && v < 24 * 60 ? v : undefined;
  };
  const pick: Partial<Record<Need, string>> = {};
  for (const part of one("pick").split(",")) {
    const m = part.match(/^([a-z]+):((?:atlas|map):[A-Za-z0-9:._-]{1,120})$/);
    if (m && isNeed(m[1]!)) pick[m[1] as Need] = m[2]!;
  }
  const times: Partial<Record<Need, number>> = {};
  for (const part of one("t").split(",")) {
    const m = part.match(/^([a-z]+):(\d{1,2}:?\d{2})$/);
    const v = m ? clock(m[2]!) : undefined;
    if (m && v !== undefined && isNeed(m[1]!)) times[m[1] as Need] = v;
  }
  const day = one("day");
  const start = clock(one("start"));
  return {
    ...(/^\d{4}-\d{2}-\d{2}$/.test(day) ? { day } : {}),
    ...(start !== undefined ? { start } : {}),
    drop: needs("drop"),
    add: needs("add"),
    pick,
    times,
  };
}

const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}${String(m % 60).padStart(2, "0")}`;

export function writeEdits(e: Edits): Record<string, string> {
  const out: Record<string, string> = {};
  if (e.day) out.day = e.day;
  if (e.start !== undefined) out.start = hhmm(e.start);
  if (e.drop?.length) out.drop = e.drop.join(",");
  if (e.add?.length) out.add = e.add.join(",");
  const pick = Object.entries(e.pick ?? {}).map(([k, v]) => `${k}:${v}`);
  if (pick.length) out.pick = pick.join(",");
  const times = Object.entries(e.times ?? {}).map(
    ([k, v]) => `${k}:${hhmm(v!)}`,
  );
  if (times.length) out.t = times.join(",");
  return out;
}
