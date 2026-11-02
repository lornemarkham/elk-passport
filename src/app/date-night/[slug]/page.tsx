import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dateNight } from "@/domain/date-night/nights";
import { DateNightInvitation } from "@/components/date-night/DateNightInvitation";
import { invitationData } from "./_server/load";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const night = dateNight((await params).slug);
  if (!night) return {};
  return {
    title: `${night.headline} — Date Night`,
    description: night.invitation,
    // A personal invitation, not a page for search engines.
    robots: { index: false, follow: false },
    openGraph: { title: night.headline, description: night.invitation },
  };
}

/**
 * **A Date Night invitation.** Open to anyone holding the link, no sign-in:
 * the invited person picks what they like, adds their own, and sends it.
 * Only the person who planned the night can read what comes back
 * (`./answers`).
 */
export default async function DateNightPage({ params }: Params) {
  const night = dateNight((await params).slug);
  if (!night) notFound();
  const data = await invitationData(night);
  return <DateNightInvitation night={night} {...data} />;
}
