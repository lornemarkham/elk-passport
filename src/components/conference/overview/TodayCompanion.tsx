"use client";

import Link from "next/link";
import { Bell, BellRing, MapPin } from "lucide-react";
import {
  effectiveEnd,
  nowAndNext,
  type DayEntry,
} from "@/domain/conference/agenda";
import { startsWords, tonight } from "@/domain/conference/moments";
import { leadFor } from "@/domain/conference/sessionReminders";
import { clock } from "@/domain/conference-plans/time";
import { Pill, wrap } from "../kit";
import { lookFor } from "../schedule/kinds";
import { useMySchedule } from "../schedule/mySchedule";
import { useNow } from "../schedule/useNow";
import { FreeTimePicks } from "./FreeTimePicks";

/**
 * **Home, during the conference: the screen people open between sessions.**
 *
 * Good morning, the date, and at most one line of personality; then the one
 * charcoal card that answers "what now?" — what's on, what's next, where,
 * and how long until — with View session and Remind me; then the rest of
 * the day, tonight, and, when the agenda leaves a gap, something that fits
 * in it. It counts down without a reload. Every line is the organiser's
 * published agenda or a plan colleagues made; nothing else.
 */
export function TodayCompanion({
  conferenceId,
  conferenceName,
  dayOf,
  timeZone,
  serverNow,
  greeting,
  dayLong,
  dayTitle,
  moment,
  entries,
  hasAgenda,
  organiser,
  exploreOn,
  city,
  bingoHref = null,
}: {
  city: string;
  /** The Bingo game, when the organiser switched it on. */
  bingoHref?: string | null;
  conferenceId: string;
  conferenceName: string;
  dayOf: string;
  timeZone: string;
  serverNow: string;
  greeting: string;
  dayLong: string;
  dayTitle: string | null;
  moment: string | null;
  entries: readonly DayEntry[];
  hasAgenda: boolean;
  organiser: boolean;
  exploreOn: boolean;
}) {
  const now = useNow(serverNow);
  const s = useMySchedule(conferenceId);
  const base = `/conferences/${conferenceId}`;
  const nn = nowAndNext(entries, now);
  const t = (iso: string) => clock(new Date(iso), timeZone);
  const next = nn.next;
  const evening = tonight(entries, timeZone, now);
  const rest = nn.later.filter((e) => e.kind !== "break");
  const remind = next && next.source === "agenda" ? leadFor(next, s.prefs) : 0;

  return (
    <header className="border-cf-line border-b bg-[linear-gradient(180deg,#fbfaf7_0%,#f7f5f0_100%)]">
      <div
        className={`${wrap} grid gap-5 pt-5 pb-6 sm:gap-8 sm:pt-12 sm:pb-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start lg:gap-14`}
      >
        <div className="cf-rise min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className="cf-eyebrow text-cf-mist min-w-0 truncate"
              data-testid="conference-name"
            >
              {conferenceName}
            </p>
            <Pill tone="live" dot data-testid="countdown">
              {dayOf}
            </Pill>
          </div>
          <h1
            className="cf-display text-cf-ink mt-3 text-[34px] leading-[1.02] sm:text-[60px]"
            data-testid="greeting"
          >
            {greeting}
          </h1>
          <p className="text-cf-slate mt-3 text-[14px] font-semibold tracking-[0.12em] uppercase sm:text-[15px]">
            <span data-testid="today-date">{dayLong}</span>
            {dayTitle ? (
              <span className="text-cf-brass tracking-normal normal-case">
                {" "}
                · {dayTitle}
              </span>
            ) : null}
          </p>
          {moment ? (
            <p
              className="cf-serif text-cf-graphite mt-4 text-[18px] leading-snug italic sm:text-[22px]"
              data-testid="moment"
            >
              {moment}
              {bingoHref && moment.startsWith("Your mission") ? (
                <Link
                  href={bingoHref}
                  className="text-cf-sage ml-2 text-[15px] font-semibold not-italic underline-offset-4 hover:underline"
                  data-testid="moment-bingo"
                >
                  Play Bingo →
                </Link>
              ) : null}
            </p>
          ) : null}

          {/* The rest of today, on a wide screen beside the card. */}
          {rest.length ? (
            <section
              className="mt-8 hidden lg:block"
              data-testid="your-day-wide"
            >
              <YourDay entries={rest} base={base} t={t} />
            </section>
          ) : null}
        </div>

        <div className="cf-rise min-w-0 space-y-4 [animation-delay:80ms]">
          <section
            className={`relative overflow-hidden rounded-3xl p-6 text-white ${
              next?.kind === "celebration"
                ? "cf-gala"
                : "bg-cf-ink shadow-[0_20px_50px_-20px_rgba(23,24,27,0.55)]"
            }`}
            data-testid="now-card"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(165,129,74,0.28),transparent_70%)]"
            />
            {nn.now.map((e) => (
              <div
                key={`${e.source}-${e.id}-${e.occurrenceId ?? ""}`}
                className="relative mb-4 border-b border-white/10 pb-4"
                data-testid="now-entry"
              >
                <p className="cf-eyebrow flex items-center gap-2 text-white/55">
                  <span
                    aria-hidden="true"
                    className="cf-pulse h-1.5 w-1.5 rounded-full bg-[#7fd1a5]"
                  />
                  Now
                  <span className="text-white/35">
                    {e.endsAt
                      ? `until ${t(e.endsAt)}`
                      : `since ${t(e.startsAt)}`}
                  </span>
                </p>
                <p className="cf-serif mt-2 text-[20px] leading-snug">
                  {e.source === "agenda" ? (
                    <Link href={`${base}/schedule/${e.id}`}>{e.title}</Link>
                  ) : (
                    e.title
                  )}
                </p>
                <p className="mt-1 text-[14px] text-white/60">
                  {e.where ??
                    (e.source === "plan"
                      ? `${e.kindLabel ?? "Plan"} with colleagues`
                      : e.kind === "break"
                        ? "A breather"
                        : "Location not given")}
                  {!e.endsAt && e.source === "agenda" && next
                    ? ` · next at ${t(effectiveEnd(e, entries).toISOString())}`
                    : ""}
                </p>
              </div>
            ))}

            {next ? (
              <div className="relative" data-testid="next-entry">
                <p className="cf-eyebrow text-[#d8c39d]">Up next</p>
                <p className="cf-display mt-2 text-[30px] leading-none tabular-nums">
                  {t(next.startsAt)}
                </p>
                <p className="cf-serif mt-3 text-[24px] leading-snug">
                  {next.title}
                </p>
                {next.topics?.length ? (
                  <p className="mt-1 text-[14px] text-white/70">
                    {next.topics[0]}
                    {next.topics.length > 1
                      ? ` · and ${next.topics.length - 1} more`
                      : ""}
                  </p>
                ) : null}
                <p className="mt-2 flex items-center gap-1.5 text-[15px] text-white/80">
                  <MapPin
                    aria-hidden="true"
                    className="h-4 w-4"
                    strokeWidth={1.8}
                  />
                  {next.where ??
                    (next.source === "plan"
                      ? "Place to be decided"
                      : "Location not given")}
                </p>
                <p
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[14px] font-semibold text-[#bfe6cf]"
                  data-testid="next-countdown"
                >
                  <span
                    aria-hidden="true"
                    className="cf-pulse h-1.5 w-1.5 rounded-full bg-[#7fd1a5]"
                  />
                  {startsWords(new Date(next.startsAt), now)}
                </p>
                {next.source === "agenda" ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link
                      href={`${base}/schedule/${next.id}`}
                      className="text-cf-ink inline-flex min-h-11 items-center rounded-full bg-white px-4 text-[14px] font-semibold"
                      data-testid="view-session"
                    >
                      View session
                    </Link>
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 px-4 text-[14px] font-semibold text-white"
                      aria-pressed={remind > 0}
                      onClick={() =>
                        s.setOverride(next.id, remind ? 0 : s.prefs.lead || 15)
                      }
                      data-testid="remind-me"
                    >
                      {remind ? (
                        <BellRing
                          aria-hidden="true"
                          className="h-4 w-4"
                          strokeWidth={1.8}
                        />
                      ) : (
                        <Bell
                          aria-hidden="true"
                          className="h-4 w-4"
                          strokeWidth={1.8}
                        />
                      )}
                      {remind ? `Reminder · ${remind} min before` : "Remind me"}
                    </button>
                  </div>
                ) : (
                  <Link
                    href={`${base}/plans#plan-${next.id}`}
                    className="mt-5 inline-flex min-h-11 items-center text-[14px] font-semibold text-white underline underline-offset-4"
                  >
                    Open the plan
                  </Link>
                )}
              </div>
            ) : !nn.now.length ? (
              <p className="relative text-[16px] leading-relaxed text-white/75">
                {entries.length
                  ? "That's everything on today's agenda. The evening is yours."
                  : hasAgenda
                    ? "Nothing is on the agenda today."
                    : organiser
                      ? "The agenda hasn't been published yet. Publish it and this card starts answering “what’s next?” for everyone."
                      : "The agenda hasn't been published yet."}
              </p>
            ) : null}

            <div className="relative mt-5 border-t border-white/10 pt-4">
              <Link
                href={hasAgenda ? `${base}/schedule` : `${base}/admin#agenda`}
                className="inline-flex min-h-10 items-center text-[14px] font-semibold text-white underline-offset-4 hover:underline"
              >
                {!hasAgenda && organiser
                  ? "Publish the agenda →"
                  : nn.later.length
                    ? `Then ${nn.later.length} more today · Full agenda →`
                    : "Full agenda →"}
              </Link>
            </div>
          </section>

          {evening && evening !== next ? (
            <Tonight e={evening} base={base} t={t} />
          ) : null}

          {exploreOn ? (
            <FreeTimePicks
              conferenceId={conferenceId}
              entries={entries}
              timeZone={timeZone}
              now={now}
              city={city}
            />
          ) : null}
        </div>

        {rest.length ? (
          <section className="lg:hidden" data-testid="your-day">
            <YourDay entries={rest} base={base} t={t} />
          </section>
        ) : null}
      </div>
    </header>
  );
}

function YourDay({
  entries,
  base,
  t,
}: {
  entries: readonly DayEntry[];
  base: string;
  t: (iso: string) => string;
}) {
  return (
    <>
      <p className="cf-eyebrow text-cf-mist">Your day</p>
      <ol className="divide-cf-line border-cf-line mt-3 divide-y overflow-hidden rounded-2xl border bg-white">
        {entries.slice(0, 7).map((e) => {
          const look = lookFor(e.kind);
          const href =
            e.source === "agenda"
              ? `${base}/schedule/${e.id}`
              : `${base}/plans#plan-${e.id}`;
          return (
            <li key={`${e.source}-${e.id}-${e.occurrenceId ?? ""}`}>
              <Link
                href={href}
                className="hover:bg-cf-paper grid min-h-12 grid-cols-[72px_minmax(0,1fr)] items-center gap-3 px-4 py-2.5"
              >
                <span className="text-cf-ink text-[13px] font-semibold whitespace-nowrap tabular-nums">
                  {t(e.startsAt)}
                </span>
                <span className="min-w-0">
                  <span className="text-cf-ink flex items-center gap-2 text-[15px] font-semibold">
                    <span className="truncate">{e.title}</span>
                    {e.kind === "celebration" ? (
                      <span aria-hidden="true" className="text-cf-brass">
                        ✦
                      </span>
                    ) : null}
                  </span>
                  <span className="text-cf-slate flex items-center gap-1.5 text-[12px]">
                    {e.source === "plan" ? (
                      "Planned by colleagues"
                    ) : (
                      <>
                        <look.Icon
                          aria-hidden="true"
                          className="h-3 w-3"
                          strokeWidth={1.8}
                        />
                        {e.where ?? look.label}
                      </>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function Tonight({
  e,
  base,
  t,
}: {
  e: DayEntry;
  base: string;
  t: (iso: string) => string;
}) {
  const gala = e.kind === "celebration";
  return (
    <Link
      href={`${base}/schedule/${e.id}`}
      className={`block rounded-3xl p-5 transition ${
        gala
          ? "cf-gala text-white"
          : "border-cf-line hover:border-cf-ink/25 border bg-white"
      }`}
      data-testid="tonight"
    >
      <p className={`cf-eyebrow ${gala ? "text-[#e2cc9f]" : "text-cf-brass"}`}>
        Tonight · {t(e.startsAt)}
      </p>
      <p
        className={`cf-serif mt-2 leading-snug ${gala ? "text-[24px] text-white" : "text-cf-ink text-[19px]"}`}
      >
        {e.title}
      </p>
      <p
        className={`mt-1 text-[13px] ${gala ? "text-white/70" : "text-cf-slate"}`}
      >
        {e.where ?? e.note ?? "Location not given"}
      </p>
    </Link>
  );
}
