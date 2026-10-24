"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  agoWords,
  freshness,
  levelOfPlace,
  placeOf,
  type ArenaPerson,
  type ArenaView,
} from "@/domain/hockey/arena-mode";
import {
  FIND_FRIEND_NAME,
  FIND_FRIEND_TAGLINE,
  GPS_CAVEAT,
  NO_PAYMENTS,
  SUMMON_LIVE_MIN,
  SUMMON_NOTES,
  SUMMON_RESPONSES,
  SUMMON_RESPONSE_EMOJI,
  SUMMON_RESPONSE_LABEL,
  gpsIsStale,
  hintWords,
  presenceOf,
  summonIsLive,
  summonTally,
  type GpsHint,
  type Presence,
  type SnackRun,
  type Summon,
} from "@/domain/hockey/crew";
import { SPOTS, nearest, spotById, type Spot } from "@/domain/hockey/concourse";
import { CART_MENU, STAND_MENUS } from "@/domain/hockey/menus";
import type { Arena } from "./useArena";
import { hueColour } from "./ArenaMap";
import { Btn, Face } from "./panels";
import { PinBadge, Sheet } from "./sheets";

// ------------------------------------------------------------------ who is where

export interface CrewMember {
  readonly person: ArenaPerson;
  readonly isMe: boolean;
  readonly presence: Presence;
  /** Their own check-in, if any. */
  readonly checkin?: ArenaView["checkins"][number];
  readonly placeLabel?: string;
  readonly hint?: GpsHint;
}

const first = (name: string) => name.split(" ")[0] ?? name;

/** Everyone on the night, and what the crew may honestly say about them. */
export function crewMembers(view: ArenaView): CrewMember[] {
  return [...view.people]
    .sort((a, b) =>
      a.id === view.me
        ? -1
        : b.id === view.me
          ? 1
          : a.name.localeCompare(b.name),
    )
    .map((person) => {
      const checkin = view.checkins.find((c) => c.user === person.id);
      const place = checkin ? placeOf(checkin.place, view.meetup) : undefined;
      const hint = view.crew.gps.find((g) => g.user === person.id);
      const inside = !!place && (place.id === "meetup" || !place.offMap);
      return {
        person,
        isMe: person.id === view.me,
        presence: presenceOf({ place: checkin?.place, inside, hint }),
        checkin,
        placeLabel: place?.label,
        hint,
      };
    });
}

const RING: Record<Presence, string> = {
  in: "#7dffb0",
  coming: "#ffd84d",
  outside: "#ffffff",
  hint: "#6cb8ff",
  quiet: "rgba(255,255,255,0.25)",
};

/** One line, in the crew's own voice, that never claims more than it knows. */
export function presenceLine(m: CrewMember, now: Date): string {
  const age = m.checkin ? agoWords(m.checkin.at, now) : "";
  switch (m.presence) {
    case "in":
      return `${m.placeLabel} · ${age}`;
    case "coming":
      return `Said they're on their way · ${age}`;
    case "outside":
      return `Said they're outside · ${age}`;
    case "hint":
      return `GPS hint only · ${m.hint ? agoWords(m.hint.at, now) : ""}`;
    case "quiet":
      return "Hasn't said where";
  }
}

// ------------------------------------------------------------------ arrivals

export interface Arrival {
  readonly id: string;
  readonly person: ArenaPerson;
  readonly place: string;
}

/**
 * Notices a friend checking in *while you are looking*: the first view is the
 * baseline, mine never counts, and an old check-in that merely turns up after
 * a refresh is not an arrival. Only a confirmed check-in inside the building
 * counts, never a GPS hint.
 */
export function useArrivals(view: ArenaView) {
  const [state, setState] = useState<{
    view: ArenaView;
    seen: ReadonlyMap<string, string>;
    arrival: Arrival | null;
    recent: ReadonlySet<string>;
  }>(() => ({
    view,
    seen: insideNow(view),
    arrival: null,
    recent: new Set(),
  }));

  // Adjusting state while rendering, keyed on the incoming view, is React's
  // way to derive "what changed since last time" without an effect.
  if (state.view !== view) {
    const next = insideNow(view);
    const asOf = new Date(view.now);
    const arrived = crewMembers(view).filter(
      (m) =>
        !m.isMe &&
        m.presence === "in" &&
        m.checkin &&
        !state.seen.has(m.person.id) &&
        freshness(m.checkin.at, asOf) === "fresh",
    );
    const first = arrived[0];
    setState({
      view,
      seen: next,
      arrival: first
        ? {
            id: `${first.person.id}:${first.checkin!.at}`,
            person: first.person,
            place: first.placeLabel ?? "the arena",
          }
        : state.arrival,
      recent: arrived.length
        ? new Set(arrived.map((m) => m.person.id))
        : state.recent,
    });
  }

  const arrivalId = state.arrival?.id;
  useEffect(() => {
    if (!arrivalId) return;
    const t = window.setTimeout(
      () => setState((s) => ({ ...s, arrival: null, recent: new Set() })),
      4500,
    );
    return () => window.clearTimeout(t);
  }, [arrivalId]);

  return { arrival: state.arrival, recent: state.recent };
}

/** Who is confirmed inside the building in this view, and where. */
function insideNow(view: ArenaView): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of crewMembers(view)) {
    if (m.presence === "in" && m.checkin) out.set(m.person.id, m.checkin.place);
  }
  return out;
}

const CONFETTI = ["#7dffb0", "#ffd84d", "#6cb8ff", "#ff7aa8", "#ffffff"];

export function Celebration({ arrival }: { arrival: Arrival | null }) {
  const reduced = useReducedMotion() ?? false;
  return (
    <AnimatePresence>
      {arrival && (
        <motion.div
          key={arrival.id}
          role="status"
          data-testid="arrival"
          initial={{ y: -50, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -50, opacity: 0 }}
          transition={
            reduced ? { duration: 0 } : { type: "spring", damping: 14 }
          }
          className="pointer-events-none fixed inset-x-0 top-16 z-50 mx-auto w-fit max-w-[92vw] rounded-full bg-[#ffd84d] px-5 py-2.5 text-center text-[15px] font-extrabold text-[#1b1300] shadow-[0_12px_40px_-8px_rgba(255,216,77,0.7)]"
        >
          🎉 {first(arrival.person.name)} made it! {arrival.place}
          {!reduced && (
            <span aria-hidden className="absolute inset-0">
              {Array.from({ length: 14 }, (_, i) => (
                <motion.i
                  key={i}
                  className="absolute top-1/2 left-1/2 block size-2 rounded-sm"
                  style={{ background: CONFETTI[i % CONFETTI.length] }}
                  initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
                  animate={{
                    x: Math.cos((i / 14) * Math.PI * 2) * (70 + (i % 3) * 22),
                    y: Math.sin((i / 14) * Math.PI * 2) * (46 + (i % 4) * 14),
                    opacity: 0,
                    rotate: 240,
                  }}
                  transition={{ duration: 1.1, ease: "easeOut" }}
                />
              ))}
            </span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ------------------------------------------------------------------ the strip

/** The crew, as small faces. A ring says what we know; the name says who. */
export function CrewStrip({
  arena,
  recent,
  onOpen,
}: {
  arena: Arena;
  recent: ReadonlySet<string>;
  onOpen: (userId: string) => void;
}) {
  const { view, now } = arena;
  const reduced = useReducedMotion() ?? false;
  const members = crewMembers(view);
  const inside = members.filter((m) => m.presence === "in").length;
  return (
    <section aria-labelledby="crew-title" className="mt-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="crew-title" className="text-[16px] font-extrabold">
          The crew
        </h2>
        <p className="text-[12px] text-white/60" data-testid="crew-count">
          {inside} of {members.length} checked in
        </p>
      </div>
      <ul className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-x-1 gap-y-2">
        {members.map((m) => {
          const stale = m.checkin && freshness(m.checkin.at, now) === "stale";
          return (
            <li key={m.person.id} className="flex justify-center">
              <button
                type="button"
                data-testid={`crew-${m.isMe ? "me" : m.person.name}`}
                data-presence={m.presence}
                onClick={() => onOpen(m.person.id)}
                aria-label={`${m.isMe ? "You" : m.person.name}: ${presenceLine(m, now)}. Open`}
                className="flex min-h-[72px] w-16 flex-col items-center gap-1 rounded-2xl py-1"
              >
                <motion.span
                  animate={
                    recent.has(m.person.id) && !reduced
                      ? { scale: [1, 1.25, 1], rotate: [0, -8, 8, 0] }
                      : { scale: 1 }
                  }
                  transition={{
                    duration: 0.8,
                    repeat: recent.has(m.person.id) ? 3 : 0,
                  }}
                  className="relative inline-flex size-12 items-center justify-center rounded-full text-[24px]"
                  style={{
                    background: hueColour(m.person.hue),
                    opacity: m.presence === "quiet" ? 0.5 : stale ? 0.65 : 1,
                    boxShadow: `0 0 0 3px #070b14, 0 0 0 5px ${RING[m.presence]}`,
                    outline:
                      m.presence === "hint" || stale ? "none" : undefined,
                  }}
                >
                  <span aria-hidden>{m.person.emoji}</span>
                  {m.presence === "in" && (
                    <span
                      aria-hidden
                      className="absolute -right-1 -bottom-1 inline-flex size-5 items-center justify-center rounded-full bg-[#7dffb0] text-[12px] text-black"
                    >
                      ✓
                    </span>
                  )}
                  {m.presence === "coming" && (
                    <span
                      aria-hidden
                      className="absolute -right-1 -bottom-1 text-[16px]"
                    >
                      🚶
                    </span>
                  )}
                  {m.presence === "hint" && (
                    <span
                      aria-hidden
                      className="absolute -right-1 -bottom-1 text-[14px]"
                    >
                      📡
                    </span>
                  )}
                </motion.span>
                <span className="max-w-full truncate text-[12px] leading-none font-semibold">
                  {m.isMe ? "You" : first(m.person.name)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-1 text-[12px] leading-snug text-white/55">
        ✓ means they checked in themselves. Everyone else is just not saying
        yet.
      </p>
    </section>
  );
}

// ------------------------------------------------------------------ one person

export function PersonSheet({
  arena,
  userId,
  live,
  onShow,
  onCheckIn,
  onClose,
}: {
  arena: Arena;
  userId: string;
  live: boolean;
  onShow: (placeId: string) => void;
  onCheckIn: () => void;
  onClose: () => void;
}) {
  const { view, now } = arena;
  const m = crewMembers(view).find((x) => x.person.id === userId);
  const mine = view.checkins.find((c) => c.user === view.me);
  if (!m) return null;
  const { person } = m;
  const name = m.isMe ? "You" : person.name;
  const place = m.checkin ? placeOf(m.checkin.place, view.meetup) : undefined;
  const stale = m.checkin && freshness(m.checkin.at, now) === "stale";
  const canFind = place && !place.offMap && !stale;
  const hintStale = m.hint ? gpsIsStale(m.hint.at, now) : false;
  const ask = (kind: "where" | "here" | "meet") => {
    if (kind !== "where" && !mine) {
      onClose();
      onCheckIn();
      return;
    }
    onClose();
    void arena.send(
      {
        type: "ping",
        kind,
        to: person.id,
        ...(kind === "where" ? {} : { place: mine!.place }),
        note: "",
      },
      {
        done:
          kind === "where"
            ? `Asked ${first(person.name)} where they are.`
            : kind === "here"
              ? `Told ${first(person.name)} where you are.`
              : `Asked ${first(person.name)} to meet you.`,
      },
    );
  };

  return (
    <Sheet title={name} onClose={onClose}>
      <div className="mt-3 flex items-center gap-3">
        <Face p={person} size={52} />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold">
            {m.presence === "in" && <>📍 {m.placeLabel}</>}
            {m.presence === "coming" && <>🚶 On their way (their word)</>}
            {m.presence === "outside" && <>🚪 Outside (their word)</>}
            {m.presence === "hint" && <>📡 Only a GPS hint</>}
            {m.presence === "quiet" && <>Hasn&apos;t said where</>}
          </p>
          {m.checkin && (
            <p className="text-[13px] text-white/65">
              Checked in {agoWords(m.checkin.at, now)}
              {stale && <span className="ml-1 text-[#ffd84d]">(old news)</span>}
            </p>
          )}
          {m.checkin?.status && (
            <p className="text-[14px] text-white/75 italic">
              “{m.checkin.status}”
            </p>
          )}
        </div>
      </div>

      {m.hint && (
        <p
          className="mt-3 rounded-2xl bg-[#6cb8ff]/12 px-4 py-3 text-[13px] leading-snug text-white/85"
          data-testid="gps-line"
        >
          <strong>{hintWords(m.hint)}</strong> · updated{" "}
          {agoWords(m.hint.at, now)}
          {hintStale && <span className="text-[#ffd84d]"> (old)</span>}
          <span className="mt-1 block text-white/60">{GPS_CAVEAT}</span>
        </p>
      )}
      <p className="mt-3 text-[13px] text-white/55">
        {person.section ? `Seat: Section ${person.section}` : "No seat entered"}
      </p>

      {live && !m.isMe && (
        <div className="mt-4 flex flex-col gap-2">
          {canFind ? (
            <Btn
              kind="light"
              onClick={() => {
                onClose();
                onShow(m.checkin!.place);
              }}
            >
              🔦 Find this legend
            </Btn>
          ) : (
            <Btn kind="light" onClick={() => ask("where")}>
              🔦 Where you at, {first(person.name)}?
            </Btn>
          )}
          <Btn onClick={() => ask("here")}>👋 I&apos;m over here, genius</Btn>
          <Btn onClick={() => ask("meet")}>🤝 Meet me</Btn>
        </div>
      )}
    </Sheet>
  );
}

// ------------------------------------------------------------------ GPS (consent)

type GpsState = "idle" | "asking" | "denied" | "unavailable" | "rough";

/**
 * **A GPS hint, only on request.**
 *
 * Nothing here asks the browser for a position until the person taps the
 * button. While a hint is on it is refreshed once a minute, and only while
 * this page is open and visible: no watchers, no service worker, nothing in
 * the background. A hint from an earlier visit is resumed only if the browser
 * already says yes; it never prompts by itself.
 */
export function useGpsHint(arena: Arena) {
  const { view } = arena;
  const mine = view.crew.gps.find((g) => g.user === view.me);
  const [state, setState] = useState<GpsState>("idle");
  const sending = useRef(false);

  const share = useCallback(async () => {
    if (!("geolocation" in navigator)) {
      setState("unavailable");
      return false;
    }
    if (sending.current) return false;
    sending.current = true;
    setState("asking");
    const reading = await new Promise<
      GeolocationPosition | GeolocationPositionError
    >((resolve) =>
      navigator.geolocation.getCurrentPosition(resolve, resolve, {
        enableHighAccuracy: false,
        maximumAge: 20_000,
        timeout: 12_000,
      }),
    );
    try {
      if (!("coords" in reading)) {
        setState(reading.code === 1 ? "denied" : "unavailable");
        return false;
      }
      const ok = await arena.send(
        {
          type: "gpsShare",
          reading: {
            lat: reading.coords.latitude,
            lng: reading.coords.longitude,
            accuracy: reading.coords.accuracy,
          },
        },
        { done: "GPS hint shared. It says near, never exactly where." },
      );
      setState(ok ? "idle" : "rough");
      return ok;
    } finally {
      sending.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arena.send]);

  const on = !!mine;
  const shareRef = useRef(share);
  useEffect(() => {
    shareRef.current = share;
  });
  useEffect(() => {
    if (!on || !("geolocation" in navigator)) return;
    let cancelled = false;
    let granted = false;
    const check = async () => {
      try {
        const p = await navigator.permissions?.query({ name: "geolocation" });
        granted = p?.state === "granted";
      } catch {
        granted = false;
      }
    };
    void check();
    const t = window.setInterval(() => {
      if (!cancelled && granted && document.visibilityState === "visible") {
        void shareRef.current();
      }
    }, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [on]);

  return { mine, state, share };
}

// ------------------------------------------------------------------ the sharing bar

/** Always on screen while anything is shared, with the one-tap way out. */
export function SharingBar({
  arena,
  gpsOn,
  closesAt,
}: {
  arena: Arena;
  gpsOn: boolean;
  closesAt: string;
}) {
  const { view, now } = arena;
  const mineCheckin = view.checkins.find((c) => c.user === view.me);
  const place = mineCheckin
    ? placeOf(mineCheckin.place, view.meetup)
    : undefined;
  const mineHint = view.crew.gps.find((g) => g.user === view.me);
  const sharing = !!mineCheckin || gpsOn;
  const others = view.people.length - 1;
  const clock = new Date(closesAt).toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Vancouver",
  });
  return (
    <div
      className={`mt-4 flex items-center gap-3 rounded-2xl px-4 py-2.5 ${sharing ? "bg-[#7dffb0]/14 ring-1 ring-[#7dffb0]/50" : "bg-white/8"}`}
      data-testid="sharing"
      data-sharing={sharing}
    >
      <span
        aria-hidden
        className={`size-2.5 shrink-0 rounded-full ${sharing ? "animate-pulse bg-[#7dffb0]" : "bg-white/35"}`}
      />
      <p className="min-w-0 flex-1 text-[14px] leading-snug">
        {sharing ? (
          <>
            <strong>
              Sharing with {others === 1 ? "1 friend" : `${others} friends`}:
            </strong>{" "}
            {mineCheckin && place && (
              <>
                {place.label}{" "}
                <span className="text-white/60">
                  (you said, {agoWords(mineCheckin.at, now)})
                </span>
              </>
            )}
            {mineCheckin && gpsOn && " + "}
            {gpsOn && mineHint && (
              <>
                GPS hint{" "}
                <span className="text-white/60">
                  ({agoWords(mineHint.at, now)})
                </span>
              </>
            )}
          </>
        ) : (
          <>Not sharing. Nobody sees where you are.</>
        )}
        <span className="block text-[12px] text-white/55">
          Only people on this night · gone at {clock}
        </span>
      </p>
      {sharing && (
        <button
          type="button"
          data-testid="stop-sharing"
          onClick={() =>
            void arena.send(
              { type: "stopSharing" },
              { done: "Stopped. Nobody can see where you are." },
            )
          }
          className="min-h-11 shrink-0 rounded-full bg-white px-3.5 text-[13px] font-extrabold text-[#070b14]"
        >
          ⏹ Stop sharing
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ the crew tab

export function CrewPanel({
  arena,
  live,
  gps,
  onCheckIn,
  onOpen,
}: {
  arena: Arena;
  live: boolean;
  gps: ReturnType<typeof useGpsHint>;
  onCheckIn: () => void;
  onOpen: (userId: string) => void;
}) {
  const { view, now } = arena;
  const members = crewMembers(view);
  const sharing = members.filter((m) => !m.isMe && m.presence !== "quiet");
  const quiet = members.filter((m) => !m.isMe && m.presence === "quiet");
  const people = new Map(view.people.map((p) => [p.id, p]));
  const sent = view.pings
    .filter((p) => p.from === view.me && !p.replyTo)
    .slice(0, 5);
  const crewOn = view.crew.available;
  const { mine, state } = gps;

  return (
    <section aria-labelledby="find-title">
      <h2
        id="find-title"
        className="text-[20px] leading-tight font-extrabold"
        data-testid="find-title"
      >
        {FIND_FRIEND_NAME}
      </h2>
      <p className="mt-1 text-[14px] text-white/70">{FIND_FRIEND_TAGLINE}</p>

      <div className="mt-3 rounded-3xl bg-white/6 p-4">
        <p className="text-[15px] font-bold">Share where you are</p>
        <p className="mt-1 text-[13px] leading-snug text-white/70">
          Off until you do it. Only the people on this night see it, it expires
          when the night does, and one tap stops it.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <Btn kind="go" onClick={onCheckIn} disabled={!live}>
            📍 Tell the crew my section or spot
          </Btn>
          <p className="text-[12px] text-white/55">
            The best way to be found: you pick a section, a stand or a gate.
            Works with no GPS at all.
          </p>

          {crewOn && (
            <div className="mt-2 rounded-2xl bg-black/20 p-3">
              <p className="text-[14px] font-bold">
                📡 Optional: add a GPS hint
              </p>
              {mine ? (
                <>
                  <p
                    className="mt-1 text-[13px] text-white/85"
                    data-testid="my-gps"
                  >
                    {hintWords(mine)} · updated {agoWords(mine.at, now)}
                    {gpsIsStale(mine.at, now) && (
                      <span className="text-[#ffd84d]"> (old)</span>
                    )}
                  </p>
                  <p className="mt-1 text-[12px] leading-snug text-white/60">
                    {GPS_CAVEAT} Refreshes about once a minute while this page
                    is open. Never in the background.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Btn
                      onClick={() => void gps.share()}
                      disabled={!live || state === "asking"}
                    >
                      🔄 Refresh now
                    </Btn>
                    <Btn
                      onClick={() =>
                        void arena.send(
                          { type: "stopSharing" },
                          { done: "Stopped. Nobody can see where you are." },
                        )
                      }
                    >
                      Turn off
                    </Btn>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-1 text-[12px] leading-snug text-white/70">
                    Your browser will ask first. Friends see only{" "}
                    <em>around the arena</em>, <em>near</em> or <em>away</em>{" "}
                    with how sure the phone is — never a map position, and
                    Passport keeps no coordinates and no trail. {GPS_CAVEAT}
                  </p>
                  <div className="mt-2">
                    <Btn
                      onClick={() => void gps.share()}
                      disabled={!live || state === "asking"}
                    >
                      {state === "asking"
                        ? "Asking your phone…"
                        : "Share a GPS hint"}
                    </Btn>
                  </div>
                </>
              )}
              {state === "denied" && (
                <p role="status" className="mt-2 text-[13px] text-[#ffd84d]">
                  Your phone said no, which is fine. Tell the crew your section
                  instead.
                </p>
              )}
              {state === "unavailable" && (
                <p role="status" className="mt-2 text-[13px] text-[#ffd84d]">
                  Couldn&apos;t get a position. Tell the crew your section
                  instead.
                </p>
              )}
              {state === "rough" && (
                <p role="status" className="mt-2 text-[13px] text-[#ffd84d]">
                  GPS is too rough in here to say anything. Tell the crew your
                  section instead.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <h3 className="mt-6 text-[15px] font-bold">Sharing with you now</h3>
      {sharing.length === 0 ? (
        <p className="mt-2 text-[14px] text-white/60">
          Nobody yet. Ask them below.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {sharing.map((m) => (
            <li key={m.person.id} data-testid={`herd-${m.person.name}`}>
              <button
                type="button"
                onClick={() => onOpen(m.person.id)}
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-white/6 px-3 text-left"
              >
                <Face p={m.person} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold">
                    {m.person.name}
                  </span>
                  <span className="block truncate text-[13px] text-white/70">
                    {presenceLine(m, now)}
                  </span>
                </span>
                <span aria-hidden className="text-[18px]">
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {quiet.length > 0 && live && (
        <div className="mt-4">
          <h3 className="text-[15px] font-bold">Not sharing</h3>
          <p className="mt-1 text-[13px] text-white/60">
            Asking is a nudge, not a tracker. They decide whether to answer.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {quiet.map((m) => (
              <li key={m.person.id} data-testid={`herd-${m.person.name}`}>
                <Btn
                  kind="light"
                  onClick={() =>
                    void arena.send(
                      {
                        type: "ping",
                        kind: "where",
                        to: m.person.id,
                        note: "",
                      },
                      { done: `Asked ${first(m.person.name)} where they are.` },
                    )
                  }
                >
                  🔦 Where you at, {first(m.person.name)}?
                </Btn>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sent.length > 0 && (
        <section className="mt-6" aria-labelledby="sent-title">
          <h3 id="sent-title" className="text-[15px] font-bold">
            What you sent
          </h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {sent.map((s) => {
              const to = s.to ? people.get(s.to)?.name : "everyone";
              const replies = view.pings.filter((r) => r.replyTo === s.id);
              return (
                <li key={s.id} className="text-[14px] text-white/80">
                  {s.kind === "where"
                    ? `Asked ${to} where they are`
                    : s.kind === "here"
                      ? `Told ${to} where you are`
                      : s.kind === "herd"
                        ? `Rounded up the herd at ${placeOf(s.place ?? "", view.meetup)?.label ?? "a spot"}`
                        : `Asked ${to} to meet at ${placeOf(s.place ?? "", view.meetup)?.label ?? "a spot"}`}
                  <span className="text-white/50">
                    {" "}
                    · {agoWords(s.at, now)}
                  </span>
                  {replies.map((r) => (
                    <span key={r.id} className="ml-2">
                      {r.kind === "coming" ? "✅" : "🙅"}{" "}
                      {people.get(r.from)?.name}
                    </span>
                  ))}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ summon the squad

/** Asks for a note and a place; "pick it on the map" hands over to the map. */
export function SummonSheet({
  arena,
  onClose,
  onPick,
}: {
  arena: Arena;
  onClose: () => void;
  onPick: (note: string) => void;
}) {
  const { view } = arena;
  const me = view.people.find((p) => p.id === view.me);
  const mine = view.checkins.find((c) => c.user === view.me);
  const myPlace = mine ? placeOf(mine.place, view.meetup) : undefined;
  const [note, setNote] = useState("");
  const others = view.people.length - 1;
  const go = (place: string) => {
    void arena.send(
      { type: "summon", place, note },
      { done: `Squad summoned to ${placeOf(place, view.meetup)?.label}.` },
    );
    onClose();
  };
  return (
    <Sheet title="Summon the squad" onClose={onClose}>
      <p className="mt-2 rounded-2xl bg-white/8 px-4 py-3 text-[13px] leading-snug text-white/80">
        Asks the {others === 1 ? "one other person" : `${others} others`} on
        this night to meet you somewhere. They answer <strong>On my way</strong>
        , <strong>Busy</strong> or <strong>Where?</strong>. It shows
        nobody&apos;s position.
      </p>
      <fieldset className="mt-4">
        <legend className="text-[14px] font-bold">Why? (optional)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SUMMON_NOTES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={note === s}
              onClick={() => setNote(note === s ? "" : s)}
              className={`min-h-10 rounded-full border px-3 text-[13px] ${
                note === s
                  ? "border-[#ffd84d] bg-[#ffd84d] text-black"
                  : "border-white/25"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <label className="mt-2 block">
          <span className="sr-only">Your own words</span>
          <input
            value={note}
            maxLength={80}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Or your own words"
            className="min-h-11 w-full rounded-xl bg-white/10 px-3 text-[15px] placeholder:text-white/45"
          />
        </label>
      </fieldset>
      <p className="mt-5 text-[14px] font-bold">Where?</p>
      <div className="mt-2 grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={() => onPick(note)}
          className="min-h-12 rounded-2xl bg-[#ffd84d] px-4 text-left text-[15px] font-semibold text-black"
        >
          🗺️ Pick it on the map
        </button>
        {view.meetup && (
          <button
            type="button"
            onClick={() => go("meetup")}
            className="min-h-12 rounded-2xl bg-white/8 px-4 text-left text-[15px] font-semibold"
          >
            🤝 The meeting point — {placeOf("meetup", view.meetup)?.where}
          </button>
        )}
        {mine && myPlace && !myPlace.offMap && (
          <button
            type="button"
            onClick={() => go(mine.place)}
            className="min-h-12 rounded-2xl bg-white/8 px-4 text-left text-[15px] font-semibold"
          >
            📍 Where I am — {myPlace.label}
          </button>
        )}
        {me?.section && (
          <button
            type="button"
            onClick={() => go(`sec:${me.section}`)}
            className="min-h-12 rounded-2xl bg-white/8 px-4 text-left text-[15px] font-semibold"
          >
            🎟️ My seat — Section {me.section}
          </button>
        )}
      </div>
    </Sheet>
  );
}

function Tally({ summon, view }: { summon: Summon; view: ArenaView }) {
  const people = new Map(view.people.map((p) => [p.id, p]));
  const tally = summonTally(
    summon,
    view.people.map((p) => p.id),
  );
  const row = (ids: string[], label: string, emoji: string, key: string) =>
    ids.length > 0 && (
      <li data-testid={`tally-${key}`} className="text-[14px]">
        <span aria-hidden>{emoji}</span> <strong>{label}</strong>{" "}
        <span className="text-white/80">
          {ids.map((id) => first(people.get(id)?.name ?? "?")).join(", ")}
        </span>
      </li>
    );
  return (
    <ul className="mt-2 flex flex-col gap-1">
      {row(tally.coming, "On their way", "🏃", "coming")}
      {row(tally.busy, "Busy", "⏳", "busy")}
      {row(tally.where, "Asking where", "🤷", "where")}
      {row(tally.silent, "Haven't said", "💤", "silent")}
    </ul>
  );
}

/** The latest live summons from somebody else that I haven't answered. */
export function IncomingSummons({
  arena,
  onShow,
}: {
  arena: Arena;
  onShow: (placeId: string) => void;
}) {
  const { view, now } = arena;
  const people = new Map(view.people.map((p) => [p.id, p]));
  const open = view.crew.summons.find(
    (s) =>
      s.from !== view.me &&
      summonIsLive(s, now) &&
      !s.replies.some((r) => r.user === view.me),
  );
  if (!open) return null;
  const from = people.get(open.from);
  const place = placeOf(open.place, view.meetup);
  return (
    <section
      aria-label="Squad summoned"
      data-testid="incoming-summons"
      className="mt-3 rounded-3xl bg-[#ffd84d] p-4 text-[#1b1300]"
    >
      <p className="text-[16px] font-extrabold">
        📣 {from ? from.name : "Someone"} summons the squad
      </p>
      <p className="text-[14px] font-semibold">
        {place?.label ?? "a spot"} · {agoWords(open.at, now)}
        {open.note && <> · “{open.note}”</>}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {SUMMON_RESPONSES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() =>
              void arena.send(
                { type: "summonReply", summon: open.id, response: r },
                {
                  done: `Told ${first(from?.name ?? "them")}: ${SUMMON_RESPONSE_LABEL[r]}.`,
                },
              )
            }
            className="min-h-12 rounded-2xl bg-black/85 px-2 text-[14px] font-extrabold text-white"
          >
            {SUMMON_RESPONSE_EMOJI[r]} {SUMMON_RESPONSE_LABEL[r]}
          </button>
        ))}
      </div>
      {place && !place.offMap && (
        <button
          type="button"
          onClick={() => onShow(open.place)}
          className="mt-2 min-h-10 rounded-full border border-black/30 px-3 text-[13px] font-bold"
        >
          Show on the map
        </button>
      )}
    </section>
  );
}

export function SquadPanel({
  arena,
  live,
  onShow,
  onSummon,
}: {
  arena: Arena;
  live: boolean;
  onShow: (placeId: string) => void;
  onSummon: () => void;
}) {
  const { view, now } = arena;
  const people = new Map(view.people.map((p) => [p.id, p]));
  const summons = view.crew.summons;
  return (
    <section aria-labelledby="squad-title">
      <h2 id="squad-title" className="text-[20px] leading-tight font-extrabold">
        Summon the squad
      </h2>
      <p className="mt-1 text-[14px] text-white/70">
        Pick a spot, call the group. Everyone answers in one tap, and you see
        who&apos;s coming.
      </p>
      {live && (
        <div className="mt-3">
          <Btn kind="go" onClick={onSummon}>
            📣 Summon the squad
          </Btn>
        </div>
      )}
      {!view.crew.available && (
        <p className="mt-3 rounded-2xl bg-white/8 px-4 py-3 text-[14px] text-white/80">
          The Crew isn&apos;t switched on for this night yet.
        </p>
      )}
      <ul className="mt-4 flex flex-col gap-3">
        {summons.map((s) => {
          const from = people.get(s.from);
          const place = placeOf(s.place, view.meetup);
          const mineReply = s.replies.find((r) => r.user === view.me);
          const isMine = s.from === view.me;
          const liveOne = summonIsLive(s, now);
          return (
            <li
              key={s.id}
              data-testid="summon"
              className={`rounded-3xl p-4 ${liveOne ? "bg-white/10 ring-1 ring-[#ffd84d]/60" : "bg-white/5 opacity-80"}`}
            >
              <p className="text-[15px] font-bold">
                {isMine
                  ? "You summoned the squad"
                  : `${from?.name ?? "Someone"} summoned the squad`}
              </p>
              <p className="text-[14px] text-white/80">
                📍 {place?.label ?? "a spot"} · {agoWords(s.at, now)}
                {!liveOne && ` · over after ${SUMMON_LIVE_MIN} min`}
              </p>
              {s.note && (
                <p className="text-[14px] text-white/70 italic">“{s.note}”</p>
              )}
              <Tally summon={s} view={view} />
              <div className="mt-3 flex flex-wrap gap-2">
                {place && !place.offMap && (
                  <Btn onClick={() => onShow(s.place)}>🔦 Show on the map</Btn>
                )}
                {live &&
                  !isMine &&
                  liveOne &&
                  SUMMON_RESPONSES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={mineReply?.response === r}
                      onClick={() =>
                        void arena.send({
                          type: "summonReply",
                          summon: s.id,
                          response: r,
                        })
                      }
                      className={`min-h-10 rounded-full px-3.5 text-[14px] font-bold ${
                        mineReply?.response === r
                          ? "bg-[#7dffb0] text-black"
                          : "border border-white/25"
                      }`}
                    >
                      {SUMMON_RESPONSE_EMOJI[r]} {SUMMON_RESPONSE_LABEL[r]}
                    </button>
                  ))}
              </div>
            </li>
          );
        })}
      </ul>
      {summons.length === 0 && view.crew.available && (
        <p className="mt-4 text-[14px] text-white/60">
          Nobody&apos;s summoned the squad yet.
        </p>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ snack run

const CONCESSION_KINDS = new Set(["food", "drink", "snackCart"]);

/** Concessions drawn on the arena's own map, nearest the seat first. */
function standsFor(mySection: string | undefined): Spot[] {
  if (mySection) {
    const near = nearest(mySection, (s) => CONCESSION_KINDS.has(s.kind), 6);
    if (near.length) return near.map((n) => n.spot);
  }
  return SPOTS.filter(
    (s) => s.level === "100" && CONCESSION_KINDS.has(s.kind),
  ).slice(0, 6);
}

function menuOf(spot: Spot | undefined) {
  if (!spot) return undefined;
  if (spot.kind === "snackCart") return CART_MENU;
  return STAND_MENUS[spot.code as keyof typeof STAND_MENUS];
}

export function SnackPanel({
  arena,
  live,
  onShow,
}: {
  arena: Arena;
  live: boolean;
  onShow: (placeId: string) => void;
}) {
  const { view, now } = arena;
  const me = view.people.find((p) => p.id === view.me);
  const stands = useMemo(() => standsFor(me?.section), [me?.section]);
  const [stand, setStand] = useState<string>("");
  const [note, setNote] = useState("");
  const people = new Map(view.people.map((p) => [p.id, p]));
  const open = view.crew.runs.filter((r) => r.status === "open");
  const past = view.crew.runs.filter((r) => r.status !== "open").slice(0, 3);
  const haveOne = open.some((r) => r.runner === view.me);

  return (
    <section aria-labelledby="snack-title">
      <h2 id="snack-title" className="text-[20px] leading-tight font-extrabold">
        Snack run 🌭
      </h2>
      <p className="mt-1 text-[14px] text-white/70">
        Heading to a stand? Tell the crew so they can put in an order.{" "}
        {NO_PAYMENTS}
      </p>

      {live && !haveOne && view.crew.available && (
        <form
          className="mt-3 rounded-3xl bg-white/6 p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await arena.send(
              {
                type: "runStart",
                ...(stand ? { stand } : {}),
                note,
              },
              { done: "Snack run announced. The crew can order." },
            );
            if (ok) {
              setNote("");
              setStand("");
            }
          }}
        >
          <p className="text-[15px] font-bold">
            I&apos;m going. Anyone want anything?
          </p>
          <fieldset className="mt-2">
            <legend className="text-[13px] text-white/70">
              Where from? Stands on the arena&apos;s map
              {me?.section ? `, nearest your seat first` : ""}
            </legend>
            <div
              role="radiogroup"
              aria-label="Where from"
              className="mt-2 flex flex-col gap-1.5"
            >
              <button
                type="button"
                role="radio"
                aria-checked={stand === ""}
                onClick={() => setStand("")}
                className={`flex min-h-11 items-center gap-2 rounded-xl px-3 text-left text-[14px] ${stand === "" ? "bg-[#ffd84d] text-black" : "bg-white/8"}`}
              >
                Wherever&apos;s quickest
              </button>
              {stands.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={stand === s.id}
                  onClick={() => setStand(s.id)}
                  className={`flex min-h-11 items-center gap-2 rounded-xl px-3 text-left text-[14px] ${stand === s.id ? "bg-[#ffd84d] text-black" : "bg-white/8"}`}
                >
                  <PinBadge spot={s} />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span
                    className={`text-[12px] ${stand === s.id ? "text-black/65" : "text-white/55"}`}
                  >
                    {menuOf(s) ? "guide lists items" : "on the map"}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          <label className="mt-3 block">
            <span className="text-[13px] text-white/70">
              A line for the crew (optional)
            </span>
            <input
              value={note}
              maxLength={80}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Leaving in 2 minutes"
              className="mt-1 min-h-11 w-full rounded-xl bg-white/10 px-3 text-[15px] placeholder:text-white/45"
            />
          </label>
          <div className="mt-3">
            <Btn type="submit" kind="go">
              🏃 Announce my snack run
            </Btn>
          </div>
        </form>
      )}

      {!view.crew.available && (
        <p className="mt-3 rounded-2xl bg-white/8 px-4 py-3 text-[14px] text-white/80">
          The Crew isn&apos;t switched on for this night yet. The Eat &amp;
          drink tab still works.
        </p>
      )}

      <ul className="mt-4 flex flex-col gap-3">
        {open.map((r) => (
          <RunCard
            key={r.id}
            run={r}
            arena={arena}
            live={live}
            runner={people.get(r.runner)}
            onShow={onShow}
          />
        ))}
      </ul>
      {open.length === 0 && view.crew.available && (
        <p className="mt-4 text-[14px] text-white/60">
          No snack runs right now.
        </p>
      )}

      {past.length > 0 && (
        <>
          <h3 className="mt-6 text-[15px] font-bold">Earlier</h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {past.map((r) => (
              <li key={r.id} className="text-[14px] text-white/70">
                {r.status === "done" ? "✅" : "🙅"}{" "}
                {r.runner === view.me
                  ? "You"
                  : first(people.get(r.runner)?.name ?? "Someone")}{" "}
                {r.status === "done" ? "went" : "called it off"} ·{" "}
                {agoWords(r.at, now)}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function RunCard({
  run,
  arena,
  live,
  runner,
  onShow,
}: {
  run: SnackRun;
  arena: Arena;
  live: boolean;
  runner?: ArenaPerson;
  onShow: (placeId: string) => void;
}) {
  const { view, now } = arena;
  const mine = run.items.find((i) => i.user === view.me);
  const [item, setItem] = useState(mine?.item ?? "");
  const spot = run.stand ? spotById(run.stand) : undefined;
  const menu = menuOf(spot);
  const isRunner = run.runner === view.me;
  const people = new Map(view.people.map((p) => [p.id, p]));
  const lvl = spot ? levelOfPlace(placeOf(spot.id)!) : undefined;
  return (
    <li
      data-testid="snack-run"
      className="rounded-3xl bg-white/8 p-4 ring-1 ring-white/10"
    >
      <p className="text-[16px] font-extrabold">
        🏃 {isRunner ? "You're" : `${runner?.name ?? "Someone"} is`} going{" "}
        {spot ? `to ${spot.name}` : "to the concourse"}
      </p>
      <p className="text-[13px] text-white/65">
        {agoWords(run.at, now)}
        {run.note && <> · “{run.note}”</>}
      </p>
      {spot && (
        <button
          type="button"
          onClick={() => onShow(spot.id)}
          className="mt-1 min-h-10 text-[13px] font-semibold text-white/85 underline"
        >
          Show {spot.name} on the map{lvl ? "" : ""}
        </button>
      )}

      <h3 className="mt-3 text-[14px] font-bold">
        {run.items.length === 0 ? "No requests yet" : "Requests"}
      </h3>
      <ul className="mt-1 flex flex-col gap-1" data-testid="snack-items">
        {run.items.map((i) => (
          <li key={i.user} className="text-[14px]">
            <strong>
              {i.user === view.me
                ? "You"
                : first(people.get(i.user)?.name ?? "?")}
            </strong>
            : {i.item}
          </li>
        ))}
      </ul>

      {live && !isRunner && (
        <form
          className="mt-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!item.trim()) return;
            await arena.send(
              { type: "runRequest", run: run.id, item },
              { done: `Requested for ${first(runner?.name ?? "the runner")}.` },
            );
          }}
        >
          {menu && (
            <div className="mb-2">
              <p className="text-[12px] text-white/60">
                From the arena&apos;s dietary guide — not a full menu, no prices
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {menu.items.slice(0, 5).map((m) => (
                  <button
                    key={m.name}
                    type="button"
                    onClick={() => setItem(m.name.slice(0, 60))}
                    className="min-h-10 rounded-full border border-white/25 px-3 text-[12px]"
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">What do you want?</span>
              <input
                value={item}
                maxLength={60}
                onChange={(e) => setItem(e.target.value)}
                placeholder="What do you want?"
                className="min-h-11 w-full rounded-xl bg-white/10 px-3 text-[15px] placeholder:text-white/45"
              />
            </label>
            <button
              type="submit"
              disabled={!item.trim()}
              className="min-h-11 rounded-xl bg-white px-4 text-[14px] font-bold text-black disabled:opacity-40"
            >
              {mine ? "Update" : "Ask"}
            </button>
          </div>
          {mine && (
            <button
              type="button"
              onClick={() => {
                void arena.send({ type: "runUnrequest", run: run.id });
                setItem("");
              }}
              className="mt-2 min-h-10 text-[13px] text-white/70 underline"
            >
              Never mind
            </button>
          )}
        </form>
      )}

      {live && isRunner && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn
            kind="go"
            onClick={() =>
              void arena.send(
                { type: "runClose", run: run.id, outcome: "done" },
                { done: "Run done. Hope you got the napkins." },
              )
            }
          >
            ✅ Done — I&apos;m back
          </Btn>
          <Btn
            onClick={() =>
              void arena.send(
                { type: "runClose", run: run.id, outcome: "cancelled" },
                { done: "Run called off." },
              )
            }
          >
            Call it off
          </Btn>
        </div>
      )}
    </li>
  );
}
