import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown, ChevronUp, MapPin } from "lucide-react";
import {
  agendaDays,
  dayEntries,
  effectiveEnd,
  planEntries,
  today as todayOf,
  type DayEntry,
} from "@/domain/conference/agenda";
import { clock, untilWords } from "@/domain/conference-plans/time";
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
  Pill,
  wrap,
} from "@/components/conference/kit";
import { VenueMap } from "@/components/conference/VenueMap";
import { Directions } from "@/components/conference-together/Directions";
import { venueAnchor } from "@/lib/conference-explore/places";

export const dynamic = "force-dynamic";

const fold =
  "border-cf-line text-cf-slate peer-focus-visible:ring-cf-ink/40 flex min-h-11 cursor-pointer items-center justify-between rounded-xl border border-dashed px-4 text-[13px] font-semibold peer-focus-visible:ring-2";

const dayTab = (ymd: string) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  const f = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", ...o }).format(d);
  return {
    weekday: f({ weekday: "short" }),
    date: f({ month: "short", day: "numeric" }),
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
  searchParams: Promise<{ day?: string }>;
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
  const asked = (await searchParams).day;
  const day =
    asked && days.includes(asked)
      ? asked
      : days.includes(ymdNow)
        ? ymdNow
        : days[0]!;
  const entries = dayEntries(c, day, plans);
  const isToday = day === ymdNow;
  const published = (c.agenda ?? []).length > 0;
  const t = (iso: string) => clock(new Date(iso), tz);
  const venue = venueAnchor(c);
  const isDone = (e: DayEntry) =>
    effectiveEnd(e, entries).getTime() <= now.getTime();
  const earlier = isToday ? entries.filter(isDone).length : 0;
  const upNext = isToday
    ? (entries.find((e) => Date.parse(e.startsAt) > now.getTime()) ?? null)
    : null;

  return (
    <>
      <PageHead
        eyebrow="Agenda"
        title={isToday ? "Today" : dayTab(day).long}
        lede={
          published
            ? `Times in ${c.place.label}. What the organiser published, and the plans colleagues made.`
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
        <nav
          aria-label="Days"
          className="cf-shelf -mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:mt-6 sm:px-0"
        >
          <ul className="flex gap-2">
            {days.map((d, i) => {
              const tab = dayTab(d);
              const on = d === day;
              return (
                <li key={d} className="min-w-[88px] flex-1 sm:flex-none">
                  <Link
                    href={`${base}/schedule?day=${d}`}
                    aria-current={on ? "page" : undefined}
                    className={`flex min-h-12 flex-col rounded-xl border px-3 py-2 transition sm:min-w-[92px] sm:px-4 sm:py-2.5 ${
                      on
                        ? "border-cf-ink bg-cf-ink text-white"
                        : "border-cf-line text-cf-ink hover:border-cf-ink/30 bg-white"
                    }`}
                  >
                    <span
                      className={`cf-eyebrow ${on ? "text-white/60" : "text-cf-mist"}`}
                    >
                      {d === ymdNow ? "Today" : `Day ${i + 1}`}
                    </span>
                    <span className="mt-0.5 text-[13px] font-semibold whitespace-nowrap sm:text-[14px]">
                      {tab.weekday} {tab.date}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

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
            {earlier ? (
              // On a phone, what's finished folds away so today opens on now.
              <div className="mb-3 sm:hidden">
                <input
                  type="checkbox"
                  id="cf-earlier"
                  className="peer sr-only"
                />
                <label
                  htmlFor="cf-earlier"
                  className={`${fold} peer-checked:hidden`}
                >
                  Show {earlier} earlier today
                  <ChevronDown aria-hidden="true" className="h-4 w-4" />
                </label>
                <label
                  htmlFor="cf-earlier"
                  className={`${fold} hidden peer-checked:flex`}
                >
                  Hide earlier sessions
                  <ChevronUp aria-hidden="true" className="h-4 w-4" />
                </label>
              </div>
            ) : null}
            {!entries.length ? (
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
                    ? "Add sessions, breaks and the evening. Everyone's overview will then show what's on now, what's next and where to be."
                    : "It will appear here as soon as the organiser publishes it."}
                </EmptyNote>
              )
            ) : (
              <ol className="relative" data-testid="agenda">
                <span
                  aria-hidden="true"
                  className="bg-cf-line absolute top-2 bottom-2 left-[74px] w-px sm:left-[116px]"
                />
                {entries.map((e) => {
                  const start = Date.parse(e.startsAt);
                  const end = effectiveEnd(e, entries).getTime();
                  const live =
                    isToday && start <= now.getTime() && end > now.getTime();
                  const done = isToday && end <= now.getTime();
                  const next = e === upNext;
                  const plan = e.source === "plan";
                  const body = (
                    <div
                      className={`rounded-2xl px-4 py-3 transition sm:px-5 sm:py-4 ${
                        live
                          ? "bg-cf-ink text-white shadow-[0_16px_40px_-20px_rgba(23,24,27,0.6)]"
                          : plan
                            ? "border-cf-line hover:border-cf-ink/25 border border-dashed bg-white/70"
                            : e.featured
                              ? "border-cf-brass/40 border bg-[#fbf7ef]"
                              : next
                                ? "border-cf-ink/40 border bg-white shadow-[0_8px_24px_-16px_rgba(23,24,27,0.5)]"
                                : "border-cf-line border bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2 empty:hidden">
                        {live ? (
                          <Pill tone="live" dot>
                            Now
                          </Pill>
                        ) : null}
                        {next ? (
                          <Pill tone="neutral" data-testid="agenda-next">
                            Next · {untilWords(new Date(e.startsAt), now)}
                          </Pill>
                        ) : null}
                        {e.featured ? (
                          <Pill
                            tone="neutral"
                            className="!bg-cf-brass/15 !text-[#7a5a28]"
                          >
                            Featured
                          </Pill>
                        ) : null}
                        {plan ? (
                          <span
                            className={`cf-eyebrow ${live ? "text-white/60" : "text-cf-brass"}`}
                          >
                            {e.kindLabel} · planned by colleagues
                          </span>
                        ) : null}
                      </div>
                      <p
                        className={`cf-serif mt-1 text-[17px] leading-snug sm:text-[19px] ${live ? "text-white" : "text-cf-ink"}`}
                      >
                        {e.title}
                      </p>
                      <p
                        className={`mt-1 flex items-start gap-1.5 text-[13px] sm:text-[14px] ${live ? "text-white/65" : "text-cf-slate"}`}
                      >
                        <MapPin
                          aria-hidden="true"
                          className="mt-[3px] h-3.5 w-3.5 shrink-0"
                          strokeWidth={1.8}
                        />
                        <span className="min-w-0">
                          {e.where ??
                            (plan
                              ? "Place to be decided"
                              : "Location not given")}
                          {plan ? ` · ${e.going ?? 0} going` : ""}
                          {plan && e.mine
                            ? ` · you: ${e.mine === "in" ? "I'm in" : e.mine === "maybe" ? "maybe" : "can't make it"}`
                            : ""}
                        </span>
                      </p>
                      {e.note ? (
                        <p
                          className={`mt-1.5 text-[13px] leading-relaxed sm:mt-2 sm:text-[14px] ${live ? "text-white/75" : "text-cf-slate"}`}
                        >
                          {e.note}
                        </p>
                      ) : null}
                    </div>
                  );
                  return (
                    <li
                      key={`${e.source}-${e.id}-${e.occurrenceId ?? ""}`}
                      id={live ? "now" : undefined}
                      className={`relative grid scroll-mt-24 grid-cols-[64px_minmax(0,1fr)] gap-5 pb-3 sm:grid-cols-[100px_minmax(0,1fr)] sm:gap-8 sm:pb-4 ${done ? "opacity-55" : ""}`}
                      data-entry={e.source}
                      data-live={live ? "true" : undefined}
                      data-done={done ? "" : undefined}
                    >
                      <div className="pt-3 text-right sm:pt-4">
                        <p className="text-cf-ink text-[13px] font-semibold whitespace-nowrap tabular-nums sm:text-[15px]">
                          {t(e.startsAt)}
                        </p>
                        {e.endsAt ? (
                          <p className="text-cf-mist text-[11px] whitespace-nowrap tabular-nums sm:text-[12px]">
                            – {t(e.endsAt)}
                          </p>
                        ) : null}
                      </div>
                      <span
                        aria-hidden="true"
                        className={`ring-cf-paper absolute top-[18px] left-[70px] h-[9px] w-[9px] rounded-full ring-4 sm:top-[22px] sm:left-[112px] ${
                          live
                            ? "bg-cf-sage"
                            : plan
                              ? "bg-cf-brass"
                              : e.featured
                                ? "bg-cf-brass"
                                : "bg-cf-ink"
                        }`}
                      />
                      {plan ? (
                        <Link
                          href={`${base}/plans#plan-${e.id}`}
                          className="block"
                        >
                          {body}
                        </Link>
                      ) : (
                        body
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
            {entries.length && plansOn ? (
              <p className="text-cf-mist mt-4 text-[13px]">
                Dashed lines are plans colleagues made, not part of the
                published agenda.{" "}
                <Link
                  href={`${base}/plans`}
                  className="text-cf-slate font-semibold underline underline-offset-4"
                >
                  Suggest one
                </Link>
                .
              </p>
            ) : null}
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
                eyebrow="How to read it"
                title="Published and planned"
              />
              <ul className="text-cf-slate mt-3 space-y-2 text-[13px]">
                <li className="flex items-center gap-2">
                  <span className="bg-cf-ink h-2 w-2 rounded-full" /> Published
                  by the organiser
                </li>
                <li className="flex items-center gap-2">
                  <span className="bg-cf-brass h-2 w-2 rounded-full" />{" "}
                  Featured, or planned by colleagues (dashed)
                </li>
                <li className="flex items-center gap-2">
                  <span className="bg-cf-sage h-2 w-2 rounded-full" /> On now
                </li>
              </ul>
            </Panel>
          </aside>
        </div>
      </div>
    </>
  );
}
