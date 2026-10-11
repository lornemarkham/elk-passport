import type { Metadata } from "next";
import { listDiscoveryCandidates } from "@/lib/data/atlas-repo";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { readBrief } from "@/domain/day/brief";
import { uncarryBrief } from "@/domain/day/carry";
import { buildDay } from "@/domain/day/build";
import { AnalogGuide } from "@/components/go/AnalogGuide";
import { townById } from "@/domain/discovery/towns";

export const metadata: Metadata = {
  title: "Your adventure — Go have a day",
};

/**
 * **`/go/print` — the thing you fold and put in the truck.**
 *
 * `ANALOG_PHILOSOPHY` in the Idea Atlas has been sitting in this repository
 * as a list of instructions nobody could follow: *print it, fold it, put it
 * in the truck. Use a real paper map. Circle things. Write notes. Go
 * somewhere with no cell service.* This is the page that makes that possible.
 *
 * ## It renders the day that was on screen, not a fresh one
 *
 * The stops arrive as **ids** in `?stops=`, and the builder is re-run only to
 * recover the reasons and the notes — then the order and membership from the
 * URL win. Re-planning here could hand somebody a different afternoon between
 * pressing print and the paper coming out, which is a small betrayal and a
 * completely avoidable one.
 *
 * ## No live connection is assumed past this point
 *
 * Everything needed is on the paper: addresses, the towns, straight-line
 * distances, what is published about hours and prices, what is not, the rules
 * worth knowing, and a map link for the drive **before** you leave. Nothing
 * on the guide requires a phone once it is printed, which is the entire idea.
 */
type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const one = (v: string | string[] | undefined) =>
  typeof v === "string" ? v : undefined;

export default async function PrintPage({ searchParams }: Props) {
  const query = (await searchParams) ?? {};
  const ids = (one(query.stops) ?? "").split(",").filter(Boolean);
  const askedAge = Number(one(query.age));
  const childAge =
    Number.isInteger(askedAge) && askedAge >= 0 && askedAge <= 17
      ? askedAge
      : undefined;

  const candidates = await listDiscoveryCandidates(childAge);
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const chosen = ids
    .map((id) => byId.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map(candidateToExperience);

  // The time set by hand and the rain plans shown on screen, replayed rather
  // than re-chosen — `stopId:minutes` and `stopId~alternativeId`.
  const minutes = Object.fromEntries(
    (one(query.mins) ?? "")
      .split(",")
      .map((pair) => pair.split(":"))
      .filter(([id, m]) => id && ids.includes(id) && Number(m) > 0)
      .map(([id, m]) => [id!, Number(m)]),
  );
  const rainPlans = Object.fromEntries(
    (one(query.rain) ?? "")
      .split(",")
      .map((pair) => pair.split("~"))
      .filter(([id, alt]) => id && alt && ids.includes(id) && byId.has(alt))
      .map(([id, alt]) => [id!, alt!]),
  );
  const shelters = Object.values(rainPlans).map((alt) =>
    candidateToExperience(byId.get(alt)!),
  );

  const hours = Number(one(query.hours));
  const read = readBrief(one(query.say) ?? "", {
    ...(Number.isFinite(hours) ? { hours } : {}),
    ...(childAge !== undefined ? { childAge } : {}),
    ...(townById(one(query.at)) ? { town: townById(one(query.at))! } : {}),
    ...(one(query.on) ? { on: one(query.on)! } : {}),
  });
  // What a revision changed on screen, laid over the re-read sentence.
  const brief = { ...read, ...uncarryBrief(one(query.b)) };

  // Re-run over exactly the chosen subjects: the builder is what knows how to
  // say why a stop is there and what its rules are, and running it over this
  // pool alone cannot change which places are on the paper.
  const day = buildDay({
    pool: [...chosen, ...shelters],
    brief,
    keep: ids,
    order: ids,
    count: Math.max(1, chosen.length),
    minutes,
    rainPlans,
  });

  return <AnalogGuide day={day} />;
}
