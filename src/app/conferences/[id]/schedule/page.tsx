import Link from "next/link";
import { notFound } from "next/navigation";
import {
  agendaDays,
  dayEntries,
  effectiveEnd,
  planEntries,
  today as todayOf,
  type DayEntry,
} from "@/domain/conference/agenda";
import { clock } from "@/domain/conference-plans/time";
import { conferenceSetup } from "@/lib/conference/config";
import { conferenceContext, readIdentity } from "@/lib/conference/request";
import { readPlans } from "@/lib/conference-plans/service";
import { togetherEnabled } from "@/lib/conference-together/enabled";
import { plansDeps } from "@/lib/conference-together/request";
import {
  btn,
  EmptyNote,
  PageHead,
  Pill,
  wrap,
} from "@/components/conference/kit";

export const dynamic = "force-dynamic";

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
          className="-mx-5 mt-6 overflow-x-auto px-5 sm:mx-0 sm:px-0"
        >
          <ul className="flex gap-2">
            {days.map((d, i) => {
              const tab = dayTab(d);
              const on = d === day;
              return (
                <li key={d}>
                  <Link
                    href={`${base}/schedule?day=${d}`}
                    aria-current={on ? "page" : undefined}
                    className={`flex min-w-[92px] flex-col rounded-xl border px-4 py-2.5 transition ${
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
                    <span className="mt-0.5 text-[14px] font-semibold">
                      {tab.weekday} {tab.date}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-8 max-w-[820px]">
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
                className="bg-cf-line absolute top-2 bottom-2 left-[92px] w-px sm:left-[116px]"
              />
              {entries.map((e) => {
                const start = Date.parse(e.startsAt);
                const end = effectiveEnd(e, entries).getTime();
                const live =
                  isToday && start <= now.getTime() && end > now.getTime();
                const done = isToday && end <= now.getTime();
                const plan = e.source === "plan";
                const body = (
                  <div
                    className={`rounded-2xl px-5 py-4 transition ${
                      live
                        ? "bg-cf-ink text-white shadow-[0_16px_40px_-20px_rgba(23,24,27,0.6)]"
                        : plan
                          ? "border-cf-line hover:border-cf-ink/25 border border-dashed bg-white/70"
                          : e.featured
                            ? "border-cf-brass/40 border bg-[#fbf7ef]"
                            : "border-cf-line border bg-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {live ? (
                        <Pill tone="live" dot>
                          Now
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
                      className={`cf-serif mt-1 text-[19px] leading-snug ${live ? "text-white" : "text-cf-ink"}`}
                    >
                      {e.title}
                    </p>
                    <p
                      className={`mt-1 text-[14px] ${live ? "text-white/65" : "text-cf-slate"}`}
                    >
                      {e.where ??
                        (plan ? "Place to be decided" : "Location not given")}
                      {plan ? ` · ${e.going ?? 0} going` : ""}
                      {plan && e.mine
                        ? ` · you: ${e.mine === "in" ? "I'm in" : e.mine === "maybe" ? "maybe" : "can't make it"}`
                        : ""}
                    </p>
                    {e.note ? (
                      <p
                        className={`mt-2 text-[14px] leading-relaxed ${live ? "text-white/75" : "text-cf-slate"}`}
                      >
                        {e.note}
                      </p>
                    ) : null}
                  </div>
                );
                return (
                  <li
                    key={`${e.source}-${e.id}-${e.occurrenceId ?? ""}`}
                    className={`relative grid grid-cols-[80px_minmax(0,1fr)] gap-6 pb-4 sm:grid-cols-[100px_minmax(0,1fr)] sm:gap-8 ${done ? "opacity-55" : ""}`}
                    data-entry={e.source}
                    data-live={live ? "true" : undefined}
                  >
                    <div className="pt-4 text-right">
                      <p className="text-cf-ink text-[15px] font-semibold tabular-nums">
                        {t(e.startsAt)}
                      </p>
                      {e.endsAt ? (
                        <p className="text-cf-mist text-[12px] tabular-nums">
                          – {t(e.endsAt)}
                        </p>
                      ) : null}
                    </div>
                    <span
                      aria-hidden="true"
                      className={`ring-cf-paper absolute top-[22px] left-[88px] h-[9px] w-[9px] rounded-full ring-4 sm:left-[112px] ${
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
              Dashed lines are plans colleagues made, not part of the published
              agenda.{" "}
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
      </div>
    </>
  );
}
