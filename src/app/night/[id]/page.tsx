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
import { dayDetails, type DayDetail } from "@/lib/adventures/propose";
import { todayIn } from "@/lib/adventures/overview";
import { loadSaved } from "@/lib/data/loadSaved";
import { savedFor } from "@/lib/adventures/fit";
import { environmentFor } from "@/lib/environment/reading";
import {
  clockTime,
  dayForecast,
  zonedInstant,
} from "@/domain/date-night/conditions";
import { daylightAt } from "@/domain/environment/daylight";
import { sunsetOf } from "@/domain/date-night/adventures/compose";
import { eveningOf } from "@/domain/date-night/adventures/evenings";

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
  const config = nightForTitle(view.title) ?? null;
  const day = config?.day;
  const refs = [
    ...new Set([
      ...view.items.flatMap((i) => (i.atlasRef ? [i.atlasRef] : [])),
      // The night opens on its own landscape until the day has pictures.
      ...(day ? day.options.map((o) => o.atlasRef) : []),
      ...(config?.evenings ?? []).flatMap((id) => eveningOf(id)?.stops ?? []),
    ]),
  ];
  const sharing = await sharingOn(db, id).catch(() => false);
  const area = day
    ? {
        id: `night-${day.townId}`,
        name: day.area,
        latitude: day.latitude,
        longitude: day.longitude,
      }
    : null;
  const [stops, packing, moments, details, saved, environments] =
    await Promise.all([
      atlasStopsFor(refs).catch(() => null),
      packingOf(db, id).catch(() => null as PackingView[] | null),
      sharing
        ? momentsOf(db, id, session.user.id).catch(() => [] as Moment[])
        : Promise.resolve([] as Moment[]),
      dayDetails(view).catch(() => null as Record<string, DayDetail> | null),
      loadSaved().catch(() => null),
      area ? environmentFor([area]) : Promise.resolve(new Map()),
    ]);
  const atlasNames = stops?.names ?? {};
  const experiences = stops?.experiences ?? {};
  // Mission 482's reading: saved places that fit this day first.
  const savedHere =
    saved?.status === "ok"
      ? savedFor(view, saved.experiences)
      : { fits: [], elsewhere: [] };
  const forecast =
    day && area ? dayForecast(environments.get(area.id), day) : undefined;
  const light = day
    ? daylightAt(
        day.latitude,
        day.longitude,
        zonedInstant(day.on, 12, day.timeZone),
      )
    : undefined;
  // Legal time: BC stays on UTC−7 from 1 Nov 2026, whatever tz database
  // this runtime carries (conditions.ts).
  const sunsetMinutes = day ? sunsetOf(day) : undefined;

  return (
    <>
      <PassportNav displayName={session.user.displayName ?? null} />
      <NightBoard
        view={view}
        invites={invites}
        packing={packing}
        moments={moments}
        sharing={sharing}
        atlasNames={atlasNames}
        experiences={experiences}
        config={config}
        details={details ?? {}}
        saved={savedHere}
        today={todayIn(view.timeZone ?? day?.timeZone ?? null)}
        atlasDown={stops === null || details === null}
        {...(forecast ? { forecast } : {})}
        {...(light && day
          ? { sunset: clockTime(light.sunset, day.timeZone) }
          : {})}
        {...(sunsetMinutes !== undefined ? { sunsetMinutes } : {})}
      />
    </>
  );
}
