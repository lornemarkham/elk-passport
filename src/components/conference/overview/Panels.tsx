import Link from "next/link";
import { Check } from "lucide-react";
import type { ArrivalRow } from "@/domain/conference-arrivals/board";
import { timeCell } from "@/components/conference-arrivals/words";
import {
  clock,
  dayWords,
  utcToZoned,
  zonedToUtc,
} from "@/domain/conference-plans/time";
import { Avatar, AvatarStack, EmptyNote, Panel, PanelHead, Pill } from "../kit";

/**
 * The board's one honest word for where a row's information comes from. A
 * booked time that has passed with no aircraft seen is "not confirmed" —
 * never "landed" — because nothing observed it land.
 */
export function arrivalStatus(
  r: ArrivalRow,
  now?: Date,
  timeZone?: string,
): {
  label: string;
  tone: "live" | "neutral" | "quiet" | "accent";
} {
  switch (r.phase) {
    case "airborne":
      return { label: "In the air", tone: "live" };
    case "landed":
      return { label: "Landed", tone: "accent" };
    case "lost":
      return { label: "Last seen", tone: "neutral" };
    case "missed":
      return { label: "Not seen", tone: "quiet" };
  }
  const due =
    r.lands && timeZone
      ? zonedToUtc(r.lands.slice(0, 10), r.lands.slice(11, 16), timeZone)
      : null;
  if (due && now && due.getTime() < now.getTime())
    return { label: "Not confirmed", tone: "quiet" };
  return { label: "Expected", tone: "quiet" };
}

/** "11:45", or "Fri 11:45" when it isn't today where the conference is. */
export function arrivalClock(
  r: ArrivalRow,
  now: Date,
  timeZone: string,
  time: string,
) {
  if (!r.lands) return time;
  const today = utcToZoned(now, timeZone).ymd;
  const day = r.lands.slice(0, 10);
  if (day === today || !/^\d/.test(time)) return time;
  const wd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    weekday: "short",
  }).format(new Date(`${day}T12:00:00Z`));
  return `${wd} ${time}`;
}

/** Who's landing, in the board's own order and its own kinds of time. */
export function ArrivalsPanel({
  rows,
  timeZone,
  now,
  href,
  airport,
  next = null,
}: {
  rows: readonly ArrivalRow[];
  timeZone: string;
  now: Date;
  href: string;
  airport: string;
  /** The digest's soonest arrival still to come, with its kind of time. */
  next?: { name: string; at: string; estimated: boolean } | null;
}) {
  const landed = rows.filter((r) => r.phase === "landed").length;
  const shown = [...rows]
    .sort((a, b) => Number(a.phase === "landed") - Number(b.phase === "landed"))
    .slice(0, 5);
  return (
    <Panel className="p-5" data-testid="arrivals-panel">
      <PanelHead
        eyebrow={`Arrivals · ${airport}`}
        title={
          rows.length
            ? `${landed} of ${rows.length} landed`
            : "Nobody has shared a flight yet"
        }
        action={{ href, label: "Board" }}
      />
      {rows.length ? (
        <div data-testid="arrivals-summary">
          {next ? (
            <p className="text-cf-slate mt-2 text-[13px]">
              Next:{" "}
              <span className="text-cf-ink font-semibold">{next.name}</span>,{" "}
              {dayWords(new Date(next.at), timeZone, now).toLowerCase()}{" "}
              {next.estimated ? "~" : ""}
              {clock(new Date(next.at), timeZone)}
            </p>
          ) : null}
          <ul className="divide-cf-line mt-4 divide-y">
            {shown.map((r) => {
              const t = timeCell(r, timeZone);
              const s = arrivalStatus(r, now, timeZone);
              const name = r.isYou ? "You" : (r.name ?? "Someone");
              const from = r.from?.city ?? r.from?.name;
              return (
                <li key={r.memberId} className="flex items-center gap-3 py-3">
                  <Avatar
                    name={r.isYou ? "You" : name}
                    size={34}
                    you={r.isYou}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-cf-ink block truncate text-[14px] font-semibold">
                      {name}
                    </span>
                    <span className="text-cf-mist block truncate text-[12px]">
                      {from ? `From ${from} · ` : ""}
                      {r.flight}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="text-cf-ink block text-[15px] font-semibold tabular-nums">
                      {arrivalClock(r, now, timeZone, t.time)}
                    </span>
                    <Pill
                      tone={s.tone}
                      dot={s.tone === "live"}
                      className="mt-0.5"
                    >
                      {s.label}
                    </Pill>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="text-cf-slate mt-3 text-[14px] leading-relaxed">
          Flights appear here only when people choose to share them.{" "}
          <Link
            href={href}
            className="text-cf-ink font-semibold underline underline-offset-4"
          >
            Add yours
          </Link>
          .
        </p>
      )}
    </Panel>
  );
}

/** Who's here: the people who chose to be seen, and an honest count of the rest. */
export function PeoplePanel({
  names,
  total,
  href,
  sharing,
}: {
  names: readonly string[];
  total: number;
  href: string;
  sharing: readonly string[];
}) {
  const quiet = total - names.length - 1;
  return (
    <Panel className="p-5" data-testid="people-panel">
      <PanelHead
        eyebrow="People"
        title={`Who's here · ${total}`}
        action={{ href, label: "Everyone" }}
      />
      {names.length ? (
        <div className="mt-4 flex items-center gap-3">
          <AvatarStack names={names} size={34} max={6} />
          <p
            className="text-cf-slate text-[13px] leading-snug"
            data-testid="visible-people"
          >
            {names.slice(0, 3).join(", ")}
            {names.length > 3 ? ` and ${names.length - 3} more` : ""}
          </p>
        </div>
      ) : null}
      <p className="text-cf-mist mt-3 text-[13px] leading-relaxed">
        {total === 1
          ? "Just you so far."
          : quiet > 0
            ? `${quiet === 1 ? "One person is" : `${quiet} people are`} here without being listed — their choice.`
            : names.length
              ? null
              : "Nobody else has chosen to be seen yet."}
      </p>
      {sharing.length ? (
        <p className="text-cf-ink mt-3 flex items-center gap-2 text-[13px]">
          <span
            aria-hidden="true"
            className="cf-pulse bg-cf-sage h-2 w-2 rounded-full"
          />
          {sharing.join(", ")} {sharing.length === 1 ? "is" : "are"} sharing
          where they are.
        </p>
      ) : null}
    </Panel>
  );
}

export function MessagesPanel({
  messages,
  href,
}: {
  messages: readonly { id: string; name: string; body: string; you: boolean }[];
  href: string;
}) {
  return (
    <Panel className="p-5" data-testid="messages-panel">
      <PanelHead
        eyebrow="Messages"
        title="The group"
        action={{ href, label: "Open" }}
      />
      {messages.length ? (
        <Link
          href={href}
          className="mt-4 block space-y-3"
          data-testid="chat-preview"
        >
          {messages.map((m) => (
            <span key={m.id} className="flex items-start gap-2.5">
              <Avatar name={m.name} size={26} you={m.you} />
              <span className="min-w-0 text-[13px] leading-snug">
                <span className="text-cf-ink font-semibold">
                  {m.you ? "You" : m.name}
                </span>{" "}
                <span className="text-cf-slate line-clamp-2">{m.body}</span>
              </span>
            </span>
          ))}
        </Link>
      ) : (
        <p className="text-cf-slate mt-3 text-[14px]">
          Quiet so far.{" "}
          <Link
            href={href}
            className="text-cf-ink font-semibold underline underline-offset-4"
          >
            Say hello
          </Link>
          .
        </p>
      )}
    </Panel>
  );
}

export function MemoriesPanel({
  photos,
  href,
  conferenceId,
}: {
  photos: readonly { id: string; caption: string; by: string }[];
  href: string;
  conferenceId: string;
}) {
  return (
    <Panel className="p-5" data-testid="memories-panel">
      <PanelHead
        eyebrow="Memories"
        title="What we've done together"
        action={{ href, label: "Album" }}
      />
      {photos.length ? (
        <Link
          href={href}
          className="mt-4 grid grid-cols-3 gap-1.5"
          data-testid="recent-memories"
        >
          {photos.slice(0, 6).map((p) => (
            // eslint-disable-next-line @next/next/no-img-element -- private bytes from a members-only route
            <img
              key={p.id}
              src={`/api/conferences/${conferenceId}/memories/${p.id}`}
              alt={p.caption || `Photo by ${p.by}`}
              loading="lazy"
              className="aspect-square w-full rounded-lg object-cover"
            />
          ))}
        </Link>
      ) : (
        <p className="text-cf-slate mt-3 text-[14px]">
          No photos yet.{" "}
          <Link
            href={href}
            className="text-cf-ink font-semibold underline underline-offset-4"
          >
            Start the album
          </Link>
          .
        </p>
      )}
    </Panel>
  );
}

/**
 * **For the organiser only, and only until it's done:** the few things that
 * make Home useful to everyone else. Each line goes straight to the setting
 * that finishes it. It lives on Organiser settings; Home carries one line
 * (`OrganiserNudge`), so setup never crowds what attendees came for.
 */
export function OrganiserSetup({
  steps,
}: {
  steps: readonly {
    done: boolean;
    label: string;
    hint: string;
    href: string;
  }[];
}) {
  const left = steps.filter((s) => !s.done).length;
  if (!left) return null;
  return (
    <Panel className="overflow-hidden" data-testid="organiser-setup">
      <div className="border-cf-line bg-cf-paper/70 border-b px-5 py-4">
        <p className="cf-eyebrow text-cf-brass">For you, as organiser</p>
        <p className="cf-serif text-cf-ink mt-1 text-[19px]">
          {left === 1
            ? "One thing left to set up"
            : `${left} things left to set up`}
        </p>
      </div>
      <ol className="divide-cf-line divide-y">
        {steps.map((s) => (
          <li key={s.label}>
            <Link
              href={s.href}
              className={`hover:bg-cf-paper/60 flex items-start gap-3 px-5 py-3.5 transition ${s.done ? "pointer-events-none" : ""}`}
              aria-disabled={s.done || undefined}
              tabIndex={s.done ? -1 : undefined}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${s.done ? "bg-cf-sage text-white" : "border-cf-line border"}`}
              >
                {s.done ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-[14px] font-semibold ${s.done ? "text-cf-mist line-through" : "text-cf-ink"}`}
                >
                  {s.label}
                </span>
                {s.done ? null : (
                  <span className="text-cf-slate block text-[13px]">
                    {s.hint}
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/** Home's one line for an organiser with setup still to do. */
export function OrganiserNudge({ left, href }: { left: number; href: string }) {
  if (!left) return null;
  return (
    <Link
      href={href}
      data-testid="organiser-nudge"
      className="border-cf-line hover:border-cf-ink/30 flex min-h-12 items-center gap-3 rounded-2xl border bg-white px-4 py-3 transition"
    >
      <span
        aria-hidden="true"
        className="bg-cf-brass h-2 w-2 shrink-0 rounded-full"
      />
      <span className="min-w-0 flex-1 text-[14px] leading-snug">
        <span className="text-cf-ink font-semibold">
          {left === 1
            ? "One thing left to set up"
            : `${left} things left to set up`}
        </span>
        <span className="text-cf-slate hidden sm:inline">
          {" "}
          · only you see this
        </span>
      </span>
      <span className="text-cf-slate shrink-0 text-[13px] font-semibold">
        <span className="sm:hidden">Settings →</span>
        <span className="hidden sm:inline">Organiser settings →</span>
      </span>
    </Link>
  );
}

export function SoloInvite({ href }: { href: string }) {
  return (
    <EmptyNote
      title="It's just you in here so far."
      action={{ href, label: "Invite people" }}
    >
      Share a link or a code from Organiser settings. Arrivals, the agenda and
      plans fill in as people join — nothing here is made up to look busy.
    </EmptyNote>
  );
}

/** A day's published agenda in a few lines: time, what, where. */
export function AgendaGlance({
  eyebrow,
  title,
  entries,
  href,
}: {
  eyebrow: string;
  title: string;
  entries: readonly {
    key: string;
    start: string;
    end: string | null;
    title: string;
    where: string | null;
    featured: boolean;
    plan: boolean;
  }[];
  href: string;
}) {
  if (!entries.length) return null;
  return (
    <section data-testid="agenda-glance">
      <PanelHead
        eyebrow={eyebrow}
        title={title}
        action={{ href, label: "Full agenda" }}
      />
      <ol className="divide-cf-line border-cf-line mt-5 divide-y overflow-hidden rounded-2xl border bg-white">
        {entries.map((e) => (
          <li
            key={e.key}
            className="grid grid-cols-[88px_minmax(0,1fr)] gap-4 px-5 py-3.5 sm:grid-cols-[110px_minmax(0,1fr)]"
          >
            <span className="text-cf-ink text-[14px] font-semibold tabular-nums">
              {e.start}
              {e.end ? (
                <span className="text-cf-mist block text-[12px] font-normal">
                  until {e.end}
                </span>
              ) : null}
            </span>
            <span className="min-w-0">
              <span className="text-cf-ink flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                {e.title}
                {e.featured ? (
                  <Pill
                    tone="neutral"
                    className="!bg-cf-brass/15 !text-[#7a5a28]"
                  >
                    Featured
                  </Pill>
                ) : null}
                {e.plan ? (
                  <span className="cf-eyebrow text-cf-brass">Colleagues</span>
                ) : null}
              </span>
              <span className="text-cf-slate block text-[13px]">
                {e.where ?? "Location not given"}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
