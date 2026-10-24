import Link from "next/link";
import type { ReactNode } from "react";
import {
  effectiveEnd,
  type DayEntry,
  type JourneyPhase,
  type NowAndNext,
} from "@/domain/conference/agenda";
import { clock, dayWords, untilWords } from "@/domain/conference-plans/time";

const t = (iso: string, tz: string) => clock(new Date(iso), tz);

function Line({
  e,
  tz,
  now,
  day,
  lead,
}: {
  e: DayEntry;
  tz: string;
  now: Date;
  day: readonly DayEntry[];
  lead: string;
}) {
  const starts = new Date(e.startsAt);
  const live = starts <= now;
  return (
    <div
      className="py-4 first:pt-0 last:pb-0"
      data-testid={live ? "now-entry" : "next-entry"}
    >
      <p className="cf-eyebrow flex items-center gap-2 text-white/50">
        {live ? (
          <span
            aria-hidden="true"
            className="cf-pulse h-1.5 w-1.5 rounded-full bg-[#7fd1a5]"
          />
        ) : null}
        {lead}
        <span className="text-white/35">
          {live
            ? e.endsAt
              ? `until ${t(e.endsAt, tz)}`
              : `since ${t(e.startsAt, tz)}`
            : `${t(e.startsAt, tz)} · ${untilWords(starts, now)}`}
        </span>
      </p>
      <p className="cf-serif mt-2 text-[22px] leading-snug text-white">
        {e.title}
      </p>
      <p className="mt-1 text-[14px] text-white/60">
        {e.source === "plan"
          ? `${e.kindLabel ?? "Plan"} with colleagues`
          : null}
        {e.source === "plan" && e.where ? " · " : null}
        {e.where
          ? `${e.where}`
          : e.source === "agenda"
            ? "Location not given"
            : null}
        {live && !e.endsAt && e.source === "agenda" ? (
          <span className="text-white/35">
            {" "}
            · until {t(effectiveEnd(e, day).toISOString(), tz)}
          </span>
        ) : null}
      </p>
    </div>
  );
}

function Shell({
  eyebrow,
  children,
  foot,
}: {
  eyebrow: string;
  children: ReactNode;
  foot?: ReactNode;
}) {
  return (
    <section
      className="bg-cf-ink relative overflow-hidden rounded-2xl p-6 text-white shadow-[0_20px_50px_-20px_rgba(23,24,27,0.55)]"
      data-testid="now-card"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(165,129,74,0.28),transparent_70%)]"
      />
      <p className="cf-eyebrow relative text-[#d8c39d]">{eyebrow}</p>
      <div className="relative mt-4">{children}</div>
      {foot ? (
        <div className="relative mt-5 border-t border-white/10 pt-4">
          {foot}
        </div>
      ) : null}
    </section>
  );
}

const footLink =
  "inline-flex min-h-10 items-center text-[14px] font-semibold text-white underline-offset-4 hover:underline";

/**
 * **The one card that answers "what now?"** — and the answer depends on
 * where the person is in their trip. During: what's on and what's next,
 * with where. Before: their own arrival and what day one opens with.
 * After: what the group kept. Every line is published, planned or typed by
 * a person; when nothing is, it says so.
 */
export function NowCard({
  phase,
  tz,
  now,
  today,
  todayEntries,
  firstDay,
  agendaHref,
  arrivalsHref,
  memoriesHref,
  yourArrival,
  hasAgenda,
  organiser,
  adminHref,
  landed,
  landingToday,
}: {
  phase: JourneyPhase;
  tz: string;
  now: Date;
  today: NowAndNext;
  todayEntries: readonly DayEntry[];
  firstDay: readonly DayEntry[];
  agendaHref: string | null;
  arrivalsHref: string | null;
  memoriesHref: string | null;
  yourArrival: { at: string | null; flight: string; kind: string } | null;
  hasAgenda: boolean;
  organiser: boolean;
  adminHref: string;
  landed: number;
  landingToday: number;
}) {
  const noAgenda = (
    <p className="text-[15px] leading-relaxed text-white/70">
      The agenda hasn&apos;t been published yet.
      {organiser
        ? " Publish it and this card starts answering “what’s next?” for everyone."
        : " It will appear here as soon as the organiser publishes it."}
    </p>
  );
  const publish =
    organiser && !hasAgenda ? (
      <Link href={`${adminHref}#agenda`} className={footLink}>
        Publish the agenda →
      </Link>
    ) : null;

  if (phase === "during") {
    const lines = [...today.now, ...(today.next ? [today.next] : [])];
    return (
      <Shell
        eyebrow={`Today · ${clock(now, tz)}`}
        foot={
          publish ??
          (agendaHref ? (
            <Link href={agendaHref} className={footLink}>
              {today.later.length
                ? `Then ${today.later.length} more today · Full agenda →`
                : "Full agenda →"}
            </Link>
          ) : null)
        }
      >
        {lines.length ? (
          <div className="divide-y divide-white/10">
            {lines.map((e) => (
              <Line
                key={`${e.source}-${e.id}-${e.occurrenceId ?? ""}`}
                e={e}
                tz={tz}
                now={now}
                day={todayEntries}
                lead={new Date(e.startsAt) <= now ? "Now" : "Next"}
              />
            ))}
          </div>
        ) : hasAgenda || todayEntries.length ? (
          <p className="text-[15px] leading-relaxed text-white/70">
            {todayEntries.length
              ? "That's everything on today's agenda. The evening is yours."
              : "Nothing is on the agenda today."}
          </p>
        ) : (
          noAgenda
        )}
      </Shell>
    );
  }

  if (phase === "after")
    return (
      <Shell
        eyebrow="Afterwards"
        foot={
          memoriesHref ? (
            <Link href={memoriesHref} className={footLink}>
              Open the shared album →
            </Link>
          ) : null
        }
      >
        <p className="cf-serif text-[22px] leading-snug">That&apos;s a wrap.</p>
        <p className="mt-2 text-[15px] leading-relaxed text-white/70">
          Download the photos you want to keep, and save the places you loved to
          your own Passport before this conference&apos;s space is cleared.
        </p>
      </Shell>
    );

  // Before, and arrival day.
  const opener = firstDay[0] ?? null;
  return (
    <Shell
      eyebrow={phase === "arrival" ? "Arrival day" : "Before you go"}
      foot={publish}
    >
      <div className="divide-y divide-white/10">
        <div className="pb-4" data-testid="your-arrival">
          <p className="cf-eyebrow text-white/50">Your arrival</p>
          {yourArrival ? (
            <p className="mt-2 text-[17px] leading-snug">
              <span className="font-semibold">{yourArrival.flight}</span>
              {yourArrival.at
                ? ` · ${yourArrival.kind === "landed" ? "landed" : "lands"} ${dayWords(new Date(yourArrival.at), tz, now).toLowerCase()} ${clock(new Date(yourArrival.at), tz)}`
                : " · no landing time given"}
            </p>
          ) : (
            <p className="mt-2 text-[15px] leading-relaxed text-white/70">
              Add your flight and colleagues landing near the same time can meet
              you at arrivals. Sharing it is your choice.
            </p>
          )}
          {arrivalsHref ? (
            <Link href={arrivalsHref} className={`${footLink} mt-1`}>
              {yourArrival ? "Arrivals board →" : "Add your flight →"}
            </Link>
          ) : null}
        </div>
        {phase === "arrival" && (landed || landingToday) ? (
          <div className="py-4">
            <p className="cf-eyebrow text-white/50">Today</p>
            <p className="mt-2 text-[15px] text-white/80">
              {landed ? `${landed} landed` : ""}
              {landed && landingToday ? " · " : ""}
              {landingToday ? `${landingToday} still to land` : ""}
            </p>
          </div>
        ) : null}
        <div className="pt-4">
          <p className="cf-eyebrow text-white/50">Day one opens with</p>
          {opener ? (
            <>
              <p className="cf-serif mt-2 text-[20px] leading-snug">
                {opener.title}
              </p>
              <p className="mt-1 text-[14px] text-white/60">
                {dayWords(new Date(opener.startsAt), tz, now)} ·{" "}
                {t(opener.startsAt, tz)}
                {opener.where ? ` · ${opener.where}` : ""}
              </p>
            </>
          ) : (
            <div className="mt-2">{noAgenda}</div>
          )}
        </div>
      </div>
    </Shell>
  );
}
