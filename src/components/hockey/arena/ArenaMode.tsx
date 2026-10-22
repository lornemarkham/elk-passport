"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Minus } from "lucide-react";
import type { ArenaLevel } from "@/domain/hockey/arena";
import type { Point } from "@/domain/hockey/bowl";
import {
  CONCOURSE_CHECKED,
  CONCOURSE_SOURCE,
  LEVELS,
  LEVEL_NAME,
  levelOfSection,
} from "@/domain/hockey/concourse";
import {
  agoWords,
  arenaWindow,
  levelOfPlace,
  placeOf,
  windowState,
} from "@/domain/hockey/arena-mode";
import styles from "../hockey.module.css";
import { ArenaMap, FILTERS, pointOf, usePlaces, type Filter } from "./ArenaMap";
import { useArena } from "./useArena";
import { IncomingPings } from "./IncomingPings";
import { CheckInSheet, PlaceSheet } from "./sheets";
import { ArenaPanel, EatPanel, HerdPanel, QuestsPanel } from "./panels";

type Tab = "herd" | "eat" | "quests" | "arena";

const TABS: readonly { id: Tab; label: string }[] = [
  { id: "herd", label: "The herd" },
  { id: "eat", label: "Eat & drink" },
  { id: "quests", label: "Quests" },
  { id: "arena", label: "The arena" },
];

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Vancouver",
  });

/**
 * **Arena Mode — the arena is the world, your friends are the characters.**
 *
 * One screen for the part of the night inside the building: a living map of
 * the level you're on, the group standing where they said they were, every
 * stand and washroom where the arena's map puts it, and the small games of
 * finding each other, feeding each other and buying a toque.
 *
 * Honest about what it is: a schematic from the arena's own map; check-ins,
 * not tracking; prices with who saw them and when. It opens three hours
 * before puck drop and forgets everything five hours after.
 */
export function ArenaMode({
  initial,
}: {
  initial: Parameters<typeof useArena>[0];
}) {
  const arena = useArena(initial);
  const { view, now } = arena;
  const reduced = useReducedMotion() ?? false;
  const people = useMemo(
    () => new Map(view.people.map((p) => [p.id, p])),
    [view.people],
  );
  const me = people.get(view.me);
  const myCheckIn = view.checkins.find((c) => c.user === view.me);
  const myPlace = myCheckIn ? placeOf(myCheckIn.place, view.meetup) : undefined;

  const [level, setLevel] = useState<ArenaLevel>(
    () =>
      levelOfSection(me?.section ?? "") ??
      levelOfSection(view.block ?? "") ??
      "100",
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<Point | null>(null);
  const [picking, setPicking] = useState<{ status: string } | null>(null);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("herd");

  const places = { "100": usePlaces("100"), "300": usePlaces("300") };
  const state = windowState(arenaWindow(view.startsAt), now);
  const live = view.available && state === "open";

  /** Show a place: its level, zoomed in, selected. */
  const showPlace = (placeId: string) => {
    const place = placeOf(placeId, view.meetup);
    if (!place) return;
    const lvl = levelOfPlace(place);
    if (lvl) {
      setLevel(lvl);
      const at = pointOf(places[lvl], lvl, placeId, view);
      if (at) setFocus(at);
    }
    setSelected(placeId);
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  const onSelect = (placeId: string) => {
    if (picking) {
      void arena.checkIn(placeId, picking.status);
      setPicking(null);
      setSelected(null);
      return;
    }
    setSelected(placeId);
  };

  const onLevel = (people: number, l: ArenaLevel) => (
    <button
      key={l}
      type="button"
      role="tab"
      aria-selected={level === l}
      onClick={() => {
        setLevel(l);
        setFocus(null);
        setSelected(null);
      }}
      className={`min-h-11 flex-1 rounded-full px-3 text-[14px] font-bold transition ${
        level === l ? "bg-white text-[#070b14]" : "bg-white/10 text-white"
      }`}
    >
      {LEVEL_NAME[l]}
      {people > 0 && (
        <span className="ml-1.5 rounded-full bg-[#00843d] px-1.5 py-0.5 text-[12px] text-white">
          {people}
        </span>
      )}
    </button>
  );

  const countOn = (l: ArenaLevel) =>
    view.checkins.filter((c) => {
      const p = placeOf(c.place, view.meetup);
      return p && !p.offMap && levelOfPlace(p) === l;
    }).length;

  // Everyone not standing on the level being shown.
  const elsewhere = view.people
    .map((p) => {
      const c = view.checkins.find((x) => x.user === p.id);
      const place = c ? placeOf(c.place, view.meetup) : undefined;
      const lvl = place ? levelOfPlace(place) : undefined;
      if (lvl === level && !place?.offMap) return null;
      return { person: p, checkin: c, place, lvl };
    })
    .filter((x) => x !== null);

  return (
    <main
      className={`${styles.page} min-h-dvh pb-24 text-white`}
      style={
        { "--home": "#00205b", "--away": "#00843d" } as React.CSSProperties
      }
    >
      <header className="mx-auto flex max-w-2xl items-center gap-3 px-4 pt-4">
        <Link
          href={`/hockey/${view.nightId}`}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/10"
          aria-label="Back to the night"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className={`${styles.display} text-[30px] leading-none`}>
            Arena Mode
          </h1>
          <p className="truncate text-[13px] text-white/70">
            {view.venue} · {view.title}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4">
        <StatusStrip
          state={state}
          available={view.available}
          opensAt={view.opensAt}
          closesAt={view.closesAt}
          myPlace={myPlace?.label}
          myAt={myCheckIn ? agoWords(myCheckIn.at, now) : undefined}
          onVanish={() => void arena.vanish()}
        />

        {live && (
          <IncomingPings
            view={view}
            now={now}
            onShow={showPlace}
            onCheckIn={() => setCheckInOpen(true)}
            onReply={(ping, kind) =>
              void arena.send(
                {
                  type: "ping",
                  kind,
                  to: ping.from,
                  replyTo: ping.id,
                  note: "",
                },
                {
                  done:
                    kind === "coming"
                      ? `Told ${people.get(ping.from)?.name ?? "them"} you're on the way.`
                      : `Told ${people.get(ping.from)?.name ?? "them"} you can't.`,
                },
              )
            }
          />
        )}

        <div role="tablist" aria-label="Level" className="mt-4 flex gap-2">
          {LEVELS.map((l) => onLevel(countOn(l), l))}
        </div>

        <div
          className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1"
          role="group"
          aria-label="Show on the map"
        >
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`min-h-10 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold ${
                filter === f.id
                  ? "border-white bg-white text-[#070b14]"
                  : "border-white/25 text-white/85"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <section
          aria-label="The arena"
          className="relative mt-3 overflow-hidden rounded-[28px] border border-white/10 bg-[#070b14] shadow-[0_30px_80px_-30px_rgba(0,132,61,0.55)]"
        >
          <AnimatePresence>
            {picking && (
              <motion.p
                initial={{ y: -30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -30, opacity: 0 }}
                className="absolute inset-x-3 top-3 z-10 flex items-center justify-between gap-2 rounded-2xl bg-[#ffd84d] px-4 py-2 text-[14px] font-bold text-[#1b1300]"
              >
                Tap where you are — a section or a pin.
                <button
                  type="button"
                  className="min-h-10 rounded-full bg-black/10 px-3 text-[13px]"
                  onClick={() => setPicking(null)}
                >
                  Cancel
                </button>
              </motion.p>
            )}
          </AnimatePresence>
          <ArenaMap
            level={level}
            view={view}
            now={now}
            filter={filter}
            selected={selected}
            focus={focus}
            picking={!!picking}
            onSelect={onSelect}
            onFocus={(p) => setFocus(p)}
          />
          {focus && (
            <button
              type="button"
              onClick={() => {
                setFocus(null);
                setSelected(null);
              }}
              className="absolute right-3 bottom-3 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-4 text-[14px] font-bold text-[#070b14] shadow-lg"
            >
              <Minus size={16} /> Whole level
            </button>
          )}
          {!focus && (
            <p className="pointer-events-none absolute bottom-3 left-4 text-[12px] text-white/60">
              Tap the map to zoom in
            </p>
          )}
        </section>

        <p className="mt-2 text-[12px] leading-snug text-white/60">
          Schematic from the arena&apos;s{" "}
          <a
            href={CONCOURSE_SOURCE.url}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            directory map
          </a>{" "}
          (read {CONCOURSE_CHECKED}). Not to scale; no indoor routes. Dots are
          check-ins people made, not GPS.
        </p>

        {elsewhere.length > 0 && (
          <ul
            className="mt-3 flex flex-wrap gap-2"
            aria-label="Not on this level"
          >
            {elsewhere.map(({ person, checkin, place, lvl }) => (
              <li key={person.id}>
                <button
                  type="button"
                  disabled={!lvl}
                  onClick={() => checkin && showPlace(checkin.place)}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white/8 px-3 text-[13px] text-white/85 disabled:opacity-70"
                >
                  <span aria-hidden>{person.emoji}</span>
                  {person.id === view.me ? "You" : person.name}
                  <span className="text-white/55">
                    ·{" "}
                    {!checkin
                      ? "not checked in"
                      : lvl
                        ? `${LEVEL_NAME[lvl]}`
                        : (place?.label ?? "somewhere")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {live && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCheckInOpen(true)}
              className="min-h-13 rounded-2xl bg-[#00843d] px-4 text-[16px] font-extrabold text-white shadow-[0_10px_30px_-10px_#00843d]"
            >
              📍 I&apos;m here
            </button>
            <button
              type="button"
              onClick={() => {
                const target = view.meetup
                  ? "meetup"
                  : (myCheckIn?.place ?? null);
                if (!target) {
                  setCheckInOpen(true);
                  return;
                }
                void arena.send(
                  { type: "ping", kind: "herd", place: target, note: "" },
                  {
                    done: `Herd summoned to ${placeOf(target, view.meetup)?.label}.`,
                  },
                );
                setFocus(null);
              }}
              className="min-h-13 rounded-2xl bg-white px-4 text-[16px] font-extrabold text-[#070b14]"
            >
              🐃 Find the herd
            </button>
          </div>
        )}

        <div
          role="tablist"
          aria-label="Arena Mode"
          className="sticky top-0 z-20 -mx-4 mt-6 flex gap-1 overflow-x-auto bg-[#070b14]/90 px-4 py-2 backdrop-blur"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`min-h-11 shrink-0 rounded-full px-4 text-[14px] font-bold ${
                tab === t.id ? "bg-[#00843d] text-white" : "text-white/75"
              }`}
            >
              {t.label}
              {t.id === "quests" &&
                view.quests.some((q) => q.status === "open") && (
                  <span className="ml-1.5 inline-block size-2 rounded-full bg-[#ffd84d]" />
                )}
            </button>
          ))}
        </div>

        <div className="pt-4">
          {tab === "herd" && (
            <HerdPanel
              arena={arena}
              live={live}
              onShow={showPlace}
              onCheckIn={() => setCheckInOpen(true)}
            />
          )}
          {tab === "eat" && (
            <EatPanel mySection={me?.section} onShow={showPlace} />
          )}
          {tab === "quests" && (
            <QuestsPanel arena={arena} live={live} onShow={showPlace} />
          )}
          {tab === "arena" && <ArenaPanel />}
        </div>
      </div>

      {/* One sheet at a time, each waiting for the last to leave: with
          overlapping exits, a quick second tap lost its sheet. */}
      <AnimatePresence mode="wait">
        {selected && !picking && (
          <PlaceSheet
            key={selected}
            placeId={selected}
            arena={arena}
            live={live}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        {checkInOpen && (
          <CheckInSheet
            key="checkin"
            arena={arena}
            onClose={() => setCheckInOpen(false)}
            onPick={(status) => {
              setCheckInOpen(false);
              setPicking({ status });
              setSelected(null);
              window.scrollTo({
                top: 0,
                behavior: reduced ? "auto" : "smooth",
              });
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(arena.error || arena.flash) && (
          <motion.div
            role={arena.error ? "alert" : "status"}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className="fixed inset-x-0 bottom-6 z-50 mx-auto flex w-fit max-w-[92vw] items-center gap-3 rounded-full bg-white px-4 py-2.5 text-[14px] font-semibold text-black shadow-lg"
          >
            {arena.error ?? arena.flash}
            {arena.error && (
              <button
                type="button"
                className="min-h-8 text-black/60"
                onClick={arena.clearError}
                aria-label="Dismiss"
              >
                ✕
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function StatusStrip({
  state,
  available,
  opensAt,
  closesAt,
  myPlace,
  myAt,
  onVanish,
}: {
  state: "before" | "open" | "closed";
  available: boolean;
  opensAt: string;
  closesAt: string;
  myPlace?: string;
  myAt?: string;
  onVanish: () => void;
}) {
  if (!available) {
    return (
      <p className="mt-4 rounded-2xl bg-white/8 px-4 py-3 text-[14px] text-white/85">
        Arena Mode isn&apos;t switched on for this night yet. The map, the food
        guide and the arena facts all work; checking in doesn&apos;t.
      </p>
    );
  }
  if (state === "before") {
    return (
      <p className="mt-4 rounded-2xl bg-white/8 px-4 py-3 text-[14px] text-white/85">
        Check-ins open at <strong>{clock(opensAt)}</strong>, three hours before
        puck drop. Explore the arena now.
      </p>
    );
  }
  if (state === "closed") {
    return (
      <p className="mt-4 rounded-2xl bg-white/8 px-4 py-3 text-[14px] text-white/85">
        The night&apos;s over. Every check-in, ping and quest from it is gone —
        that&apos;s the deal.
      </p>
    );
  }
  return (
    <div
      className="mt-4 flex items-center gap-3 rounded-2xl bg-white/8 px-4 py-2.5"
      data-testid="sharing"
    >
      <span
        aria-hidden
        className={`size-2.5 shrink-0 rounded-full ${myPlace ? "bg-[#7dffb0]" : "bg-white/35"}`}
      />
      <p className="min-w-0 flex-1 text-[14px] leading-snug">
        {myPlace ? (
          <>
            Your group sees you at <strong>{myPlace}</strong>{" "}
            <span className="text-white/60">({myAt})</span>
          </>
        ) : (
          <>You&apos;re hidden. Nobody sees you until you check in.</>
        )}
        <span className="block text-[12px] text-white/55">
          Only people on this night · gone at {clock(closesAt)}
        </span>
      </p>
      {myPlace && (
        <button
          type="button"
          onClick={onVanish}
          className="min-h-10 shrink-0 rounded-full border border-white/30 px-3 text-[13px] font-bold"
        >
          👻 Vanish
        </button>
      )}
    </div>
  );
}
