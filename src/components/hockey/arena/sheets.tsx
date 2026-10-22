"use client";

import { useEffect, useId, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { gateById } from "@/domain/hockey/arena";
import {
  distanceWords,
  levelOfSection,
  nearest,
  type Spot,
} from "@/domain/hockey/concourse";
import {
  CART_MENU,
  DIET_LABEL,
  DRINK_RULES,
  FOOD_PAGE,
  STAND_MENUS,
  BEER_ON_TAP,
  type StandMenu,
} from "@/domain/hockey/menus";
import { GUEST_FACTS } from "@/domain/hockey/guest-facts";
import {
  ELSEWHERE,
  STATUS_PRESETS,
  agoWords,
  placeOf,
} from "@/domain/hockey/arena-mode";
import type { Arena } from "./useArena";
import { hueColour, pinGlyph, pinStyle } from "./ArenaMap";

function Sheet({
  title,
  onClose,
  children,
}: {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion() ?? false;
  const id = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-black/55"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85dvh] max-w-2xl overflow-y-auto rounded-t-[28px] bg-[#0d1424] px-5 pt-3 pb-8 text-white shadow-[0_-20px_60px_rgba(0,0,0,0.6)]"
        initial={reduced ? { opacity: 0 } : { y: "100%" }}
        animate={reduced ? { opacity: 1 } : { y: 0 }}
        exit={reduced ? { opacity: 0 } : { y: "100%" }}
        transition={
          reduced
            ? { duration: 0 }
            : { type: "spring", stiffness: 340, damping: 32 }
        }
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/25" />
        <div className="flex items-start gap-3">
          <h2
            id={id}
            className="min-w-0 flex-1 text-[22px] leading-tight font-extrabold"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/10"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </motion.div>
    </>
  );
}

export function PinBadge({ spot }: { spot: Spot }) {
  const s = pinStyle(spot);
  return (
    <span
      aria-hidden
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-black"
      style={{ background: s.fill, color: s.ink }}
    >
      {pinGlyph(spot)}
    </span>
  );
}

export function MenuList({
  menu,
  diet,
}: {
  menu: StandMenu;
  diet?: keyof typeof DIET_LABEL | null;
}) {
  const items = diet
    ? menu.items.filter((i) => i.diets.includes(diet))
    : menu.items;
  return (
    <div className="mt-2">
      <ul className="flex flex-col gap-1.5">
        {items.map((i) => (
          <li key={i.name} className="text-[14px] leading-snug">
            {i.name}
            <span className="ml-1.5 text-[12px] text-white/55">
              {i.diets.map((d) => DIET_LABEL[d]).join(" · ")}
            </span>
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-[14px] text-white/60">
            Nothing listed here for that diet.
          </li>
        )}
      </ul>
      <p className="mt-2 text-[12px] text-white/55">
        From the arena&apos;s dietary guide ({FOOD_PAGE.updated}):{" "}
        {menu.listedAt}. A guide, not the whole menu. No prices published.
      </p>
      <SourceLink
        href={FOOD_PAGE.url}
        className="text-[13px] font-semibold text-white/75"
      >
        The dietary guide ↗
      </SourceLink>
    </div>
  );
}

/** A source, as a link a thumb can hit: inline, but 40 px tall. */
export function SourceLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex min-h-10 items-center underline ${className}`}
    >
      {children}
    </a>
  );
}

export function SourceLine({
  text,
  source,
  url,
}: {
  text: string;
  source: string;
  url: string;
}) {
  return (
    <li className="text-[14px] leading-snug">
      {text}{" "}
      <SourceLink href={url} className="text-[12px] text-white/55">
        {source}
      </SourceLink>
    </li>
  );
}

/** One place, opened from the map or a list. */
export function PlaceSheet({
  placeId,
  arena,
  live,
  onClose,
}: {
  placeId: string;
  arena: Arena;
  live: boolean;
  onClose: () => void;
}) {
  const { view, now } = arena;
  const place = placeOf(placeId, view.meetup);
  const people = new Map(view.people.map((p) => [p.id, p]));
  const mySection = people.get(view.me)?.section;
  if (!place) return null;
  const spot = place.spot;
  const gate = place.gate ? gateById(place.gate) : undefined;
  const here = view.checkins.filter((c) => c.place === placeId);
  const seatedHere = place.section
    ? view.people.filter((p) => p.section === place.section)
    : [];
  const menu =
    spot?.kind === "snackCart"
      ? CART_MENU
      : spot?.code && spot.code in STAND_MENUS
        ? STAND_MENUS[spot.code as keyof typeof STAND_MENUS]
        : undefined;
  const distance = spot ? distanceWords(mySection, spot) : undefined;

  return (
    <Sheet
      onClose={onClose}
      title={
        <span className="flex items-center gap-2.5">
          {spot && <PinBadge spot={spot} />}
          {place.label}
        </span>
      }
    >
      <p className="mt-1 text-[14px] text-white/75" data-testid="place-where">
        {place.where}
        {distance ? ` · ${distance} from your section` : ""}
      </p>
      {spot?.note && (
        <p className="mt-2 text-[14px] text-white/80">{spot.note}</p>
      )}
      {gate && (
        <p className="mt-2 text-[14px] text-white/80">
          {gate.where}.{" "}
          {gate.accessible
            ? "Accessible entrance."
            : "Not an accessible entrance."}{" "}
          {gate.note ?? ""}
        </p>
      )}

      {(here.length > 0 || seatedHere.length > 0) && (
        <ul className="mt-4 flex flex-col gap-2">
          {here.map((c) => {
            const p = people.get(c.user);
            if (!p) return null;
            return (
              <li key={c.user} className="flex items-center gap-2 text-[14px]">
                <span
                  className="inline-flex size-8 items-center justify-center rounded-full"
                  style={{ background: hueColour(p.hue) }}
                  aria-hidden
                >
                  {p.emoji}
                </span>
                <span>
                  <strong>{c.user === view.me ? "You" : p.name}</strong> checked
                  in {agoWords(c.at, now)}
                  {c.status ? ` — “${c.status}”` : ""}
                </span>
              </li>
            );
          })}
          {seatedHere.map((p) => (
            <li key={`seat-${p.id}`} className="text-[14px] text-white/75">
              🎟️ {p.id === view.me ? "Your" : `${p.name}'s`} seat is in this
              section.
            </li>
          ))}
        </ul>
      )}

      {menu && (
        <section className="mt-5">
          <h3 className="text-[15px] font-bold">What the arena lists here</h3>
          <MenuList menu={menu} />
        </section>
      )}
      {spot?.code === "L" && (
        <ul className="mt-4">
          <SourceLine {...BEER_ON_TAP} />
        </ul>
      )}
      {spot?.kind === "drink" && (
        <ul className="mt-4 flex flex-col gap-1.5">
          {DRINK_RULES.slice(0, 2).map((r) => (
            <SourceLine key={r.text} {...r} />
          ))}
        </ul>
      )}
      {spot?.kind === "store" && (
        <ul className="mt-4 flex flex-col gap-1.5">
          {GUEST_FACTS.filter((f) => f.topic === "store").map((f) => (
            <SourceLine key={f.text} {...f} />
          ))}
        </ul>
      )}
      {spot?.kind === "washroom" && (
        <ul className="mt-4 flex flex-col gap-1.5">
          {GUEST_FACTS.filter(
            (f) =>
              f.topic === "washrooms" || f.text.includes("family washrooms"),
          ).map((f) => (
            <SourceLine key={f.text} {...f} />
          ))}
        </ul>
      )}

      {live && (
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="min-h-12 rounded-2xl bg-[#00843d] px-3 text-[15px] font-extrabold"
            onClick={() => {
              void arena.checkIn(placeId);
              onClose();
            }}
          >
            📍 I&apos;m here
          </button>
          <button
            type="button"
            className="min-h-12 rounded-2xl bg-white px-3 text-[15px] font-extrabold text-[#070b14]"
            onClick={() => {
              void arena.send(
                { type: "ping", kind: "meet", place: placeId, note: "" },
                { done: `Asked everyone to meet at ${place.label}.` },
              );
              onClose();
            }}
          >
            🤝 Meet here
          </button>
        </div>
      )}
    </Sheet>
  );
}

/** "Where are you?" — the rules first, then the fastest ways to answer. */
export function CheckInSheet({
  arena,
  onClose,
  onPick,
}: {
  arena: Arena;
  onClose: () => void;
  onPick: (status: string) => void;
}) {
  const { view } = arena;
  const me = view.people.find((p) => p.id === view.me);
  const [status, setStatus] = useState("");
  const [section, setSection] = useState("");
  const others = view.people.length - 1;
  const go = (place: string) => {
    void arena.checkIn(place, status);
    onClose();
  };
  const near = me?.section
    ? nearest(
        me.section,
        (s) => s.kind === "food" || s.kind === "drink" || s.kind === "washroom",
        4,
      )
    : [];
  const typed = section.trim().toUpperCase();
  const typedOk = !!levelOfSection(typed);

  return (
    <Sheet title="Where are you?" onClose={onClose}>
      <p className="mt-2 rounded-2xl bg-white/8 px-4 py-3 text-[13px] leading-snug text-white/80">
        Only the {others === 1 ? "one other person" : `${others} other people`}{" "}
        on this night will see it — as a place you picked and how long ago,
        never GPS. It disappears when the night ends, and{" "}
        <strong>Vanish</strong> removes it any time.
      </p>

      <fieldset className="mt-4">
        <legend className="text-[14px] font-bold">
          Say something (optional)
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {STATUS_PRESETS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => setStatus(status === s ? "" : s)}
              className={`min-h-10 rounded-full border px-3 text-[13px] ${
                status === s
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
            value={status}
            maxLength={80}
            onChange={(e) => setStatus(e.target.value)}
            placeholder="Or your own words"
            className="min-h-11 w-full rounded-xl bg-white/10 px-3 text-[15px] placeholder:text-white/45"
          />
        </label>
      </fieldset>

      <div className="mt-5 grid grid-cols-1 gap-2">
        {me?.section && (
          <Choice onClick={() => go(`sec:${me.section}`)}>
            🎟️ In my seat — Section {me.section}
          </Choice>
        )}
        {view.meetup && (
          <Choice onClick={() => go("meetup")}>
            🤝 At the meeting point — {placeOf("meetup", view.meetup)?.where}
          </Choice>
        )}
        <Choice onClick={() => onPick(status)} accent>
          🗺️ Pick it on the map
        </Choice>
        {near.map(({ spot, apart }) => (
          <Choice key={spot.id} onClick={() => go(spot.id)}>
            <span className="inline-flex items-center gap-2">
              <PinBadge spot={spot} />
              {spot.name}
              <span className="text-[12px] text-white/55">
                {apart === 0 ? "by your section" : `${apart} along`}
              </span>
            </span>
          </Choice>
        ))}
        {(Object.keys(ELSEWHERE) as (keyof typeof ELSEWHERE)[]).map((k) => (
          <Choice key={k} onClick={() => go(k)}>
            {k === "out:outside" ? "🚪" : "🚶"} {ELSEWHERE[k]}
          </Choice>
        ))}
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (typedOk) go(`sec:${typed}`);
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Section number</span>
          <input
            inputMode="numeric"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            placeholder="Any section, e.g. 309"
            className="min-h-11 w-full rounded-xl bg-white/10 px-3 text-[15px] placeholder:text-white/45"
          />
        </label>
        <button
          type="submit"
          disabled={!typedOk}
          className="min-h-11 rounded-xl bg-white px-4 text-[15px] font-bold text-black disabled:opacity-40"
        >
          Check in
        </button>
      </form>
    </Sheet>
  );
}

function Choice({
  children,
  onClick,
  accent,
}: {
  children: React.ReactNode;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-12 rounded-2xl px-4 text-left text-[15px] font-semibold ${
        accent ? "bg-[#ffd84d] text-black" : "bg-white/8"
      }`}
    >
      {children}
    </button>
  );
}
