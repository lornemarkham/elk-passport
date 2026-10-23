"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PlanPhoto } from "@/components/hockey/VenueCard";
import { field, primary, Problem, secondary } from "@/components/conference/ui";
import {
  ACTIVITY_KINDS,
  ANSWER_WORDS,
  KINDS,
  type ActivityKind,
  type Answer,
} from "@/domain/conference-plans/types";
import {
  clock,
  dayWords,
  shortDay,
  utcToZoned,
} from "@/domain/conference-plans/time";
import type {
  OccurrenceView,
  PlaceFacts,
  PlanView,
} from "@/domain/conference-plans/views";
import type { ExplorePlace } from "@/domain/conference-explore/explore";
import type { PlansBoard as Board } from "@/lib/conference-plans/service";
import { Directions } from "./Directions";
import { send, usePoll } from "./usePoll";

export interface DayChoice {
  readonly ymd: string;
  readonly label: string;
}

export interface Prefill {
  readonly kind?: ActivityKind;
  readonly venueId?: string;
  readonly venueName?: string;
  readonly title?: string;
  readonly meeting?: string;
  readonly day?: string;
  readonly time?: string;
  readonly open?: boolean;
}

/**
 * **Plans: make one, or join one.** Every plan the person may see, with
 * each occurrence answered separately, the place vote where there is one,
 * and a way into the plan's own chat thread.
 */
export function PlansBoard({
  conferenceId,
  initial,
  days,
  meetingIdeas,
  prefill,
}: {
  conferenceId: string;
  initial: Board;
  days: readonly DayChoice[];
  meetingIdeas: readonly { id: string; name: string }[];
  prefill?: Prefill;
}) {
  const api = `/api/conferences/${conferenceId}/plans`;
  const {
    data: board,
    setData,
    refresh,
  } = usePoll(api, (j) => j.board as Board, initial);
  const [making, setMaking] = useState(!!prefill?.open);
  const [editing, setEditing] = useState<PlanView | null>(null);
  const now = new Date(board.at);

  const act = async (b: Record<string, unknown>) => {
    const r = await send(api, b);
    if (r.ok) await refresh();
    return r;
  };

  const upcoming = board.plans.filter((p) => p.next);
  const past = board.plans.filter((p) => !p.next);

  return (
    <div className="mx-auto max-w-[760px] px-5 pb-16">
      {!making && !editing ? (
        <button
          type="button"
          onClick={() => setMaking(true)}
          className="mt-6 w-full rounded-2xl bg-black px-5 py-4 text-left text-[19px] font-black text-white"
        >
          + Make a plan
          <span className="block text-[14px] font-medium text-white/70">
            A walk, coffee, lunch, dinner, drinks — on one day or several.
          </span>
        </button>
      ) : (
        <PlanForm
          key={editing?.id ?? "new"}
          board={board}
          days={days}
          meetingIdeas={meetingIdeas}
          prefill={editing ? undefined : prefill}
          editing={editing}
          onDone={async (planId) => {
            setMaking(false);
            setEditing(null);
            await refresh();
            if (planId)
              document
                .getElementById(`plan-${planId}`)
                ?.scrollIntoView({ block: "start" });
          }}
          api={api}
          conferenceId={conferenceId}
        />
      )}

      {upcoming.length ? (
        <ul className="mt-8 flex flex-col gap-4" data-testid="plans">
          {upcoming.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              conferenceId={conferenceId}
              timeZone={board.timeZone}
              now={now}
              act={act}
              onEdit={() => {
                setMaking(false);
                setEditing(p);
                window.scrollTo({ top: 0 });
              }}
              onLocal={(next) =>
                setData({
                  ...board,
                  plans: board.plans.map((x) => (x.id === next.id ? next : x)),
                })
              }
            />
          ))}
        </ul>
      ) : (
        <p className="mt-8 rounded-2xl bg-black/[0.04] p-5 text-[16px] text-black/65">
          Nothing planned yet. The first plan is usually somebody saying
          &ldquo;Coffee at 8, anyone?&rdquo; — be that somebody.
        </p>
      )}

      {past.length ? (
        <details className="mt-10">
          <summary className="min-h-11 cursor-pointer text-[13px] font-bold tracking-[0.14em] text-black/50 uppercase">
            Already happened · {past.length}
          </summary>
          <ul className="mt-3 flex flex-col gap-3">
            {past.map((p) => (
              <li key={p.id} className="rounded-2xl border border-black/10 p-4">
                <span className="text-[15px] font-bold">
                  {p.emoji} {p.title}
                </span>
                <span className="block text-[14px] text-black/55">
                  {p.occurrences
                    .map((o) => shortDay(new Date(o.startsAt), board.timeZone))
                    .join(" · ")}{" "}
                  ·{" "}
                  <Link
                    href={`/conferences/${conferenceId}/memories?plan=${p.id}`}
                    className="underline"
                  >
                    Add photos
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

// ── One plan ─────────────────────────────────────────────────────────────

function PlanCard({
  plan: p,
  conferenceId,
  timeZone,
  now,
  act,
  onEdit,
  onLocal,
}: {
  plan: PlanView;
  conferenceId: string;
  timeZone: string;
  now: Date;
  act: (
    b: Record<string, unknown>,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  onEdit: () => void;
  onLocal: (p: PlanView) => void;
}) {
  const [problem, setProblem] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const answer = async (o: OccurrenceView, a: Answer) => {
    const next = o.mine === a ? null : a;
    // Optimistic: the button moves now; the server's answer replaces it.
    onLocal({
      ...p,
      occurrences: p.occurrences.map((x) =>
        x.id === o.id ? { ...x, mine: next } : x,
      ),
    });
    const r = await act({
      action: "answer",
      planId: p.id,
      occurrenceId: o.id,
      answer: next,
    });
    setProblem(r.ok ? "" : r.message);
  };

  const meetingAt = p.meeting?.place?.at;
  const venueAt = p.venue && "at" in p.venue ? p.venue.at : undefined;

  return (
    <li
      id={`plan-${p.id}`}
      className="scroll-mt-4 rounded-3xl border border-black/10 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.04)]"
      data-testid="plan"
      data-plan={p.title}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-bold tracking-[0.12em] text-black/50 uppercase">
          {p.emoji} {p.kindLabel}
          {p.audience === "selected" ? " · Invite only" : ""}
        </p>
        {p.canManage ? (
          <span className="flex gap-1">
            <button
              type="button"
              onClick={onEdit}
              className="min-h-11 px-2 text-[14px] font-semibold underline"
            >
              Edit
            </button>
            {cancelling ? (
              <button
                type="button"
                onClick={async () => {
                  const r = await act({ action: "cancel", planId: p.id });
                  if (!r.ok) setProblem(r.message);
                }}
                className="min-h-11 rounded-lg bg-[#b42318] px-3 text-[14px] font-bold text-white"
              >
                Yes, cancel it
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCancelling(true)}
                className="min-h-11 px-2 text-[14px] text-black/55 underline"
              >
                Cancel plan
              </button>
            )}
          </span>
        ) : null}
      </div>
      <h3 className="mt-1 text-[22px] leading-tight font-black tracking-[-0.01em]">
        {p.title}
      </h3>
      <p className="mt-1 text-[14px] text-black/55">
        {p.organiser.you
          ? "You organised this"
          : `Organised by ${p.organiser.name ?? "a coworker"}`}
        {p.audience === "selected"
          ? ` · for ${p.invited.map((x) => (x.you ? "you" : x.name)).join(", ") || `${p.invitedCount} people`}`
          : " · everyone's invited"}
      </p>
      {p.description ? (
        <p className="mt-3 text-[16px] whitespace-pre-line text-black/80">
          {p.description}
        </p>
      ) : null}

      {p.meeting ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-black/[0.04] p-3">
          <span className="text-[15px]">
            <span className="font-bold">Meet:</span> {p.meeting.label}
            {p.meeting.place?.address ? (
              <span className="block text-[13px] text-black/55">
                {p.meeting.place.address}
              </span>
            ) : null}
          </span>
          {meetingAt ? (
            <Directions name={p.meeting.label} at={meetingAt} compact />
          ) : null}
        </div>
      ) : null}

      {p.venue ? (
        <VenueLine place={p.venue} label="Going to" at={venueAt} />
      ) : null}

      <ul className="mt-4 flex flex-col gap-3">
        {p.occurrences.map((o) => (
          <Occurrence
            key={o.id}
            o={o}
            timeZone={timeZone}
            now={now}
            onAnswer={(a) => answer(o, a)}
          />
        ))}
      </ul>

      {p.votes ? (
        <VenueVote
          plan={p}
          conferenceId={conferenceId}
          act={act}
          setProblem={setProblem}
        />
      ) : null}

      <Problem>{problem}</Problem>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/conferences/${conferenceId}/chat?room=${p.id}`}
          className={`${secondary} inline-flex min-h-11 items-center`}
        >
          💬 Talk about it
        </Link>
      </div>
    </li>
  );
}

function Occurrence({
  o,
  timeZone,
  now,
  onAnswer,
}: {
  o: OccurrenceView;
  timeZone: string;
  now: Date;
  onAnswer: (a: Answer) => void;
}) {
  const at = new Date(o.startsAt);
  const names = [...o.going.map((g) => (g.you ? "You" : g.name))];
  const done = o.status === "past";
  return (
    <li
      className="rounded-2xl border border-black/10 p-3"
      data-testid="occurrence"
      data-day={utcToZoned(at, timeZone).ymd}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[17px] font-bold">
          {dayWords(at, timeZone, now)} · {clock(at, timeZone)}
        </span>
        {o.status === "soon" || o.status === "now" ? (
          <span className="rounded-full bg-[#ffd84d] px-2 py-0.5 text-[12px] font-bold">
            {o.status === "now" ? "Happening now" : "Starting soon"}
          </span>
        ) : done ? (
          <span className="text-[13px] text-black/45">Done</span>
        ) : null}
      </div>
      <p className="mt-1 text-[14px] text-black/60" data-testid="who">
        {o.counts.in} in
        {o.counts.maybe ? ` · ${o.counts.maybe} maybe` : ""}
        {names.length ? ` — ${names.join(", ")}` : ""}
        {o.unnamed ? ` +${o.unnamed} more` : ""}
        {o.maybe.length
          ? ` · maybe: ${o.maybe.map((m) => (m.you ? "you" : m.name)).join(", ")}`
          : ""}
      </p>
      {!done ? (
        <div
          className="mt-2 grid grid-cols-3 gap-2"
          role="group"
          aria-label={`Your answer for ${shortDay(at, timeZone)}`}
        >
          {(["in", "maybe", "out"] as const).map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={o.mine === a}
              onClick={() => onAnswer(a)}
              className={`min-h-11 rounded-xl border px-2 text-[14px] font-bold ${
                o.mine === a
                  ? a === "in"
                    ? "border-black bg-black text-white"
                    : a === "maybe"
                      ? "border-black bg-black/10"
                      : "border-black/40 bg-black/[0.03] text-black/60"
                  : "border-black/15"
              }`}
            >
              {ANSWER_WORDS[a]}
            </button>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function VenueLine({
  place,
  label,
  at,
}: {
  place: PlaceFacts | { id: string; name: string };
  label: string;
  at?: readonly [number, number];
}) {
  const image = "image" in place ? place.image : undefined;
  return (
    <div className="mt-3 flex items-center gap-3 rounded-2xl bg-black/[0.04] p-3">
      <PlanPhoto
        url={image}
        className="h-14 w-14 shrink-0 rounded-xl object-cover"
        fallback={
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-black/10 text-[22px]">
            📍
          </span>
        }
      />
      <span className="min-w-0 flex-1 text-[15px]">
        <span className="font-bold">{label}:</span> {place.name}
        {"address" in place && place.address ? (
          <span className="block text-[13px] text-black/55">
            {place.address}
          </span>
        ) : null}
      </span>
      {at ? <Directions name={place.name} at={at} compact /> : null}
    </div>
  );
}

// ── Where shall we go? ──────────────────────────────────────────────────

function VenueVote({
  plan: p,
  conferenceId,
  act,
  setProblem,
}: {
  plan: PlanView;
  conferenceId: string;
  act: (
    b: Record<string, unknown>,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  setProblem: (s: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  return (
    <section className="mt-5" aria-label="Where shall we go?">
      <h4 className="text-[13px] font-bold tracking-[0.14em] text-black/50 uppercase">
        Where shall we go?
      </h4>
      {p.options.length ? (
        <ul className="mt-2 flex flex-col gap-2" data-testid="venue-options">
          {p.options.map((o) => {
            const image = "image" in o.place ? o.place.image : undefined;
            const chosen = p.venue?.id === o.place.id;
            return (
              <li
                key={o.id}
                className={`flex items-center gap-3 rounded-2xl border p-2 ${
                  chosen ? "border-black" : "border-black/10"
                }`}
              >
                <PlanPhoto
                  url={image}
                  className="h-14 w-14 shrink-0 rounded-xl object-cover"
                  fallback={
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-black/10 text-[22px]">
                      🍽️
                    </span>
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-bold">
                    {o.place.name}
                  </span>
                  <span className="text-[13px] text-black/55">
                    {o.votes} vote{o.votes === 1 ? "" : "s"}
                    {o.leading && o.votes ? " · leading" : ""}
                    {chosen ? " · chosen" : ""}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col gap-1 sm:flex-row">
                  <button
                    type="button"
                    aria-pressed={o.mine}
                    aria-label={`Vote for ${o.place.name}`}
                    onClick={async () => {
                      const r = await act({
                        action: "vote",
                        planId: p.id,
                        optionId: o.mine ? null : o.id,
                      });
                      setProblem(r.ok ? "" : r.message);
                    }}
                    className={`min-h-11 rounded-xl px-3 text-[14px] font-bold ${
                      o.mine ? "bg-black text-white" : "border border-black/15"
                    }`}
                  >
                    {o.mine ? "✓ Voted" : "Vote"}
                  </button>
                  {p.canManage && !chosen ? (
                    <button
                      type="button"
                      aria-label={`Choose ${o.place.name}`}
                      onClick={async () => {
                        const r = await act({
                          action: "choose",
                          planId: p.id,
                          optionId: o.id,
                        });
                        setProblem(r.ok ? "" : r.message);
                      }}
                      className="min-h-11 rounded-xl border border-black/15 px-3 text-[14px]"
                    >
                      Choose
                    </button>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-[14px] text-black/55">
          No places yet. Suggest one and the group votes.
        </p>
      )}
      {picking ? (
        <PlacePicker
          conferenceId={conferenceId}
          kind={p.kind}
          onPick={async (place) => {
            const r = await act({
              action: "suggest",
              planId: p.id,
              placeId: place.id,
            });
            setProblem(r.ok ? "" : r.message);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className={`${secondary} mt-2 min-h-11`}
        >
          + Suggest a place
        </button>
      )}
    </section>
  );
}

/** Places from Explore for this kind of plan, photographs first. */
export function PlacePicker({
  conferenceId,
  kind,
  onPick,
  onClose,
}: {
  conferenceId: string;
  kind: ActivityKind;
  onPick: (p: ExplorePlace) => void;
  onClose: () => void;
}) {
  const shelf = KINDS[kind].shelf ?? "restaurants";
  const [places, setPlaces] = useState<ExplorePlace[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(`/api/conferences/${conferenceId}/explore`)
      .then((r) => r.json())
      .then((j) => {
        if (!live) return;
        const s = j.explore?.shelves as
          Record<string, ExplorePlace[]> | undefined;
        setPlaces(
          s
            ? [
                ...(s[shelf] ?? []),
                ...(shelf === "restaurants" ? [] : (s.restaurants ?? [])),
              ]
            : [],
        );
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [conferenceId, shelf]);
  return (
    <div
      className="mt-2 rounded-2xl border border-black/15 p-3"
      data-testid="place-picker"
    >
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-bold">Pick a place</span>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 px-2 underline"
        >
          Close
        </button>
      </div>
      {failed ? (
        <p className="text-[14px] text-black/55">Couldn&apos;t load places.</p>
      ) : !places ? (
        <p className="text-[14px] text-black/55">Finding places near you…</p>
      ) : !places.length ? (
        <p className="text-[14px] text-black/55">
          Passport doesn&apos;t know places near here yet.
        </p>
      ) : (
        <ul className="mt-1 flex max-h-[360px] flex-col gap-2 overflow-y-auto">
          {places.map((pl) => (
            <li key={pl.id}>
              <button
                type="button"
                onClick={() => onPick(pl)}
                className="flex w-full items-center gap-3 rounded-xl border border-black/10 p-2 text-left"
              >
                <PlanPhoto
                  url={pl.photo?.url}
                  className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  fallback={
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-black/10">
                      📍
                    </span>
                  }
                />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-bold">
                    {pl.name}
                  </span>
                  <span className="text-[13px] text-black/55">
                    {pl.subtype ??
                      (pl.from === "curated" ? "Passport's list" : "")}{" "}
                    · {pl.walkMinutes}+ min walk
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Making and editing ──────────────────────────────────────────────────

function PlanForm({
  board,
  days,
  meetingIdeas,
  prefill,
  editing,
  onDone,
  api,
  conferenceId,
}: {
  conferenceId: string;
  board: Board;
  days: readonly DayChoice[];
  meetingIdeas: readonly { id: string; name: string }[];
  prefill?: Prefill;
  editing: PlanView | null;
  onDone: (planId?: string) => void;
  api: string;
}) {
  const tz = board.timeZone;
  const firstTime = editing
    ? utcToZoned(new Date(editing.occurrences[0]!.startsAt), tz).hm
    : null;
  const [kind, setKind] = useState<ActivityKind>(
    editing?.kind ?? prefill?.kind ?? "morning-walk",
  );
  const [title, setTitle] = useState(editing?.title ?? prefill?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [chosenDays, setDays] = useState<Set<string>>(
    new Set(
      editing
        ? editing.occurrences.map(
            (o) => utcToZoned(new Date(o.startsAt), tz).ymd,
          )
        : prefill?.day && days.some((d) => d.ymd === prefill.day)
          ? [prefill.day]
          : [],
    ),
  );
  const [time, setTime] = useState(
    firstTime ?? prefill?.time ?? KINDS[kind].time,
  );
  const [timeTouched, setTimeTouched] = useState(!!editing || !!prefill?.time);
  const [meeting, setMeeting] = useState(
    editing?.meeting?.label ?? prefill?.meeting ?? "",
  );
  const [meetingPlaceId, setMeetingPlaceId] = useState(
    editing?.meeting?.place?.id ?? "",
  );
  const [venue, setVenue] = useState<{ id: string; name: string } | null>(
    editing?.venue
      ? { id: editing.venue.id, name: editing.venue.name }
      : prefill?.venueId
        ? { id: prefill.venueId, name: prefill.venueName ?? "A place" }
        : null,
  );
  const [audience, setAudience] = useState<"everyone" | "selected">(
    editing?.audience ?? "everyone",
  );
  const [invited, setInvited] = useState<Set<string>>(
    new Set(editing?.invited.filter((x) => !x.you).map((x) => x.memberId)),
  );
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  const pickKind = (k: ActivityKind) => {
    setKind(k);
    if (!timeTouched) setTime(KINDS[k].time);
  };

  const inPast = useMemo(() => {
    const today = utcToZoned(new Date(board.at), tz).ymd;
    return (ymd: string) => ymd < today;
  }, [board.at, tz]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const plan = {
      kind,
      title: title.trim() || KINDS[kind].example,
      description,
      days: [...chosenDays].sort(),
      time,
      meeting,
      meetingPlaceId,
      venueId: venue?.id ?? "",
      audience,
      invited: [...invited],
    };
    const r = await send(
      api,
      editing
        ? { action: "update", planId: editing.id, plan }
        : { action: "create", plan },
    );
    setBusy(false);
    if (!r.ok) return setProblem(r.message);
    onDone((r.json.planId as string | undefined) ?? editing?.id);
  };

  return (
    <form
      onSubmit={save}
      className="mt-6 rounded-3xl border-2 border-black p-5"
      aria-label={editing ? "Edit plan" : "Make a plan"}
    >
      <h2 className="text-[22px] font-black">
        {editing ? "Change the plan" : "Make a plan"}
      </h2>

      <fieldset className="mt-4">
        <legend className="text-[14px] font-bold">What kind?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {ACTIVITY_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => pickKind(k)}
              className={`min-h-11 rounded-full border px-3 text-[15px] ${
                kind === k
                  ? "border-black bg-black font-bold text-white"
                  : "border-black/15"
              }`}
            >
              {KINDS[k].emoji} {KINDS[k].label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="mt-4 block text-[14px] font-bold">
        Call it
        <input
          className={`${field} mt-1 font-normal`}
          value={title}
          maxLength={80}
          placeholder={KINDS[kind].example}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <label className="mt-4 block text-[14px] font-bold">
        Anything people should know
        <textarea
          className={`${field} mt-1 min-h-20 font-normal`}
          value={description}
          maxLength={600}
          placeholder="Seawall loop, back by 8. Bring a jacket."
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <fieldset className="mt-4">
        <legend className="text-[14px] font-bold">
          Which days?{" "}
          <span className="font-normal text-black/55">
            Pick several for a regular thing.
          </span>
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {days.map((d) => (
            <label
              key={d.ymd}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-[15px] ${
                chosenDays.has(d.ymd)
                  ? "border-black bg-black/5 font-bold"
                  : "border-black/15"
              } ${inPast(d.ymd) && !chosenDays.has(d.ymd) ? "opacity-40" : ""}`}
            >
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={chosenDays.has(d.ymd)}
                onChange={(e) => {
                  const next = new Set(chosenDays);
                  if (e.target.checked) next.add(d.ymd);
                  else next.delete(d.ymd);
                  setDays(next);
                }}
              />
              {d.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-4 block text-[14px] font-bold">
        What time?{" "}
        <span className="font-normal text-black/55">
          ({tz.split("/")[1]?.replace("_", " ")} time)
        </span>
        <input
          type="time"
          className={`${field} mt-1 max-w-[200px] font-normal`}
          value={time}
          onChange={(e) => {
            setTime(e.target.value);
            setTimeTouched(true);
          }}
          required
        />
      </label>

      <label className="mt-4 block text-[14px] font-bold">
        Where do we meet?
        <input
          className={`${field} mt-1 font-normal`}
          value={meeting}
          maxLength={80}
          placeholder="Hotel lobby"
          onChange={(e) => {
            setMeeting(e.target.value);
            setMeetingPlaceId("");
          }}
        />
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        {["Hotel lobby", ...meetingIdeas.map((m) => m.name)]
          .slice(0, 6)
          .map((name) => {
            const idea = meetingIdeas.find((m) => m.name === name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setMeeting(name);
                  setMeetingPlaceId(idea?.id ?? "");
                }}
                className="min-h-11 rounded-full border border-black/15 px-3 text-[14px]"
              >
                {name}
              </button>
            );
          })}
      </div>

      <div className="mt-4">
        <p className="text-[14px] font-bold">Going somewhere?</p>
        {venue ? (
          <p className="mt-1 flex items-center gap-2 text-[15px]">
            📍 {venue.name}
            <button
              type="button"
              className="min-h-11 px-2 underline"
              onClick={() => setVenue(null)}
            >
              Remove
            </button>
          </p>
        ) : picking ? (
          <PlacePicker
            conferenceId={conferenceId}
            kind={kind}
            onPick={(p) => {
              setVenue({ id: p.id, name: p.name });
              setPicking(false);
            }}
            onClose={() => setPicking(false)}
          />
        ) : (
          <button
            type="button"
            className={`${secondary} mt-1 min-h-11`}
            onClick={() => setPicking(true)}
          >
            Pick a place
          </button>
        )}
        {KINDS[kind].vote && !venue ? (
          <p className="mt-1 text-[13px] text-black/55">
            Or leave it open: people can suggest places and vote.
          </p>
        ) : null}
      </div>

      <fieldset className="mt-4">
        <legend className="text-[14px] font-bold">Who&apos;s invited?</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["everyone", "selected"] as const).map((a) => (
            <label
              key={a}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-[15px] ${
                audience === a ? "border-black font-bold" : "border-black/15"
              }`}
            >
              <input
                type="radio"
                name="audience"
                checked={audience === a}
                onChange={() => setAudience(a)}
              />
              {a === "everyone" ? "Everyone" : "Selected coworkers"}
            </label>
          ))}
        </div>
        {audience === "selected" ? (
          board.people.length ? (
            <div
              className="mt-2 flex flex-wrap gap-2"
              data-testid="invite-people"
            >
              {board.people.map((p) => (
                <label
                  key={p.memberId}
                  className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-[15px] ${
                    invited.has(p.memberId)
                      ? "border-black bg-black/5 font-bold"
                      : "border-black/15"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={invited.has(p.memberId)}
                    onChange={(e) => {
                      const next = new Set(invited);
                      if (e.target.checked) next.add(p.memberId);
                      else next.delete(p.memberId);
                      setInvited(next);
                    }}
                  />
                  {p.name}
                </label>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[14px] text-black/55">
              Nobody has chosen to be seen yet, so there&apos;s nobody to pick.
            </p>
          )
        ) : null}
        <p className="mt-2 text-[13px] text-black/55">
          {audience === "selected"
            ? "Only the people you pick will see this plan."
            : "Everyone in the conference will see it and can join."}
        </p>
      </fieldset>

      <Problem>{problem}</Problem>
      <div className="mt-5 flex gap-3">
        <button className={primary} disabled={busy || chosenDays.size === 0}>
          {editing ? "Save" : "Post the plan"}
        </button>
        <button type="button" className={secondary} onClick={() => onDone()}>
          Never mind
        </button>
      </div>
    </form>
  );
}
