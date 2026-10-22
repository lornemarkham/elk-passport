"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ACCESSIBILITY,
  CONFLICTS,
  ENTRY_GUIDANCE,
  ROGERS_ARENA_GATES,
  SOURCES,
} from "@/domain/hockey/arena";
import {
  LEVELS,
  LEVEL_NAME,
  SPOTS,
  distanceWords,
  levelOfSection,
  nearest,
  spotDistance,
  type Spot,
} from "@/domain/hockey/concourse";
import {
  CART_MENU,
  DIET_LABEL,
  DRINK_RULES,
  PRICE_REPORTS,
  SOFT_DRINKS,
  BEER_ON_TAP,
  STAND_MENUS,
  cheapestReportedBeer,
  type Diet,
} from "@/domain/hockey/menus";
import { GUEST_CONFLICTS, GUEST_FACTS } from "@/domain/hockey/guest-facts";
import {
  QUESTS,
  agoWords,
  dollars,
  freshness,
  lowestReport,
  placeOf,
  questKind,
  type ArenaPerson,
  type Quest,
} from "@/domain/hockey/arena-mode";
import type { Arena } from "./useArena";
import { hueColour } from "./ArenaMap";
import { MenuList, PinBadge, SourceLine, SourceLink } from "./sheets";

const H = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-[20px] leading-tight font-extrabold">{children}</h2>
);

function Face({ p, size = 40 }: { p: ArenaPerson; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        background: hueColour(p.hue),
        width: size,
        height: size,
        fontSize: size * 0.5,
      }}
    >
      {p.emoji}
    </span>
  );
}

function Btn({
  children,
  onClick,
  kind = "ghost",
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  kind?: "go" | "ghost" | "light";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const cls =
    kind === "go"
      ? "bg-[#00843d] text-white"
      : kind === "light"
        ? "bg-white text-[#070b14]"
        : "border border-white/25 text-white";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-10 rounded-full px-3.5 text-[14px] font-bold disabled:opacity-40 ${cls}`}
    >
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ the herd

export function HerdPanel({
  arena,
  live,
  onShow,
  onCheckIn,
}: {
  arena: Arena;
  live: boolean;
  onShow: (placeId: string) => void;
  onCheckIn: () => void;
}) {
  const { view, now } = arena;
  const reduced = useReducedMotion() ?? false;
  const mine = view.checkins.find((c) => c.user === view.me);
  const people = new Map(view.people.map((p) => [p.id, p]));
  const ordered = [...view.people].sort((a, b) =>
    a.id === view.me ? -1 : b.id === view.me ? 1 : a.name.localeCompare(b.name),
  );
  const sent = view.pings
    .filter((p) => p.from === view.me && !p.replyTo)
    .slice(0, 5);

  return (
    <section aria-labelledby="herd-title">
      <H>
        <span id="herd-title">The herd</span>
      </H>
      <p className="mt-1 text-[14px] text-white/65">
        Where everybody said they were, and how long ago. Nobody is tracked.
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        {ordered.map((p, i) => {
          const c = view.checkins.find((x) => x.user === p.id);
          const place = c ? placeOf(c.place, view.meetup) : undefined;
          const fresh = c ? freshness(c.at, now) : undefined;
          const isMe = p.id === view.me;
          return (
            <motion.li
              key={p.id}
              data-testid={`herd-${isMe ? "me" : p.name}`}
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduced ? 0 : i * 0.04 }}
              className="rounded-3xl bg-white/6 p-4"
            >
              <div className="flex items-start gap-3">
                <Face p={p} />
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-bold">
                    {isMe ? "You" : p.name}
                    {p.role === "host" && (
                      <span className="ml-2 rounded-full bg-white/12 px-2 py-0.5 text-[12px] font-semibold">
                        host
                      </span>
                    )}
                  </p>
                  <p className="text-[14px] text-white/80">
                    {place ? (
                      <>
                        📍 {place.label}
                        <span className="text-white/55">
                          {" "}
                          · {agoWords(c!.at, now)}
                        </span>
                        {fresh === "stale" && (
                          <span className="ml-1 text-[12px] text-[#ffd84d]">
                            (old news)
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-white/55">
                        Hasn&apos;t checked in
                      </span>
                    )}
                  </p>
                  {c?.status && (
                    <p className="text-[14px] text-white/70 italic">
                      “{c.status}”
                    </p>
                  )}
                  <p className="text-[12px] text-white/50">
                    {p.section
                      ? `Seat: Section ${p.section}`
                      : "No seat entered"}
                  </p>
                </div>
              </div>
              {live && !isMe && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {place && !place.offMap && fresh !== "stale" ? (
                    <Btn kind="light" onClick={() => onShow(c!.place)}>
                      🔦 Find this legend
                    </Btn>
                  ) : (
                    <Btn
                      kind="light"
                      onClick={() =>
                        void arena.send(
                          { type: "ping", kind: "where", to: p.id, note: "" },
                          { done: `Asked ${p.name} where they are.` },
                        )
                      }
                    >
                      🔦 Where you at, {p.name.split(" ")[0]}?
                    </Btn>
                  )}
                  <Btn
                    onClick={() =>
                      mine
                        ? void arena.send(
                            {
                              type: "ping",
                              kind: "here",
                              to: p.id,
                              place: mine.place,
                              note: "",
                            },
                            { done: `Told ${p.name} where you are.` },
                          )
                        : onCheckIn()
                    }
                  >
                    👋 I&apos;m over here, genius
                  </Btn>
                  <Btn
                    onClick={() =>
                      mine
                        ? void arena.send(
                            {
                              type: "ping",
                              kind: "meet",
                              to: p.id,
                              place: mine.place,
                              note: "",
                            },
                            { done: `Asked ${p.name} to meet you.` },
                          )
                        : onCheckIn()
                    }
                  >
                    🤝 Meet me
                  </Btn>
                </div>
              )}
            </motion.li>
          );
        })}
      </ul>

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

// ------------------------------------------------------------------ eat & drink

const DIETS = Object.keys(DIET_LABEL) as Diet[];

export function EatPanel({
  mySection,
  onShow,
}: {
  mySection?: string;
  onShow: (placeId: string) => void;
}) {
  const [diet, setDiet] = useState<Diet | null>(null);
  const [kind, setKind] = useState<"food" | "drink">("food");
  const level = mySection ? levelOfSection(mySection) : undefined;
  const levels = level ? [level] : LEVELS;
  const cheapest = cheapestReportedBeer();

  const listFor = (l: (typeof LEVELS)[number]) =>
    SPOTS.filter((s) => s.level === l)
      .filter((s) =>
        kind === "food"
          ? s.kind === "food" || s.kind === "snackCart"
          : s.kind === "drink",
      )
      .filter((s) => {
        if (!diet) return true;
        const menu =
          s.kind === "snackCart"
            ? CART_MENU
            : STAND_MENUS[s.code as keyof typeof STAND_MENUS];
        return !!menu?.items.some((i) => i.diets.includes(diet));
      })
      .sort(
        (a, b) =>
          (mySection
            ? (spotDistance(mySection, a) ?? 99) -
              (spotDistance(mySection, b) ?? 99)
            : 0) || a.name.localeCompare(b.name),
      );

  return (
    <section aria-labelledby="eat-title">
      <H>
        <span id="eat-title">Eat &amp; drink</span>
      </H>
      <p className="mt-1 text-[14px] text-white/65">
        {mySection
          ? `Nearest your seat in Section ${mySection} first, by the arena map's section numbers.`
          : "Add your seat on the night's Plan tab (Our Seats) and this sorts by what's nearest you."}
      </p>

      <div className="mt-3 flex gap-2" role="group" aria-label="Food or drink">
        {(["food", "drink"] as const).map((k) => (
          <Btn
            key={k}
            kind={kind === k ? "light" : "ghost"}
            onClick={() => setKind(k)}
          >
            {k === "food" ? "🌭 Food" : "🍺 Drinks"}
          </Btn>
        ))}
      </div>
      {kind === "food" && (
        <div
          className="mt-2 flex flex-wrap gap-2"
          role="group"
          aria-label="Diet"
        >
          {DIETS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={diet === d}
              onClick={() => setDiet(diet === d ? null : d)}
              className={`min-h-10 rounded-full border px-3 text-[13px] font-semibold ${
                diet === d
                  ? "border-[#7dffb0] bg-[#7dffb0] text-black"
                  : "border-white/25"
              }`}
            >
              {DIET_LABEL[d]}
            </button>
          ))}
        </div>
      )}

      {levels.map((l) => (
        <div key={l} className="mt-4">
          {!level && (
            <h3 className="mb-2 text-[15px] font-bold">{LEVEL_NAME[l]}</h3>
          )}
          <ul className="flex flex-col gap-2">
            {listFor(l).map((s) => (
              <StandRow
                key={s.id}
                spot={s}
                diet={kind === "food" ? diet : null}
                mySection={mySection}
                onShow={onShow}
              />
            ))}
          </ul>
        </div>
      ))}

      {kind === "drink" && (
        <section
          className="mt-6 rounded-3xl bg-white/6 p-4"
          aria-labelledby="prices-title"
        >
          <h3 id="prices-title" className="text-[16px] font-bold">
            Prices — what&apos;s actually known
          </h3>
          <p className="mt-1 text-[13px] text-white/65">
            The arena publishes no prices. One reporter wrote some down:
          </p>
          {PRICE_REPORTS.map((r) => (
            <div key={r.url} className="mt-3">
              <table className="w-full text-[14px]">
                <tbody>
                  {r.prices.map((p) => (
                    <tr key={p.item} className="border-b border-white/8">
                      <td className="py-1.5">{p.item}</td>
                      <td className="py-1.5 text-right font-bold tabular-nums">
                        {p.price}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[12px] text-white/55">
                Seen by <SourceLink href={r.url}>{r.by}</SourceLink> ({r.author}
                , published {r.published}) at the {r.seen}. Press, not official;
                no stand named; tonight&apos;s may differ. Run{" "}
                <strong>Find the Cheapest Beer</strong> to check with your own
                eyes.
              </p>
            </div>
          ))}
          {cheapest && (
            <p className="mt-3 text-[14px]">
              Cheapest beer anyone has published:{" "}
              <strong>{cheapest.price.item}</strong>, {cheapest.price.price} (
              {cheapest.report.by}, {cheapest.report.published}).
            </p>
          )}
          <ul className="mt-4 flex flex-col gap-1.5">
            <SourceLine {...BEER_ON_TAP} />
            <SourceLine {...SOFT_DRINKS} />
            {DRINK_RULES.map((r) => (
              <SourceLine key={r.text} {...r} />
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

function StandRow({
  spot,
  diet,
  mySection,
  onShow,
}: {
  spot: Spot;
  diet: Diet | null;
  mySection?: string;
  onShow: (placeId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const menu =
    spot.kind === "snackCart"
      ? CART_MENU
      : STAND_MENUS[spot.code as keyof typeof STAND_MENUS];
  const distance = distanceWords(mySection, spot);
  return (
    <li className="rounded-2xl bg-white/6 px-3 py-2.5" data-testid="stand">
      <div className="flex items-center gap-3">
        <PinBadge spot={spot} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold">{spot.name}</p>
          <p className="text-[12px] text-white/60">
            {spot.by.length === 1
              ? `By ${spot.by[0]}`
              : `By ${spot.by.join("–")}`}
            {spot.zone ? " · off the bowl" : ""}
            {distance ? ` · ${distance}` : ""}
          </p>
        </div>
        <Btn onClick={() => onShow(spot.id)}>Map</Btn>
      </div>
      {menu ? (
        <>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="mt-1 min-h-10 text-[13px] font-semibold text-[#7dffb0]"
          >
            {open ? "Hide" : "What the arena lists here"}
          </button>
          {open && <MenuList menu={menu} diet={diet} />}
        </>
      ) : (
        <p className="mt-1 text-[12px] text-white/50">
          The arena publishes nothing about what&apos;s here.
        </p>
      )}
    </li>
  );
}

// ------------------------------------------------------------------ quests

export function QuestsPanel({
  arena,
  live,
  onShow,
}: {
  arena: Arena;
  live: boolean;
  onShow: (placeId: string) => void;
}) {
  const { view } = arena;
  const [starting, setStarting] = useState<string | null>(null);
  const open = view.quests.filter((q) => q.status === "open");
  const done = view.quests.filter((q) => q.status !== "open");
  const reduced = useReducedMotion() ?? false;

  return (
    <section aria-labelledby="quests-title">
      <H>
        <span id="quests-title">Side quests</span>
      </H>
      <p className="mt-1 text-[14px] text-white/65">
        Small missions for the intermissions. Optional, silly, over when the
        night is.
      </p>

      {open.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {open.map((q) => (
              <motion.li
                key={q.id}
                layout={!reduced}
                initial={reduced ? false : { opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={
                  reduced
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.9, rotate: -2 }
                }
              >
                <QuestCard
                  quest={q}
                  arena={arena}
                  live={live}
                  onShow={onShow}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {live && (
        <>
          <h3 className="mt-6 text-[15px] font-bold">Start one</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {QUESTS.map((k) => (
              <button
                key={k.id}
                type="button"
                aria-expanded={starting === k.id}
                onClick={() => setStarting(starting === k.id ? null : k.id)}
                className={`min-h-20 rounded-2xl p-3 text-left ${
                  starting === k.id ? "bg-white text-[#070b14]" : "bg-white/8"
                }`}
              >
                <span className="text-[24px]" aria-hidden>
                  {k.emoji}
                </span>
                <span className="block text-[15px] leading-tight font-extrabold">
                  {k.name}
                </span>
              </button>
            ))}
          </div>
          {/* Enter-only: with an exit animation, opening a second quest
              while the first form was still leaving removed the new one. */}
          {starting && (
            <motion.div
              key={starting}
              initial={reduced ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <StartQuest
                kindId={starting}
                arena={arena}
                // Closes only its own form: a slow answer must not shut the one
                // somebody opened in the meantime.
                onDone={() =>
                  setStarting((now) => (now === starting ? null : now))
                }
              />
            </motion.div>
          )}
        </>
      )}
      {!live && open.length === 0 && (
        <p className="mt-4 text-[14px] text-white/60">
          Quests run while the arena&apos;s open for this night.
        </p>
      )}

      {done.length > 0 && (
        <section className="mt-6">
          <h3 className="text-[15px] font-bold">The log</h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {done.map((q) => {
              const k = questKind(q.kind);
              const by = view.people.find((p) => p.id === q.closedBy);
              return (
                <li
                  key={q.id}
                  className="text-[14px] text-white/75"
                  data-testid="quest-log"
                >
                  {q.status === "done" ? "✅" : "🏳️"} {k?.emoji} {k?.name} —{" "}
                  {q.status === "done" ? "done" : "dropped"} by{" "}
                  {by?.name ?? "someone"}
                  {q.closedNote ? `: “${q.closedNote}”` : ""}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </section>
  );
}

function StartQuest({
  kindId,
  arena,
  onDone,
}: {
  kindId: string;
  arena: Arena;
  onDone: () => void;
}) {
  const { view } = arena;
  const k = questKind(kindId)!;
  const mine = view.checkins.find((c) => c.user === view.me);
  const me = view.people.find((p) => p.id === view.me);
  const others = view.people.filter((p) => p.id !== view.me);
  const herdPlaces = [
    ...(view.meetup ? ["meetup"] : []),
    ...(mine ? [mine.place] : []),
    ...(me?.section ? [`sec:${me.section}`] : []),
    ...ROGERS_ARENA_GATES.map((g) => `gate:${g.id}`),
  ].filter((v, i, a) => a.indexOf(v) === i);
  const [subject, setSubject] = useState(others[0]?.id ?? "");
  const [place, setPlace] = useState(herdPlaces[0] ?? "");
  const [note, setNote] = useState("");

  return (
    <form
      className="mt-3 rounded-3xl bg-white/6 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await arena.send(
          {
            type: "questStart",
            kind: k.id,
            note,
            ...(k.needsSubject ? { subject } : {}),
            ...(k.needsPlace ? { place } : {}),
          },
          { done: `${k.emoji} ${k.name} is on.` },
        );
        if (ok) onDone();
      }}
    >
      <p className="text-[15px]">{k.pitch}</p>
      {k.sensible && (
        <p className="mt-1 text-[13px] text-[#7dffb0]">{k.sensible}</p>
      )}
      {k.needsSubject && (
        <label className="mt-3 block text-[14px] font-semibold">
          Who&apos;s missing?
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 block min-h-11 w-full rounded-xl bg-white/10 px-3 text-[15px]"
          >
            {others.map((p) => (
              <option key={p.id} value={p.id} className="text-black">
                {p.emoji} {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {k.needsPlace && (
        <label className="mt-3 block text-[14px] font-semibold">
          Where does the herd meet?
          <select
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            className="mt-1 block min-h-11 w-full rounded-xl bg-white/10 px-3 text-[15px]"
          >
            {herdPlaces.map((id) => (
              <option key={id} value={id} className="text-black">
                {placeOf(id, view.meetup)?.label} —{" "}
                {placeOf(id, view.meetup)?.where}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="mt-3 block text-[14px] font-semibold">
        A word for the crew (optional)
        <input
          value={note}
          maxLength={80}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 block min-h-11 w-full rounded-xl bg-white/10 px-3 text-[15px]"
        />
      </label>
      <div className="mt-3 flex gap-2">
        <Btn type="submit" kind="go" disabled={k.needsSubject && !subject}>
          Start {k.name}
        </Btn>
        <Btn onClick={onDone}>Never mind</Btn>
      </div>
    </form>
  );
}

function QuestCard({
  quest,
  arena,
  live,
  onShow,
}: {
  quest: Quest;
  arena: Arena;
  live: boolean;
  onShow: (placeId: string) => void;
}) {
  const { view, now } = arena;
  const k = questKind(quest.kind);
  const people = new Map(view.people.map((p) => [p.id, p]));
  const starter = people.get(quest.startedBy);
  const onCrew = quest.crew.some((c) => c.user === view.me);
  const myCrew = quest.crew.find((c) => c.user === view.me);
  const [note, setNote] = useState(myCrew?.note ?? "");
  const [price, setPrice] = useState("");
  const [priceAt, setPriceAt] = useState("");
  const anchor = people.get(view.me)?.section ?? starter?.section;
  const suggestions =
    k?.destination && anchor ? nearest(anchor, k.destination, 3) : [];
  const subject = quest.subject ? people.get(quest.subject) : undefined;
  const subjectAt = subject
    ? view.checkins.find((c) => c.user === subject.id)
    : undefined;
  const lowest = lowestReport(quest);
  const published = cheapestReportedBeer();
  const drinkSpots = anchor
    ? nearest(anchor, (s) => s.kind === "drink", 8).map((n) => n.spot)
    : SPOTS.filter((s) => s.kind === "drink");
  if (!k) return null;

  return (
    <article
      className="rounded-3xl bg-gradient-to-br from-[#00843d]/30 to-white/5 p-4 ring-1 ring-white/10"
      data-testid={`quest-${k.id}`}
    >
      <header className="flex items-start gap-3">
        <span className="text-[30px] leading-none" aria-hidden>
          {k.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[18px] leading-tight font-extrabold">{k.name}</h3>
          <p className="text-[12px] text-white/60">
            Started by{" "}
            {quest.startedBy === view.me ? "you" : (starter?.name ?? "someone")}{" "}
            · {agoWords(quest.at, now)}
          </p>
        </div>
      </header>
      {quest.note && <p className="mt-2 text-[14px] italic">“{quest.note}”</p>}
      {subject && (
        <p className="mt-2 text-[14px]">
          Missing: {subject.emoji} <strong>{subject.name}</strong> —{" "}
          {subjectAt
            ? `last checked in at ${placeOf(subjectAt.place, view.meetup)?.label}, ${agoWords(subjectAt.at, now)}`
            : "never checked in. Classic."}
        </p>
      )}
      {quest.place && (
        <p className="mt-2 text-[14px]">
          Meet at <strong>{placeOf(quest.place, view.meetup)?.label}</strong>{" "}
          <button
            type="button"
            className="min-h-10 px-1 underline"
            onClick={() => onShow(quest.place!)}
          >
            show me
          </button>
        </p>
      )}
      {k.sensible && (
        <p className="mt-2 text-[13px] text-[#7dffb0]">{k.sensible}</p>
      )}
      {suggestions.length > 0 && (
        <div className="mt-3">
          <p className="text-[13px] text-white/65">Nearest to {anchor}:</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {suggestions.map(({ spot, apart }) => (
              <Btn key={spot.id} onClick={() => onShow(spot.id)}>
                {spot.name} by {spot.by.join("–")} ·{" "}
                {apart === 0 ? "right there" : `${apart} along`}
              </Btn>
            ))}
          </div>
        </div>
      )}
      {k.reportsPrice && (
        <div className="mt-3 rounded-2xl bg-black/25 p-3 text-[14px]">
          {lowest ? (
            <p>
              🏆 Lowest seen tonight:{" "}
              <strong>{dollars(lowest.priceCents!)}</strong> by{" "}
              {people.get(lowest.user)?.name}
              {lowest.place
                ? ` at ${placeOf(lowest.place, view.meetup)?.label}`
                : ""}{" "}
              · {agoWords(lowest.at, now)}. Reported, not verified.
            </p>
          ) : (
            <p>Nobody&apos;s reported a price yet.</p>
          )}
          {published && (
            <p className="mt-1 text-[12px] text-white/60">
              To beat: {published.price.item} at {published.price.price}, seen
              by {published.report.by} ({published.report.published}).
            </p>
          )}
        </div>
      )}

      <ul className="mt-3 flex flex-col gap-1.5" aria-label="Crew">
        {quest.crew.map((c) => {
          const p = people.get(c.user);
          if (!p) return null;
          return (
            <li key={c.user} className="flex items-center gap-2 text-[14px]">
              <Face p={p} size={28} />
              <span>
                {c.user === view.me ? "You" : p.name}
                {c.note ? ` — ${c.note}` : ""}
                {c.priceCents ? ` · saw ${dollars(c.priceCents)}` : ""}
                {c.place && c.priceCents
                  ? ` at ${placeOf(c.place, view.meetup)?.label}`
                  : ""}
              </span>
            </li>
          );
        })}
      </ul>

      {live && (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const cents = Math.round(
              Number(price.replace(/[^0-9.]/g, "")) * 100,
            );
            void arena.send(
              {
                type: "questJoin",
                quest: quest.id,
                note,
                ...(k.reportsPrice && cents > 0 ? { priceCents: cents } : {}),
                ...(k.reportsPrice && priceAt ? { place: priceAt } : {}),
              },
              { done: onCrew ? "Updated." : `You're on ${k.name}.` },
            );
            setPrice("");
          }}
        >
          {k.noteLabel && (
            <label className="text-[13px] font-semibold">
              {k.noteLabel}
              <input
                value={note}
                maxLength={80}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1 block min-h-11 w-full rounded-xl bg-white/10 px-3 text-[15px]"
              />
            </label>
          )}
          {k.reportsPrice && (
            <div className="flex gap-2">
              <label className="w-28 text-[13px] font-semibold">
                Price you saw
                <input
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="$"
                  className="mt-1 block min-h-11 w-full rounded-xl bg-white/10 px-3 text-[15px]"
                />
              </label>
              <label className="min-w-0 flex-1 text-[13px] font-semibold">
                Where
                <select
                  value={priceAt}
                  onChange={(e) => setPriceAt(e.target.value)}
                  className="mt-1 block min-h-11 w-full rounded-xl bg-white/10 px-3 text-[15px]"
                >
                  <option value="" className="text-black">
                    Somewhere
                  </option>
                  {drinkSpots.map((s) => (
                    <option key={s.id} value={s.id} className="text-black">
                      {s.name} — {LEVEL_NAME[s.level]}, by {s.by.join("–")}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Btn type="submit" kind={onCrew ? "ghost" : "go"}>
              {onCrew ? (k.reportsPrice ? "Report" : "Update") : "I'm in"}
            </Btn>
            {onCrew && quest.startedBy !== view.me && (
              <Btn
                onClick={() =>
                  void arena.send({ type: "questLeave", quest: quest.id })
                }
              >
                Leave
              </Btn>
            )}
            {(onCrew || quest.startedBy === view.me) && (
              <Btn
                kind="light"
                onClick={() =>
                  void arena.send(
                    {
                      type: "questClose",
                      quest: quest.id,
                      outcome: "done",
                      note: "",
                    },
                    { done: `${k.emoji} Quest complete. Legend.` },
                  )
                }
              >
                ✅ Done
              </Btn>
            )}
            {quest.startedBy === view.me && (
              <Btn
                onClick={() =>
                  void arena.send({
                    type: "questClose",
                    quest: quest.id,
                    outcome: "dropped",
                    note: "",
                  })
                }
              >
                Drop it
              </Btn>
            )}
          </div>
        </form>
      )}
    </article>
  );
}

// ------------------------------------------------------------------ the arena

export function ArenaPanel() {
  return (
    <section aria-labelledby="arena-title" className="flex flex-col gap-6">
      <div>
        <H>
          <span id="arena-title">The arena</span>
        </H>
        <p className="mt-1 text-[14px] text-white/65">
          Everything here is from Rogers Arena&apos;s own pages, with links.{" "}
          <SourceLink href={SOURCES.map.url}>The official map</SourceLink> is
          the real one; Passport&apos;s is a sketch of it.
        </p>
      </div>

      <div>
        <h3 className="text-[16px] font-bold">Gates</h3>
        <ul className="mt-2 flex flex-col gap-1.5">
          {ROGERS_ARENA_GATES.map((g) => (
            <li key={g.id} className="text-[14px]">
              <strong>{g.name}</strong> — {g.where}
              {!g.accessible && (
                <span className="text-[#ffd84d]"> · not accessible</span>
              )}
              {g.note ? (
                <span className="text-white/65"> · {g.note}</span>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12px] text-white/55">
          The arena doesn&apos;t say which gate is best for which section. Your
          ticket might.
        </p>
      </div>

      <div>
        <h3 className="text-[16px] font-bold">Getting in</h3>
        <ul className="mt-2 flex flex-col gap-1.5">
          {ENTRY_GUIDANCE.map((g) => (
            <SourceLine
              key={g.text}
              text={g.text}
              source={SOURCES[g.source].label}
              url={SOURCES[g.source].url}
            />
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-[16px] font-bold">Washrooms, help, families</h3>
        <ul className="mt-2 flex flex-col gap-1.5">
          {GUEST_FACTS.filter((f) => f.topic !== "store").map((f) => (
            <SourceLine key={f.text} {...f} />
          ))}
          {ACCESSIBILITY.map((g) => (
            <SourceLine
              key={g.text}
              text={g.text}
              source={SOURCES[g.source].label}
              url={SOURCES[g.source].url}
            />
          ))}
          <SourceLine {...DRINK_RULES[DRINK_RULES.length - 1]} />
        </ul>
      </div>

      <details className="rounded-2xl bg-white/6 p-4">
        <summary className="min-h-10 cursor-pointer text-[15px] font-bold">
          Where the arena&apos;s own pages disagree
        </summary>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[13px] text-white/75">
          {[...CONFLICTS, ...GUEST_CONFLICTS].map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </details>

      <details className="rounded-2xl bg-white/6 p-4">
        <summary className="min-h-10 cursor-pointer text-[15px] font-bold">
          Why there&apos;s no live location
        </summary>
        <p className="mt-2 text-[13px] leading-relaxed text-white/75">
          Phone location inside a concrete bowl is good to the building, not the
          section, and a web page can&apos;t keep sharing it from a pocket.
          Doing it properly means continuous tracking, which needs its own
          privacy review first. So Arena Mode only ever shows where somebody
          said they were, and when.
        </p>
      </details>
    </section>
  );
}
