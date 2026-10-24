import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, MapPin } from "lucide-react";
import {
  agendaEntry,
  dayEntries,
  effectiveEnd,
} from "@/domain/conference/agenda";
import { startsWords } from "@/domain/conference/moments";
import { clock, dayWords } from "@/domain/conference-plans/time";
import { conferenceContext } from "@/lib/conference/request";
import { venueAnchor } from "@/lib/conference-explore/places";
import { Panel, PanelHead, wrap } from "@/components/conference/kit";
import { lookFor } from "@/components/conference/schedule/kinds";
import { SessionActions } from "@/components/conference/schedule/SessionActions";
import { Directions } from "@/components/conference-together/Directions";

export const dynamic = "force-dynamic";

const longDay = (ymd: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${ymd}T12:00:00Z`));

/**
 * **One line of the agenda, on its own page** — the place "View session"
 * goes, and the link inside its calendar entry. What, when (and that no end
 * was given, when none was), where, what it covers, what comes before and
 * after; save, remind, add to calendar. Members only, like everything here.
 */
export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string; item: string }>;
}) {
  const { id, item: itemId } = await params;
  const ctx = await conferenceContext(id);
  if (!ctx) notFound();
  const { conference: c, viewer, now } = ctx;
  if (!c.modules.includes("schedule") && viewer.role !== "organiser")
    notFound();
  const item = (c.agenda ?? []).find((i) => i.id === itemId);
  if (!item) notFound();
  const tz = c.timeZone;
  const base = `/conferences/${c.id}`;
  const e = agendaEntry(item, tz);
  const day = dayEntries(c, item.day);
  const at = day.findIndex((x) => x.id === item.id);
  const before = at > 0 ? day[at - 1]! : null;
  const after = at >= 0 ? (day[at + 1] ?? null) : null;
  const start = new Date(e.startsAt);
  const end = effectiveEnd(e, day);
  const t = now.getTime();
  const state =
    start.getTime() > t ? "upcoming" : end.getTime() > t ? "now" : "done";
  const look = lookFor(item.kind);
  const gala = item.kind === "celebration";
  const venue = venueAnchor(c);
  const atVenue = item.where && venue;

  return (
    <div className={`${wrap} pt-5 pb-16 sm:pt-8`}>
      <Link
        href={`${base}/schedule?day=${item.day}`}
        className="text-cf-slate hover:text-cf-ink inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" /> {longDay(item.day)}
      </Link>

      <article
        className={`mt-2 max-w-[760px] rounded-3xl p-6 sm:p-9 ${
          gala
            ? "cf-gala text-white"
            : state === "now"
              ? "bg-cf-ink text-white"
              : "border-cf-line border bg-white"
        }`}
        data-testid="session"
        data-state={state}
      >
        <p
          className={`cf-eyebrow inline-flex items-center gap-1.5 ${gala || state === "now" ? "text-[#e2cc9f]" : look.eyebrow}`}
        >
          <look.Icon
            aria-hidden="true"
            className="h-3.5 w-3.5"
            strokeWidth={1.8}
          />
          {look.label}
          {state === "now"
            ? " · On now"
            : state === "done"
              ? " · Finished"
              : ""}
        </p>
        <h1 className="cf-display mt-3 text-[32px] leading-[1.08] sm:text-[44px]">
          {item.title}
        </h1>
        {item.aside ? (
          <p
            className={`cf-serif mt-3 text-[18px] italic ${gala || state === "now" ? "text-[#e2cc9f]" : "text-cf-brass"}`}
          >
            {item.aside}
          </p>
        ) : null}
        <dl
          className={`mt-6 grid gap-4 text-[15px] sm:grid-cols-2 ${gala || state === "now" ? "text-white/85" : "text-cf-graphite"}`}
        >
          <div className="flex gap-3">
            <Clock
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 shrink-0 opacity-60"
              strokeWidth={1.6}
            />
            <div>
              <dt className="sr-only">When</dt>
              <dd className="font-semibold" data-testid="session-when">
                {longDay(item.day)} · {clock(start, tz)}
                {item.end ? ` – ${clock(new Date(e.endsAt!), tz)}` : ""}
              </dd>
              <dd className="mt-0.5 text-[13px] opacity-70">
                {state === "upcoming"
                  ? start.getTime() - t < 12 * 3_600_000
                    ? startsWords(start, now)
                    : dayWords(start, tz, now)
                  : state === "now"
                    ? `Started ${clock(start, tz)}`
                    : "Finished"}
                {item.end ? "" : " · the agenda gives no end time"}
              </dd>
            </div>
          </div>
          <div className="flex gap-3">
            <MapPin
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 shrink-0 opacity-60"
              strokeWidth={1.6}
            />
            <div>
              <dt className="sr-only">Where</dt>
              <dd className="font-semibold" data-testid="session-where">
                {item.where ?? "Location not given"}
              </dd>
              {item.where && c.venue ? (
                <dd className="mt-0.5 text-[13px] opacity-70">
                  {c.venue.name}
                </dd>
              ) : null}
            </div>
          </div>
        </dl>

        {item.topics?.length ? (
          <section className="mt-7">
            <h2
              className={`cf-eyebrow ${gala || state === "now" ? "text-white/50" : "text-cf-mist"}`}
            >
              On the agenda
            </h2>
            <ol className="mt-3 space-y-2.5" data-testid="session-topics">
              {item.topics.map((topic, n) => (
                <li key={topic} className="flex gap-3 text-[16px] leading-snug">
                  <span
                    className={`cf-serif tabular-nums ${gala || state === "now" ? "text-[#e2cc9f]" : "text-cf-brass"}`}
                  >
                    {n + 1}
                  </span>
                  {topic}
                </li>
              ))}
            </ol>
          </section>
        ) : null}
        {item.note ? (
          <p
            className={`mt-6 text-[15px] leading-relaxed ${gala || state === "now" ? "text-white/75" : "text-cf-slate"}`}
          >
            {item.note}
          </p>
        ) : null}

        <div className="mt-7">
          <SessionActions
            conferenceId={c.id}
            id={item.id}
            kind={item.kind}
            title={item.title}
            dark={gala || state === "now"}
            past={state === "done"}
          />
        </div>
      </article>

      <div className="mt-6 grid max-w-[760px] grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
        {atVenue ? (
          <Panel className="min-w-0 p-5">
            <PanelHead eyebrow="Getting there" title={c.venue!.name} />
            <p className="text-cf-slate mt-1 text-[13px]">
              {item.where}
              {c.venue!.address ? ` · ${c.venue!.address}` : ""}
            </p>
            <div className="mt-4">
              <Directions name={venue.name} at={venue.at} />
            </div>
          </Panel>
        ) : null}
        {[before, after].some(Boolean) ? (
          <Panel className="min-w-0 p-5">
            <PanelHead eyebrow="Around it" title="Before and after" />
            <ul className="mt-3 space-y-2 text-[14px]">
              {[
                ["Before", before],
                ["After", after],
              ].map(([label, x]) =>
                x && typeof x === "object" ? (
                  <li key={label as string}>
                    <Link
                      href={`${base}/schedule/${x.id}`}
                      className="hover:bg-cf-paper -mx-2 flex min-h-11 items-center gap-3 rounded-lg px-2"
                    >
                      <span className="text-cf-mist w-[52px] text-[12px] font-semibold uppercase">
                        {label as string}
                      </span>
                      <span className="text-cf-ink w-[64px] font-semibold tabular-nums">
                        {clock(new Date(x.startsAt), tz)}
                      </span>
                      <span className="text-cf-ink min-w-0 flex-1 truncate">
                        {x.title}
                      </span>
                    </Link>
                  </li>
                ) : null,
              )}
            </ul>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
