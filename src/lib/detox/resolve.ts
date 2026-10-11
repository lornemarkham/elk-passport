import { listDiscoveryCandidates } from "@/lib/data/atlas-repo";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { readBrief } from "@/domain/day/brief";
import { buildDay } from "@/domain/day/build";
import { townById } from "@/domain/discovery/towns";
import { snapshotDay, type OfflineDay } from "./day";

/**
 * **The printed day, recovered from the same query `/go/print` reads.**
 *
 * This deliberately mirrors `src/app/go/print/page.tsx` line for line, so the
 * stops kept on the phone are the stops on the paper. It is a copy rather than
 * a shared import because `/go/print` is where three lanes currently conflict
 * (daybuilder, analog, maps) and this lane is told to stay clear of it. When
 * those merge, both should call one resolver — named in `README.md`.
 */
export type ResolvedDay =
  | { readonly kind: "none" }
  | { readonly kind: "day"; readonly day: OfflineDay }
  | { readonly kind: "unreachable" };

const one = (v: string | string[] | undefined) =>
  typeof v === "string" ? v : undefined;

export async function resolveDay(
  query: Record<string, string | string[] | undefined>,
  print: string,
): Promise<ResolvedDay> {
  const ids = (one(query.stops) ?? "").split(",").filter(Boolean);
  if (ids.length === 0) return { kind: "none" };

  const askedAge = Number(one(query.age));
  const childAge =
    Number.isInteger(askedAge) && askedAge >= 0 && askedAge <= 17
      ? askedAge
      : undefined;

  let candidates;
  try {
    candidates = await listDiscoveryCandidates(childAge);
  } catch {
    // Atlas is unreachable. The paper already has the day; this page says so
    // rather than pretending there was nothing to keep.
    return { kind: "unreachable" };
  }
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const chosen = ids
    .map((id) => byId.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map(candidateToExperience);

  const hours = Number(one(query.hours));
  const town = townById(one(query.at));
  const on = one(query.on);
  const brief = readBrief(one(query.say) ?? "", {
    ...(Number.isFinite(hours) ? { hours } : {}),
    ...(childAge !== undefined ? { childAge } : {}),
    ...(town ? { town } : {}),
    ...(on ? { on } : {}),
  });

  const day = snapshotDay(buildDay({ pool: chosen, brief }), print);
  return day ? { kind: "day", day } : { kind: "none" };
}
