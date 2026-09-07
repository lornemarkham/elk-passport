import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findFixture, FIXTURES } from "@/experience-lab/fixtures";
import { ExperienceScreen } from "@/experience-lab/ui/ExperienceScreen";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return FIXTURES.map((fixture) => ({ slug: fixture.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const fixture = findFixture(slug);
  return {
    title: fixture ? `${fixture.title} — Passport` : "Experience Lab",
    description: fixture?.subtitle,
    robots: { index: false, follow: false },
  };
}

export default async function ExperienceLabPage({ params }: Props) {
  const { slug } = await params;
  const fixture = findFixture(slug);
  if (!fixture) notFound();
  return <ExperienceScreen definition={fixture} />;
}
