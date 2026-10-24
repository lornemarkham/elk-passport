"use client";

import Link from "next/link";
import { ChevronDown, LocateFixed, MapPin } from "lucide-react";
import { effectiveEnd, type DayEntry } from "@/domain/conference/agenda";
import { startsWords } from "@/domain/conference/moments";
import { clock } from "@/domain/conference-plans/time";
import { Pill } from "../kit";
import { lookFor } from "./kinds";
import { SessionActions } from "./SessionActions";
import { useMySchedule } from "./mySchedule";
import { useNow } from "./useNow";

/**
 * **One day of the agenda, as a timeline that knows what time it is.**
 *
 * What's on now is the charcoal card (or, for the celebration, its own
 * evening dress); what's next carries its countdown; what's done steps back
 * and, on a phone, folds away so the day opens on now. Each published line
 * opens in place — topics, the organiser's note, and save / remind / add to
 * calendar — and has its own page. Colleagues' plans stay dashed and
 * marked as theirs.
 */
export function AgendaTimeline({
  conferenceId,
  timeZone,
  serverNow,
  entries,
  isToday,
}: {
  conferenceId: string;
  timeZone: string;
  serverNow: string;
  entries: readonly DayEntry[];
  isToday: boolean;
}) {
  const now = useNow(serverNow);
  const mine = useMySchedule(conferenceId);
  const base = `/conferences/${conferenceId}`;
  const t = now.getTime();
  const end = (e: DayEntry) => effectiveEnd(e, entries).getTime();
  const isDone = (e: DayEntry) => isToday && end(e) <= t;
  const isLive = (e: DayEntry) =>
    isToday && Date.parse(e.startsAt) <= t && end(e) > t;
  const upNext = isToday
    ? (entries.find((e) => Date.parse(e.startsAt) > t) ?? null)
    : null;
  const earlier = entries.filter(isDone).length;
  const anchor = entries.some(isLive) ? "now" : upNext ? "next" : null;
  const time = (iso: string) => clock(new Date(iso), timeZone);

  return (
    <>
      {earlier ? (
        // On a phone, what's finished folds away so today opens on now.
        <div className="mb-3 sm:hidden">
          <input type="checkbox" id="cf-earlier" className="peer sr-only" />
          <label
            htmlFor="cf-earlier"
            className="cf-fold peer-checked:hidden"
            data-testid="show-earlier"
          >
            Show {earlier} earlier today
            <ChevronDown aria-hidden="true" className="h-4 w-4" />
          </label>
          <label
            htmlFor="cf-earlier"
            className="cf-fold hidden peer-checked:flex"
          >
            Hide earlier
            <ChevronDown aria-hidden="true" className="h-4 w-4 rotate-180" />
          </label>
        </div>
      ) : null}

      <ol className="relative" data-testid="agenda">
        <span
          aria-hidden="true"
          className="bg-cf-line absolute top-2 bottom-2 left-[66px] w-px sm:left-[108px]"
        />
        {entries.map((e) => {
          const live = isLive(e);
          const done = isDone(e);
          const next = e === upNext;
          const plan = e.source === "plan";
          const look = lookFor(e.kind);
          const gala = !plan && e.kind === "celebration";
          const dark = (live && !plan) || gala;
          const saved = !plan && mine.isSaved(e.id);
          const where = e.where ?? (plan ? "Place to be decided" : null);
          const pills = (
            <div className="flex flex-wrap items-center gap-2 empty:hidden">
              {!plan && !look.compact ? (
                <span
                  className={`cf-eyebrow inline-flex items-center gap-1.5 ${dark ? "text-[#e2cc9f]" : look.eyebrow}`}
                >
                  <look.Icon
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                    strokeWidth={1.8}
                  />
                  {look.label}
                </span>
              ) : null}
              {live ? (
                <Pill tone="live" dot>
                  Now
                </Pill>
              ) : null}
              {next ? (
                <Pill
                  tone="neutral"
                  data-testid="agenda-next"
                  className={dark ? "!bg-white/15 !text-white" : ""}
                >
                  Next · {startsWords(new Date(e.startsAt), now).toLowerCase()}
                </Pill>
              ) : null}
              {e.featured && e.kind !== "celebration" ? (
                <Pill
                  tone="neutral"
                  className={
                    dark
                      ? "!bg-white/15 !text-white"
                      : "!bg-cf-brass/15 !text-[#7a5a28]"
                  }
                >
                  Featured
                </Pill>
              ) : null}
              {saved ? (
                <span
                  className={`text-[12px] font-semibold ${dark ? "text-[#e2cc9f]" : "text-[#7a5a28]"}`}
                >
                  ★ In my schedule
                </span>
              ) : null}
              {plan ? (
                <span
                  className={`cf-eyebrow ${live ? "text-white/60" : "text-cf-brass"}`}
                >
                  {e.kindLabel} · planned by colleagues
                </span>
              ) : null}
            </div>
          );

          const card = plan ? (
            <Link
              href={`${base}/plans#plan-${e.id}`}
              className={`block rounded-2xl px-4 py-3 transition sm:px-5 sm:py-4 ${
                live
                  ? "bg-cf-ink text-white"
                  : "border-cf-line hover:border-cf-ink/25 border border-dashed bg-white/70"
              }`}
            >
              {pills}
              <p
                className={`cf-serif mt-1 text-[17px] leading-snug ${live ? "text-white" : "text-cf-ink"}`}
              >
                {e.title}
              </p>
              <p
                className={`mt-1 text-[13px] ${live ? "text-white/65" : "text-cf-slate"}`}
              >
                {where} · {e.going ?? 0} going
                {e.mine
                  ? ` · you: ${e.mine === "in" ? "I'm in" : e.mine === "maybe" ? "maybe" : "can't make it"}`
                  : ""}
              </p>
            </Link>
          ) : look.compact && !live ? (
            // A break: one quiet line.
            <div
              className="flex min-h-11 items-center gap-2 px-1 py-2"
              data-kind={e.kind}
            >
              <look.Icon
                aria-hidden="true"
                className="text-cf-mist h-4 w-4 shrink-0"
                strokeWidth={1.8}
              />
              <span className="text-cf-slate min-w-0 text-[14px] font-semibold">
                {e.title}
              </span>
              {next ? (
                <span className="text-cf-mist text-[12px] whitespace-nowrap">
                  · {startsWords(new Date(e.startsAt), now).toLowerCase()}
                </span>
              ) : null}
            </div>
          ) : (
            <details
              className={`cf-details group rounded-2xl transition ${
                gala
                  ? look.card
                  : live
                    ? "bg-cf-ink text-white shadow-[0_16px_40px_-20px_rgba(23,24,27,0.6)]"
                    : next
                      ? `${look.card} ring-cf-ink/25 shadow-[0_8px_24px_-16px_rgba(23,24,27,0.5)] ring-1`
                      : look.card
              }`}
              open={live || undefined}
              data-kind={e.kind}
            >
              <summary className="cursor-pointer list-none px-4 py-3 sm:px-5 sm:py-4">
                {pills}
                <div className="flex items-start gap-3">
                  <p
                    className={`cf-serif mt-1 min-w-0 flex-1 leading-snug ${
                      gala
                        ? "text-[21px] sm:text-[24px]"
                        : "text-[17px] sm:text-[19px]"
                    } ${dark ? "text-white" : "text-cf-ink"}`}
                  >
                    {e.title}
                  </p>
                  <ChevronDown
                    aria-hidden="true"
                    className={`mt-2 h-4 w-4 shrink-0 transition group-open:rotate-180 ${dark ? "text-white/50" : "text-cf-mist"}`}
                  />
                </div>
                <p
                  className={`mt-1 flex items-start gap-1.5 text-[13px] sm:text-[14px] ${dark ? "text-white/70" : "text-cf-slate"}`}
                >
                  <MapPin
                    aria-hidden="true"
                    className="mt-[3px] h-3.5 w-3.5 shrink-0"
                    strokeWidth={1.8}
                  />
                  <span className="min-w-0">
                    {where ?? "Location not given"}
                  </span>
                </p>
                {e.aside ? (
                  <p
                    className={`cf-serif mt-2 text-[15px] italic ${dark ? "text-[#e2cc9f]" : "text-cf-brass"}`}
                  >
                    {e.aside}
                  </p>
                ) : null}
              </summary>
              <div
                className={`border-t px-4 pt-3 pb-4 sm:px-5 ${dark ? "border-white/10" : "border-cf-line"}`}
              >
                {e.topics?.length ? (
                  <ul
                    className={`space-y-1.5 text-[14px] leading-snug ${dark ? "text-white/85" : "text-cf-graphite"}`}
                    data-testid="session-topics"
                  >
                    {e.topics.map((topic) => (
                      <li key={topic} className="flex gap-2">
                        <span
                          aria-hidden="true"
                          className={dark ? "text-[#e2cc9f]" : "text-cf-brass"}
                        >
                          —
                        </span>
                        {topic}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {e.note ? (
                  <p
                    className={`mt-2 text-[14px] leading-relaxed first:mt-0 ${dark ? "text-white/75" : "text-cf-slate"}`}
                  >
                    {e.note}
                  </p>
                ) : null}
                <p
                  className={`mt-2 text-[12px] first:mt-0 ${dark ? "text-white/50" : "text-cf-mist"}`}
                >
                  {e.endsAt
                    ? `${time(e.startsAt)} – ${time(e.endsAt)}`
                    : `Starts ${time(e.startsAt)} · the agenda gives no end time`}
                </p>
                <div className="mt-3">
                  <SessionActions
                    conferenceId={conferenceId}
                    id={e.id}
                    kind={e.kind}
                    title={e.title}
                    dark={dark}
                    past={done}
                  />
                </div>
                <Link
                  href={`${base}/schedule/${e.id}`}
                  className={`mt-3 inline-flex min-h-10 items-center text-[13px] font-semibold underline-offset-4 hover:underline ${dark ? "text-white" : "text-cf-ink"}`}
                >
                  Session page →
                </Link>
              </div>
            </details>
          );

          return (
            <li
              key={`${e.source}-${e.id}-${e.occurrenceId ?? ""}`}
              id={live ? "now" : next ? "next" : undefined}
              className={`relative grid scroll-mt-28 grid-cols-[56px_minmax(0,1fr)] gap-5 sm:grid-cols-[92px_minmax(0,1fr)] sm:gap-8 ${
                look.compact && !live && !plan ? "pb-1" : "pb-3 sm:pb-4"
              } ${done ? "opacity-55" : ""}`}
              data-entry={e.source}
              data-entry-id={e.id}
              data-live={live ? "true" : undefined}
              data-done={done ? "" : undefined}
            >
              <div
                className={`text-right ${look.compact && !live && !plan ? "pt-2.5" : "pt-3 sm:pt-4"}`}
              >
                <p
                  className={`text-[13px] font-semibold whitespace-nowrap tabular-nums sm:text-[15px] ${look.compact && !live ? "text-cf-mist" : "text-cf-ink"}`}
                >
                  {time(e.startsAt)}
                </p>
                {e.endsAt ? (
                  <p className="text-cf-mist text-[11px] whitespace-nowrap tabular-nums sm:text-[12px]">
                    – {time(e.endsAt)}
                  </p>
                ) : null}
              </div>
              <span
                aria-hidden="true"
                className={`ring-cf-paper absolute left-[62px] h-[9px] w-[9px] rounded-full ring-4 sm:left-[104px] ${
                  look.compact && !live && !plan
                    ? "top-[16px]"
                    : "top-[18px] sm:top-[22px]"
                } ${live ? "bg-cf-sage" : plan ? "bg-cf-brass" : look.dot}`}
              />
              {card}
            </li>
          );
        })}
      </ol>

      {anchor ? (
        <a
          href={`#${anchor}`}
          className="bg-cf-ink fixed right-4 bottom-[calc(84px+env(safe-area-inset-bottom))] z-30 inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[14px] font-semibold text-white shadow-[0_10px_30px_-10px_rgba(23,24,27,0.6)] sm:static sm:mt-4 sm:shadow-none"
          data-testid="jump-to-now"
        >
          <LocateFixed
            aria-hidden="true"
            className="h-4 w-4"
            strokeWidth={1.8}
          />
          Jump to now
        </a>
      ) : null}
    </>
  );
}
