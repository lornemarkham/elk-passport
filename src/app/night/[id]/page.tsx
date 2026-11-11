import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
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
import { readPacking } from "@/lib/date-night/night";
import { momentsOf, sharingOn } from "@/app/christmas/_server/together";
import type { Moment } from "@/domain/christmas/recap";
import { todayIn } from "@/lib/adventures/overview";
import { environmentFor } from "@/lib/environment/reading";
import { dayForecast, wallMinutes } from "@/domain/date-night/conditions";
import type { StoredStop } from "@/domain/date-night/adventures/itinerary";
import { sunsetOf } from "@/domain/date-night/adventures/compose";
import { eveningOf } from "@/domain/date-night/adventures/evenings";
import { hideUnopened } from "@/domain/date-night/plays";

export const metadata: Metadata = {
  title: "Just us ❤️",
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ p?: string | string[] }>;
}) {
  const { id } = await params;
  const { p } = await searchParams;
  // A texted link opens one play (`?p=`): only an item id is accepted.
  const focus = typeof p === "string" && /^[0-9a-f-]{36}$/i.test(p) ? p : null;
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
                ? `/auth?next=${encodeURIComponent(`/night/${id}${focus ? `?p=${focus}` : ""}`)}`
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
  const zone = view.timeZone ?? day?.timeZone ?? "America/Vancouver";
  // A note that hasn't opened never reaches the other person's browser.
  if (day)
    view = {
      ...view,
      items: hideUnopened(
        view.items,
        day.on,
        todayIn(zone),
        wallMinutes(new Date(), zone),
      ),
    };
  const refs = [
    ...new Set([
      ...view.items.flatMap((i) => (i.atlasRef ? [i.atlasRef] : [])),
      // The night's own Atlas places: pictures and directions for any stop.
      ...(day ? day.options.map((o) => o.atlasRef) : []),
      ...(config?.evenings ?? []).flatMap((id) =>
        (eveningOf(id)?.stops ?? []).flatMap((s) =>
          s.atlasRef ? [s.atlasRef] : [],
        ),
      ),
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
  const [stops, packing, moments, environments] = await Promise.all([
    atlasStopsFor(refs).catch(() => null),
    readPacking(db, id),
    sharing
      ? momentsOf(db, id, session.user.id).catch(() => [] as Moment[])
      : Promise.resolve([] as Moment[]),
    area ? environmentFor([area]) : Promise.resolve(new Map()),
  ]);
  const forecast =
    day && area ? dayForecast(environments.get(area.id), day) : undefined;
  const timeZone = view.timeZone ?? day?.timeZone ?? "America/Vancouver";
  // Legal time: BC stays on UTC−7 from 1 Nov 2026, whatever tz database
  // this runtime carries (conditions.ts).
  const sunsetMinutes = (day ? sunsetOf(day) : undefined) ?? 17 * 60 + 33;
  const dayStops: StoredStop[] = day
    ? view.items
        .filter((i) => i.onDay === day.on)
        .map((i) => ({
          id: i.id,
          label: i.label,
          note: i.note,
          atlasRef: i.atlasRef,
          at: i.startsAt ? wallMinutes(new Date(i.startsAt), timeZone) : null,
          position: i.position,
          // `addedBy` is a member id; people see a name.
          ...(i.mine
            ? {}
            : {
                by:
                  view.members.find((m) => m.memberId === i.addedBy)
                    ?.displayName ?? "one of you",
              }),
          mine: i.mine,
        }))
    : [];

  return (
    <>
      <NightBoard
        view={view}
        invites={invites}
        packing={packing.items}
        packingTrouble={packing.trouble}
        moments={moments}
        sharing={sharing}
        experiences={stops?.experiences ?? {}}
        config={config}
        dayStops={dayStops}
        today={todayIn(timeZone)}
        now={wallMinutes(new Date(), timeZone)}
        sunsetMinutes={sunsetMinutes}
        focus={focus}
        {...(forecast ? { forecast } : {})}
      />
    </>
  );
}
