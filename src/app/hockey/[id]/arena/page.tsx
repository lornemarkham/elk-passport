import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/currentUser";
import { ArenaMode } from "@/components/hockey/arena/ArenaMode";
import { arenaFor } from "../../_server/arena";
import { NightError } from "../../_server/night";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Arena Mode — Hockey Night",
  robots: { index: false, follow: false },
};

/**
 * Arena Mode for one night. Same door as the night itself: signed out, sign
 * in and come straight back; not on the list, the same 404 as a night that
 * does not exist.
 */
export default async function ArenaModePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();
  if (!user)
    redirect(`/auth?next=${encodeURIComponent(`/hockey/${id}/arena`)}`);
  const view = await arenaFor(user, id).catch((error: unknown) => {
    if (error instanceof NightError && error.status === 404) return null;
    throw error;
  });
  if (!view) notFound();
  return <ArenaMode initial={view} />;
}
