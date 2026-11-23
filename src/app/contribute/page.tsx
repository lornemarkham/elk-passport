import type { Metadata } from "next";
import Link from "next/link";
import { SuggestForm } from "@/components/contributions/SuggestSomething";
import { MyContributions } from "@/components/contributions/MyContributions";
import { EXPERIENCE_RE, experienceLabel } from "@/domain/contributions/model";

export const metadata: Metadata = {
  title: "Suggest something — Passport",
  description:
    "Know a place, event, market or display Passport is missing? Tell us in under a minute. No account needed.",
};

/**
 * **Suggest something, as a page**: the same form the "+ Suggest something"
 * button opens, for a link someone sends on ("add it here"), plus the
 * person's own progress toward the shared milestones. `?from=` names the
 * experience the link came from.
 */
export default async function ContributePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const experience =
    from && EXPERIENCE_RE.test(from.toLowerCase())
      ? from.toLowerCase()
      : "gohaveaday";
  return (
    <main className="mx-auto max-w-lg px-4 pt-8 pb-24 text-[#111] sm:px-6">
      <p className="text-[11px] font-bold tracking-[0.16em] text-black/55 uppercase">
        {experienceLabel(experience)} · Community
      </p>
      <h1 className="ghad-display mt-1 text-4xl font-extrabold tracking-[-0.02em]">
        Know something we&apos;re missing?
      </h1>
      <p className="mt-2 text-black/70">
        A restaurant, a market, an event, a trail, a lights display — if it
        should be on Passport, tell us. It takes under a minute and needs no
        account. We check everything before it&apos;s published.
      </p>
      <div className="mt-4 rounded-[28px] bg-[#fbf8f2] p-5 ring-1 ring-black/10">
        <SuggestForm experience={experience} moreHref="/local/share" />
      </div>
      <section className="mt-8">
        <h2 className="ghad-display text-2xl font-extrabold">
          Your contributions
        </h2>
        <p className="mt-1 text-sm text-black/60">
          Milestones count approved contributions across every Passport
          experience: 1 First Discovery · 5 Local Explorer · 10 Community Scout
          · 25 Discovery Champion · 50 Local Legend.
        </p>
        <div className="mt-3">
          <MyContributions />
        </div>
      </section>
      <p className="mt-8 text-sm">
        <Link href="/discovery" className="font-bold underline">
          ← Go Have a Day
        </Link>
      </p>
    </main>
  );
}
