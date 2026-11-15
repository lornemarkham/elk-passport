"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Car,
  Clock,
  Loader2,
  Pencil,
  Play,
  Plus,
  Share2,
  Users,
} from "lucide-react";
import type { Itinerary } from "@/domain/christmas/itinerary";
import {
  clockText,
  durationText,
  readEdits,
  writeEdits,
  type Edits,
} from "@/domain/christmas/edits";
import {
  NEED_EMOJI,
  NEED_LABEL,
  NEEDS,
  type Need,
} from "@/domain/christmas/request";
import type { Party } from "@/domain/christmas/discover";
import { tourQuery } from "@/domain/christmas/lights/tour";
import { cn } from "@/lib/utils";
import { StopCard, TravelLine, type StopChange } from "./StopCard";
import { LiveDay } from "./LiveDay";
import { Moments } from "./Moments";

/**
 * **Screen two: your Christmas plan.** A clean, phone-first itinerary —
 * time, stop, picture, why it's here — with three actions: **Edit Plan**
 * (replace, re-time, remove, add, nearby), **Share** (a link that opens the
 * same plan; signed in, an adventure your people join and vote on), and
 * **Start Day** (what's next, directions, running late, then memories).
 */
export function ItineraryView({
  itinerary,
  say,
  query,
  signedIn,
  party,
  romantic,
}: {
  readonly itinerary: Itinerary;
  readonly say: string;
  readonly query: Readonly<Record<string, string>>;
  readonly signedIn: boolean;
  readonly party: Party | null;
  readonly romantic: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [live, setLive] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const edits = useMemo(() => readEdits(query), [query]);

  const href = (next: Edits) => {
    const q = new URLSearchParams({ say });
    if (query.at) q.set("at", query.at);
    for (const [k, v] of Object.entries(writeEdits(next))) q.set(k, v);
    return `/christmas/itinerary?${q.toString()}`;
  };
  const hrefFor = (need: Need) => (change: StopChange) => {
    const drop = new Set(edits.drop ?? []);
    const add = new Set(edits.add ?? []);
    const pick = { ...(edits.pick ?? {}) };
    const times = { ...(edits.times ?? {}) };
    switch (change.kind) {
      case "drop":
        drop.add(need);
        add.delete(need);
        delete pick[need];
        delete times[need];
        break;
      case "pick":
        pick[need] = change.ref;
        break;
      case "time":
        times[need] = change.minutes;
        break;
      case "day":
        return href({ ...edits, day: change.day });
      case "add":
        drop.delete(change.need);
        add.add(change.need);
        if (change.ref) pick[change.need] = change.ref;
        break;
    }
    return href({ ...edits, drop: [...drop], add: [...add], pick, times });
  };
  const addHref = (need: Need) => {
    const drop = new Set(edits.drop ?? []);
    drop.delete(need);
    return href({
      ...edits,
      drop: [...drop],
      add: [...(edits.add ?? []), need],
    });
  };

  const inPlan = new Set(itinerary.stops.map((s) => s.need));
  const canAdd = NEEDS.filter((n) => !inPlan.has(n));
  const said = itinerary.stops.filter((s) => s.said || s.status === "planned");
  const quiet = itinerary.stops.filter(
    (s) => !s.said && s.status === "unresolved",
  );
  const planned = itinerary.stops.filter((s) => s.status === "planned");
  const lightsStop = planned.find((s) => s.need === "lights");

  async function share() {
    setNote(null);
    if (signedIn) {
      setSharing(true);
      try {
        const response = await fetch("/christmas/api/itinerary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        const body = await response.json().catch(() => ({}));
        if (response.status === 401) {
          window.location.href = `/auth?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
          return;
        }
        if (!response.ok || !body.id) {
          setNote(body.error ?? "Couldn't save it. Please try again.");
          return;
        }
        router.push(`/christmas/adventure/${body.id}?started=itinerary`);
      } catch {
        setNote("Couldn't save it. Please try again.");
      } finally {
        setSharing(false);
      }
      return;
    }
    const url = window.location.href;
    const text = `${itinerary.title} — ${itinerary.dayLabel}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: itinerary.title, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setNote("Link copied — anyone who opens it sees this plan.");
    } catch {
      setNote(`Copy this link to share it: ${url}`);
    }
  }

  if (live)
    return (
      <LiveDay
        itinerary={itinerary}
        storageKey={`passport.christmas.live:${say}|${itinerary.day}|${itinerary.from.id}`}
        onClose={() => setLive(false)}
        signedIn={signedIn}
        onKeep={share}
      />
    );

  return (
    <div data-testid="itinerary">
      <section className="-mt-2 rounded-[28px] bg-[#082319] p-5 text-white shadow-xl">
        <p className="text-xs font-bold tracking-[0.18em] text-[#ffd98a] uppercase">
          Your Christmas plan
        </p>
        <h1
          className="ghad-display mt-2 text-[2.2rem] leading-[0.95] font-extrabold tracking-[-0.03em] text-balance uppercase"
          data-testid="itinerary-title"
        >
          {itinerary.title}
        </h1>
        <p className="mt-2 text-sm text-white/75">“{say}”</p>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <Fact
            icon={<CalendarDays className="h-4 w-4" />}
            label="Date"
            value={itinerary.dayLabel}
            testid="itinerary-date"
          />
          <Fact
            icon={<Clock className="h-4 w-4" />}
            label="Time"
            value={
              itinerary.start !== undefined && itinerary.end !== undefined
                ? `${clockText(itinerary.start)} – ${clockText(itinerary.end)} · ${durationText(itinerary.totalMinutes)}`
                : "—"
            }
            testid="itinerary-duration"
          />
          <Fact
            icon={<Car className="h-4 w-4" />}
            label={itinerary.mode === "walk" ? "Walking" : "Driving"}
            value={`${planned.length ? `${itinerary.km} km` : "—"} from ${itinerary.from.name}${itinerary.leaveAt !== undefined ? ` · leave ${clockText(itinerary.leaveAt)}` : ""}`}
            testid="itinerary-distance"
          />
          <Fact
            icon={<Users className="h-4 w-4" />}
            label="Who"
            value={itinerary.who ?? "Say who's coming in your words"}
            testid="itinerary-who"
          />
        </dl>
        {itinerary.budget && (
          <p
            className="mt-3 text-sm text-white/85"
            data-testid="itinerary-budget"
          >
            💰 {itinerary.budget}
          </p>
        )}
        {itinerary.homeBy && (
          <p
            className="mt-2 text-sm text-[#ffd98a]"
            data-testid="itinerary-home-by"
          >
            🏠 {itinerary.homeBy}
          </p>
        )}
        <p className="mt-3 text-sm font-semibold" data-testid="itinerary-count">
          {itinerary.planned} of {itinerary.stops.length} parts planned
          {itinerary.unresolved > 0
            ? ` · ${itinerary.unresolved} couldn't be confirmed — said below`
            : " · everything you asked for"}
        </p>
      </section>

      {itinerary.question && (
        <section
          className="mt-4 rounded-[22px] bg-white p-4 ring-2 ring-[#ffd98a]"
          data-testid="itinerary-question"
        >
          <p className="font-extrabold">
            {itinerary.question.ask}{" "}
            <span className="font-normal text-[var(--gh-ink-soft)]">
              Planned for {itinerary.dayLabel} until you say.
            </span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {itinerary.question.options.map((o) => (
              <Link
                key={o.day}
                href={href({ ...edits, day: o.day })}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold ring-1",
                  o.day === itinerary.day
                    ? "bg-[#0f3b2b] text-white ring-[#0f3b2b]"
                    : "bg-white ring-black/15",
                )}
                data-testid="question-day"
              >
                {o.label}
              </Link>
            ))}
            <form
              action="/christmas/itinerary"
              className="inline-flex items-center gap-1"
            >
              {Object.entries({ ...query, ...writeEdits(edits) })
                .filter(([k]) => k !== "day")
                .map(([k, v]) => (
                  <input key={k} type="hidden" name={k} value={v} />
                ))}
              <input
                type="date"
                name="day"
                aria-label="Pick a date"
                className="min-h-11 rounded-full border-2 border-black/10 px-3 text-sm"
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
              />
            </form>
          </div>
        </section>
      )}

      <ol className="mt-5 space-y-1" data-testid="itinerary-stops">
        {said.map((stop, i) => (
          <li key={stop.need}>
            {stop.travel && i > 0 && (
              <TravelLine
                minutes={stop.travel.minutes}
                km={stop.travel.km}
                mode={itinerary.mode}
              />
            )}
            <div className="flex items-baseline gap-3 pt-2 pb-2">
              <span
                className="ghad-display min-w-[5.2rem] text-lg font-extrabold text-[#b3242f]"
                data-testid="stop-time"
              >
                {stop.time !== undefined
                  ? `${stop.timeIs === "about" ? "~" : ""}${clockText(stop.time)}`
                  : "—"}
              </span>
              <span className="text-base font-extrabold tracking-wide uppercase">
                {stop.label}
              </span>
            </div>
            <StopCard
              stop={stop}
              editing={editing}
              hrefFor={hrefFor(stop.need)}
              {...(stop.need === "lights" && stopTour(itinerary, stop)
                ? { tour: stopTour(itinerary, stop)! }
                : {})}
            />
          </li>
        ))}
      </ol>

      {quiet.length > 0 && (
        <p
          className="mt-4 rounded-[18px] bg-white/70 p-3 text-sm text-[var(--gh-ink-soft)]"
          data-testid="itinerary-also"
        >
          Passport also looked for{" "}
          {quiet.map((s, i) => (
            <span key={s.need}>
              {i > 0 ? (i === quiet.length - 1 ? " and " : ", ") : ""}
              <strong>{s.label.toLowerCase()}</strong>
              {s.tryDay ? (
                <>
                  {" "}
                  (nothing confirmed that day —{" "}
                  <Link
                    href={hrefFor(s.need)({ kind: "day", day: s.tryDay.day })}
                    className="underline"
                  >
                    try {s.tryDay.label}
                  </Link>
                  )
                </>
              ) : (
                " (nothing confirmed near you)"
              )}
            </span>
          ))}
          .
        </p>
      )}

      {(editing || planned.length === 0) && (
        <section
          className="mt-6 rounded-[22px] bg-white p-4 ring-1 ring-black/5"
          data-testid="add-stop"
        >
          <p className="flex items-center gap-2 font-extrabold">
            <Plus className="h-4 w-4" aria-hidden /> Add a stop
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {canAdd.map((need) => (
              <Link
                key={need}
                href={addHref(need)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[#f6f1e7] px-4 text-sm font-bold hover:bg-[#ebe1cd]"
                data-testid={`add-${need}`}
              >
                <span aria-hidden>{NEED_EMOJI[need]}</span>
                {NEED_LABEL[need]}
              </Link>
            ))}
          </div>
          <form action="/christmas/itinerary" className="mt-4 flex gap-2">
            {query.at && <input type="hidden" name="at" value={query.at} />}
            <input
              name="say"
              defaultValue={say}
              aria-label="Change what you asked for"
              className="min-h-12 w-full rounded-full border-2 border-black/10 px-4"
              maxLength={240}
            />
            <button className="min-h-12 shrink-0 rounded-full bg-[#0f3b2b] px-4 font-bold text-white">
              Re-plan
            </button>
          </form>
        </section>
      )}

      <Moments
        party={party}
        romantic={romantic}
        needs={planned.map((s) => s.need)}
        displays={
          lightsStop?.displays ?? (lightsStop?.place ? [lightsStop.place] : [])
        }
      />

      {note && (
        <p
          role="status"
          className="mt-4 rounded-2xl bg-[#ffd98a] p-3 text-sm font-semibold text-[#082319]"
          data-testid="itinerary-note"
        >
          {note}
        </p>
      )}
      {!signedIn && (
        <p className="mt-4 text-center text-sm text-[var(--gh-ink-soft)]">
          Want your people to vote and add photos?{" "}
          <Link
            href={`/auth?next=${encodeURIComponent(`/christmas/itinerary?${new URLSearchParams(query).toString()}`)}`}
            className="font-bold underline"
            data-testid="itinerary-sign-in"
          >
            Sign in to plan it together
          </Link>
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-[#fffaf2]/95 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto grid max-w-2xl grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            aria-pressed={editing}
            className={cn(
              "inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full text-sm font-extrabold ring-2",
              editing
                ? "bg-[#0f3b2b] text-white ring-[#0f3b2b]"
                : "bg-white ring-[#0f3b2b]",
            )}
            data-testid="action-edit"
          >
            <Pencil className="h-4 w-4" aria-hidden />
            {editing ? "Done" : "Edit Plan"}
          </button>
          <button
            type="button"
            onClick={share}
            disabled={sharing}
            className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-white text-sm font-extrabold ring-2 ring-[#b3242f]"
            data-testid="action-share"
          >
            {sharing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Share2 className="h-4 w-4" aria-hidden />
            )}
            Share
          </button>
          <button
            type="button"
            onClick={() => setLive(true)}
            disabled={planned.length === 0}
            className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-[#b3242f] text-sm font-extrabold text-white disabled:opacity-50"
            data-testid="action-start"
          >
            <Play className="h-4 w-4" aria-hidden />
            Start Day
          </button>
        </div>
      </div>
    </div>
  );
}

function stopTour(
  itinerary: Itinerary,
  stop: Itinerary["stops"][number],
): string | undefined {
  const ids = (stop.displays ?? (stop.place ? [stop.place] : []))
    .filter((p) => p.source === "map")
    .map((p) => p.ref.slice(4));
  if (!ids.length) return undefined;
  return `/christmas/lights/tour?${tourQuery({
    from: { lat: itinerary.from.latitude, lng: itinerary.from.longitude },
    mode: itinerary.mode,
    stops: ids,
  })}`;
}

function Fact({
  icon,
  label,
  value,
  testid,
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly value: string;
  readonly testid: string;
}) {
  return (
    <div className="rounded-2xl bg-white/10 p-2.5" data-testid={testid}>
      <dt className="flex items-center gap-1 text-[11px] font-bold tracking-[0.12em] text-[#ffd98a] uppercase">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 leading-snug font-semibold">{value}</dd>
    </div>
  );
}
