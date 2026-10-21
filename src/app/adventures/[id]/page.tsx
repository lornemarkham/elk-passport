import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PassportNav } from "@/components/shell/PassportNav";
import { AdventurePeople } from "@/components/adventures/AdventurePeople";
import { AdventurePlan } from "@/components/adventures/AdventurePlan";
import { adventureSession } from "@/lib/adventures/server";
import {
  adventureFor,
  invitesOf,
  type AdventureView,
  type InviteView,
} from "@/lib/adventures/store";
import { atlasStopsFor } from "@/lib/adventures/atlas-names";
import { ZONE } from "@/domain/experience/eventTime";
import { kindLabel } from "@/lib/adventures/kinds";
import { momentLabel, whenLabel } from "@/lib/adventures/present";

export const metadata: Metadata = {
  title: "Adventure — Passport",
  robots: { index: false },
};

function Panel({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
      <p className="text-lg font-medium">{title}</p>
      {children}
    </div>
  );
}

/**
 * **One adventure: what it is, who's going, and the plan.**
 *
 * Read as the signed-in person, so what they see is exactly what Postgres
 * lets them see. "Not found" covers missing and not-yours identically.
 */
export default async function AdventurePage({
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
      // Only an owner may read links (RLS); nobody else is asked.
      if (view?.role === "owner") invites = await invitesOf(session.db, id);
    } catch {
      failed = true;
    }
  }

  const refs = view
    ? [
        ...view.items.flatMap((i) => (i.atlasRef ? [i.atlasRef] : [])),
        ...(view.hockey?.arenaAtlasRef ? [view.hockey.arenaAtlasRef] : []),
      ]
    : [];
  const { names: atlasNames, experiences } =
    refs.length > 0
      ? await atlasStopsFor(refs)
      : { names: {}, experiences: {} };
  const today = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: view?.timeZone ?? ZONE,
  }).format(new Date());

  return (
    <>
      <PassportNav displayName={session?.user.displayName ?? null} />
      <main className="bg-background min-h-screen">
        <div className="mx-auto max-w-3xl space-y-10 px-6 py-10 sm:py-14">
          <Link
            href="/adventures"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Adventures
          </Link>

          {!session ? (
            <Panel title="Sign in to open this">
              <Link
                href={`/auth?next=${encodeURIComponent(`/adventures/${id}`)}`}
                className="bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-medium"
              >
                Sign in
              </Link>
            </Panel>
          ) : failed ? (
            <Panel title="Couldn't load this just now">
              <p className="text-muted-foreground text-sm">
                Try again in a moment.
              </p>
            </Panel>
          ) : !view ? (
            <Panel title="Not found">
              <p className="text-muted-foreground max-w-sm text-sm">
                It may have been deleted, the link may be wrong, or it
                isn&apos;t one you&apos;re in. If somebody invited you, open the
                link they sent.
              </p>
            </Panel>
          ) : (
            <>
              <header>
                <p className="text-muted-foreground text-sm">
                  {kindLabel(view.kind)}
                </p>
                <h1 className="font-heading text-3xl font-semibold tracking-tight">
                  {view.title}
                </h1>
                <p className="text-muted-foreground mt-2 text-sm">
                  {[
                    whenLabel(view.startsOn, view.endsOn),
                    view.destinationLabel,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No date or place yet."}
                </p>
                {view.hockey &&
                  (view.hockey.homeTeam ||
                    view.hockey.awayTeam ||
                    view.hockey.arenaLabel ||
                    view.hockey.arenaAtlasRef ||
                    view.hockey.puckDrop) && (
                    <p className="mt-3 text-sm" data-testid="hockey-facts">
                      {[
                        view.hockey.homeTeam && view.hockey.awayTeam
                          ? `${view.hockey.homeTeam} vs ${view.hockey.awayTeam}`
                          : view.hockey.awayTeam
                            ? `vs ${view.hockey.awayTeam}`
                            : view.hockey.homeTeam,
                        view.hockey.arenaLabel ??
                          (view.hockey.arenaAtlasRef
                            ? atlasNames[view.hockey.arenaAtlasRef]
                            : null),
                        view.hockey.puckDrop
                          ? `puck drop ${momentLabel(view.hockey.puckDrop, view.timeZone)}`
                          : "puck drop not confirmed",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
              </header>

              <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <Link
                  href={`/saved?adventure=${encodeURIComponent(view.id)}`}
                  data-testid="add-from-saved"
                  className="font-medium underline-offset-4 hover:underline"
                >
                  Add from Saved
                </Link>
                <Link
                  href="/discovery"
                  className="text-muted-foreground underline-offset-4 hover:underline"
                >
                  Find more in Discovery
                </Link>
              </p>

              <AdventurePlan
                adventureId={view.id}
                isOwner={view.role === "owner"}
                items={view.items}
                atlasNames={atlasNames}
                experiences={experiences}
                timeZone={view.timeZone}
                startsOn={view.startsOn}
                endsOn={view.endsOn}
                days={view.days}
                townId={view.destinationTownId}
                today={today}
              />

              <AdventurePeople
                adventureId={view.id}
                isOwner={view.role === "owner"}
                members={view.members}
                you={view.you}
                invites={invites}
              />
            </>
          )}
        </div>
      </main>
    </>
  );
}
