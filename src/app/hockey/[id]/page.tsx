import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/currentUser";
import { HockeyNightScreen } from "@/components/hockey/HockeyNightScreen";
import { loadNight } from "../_server/night";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hockey Night — Passport",
  robots: { index: false, follow: false },
};

/**
 * One night. Signed out: sign in and come straight back. Signed in but not on
 * the list: the same 404 as a night that does not exist, so an id that leaks
 * tells nobody anything — not the title, not who is going.
 */
export default async function HockeyNightPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/auth?next=${encodeURIComponent(`/hockey/${id}`)}`);
  const night = await loadNight(user, id);
  if (!night) notFound();
  return <HockeyNightScreen initial={night} />;
}
