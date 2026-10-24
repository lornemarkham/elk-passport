import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import {
  agendaDays,
  dayEntries,
  dayTitleFor,
  planEntries,
  today as todayOf,
  type DayEntry,
} from "@/domain/conference/agenda";
import { conferenceSetup } from "@/lib/conference/config";
import { conferenceContext, readIdentity } from "@/lib/conference/request";
import { readPlans } from "@/lib/conference-plans/service";
import { togetherEnabled } from "@/lib/conference-together/enabled";
import { plansDeps } from "@/lib/conference-together/request";
import {
  btn,
  EmptyNote,
  PageHead,
  Panel,
  PanelHead,
  wrap,
} from "@/components/conference/kit";
import { AgendaTimeline } from "@/components/conference/schedule/AgendaTimeline";
import { CalendarExport } from "@/components/conference/schedule/CalendarExport";
import { MyScheduleView } from "@/components/conference/schedule/MyScheduleView";
import { ReminderSettings } from "@/components/conference/schedule/ReminderSettings";
import { VenueMap } from "@/components/conference/VenueMap";
import { Directions } from "@/components/conference-together/Directions";
import { venueAnchor } from "@/lib/conference-explore/places";

export const dynamic = "force-dynamic";

const dayTab = (ymd: string) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  const f = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", ...o }).format(d);
  return {
    weekday: f({ weekday: "short" }),
    date: f({ month: "short", day: "numeric" }),
    num: f({ day: "numeric" }),
    long: f({ weekday: "long", month: "long", day: "numeric" }),
  };
};

/**
 * **The `schedule` module, called Agenda: the day, made effortless.** What
 * the organiser published, and — marked as theirs, not the organiser's —
 * the plans colleagues made, in one timeline per day. On today, what is on
 * now is set apart and what's done steps back.
 */
export default async function AgendaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ day?: string; view?: string }>;
}) {
  const ctx = await conferenceContext((await params).id);
  if (!ctx) notFound();
  const { conference: c, viewer, now } = ctx;
  const organiser = viewer.role === "organiser";
  if (!c.modules.includes("schedule") && !organiser) notFound();
  const base = `/conferences/${c.id}`;
  const tz = c.timeZone;

  let plans: DayEntry[] = [];
  const plansOn = c.modules.includes("plans") && togetherEnabled();
  if (plansOn) {
    const setup = conferenceSetup();
    const identity = setup.open ? await readIdentity(setup.config) : null;
    const board = identity
      ? await readPlans(await plansDeps(c, 1500), identity, c.id).catch(
          () => null,
        )
      : null;
    plans = board ? planEntries(board.plans) : [];
  }

  const days = agendaDays(c);
  const ymdNow = todayOf(c, now);
  const query = await searchParams;
  const asked = query.day;
  const mineView = query.view === "mine";
  const day =
    asked && days.includes(asked)
      ? asked
      : days.includes(ymdNow)
        ? ymdNow
        : days[0]!;
  const entries = dayEntries(c, day, plans);
  const isToday = day === ymdNow;
  const published = (c.agenda ?? []).length > 0;
  const venue = venueAnchor(c);
  const heading = dayTitleFor(c, day);
  const tabClass = (on: boolean) =>
    `inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-4 text-[14px] font-semibold transition sm:flex-none ${
      on ? "bg-cf-ink text-white" : "text-cf-slate hover:text-cf-ink"
    }`;

  return (
    <>
      <PageHead
        eyebrow={
          mineView
            ? "Agenda"
            : isToday
              ? `Today · ${dayTab(day).long}`
              : "Agenda"
        }
        title={
          mineView
            ? "My schedule"
            : (heading ?? (isToday ? "Today" : dayTab(day).long))
        }
        lede={
          published && !mineView
            ? `${heading && !isToday ? `${dayTab(day).long}. ` : ""}Times in ${c.place.label}.${plansOn ? " Dashed lines are plans colleagues made." : ""}`
            : undefined
        }
      >
        {organiser ? (
          <Link
            href={`${base}/admin#agenda`}
            className={`${btn.secondary} mt-5`}
          >
            Edit the agenda
          </Link>
        ) : null}
      </PageHead>

      <div className={`${wrap} pb-16`}>
        {published ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 sm:mt-6">
            <nav
              aria-label="Agenda or my schedule"
              className="border-cf-line flex w-full rounded-full border bg-white p-1 sm:w-auto"
            >
              <Link
                href={`${base}/schedule${asked ? `?day=${asked}` : ""}`}
                aria-current={!mineView ? "page" : undefined}
                className={tabClass(!mineView)}
              >
                Full agenda
              </Link>
              <Link
                href={`${base}/schedule?view=mine`}
                aria-current={mineView ? "page" : undefined}
                className={tabClass(mineView)}
                data-testid="my-schedule-tab"
              >
                My schedule
              </Link>
            </nav>
            <div className="cf-shelf -mx-4 flex w-[calc(100%+2rem)] items-center gap-2 overflow-x-auto px-4 whitespace-nowrap sm:mx-0 sm:w-auto sm:px-0">
              <ReminderSettings conferenceId={c.id} />
              {!mineView ? (
                <CalendarExport
                  conferenceId={c.id}
                  dayIds={entries
                    .filter((e) => e.source === "agenda")
                    .map((e) => e.id)}
                  dayLabel={`Just ${dayTab(day).weekday}`}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        {!mineView ? (
          <nav
            aria-label="Days"
            className="cf-shelf -mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
          >
            <ul className="flex gap-2">
              {days.map((d) => {
                const tab = dayTab(d);
                const on = d === day;
                return (
                  <li key={d} className="min-w-[72px] flex-1 sm:max-w-[120px]">
                    <Link
                      href={`${base}/schedule?day=${d}`}
                      aria-current={on ? "page" : undefined}
                      aria-label={tab.long}
                      className={`relative flex min-h-[64px] flex-col items-center justify-center rounded-2xl border px-2 py-2 transition ${
                        on
                          ? "border-cf-ink bg-cf-ink text-white shadow-[0_10px_24px_-14px_rgba(23,24,27,0.7)]"
                          : "border-cf-line text-cf-ink hover:border-cf-ink/30 bg-white"
                      }`}
                      data-day={d}
                    >
                      <span
                        className={`text-[11px] font-bold tracking-[0.16em] uppercase ${on ? "text-white/70" : "text-cf-mist"}`}
                      >
                        {tab.weekday}
                      </span>
                      <span className="cf-display text-[24px] leading-none tabular-nums">
                        {tab.num}
                      </span>
                      {d === ymdNow ? (
                        <span
                          className={`absolute top-1.5 right-2 h-1.5 w-1.5 rounded-full ${on ? "bg-[#7fd1a5]" : "bg-cf-sage"}`}
                          aria-label="Today"
                        />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : null}

        {c.venue ? (
          <div
            className="border-cf-line mt-4 flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 lg:hidden"
            data-testid="agenda-venue"
          >
            <MapPin
              className="text-cf-slate h-4 w-4 shrink-0"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span className="text-cf-ink min-w-0 flex-1 truncate text-[14px] font-semibold">
              {c.venue.name}
            </span>
            {venue ? (
              <Directions name={venue.name} at={venue.at} compact />
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 grid gap-10 sm:mt-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="cf-agenda-day min-w-0">
            {mineView ? (
              <MyScheduleView
                conferenceId={c.id}
                timeZone={tz}
                serverNow={now.toISOString()}
                days={days.map((d) => ({
                  ymd: d,
                  label: dayTab(d).long,
                  entries: dayEntries(c, d, plans),
                }))}
              />
            ) : !entries.length ? (
              published ? (
                <EmptyNote title="Nothing on the agenda this day.">
                  {plansOn ? (
                    <>
                      Free time. Make it count —{" "}
                      <Link
                        href={`${base}/plans`}
                        className="text-cf-ink font-semibold underline underline-offset-4"
                      >
                        suggest a plan
                      </Link>
                      .
                    </>
                  ) : (
                    "Free time."
                  )}
                </EmptyNote>
              ) : (
                <EmptyNote
                  title="The agenda hasn't been published yet."
                  action={
                    organiser
                      ? {
                          href: `${base}/admin#agenda`,
                          label: "Publish the agenda",
                        }
                      : null
                  }
                >
                  {organiser
                    ? "Add sessions, breaks and the evening — or import the organiser's file. Everyone's Home will then show what's on now, what's next and where to be."
                    : "It will appear here as soon as the organiser publishes it."}
                </EmptyNote>
              )
            ) : (
              <AgendaTimeline
                conferenceId={c.id}
                timeZone={tz}
                serverNow={now.toISOString()}
                entries={entries}
                isToday={isToday}
              />
            )}
          </div>
          <aside className="hidden min-w-0 space-y-5 lg:sticky lg:top-20 lg:block lg:self-start">
            {venue ? (
              <Panel className="overflow-hidden">
                <VenueMap
                  venue={{ name: venue.name, at: venue.at }}
                  className="h-[180px]"
                />
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
            ) : c.venue ? (
              <Panel className="p-5">
                <PanelHead eyebrow="Venue" title={c.venue.name} />
                {c.venue.address ? (
                  <p className="text-cf-slate mt-1 text-[13px]">
                    {c.venue.address}
                  </p>
                ) : null}
              </Panel>
            ) : null}
            <Panel className="p-5">
              <PanelHead
                eyebrow="Reminders"
                title="Never miss the good stuff"
              />
              <div className="mt-3">
                <ReminderSettings conferenceId={c.id} full />
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    </>
  );
}
