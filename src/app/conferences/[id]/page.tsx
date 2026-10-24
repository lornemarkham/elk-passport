import Link from "next/link";
import { notFound } from "next/navigation";
import {
  agendaDays,
  dayEntries,
  journeyPhase,
  nowAndNext,
  planEntries,
  today as todayOf,
} from "@/domain/conference/agenda";
import { digest } from "@/domain/conference-arrivals/digest";
import { arrivalsEnabled } from "@/lib/conference-arrivals/enabled";
import { readArrivals } from "@/lib/conference-arrivals/service";
import { arrivalsDeps } from "@/lib/conference-arrivals/request";
import { readRoom } from "@/lib/conference-chat/service";
import { venueAnchor } from "@/lib/conference-explore/places";
import { readAlbum } from "@/lib/conference-memories/service";
import { readPeople } from "@/lib/conference-people/service";
import { readPlans } from "@/lib/conference-plans/service";
import { conferenceSetup } from "@/lib/conference/config";
import { deps, readIdentity } from "@/lib/conference/request";
import { homeFor } from "@/lib/conference/service";
import { togetherEnabled } from "@/lib/conference-together/enabled";
import {
  chatDeps,
  memoriesDeps,
  peopleDeps,
  plansDeps,
} from "@/lib/conference-together/request";
import { Closed } from "@/components/conference/Closed";
import { LiveRefresh } from "@/components/conference/LiveRefresh";
import { PanelHead, Panel, wrap } from "@/components/conference/kit";
import { VenueMap } from "@/components/conference/VenueMap";
import { OverviewHero } from "@/components/conference/overview/Hero";
import { NowCard } from "@/components/conference/overview/NowCard";
import {
  AgendaGlance,
  ArrivalsPanel,
  MemoriesPanel,
  MessagesPanel,
  OrganiserSetup,
  PeoplePanel,
  SoloInvite,
} from "@/components/conference/overview/Panels";
import { clock } from "@/domain/conference-plans/time";
import { Directions } from "@/components/conference-together/Directions";
import { ExplorePicks } from "@/components/conference-together/ExplorePicks";
import { Reminders } from "@/components/conference-together/Reminders";
import { UpNext } from "@/components/conference-together/UpNext";

export const dynamic = "force-dynamic";

/** A module's summary failing never takes the overview down with it. */
const soft = <T,>(p: Promise<T>): Promise<T | null> =>
  p.catch((error) => {
    console.error("[conference overview] a summary failed", error);
    return null;
  });

/**
 * **A conference's overview.** Members only. To anybody else it doesn't
 * exist: this is `notFound()`, the same page a mistyped URL gets.
 *
 * It leads with what matters now, and "now" depends on the trip (see
 * `journeyPhase`): before it, your arrival and day one; on arrival day, who
 * has landed; during, what's on and what's next and where; afterwards, the
 * album. Everything else sits beside that, each part only when its module
 * is on, and each says plainly when it is empty. No form lives here: how
 * you appear is under your profile, settings under the organiser's.
 */
export default async function ConferenceOverview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const setup = conferenceSetup();
  if (!setup.open) return <Closed missing={setup.missing} />;
  const identity = await readIdentity(setup.config);
  if (!identity) notFound();
  const d = deps();
  const home = await homeFor(d, identity, (await params).id);
  if (!home) notFound();

  const { conference: c, you, people } = home;
  const organiser = you.role === "organiser";
  const together = togetherEnabled();
  const on = (id: (typeof c.modules)[number]) =>
    c.modules.includes(id) &&
    (id === "arrivals"
      ? arrivalsEnabled()
      : id === "discover" || id === "schedule"
        ? true
        : together);
  const base = `/conferences/${c.id}`;
  const now = d.now;
  const tz = c.timeZone;

  const [board, arrivals, room, album, sharing] = await Promise.all([
    on("plans")
      ? soft(plansDeps(c, 1500).then((p) => readPlans(p, identity, c.id)))
      : null,
    on("arrivals")
      ? soft(readArrivals(arrivalsDeps(), identity, c.id, false))
      : null,
    on("community") ? soft(readRoom(chatDeps(), identity, c.id, null)) : null,
    on("memories") ? soft(readAlbum(memoriesDeps(), identity, c.id)) : null,
    on("people") ? soft(readPeople(peopleDeps(), identity, c.id)) : null,
  ]);

  const rows = arrivals?.board?.rows ?? [];
  const arrived = arrivals?.board ? digest(arrivals.board, now, tz) : null;
  const ymd = todayOf(c, now);
  const landingToday =
    arrived?.timeline
      .find((t) => t.day === ymd)
      ?.entries.filter((e) => e.kind !== "landed").length ?? 0;
  const phase = journeyPhase(c, now, landingToday);

  const plans = board ? planEntries(board.plans) : [];
  const todayEntries = on("schedule") ? dayEntries(c, ymd, plans) : [];
  const nn = nowAndNext(todayEntries, now);
  const firstDay = dayEntries(c, agendaDays(c)[0] ?? c.startsOn).filter(
    (e) => e.source === "agenda",
  );
  const mine = rows.find((r) => r.isYou);
  const yourArrival = mine
    ? (() => {
        const e = arrived?.timeline
          .flatMap((t) => t.entries)
          .find((x) => x.you);
        return {
          flight: mine.flight,
          at: e?.at ?? null,
          kind: e?.kind ?? "scheduled",
        };
      })()
    : null;
  const venue = venueAnchor(c);
  const named = people.visible
    .filter((p) => p.displayName && p.memberId !== you.memberId)
    .map((p) => p.displayName!);
  const admin = `${base}/admin`;
  const hasAgenda = (c.agenda ?? []).length > 0;

  const steps = [
    {
      done: !!c.venue,
      label: "Add the venue",
      hint: "So everyone knows where to be, and Explore measures walks from it.",
      href: `${admin}#details`,
    },
    {
      done: hasAgenda || !c.modules.includes("schedule"),
      label: "Publish the agenda",
      hint: "Sessions, breaks and the evening. The overview answers “what’s next?” from it.",
      href: `${admin}#agenda`,
    },
    {
      done: people.total > 1,
      label: "Invite people",
      hint: "A link or a code. Nobody needs an account to join.",
      href: `${admin}#access`,
    },
    {
      done: !!c.tagline,
      label: "Write a line of welcome",
      hint: "One sentence under the name, in your own words.",
      href: `${admin}#details`,
    },
  ];

  const glance = (list: readonly (typeof todayEntries)[number][]) =>
    list.slice(0, 7).map((e) => ({
      key: `${e.source}-${e.id}-${e.occurrenceId ?? ""}`,
      start: clock(new Date(e.startsAt), tz),
      end: e.endsAt ? clock(new Date(e.endsAt), tz) : null,
      title: e.title,
      where: e.where,
      featured: e.featured,
      plan: e.source === "plan",
    }));

  const nowCard = (
    <NowCard
      phase={phase}
      tz={tz}
      now={now}
      today={nn}
      todayEntries={todayEntries}
      firstDay={firstDay}
      agendaHref={on("schedule") ? `${base}/schedule` : null}
      arrivalsHref={on("arrivals") ? `${base}/arrivals` : null}
      memoriesHref={on("memories") ? `${base}/memories` : null}
      yourArrival={yourArrival}
      hasAgenda={hasAgenda}
      organiser={organiser}
      adminHref={admin}
      landed={arrived?.landed.length ?? 0}
      landingToday={landingToday}
    />
  );

  const arrivalsPanel =
    on("arrivals") && arrivals?.board ? (
      <ArrivalsPanel
        rows={rows}
        timeZone={tz}
        now={now}
        href={`${base}/arrivals`}
        airport={arrivals.board.arrival.iata ?? arrivals.board.arrival.icao}
      />
    ) : null;

  const memoriesPanel = album ? (
    <MemoriesPanel
      photos={album.photos.map((p) => ({
        id: p.id,
        caption: p.caption,
        by: p.by.name,
      }))}
      href={`${base}/memories`}
      conferenceId={c.id}
    />
  ) : null;

  return (
    <>
      <LiveRefresh everySeconds={20} />
      <OverviewHero
        c={c}
        now={now}
        participants={people.total}
        organiser={organiser}
        aside={nowCard}
      />

      <div className={`${wrap} pb-16`}>
        {board ? <Reminders conferenceId={c.id} controls={false} /> : null}
        {c.welcome ? (
          <p className="cf-serif text-cf-graphite mt-10 max-w-[62ch] text-[20px] leading-relaxed whitespace-pre-line">
            {c.welcome}
          </p>
        ) : null}

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
          <div className="min-w-0 space-y-12">
            {organiser && people.total === 1 ? (
              <SoloInvite href={`${admin}#access`} />
            ) : null}

            {phase === "after" && memoriesPanel ? memoriesPanel : null}

            {on("schedule") && phase === "during" ? (
              <AgendaGlance
                eyebrow="Agenda"
                title="Later today"
                entries={glance(nn.later)}
                href={`${base}/schedule`}
              />
            ) : null}
            {on("schedule") && (phase === "before" || phase === "arrival") ? (
              <AgendaGlance
                eyebrow="Agenda"
                title="Day one at a glance"
                entries={glance(firstDay)}
                href={`${base}/schedule`}
              />
            ) : null}

            {board ? (
              <section>
                <PanelHead
                  eyebrow="Shared plans"
                  title="With colleagues"
                  action={{ href: `${base}/plans`, label: "All plans" }}
                />
                <div className="mt-5">
                  <UpNext conferenceId={c.id} initial={board} />
                </div>
              </section>
            ) : null}

            {on("discover") ? (
              <section>
                <PanelHead
                  eyebrow={`Explore ${c.place.label}`}
                  title={
                    venue ? `A short walk from ${venue.name}` : "Good nearby"
                  }
                  action={{ href: `${base}/discover`, label: "Explore" }}
                />
                <div className="mt-5">
                  <ExplorePicks conferenceId={c.id} />
                </div>
              </section>
            ) : null}
          </div>

          <aside className="min-w-0 space-y-5">
            {organiser ? <OrganiserSetup steps={steps} /> : null}
            {phase === "arrival" || phase === "before" ? arrivalsPanel : null}
            {venue ? (
              <Panel className="overflow-hidden" data-testid="venue-panel">
                <VenueMap venue={{ name: venue.name, at: venue.at }} />
                <div className="p-5">
                  <PanelHead eyebrow="Venue" title={c.venue!.name} />
                  {c.venue!.address ? (
                    <p className="text-cf-slate mt-1 text-[13px]">
                      {c.venue!.address}
                    </p>
                  ) : null}
                  <div className="mt-4">
                    <Directions name={venue.name} at={venue.at} />
                  </div>
                </div>
              </Panel>
            ) : null}
            {phase === "during" || phase === "after" ? arrivalsPanel : null}
            <PeoplePanel
              names={named}
              total={people.total}
              href={`${base}/people`}
              sharing={(sharing?.people ?? [])
                .filter((p) => !p.you)
                .map((p) => p.name)}
            />
            {room ? (
              <MessagesPanel
                href={`${base}/chat`}
                messages={room.messages.slice(-3).map((m) => ({
                  id: m.id,
                  name: m.by.name,
                  body: m.body,
                  you: m.by.you,
                }))}
              />
            ) : null}
            {phase !== "after" ? memoriesPanel : null}
            <p className="text-cf-mist px-1 text-[12px] leading-relaxed">
              Private to the people in this {c.kind}. You appear only where you
              choose to —{" "}
              <Link
                href={`${base}/you`}
                className="underline underline-offset-4"
              >
                your profile &amp; privacy
              </Link>
              .
            </p>
          </aside>
        </div>
      </div>
    </>
  );
}
