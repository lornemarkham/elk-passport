import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PassportNav } from "@/components/shell/PassportNav";
import { NightBoard } from "@/components/night/NightBoard";
import { adventureSession } from "@/lib/adventures/server";
import {
  adventureFor,
  invitesOf,
  type AdventureView,
  type InviteView,
} from "@/lib/adventures/store";
import { atlasStopsFor } from "@/lib/adventures/atlas-names";
import { nightForTitle } from "@/domain/date-night/adventures";
import { packingOf, type PackingView } from "@/lib/date-night/night";
import { momentsOf, sharingOn } from "@/app/christmas/_server/together";
import type { Moment } from "@/domain/christmas/recap";

export const metadata: Metadata = {
  title: "The Markham Adventure ❤️",
  robots: { index: false },
};

/**
 * **A Date Night** — the core's adventure (members, invitations, ideas, the
 * vote) composed for two: ideas as cards, a plan read from the votes, a
 * shared packing list, and memories afterwards. Nothing here is public: it
 * is members-only by the database, and the page is `noindex`.
 */
export default async function NightPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await adventureSession();

  let view: AdventureView | null = null;
  let invites: InviteView[] = [];
  let failed = false;
  if (session) {
    try {
      view = await adventureFor(session.db, id, session.user.id);
      if (view?.role === "owner") invites = await invitesOf(session.db, id);
    } catch {
      failed = true;
    }
  }
  if (view && view.kind !== "date-night-plan")
    redirect(`/adventures/${encodeURIComponent(id)}`);

  if (!session || !view) {
    return (
      <>
        <PassportNav displayName={session?.user.displayName ?? null} />
        <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
          <p className="text-4xl">🧭</p>
          <h1 className="text-2xl font-bold">
            {failed
              ? "Couldn't open this just now"
              : !session
                ? "Sign in to open it"
                : "This adventure isn't yours to see"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {failed
              ? "Please try again in a moment."
              : !session
                ? "It's private to the two of you."
                : "It doesn't exist, or you aren't part of it. Ask for a new invitation."}
          </p>
          <Link
            href={
              !session
                ? `/auth?next=${encodeURIComponent(`/night/${id}`)}`
                : "/"
            }
            className="bg-primary text-primary-foreground rounded-full px-5 py-2.5 text-sm font-medium"
          >
            {!session ? "Sign in" : "Back to Passport"}
          </Link>
        </main>
      </>
    );
  }

  const db = session.db;
  const refs = [
    ...new Set(view.items.flatMap((i) => (i.atlasRef ? [i.atlasRef] : []))),
  ];
  const sharing = await sharingOn(db, id).catch(() => false);
  const [stops, packing, moments] = await Promise.all([
    atlasStopsFor(refs).catch(() => ({ names: {}, experiences: {} })),
    packingOf(db, id).catch(() => null as PackingView[] | null),
    sharing
      ? momentsOf(db, id, session.user.id).catch(() => [] as Moment[])
      : Promise.resolve([] as Moment[]),
  ]);
  const config = nightForTitle(view.title) ?? null;

  return (
    <>
      <PassportNav displayName={session.user.displayName ?? null} />
      <NightBoard
        view={view}
        invites={invites}
        packing={packing}
        moments={moments}
        sharing={sharing}
        atlasNames={stops.names}
        experiences={stops.experiences}
        config={config}
      />
    </>
  );
}
