import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listDiscoveryCandidates } from "@/lib/data/atlas-repo";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { destinationFor } from "@/domain/experience/destination";
import { dayPlan } from "@/domain/day/plan";
import { DayPlanView } from "@/components/ghad/DayPlanView";
import { ThemeProvider } from "@/components/ghad/theme";
import { PassportNav } from "@/components/shell/PassportNav";
import { currentUser } from "@/lib/auth/currentUser";
import { safeNext } from "@/lib/auth/safeNext";

/**
 * **`/day/{id}` — "Let's do this", and what happens next.**
 *
 * The first vertical slice of planning. One subject, one date, one optional
 * age: the facts Atlas states about going there on that day, and the headings
 * it cannot fill. Nothing is scheduled and nothing is sequenced.
 *
 * ## Why it reads the candidate feed
 *
 * The same read Discovery itself uses, cached per age, so the plan says the
 * same things the card said. The grounding block — `candidate-knowledge/2`,
 * `candidate-occurrence/2`, `candidate-suitability/1`, `candidate-geography/2`
 * — is where the evidence this page needs actually lives, and the composed
 * subject read (`/organizations/:id/detail`) carries a different shape
 * entirely. The subject's own page is one click away for that.
 *
 * ## The age is asked of Atlas, never assumed
 *
 * `?childAge=N` is forwarded to Atlas, which answers with its own verdict for
 * that age. Without one the plan says nobody has been named — it does not
 * quietly ask about a five-year-old, which would be Passport inventing the one
 * fact this exists to carry.
 */
type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const one = (value: string | string[] | undefined): string | undefined =>
  typeof value === "string" ? value : undefined;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const metadata: Metadata = {
  title: "Your day · Go Have A Day",
};

export default async function DayPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;

  const on = DAY.test(one(query.on) ?? "") ? one(query.on) : undefined;
  const askedAge = Number(one(query.childAge));
  const childAge =
    Number.isInteger(askedAge) && askedAge >= 0 && askedAge <= 17
      ? askedAge
      : undefined;
  // Same-site only. `safeNext` refuses anything a stranger could use to send
  // somebody off the site.
  const back = safeNext(one(query.back) ?? null, "/discovery");

  const candidates = await listDiscoveryCandidates(childAge);
  const candidate = candidates.find((c) => c.id === id);
  if (!candidate) notFound();

  const experience = candidateToExperience(candidate);
  const plan = dayPlan(experience, {
    ...(on ? { on } : {}),
    ...(childAge === undefined ? {} : { childAge }),
  });

  // Atlas's own verdict on whether its description is worth printing. 255
  // candidates carry `descriptionAddsKnowledge: false` — the tautology
  // problem, answered at the source rather than guessed at here.
  const worthPrinting =
    experience.knowledge?.descriptionAddsKnowledge !== false &&
    !experience.knowledge?.descriptionCaveat;
  const description = worthPrinting
    ? experience.description || experience.shortDescription
    : undefined;

  const user = await currentUser().catch(() => null);

  return (
    <ThemeProvider>
      <PassportNav displayName={user?.displayName ?? null} />
      <main className="min-h-screen bg-white">
        <DayPlanView
          plan={plan}
          {...(description ? { description } : {})}
          {...(experience.heroMedia?.src
            ? { picture: experience.heroMedia.src }
            : {})}
          {...(experience.geography?.coordinates
            ? { coordinates: experience.geography.coordinates }
            : {})}
          entityHref={destinationFor(experience) ?? `/passport/${id}`}
          back={back}
        />
      </main>
    </ThemeProvider>
  );
}
