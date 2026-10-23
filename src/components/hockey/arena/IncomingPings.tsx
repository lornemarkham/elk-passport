"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  agoWords,
  placeOf,
  type ArenaView,
  type Ping,
} from "@/domain/hockey/arena-mode";
import { hueColour } from "./ArenaMap";

/** A ping older than this has done its job; it stops shouting. */
const SHOUT_FOR_MS = 15 * 60_000;
/** "On my way" and "can't" say their piece faster. */
const ANSWER_FOR_MS = 60_000;
/** After this a ping shrinks to a one-line pill: it said its piece. */
const LOUD_FOR_MS = 30_000;
const EVENT = "arena:pings-dismissed";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/**
 * **Somebody wants you.** Pings addressed to me, or to everybody, from
 * somebody else — newest first, one at a time, each with the one
 * button that answers it. Dismissed ones are remembered on this phone only.
 */
export function IncomingPings({
  view,
  now,
  onShow,
  onCheckIn,
  onReply,
}: {
  view: ArenaView;
  now: Date;
  onShow: (placeId: string) => void;
  onCheckIn: () => void;
  onReply: (ping: Ping, kind: "coming" | "cant") => void;
}) {
  const reduced = useReducedMotion() ?? false;
  const key = `arena:${view.nightId}:dismissed`;
  const stored = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(key) ?? "",
    () => "",
  );
  const dismissed = useMemo(
    () => new Set(stored.split(",").filter(Boolean)),
    [stored],
  );

  const dismiss = (id: string) => {
    const next = new Set(dismissed).add(id);
    window.localStorage.setItem(key, [...next].slice(-80).join(","));
    window.dispatchEvent(new Event(EVENT));
  };

  const people = new Map(view.people.map((p) => [p.id, p]));
  const answered = new Set(
    view.pings
      .filter((p) => p.from === view.me && p.replyTo)
      .map((p) => p.replyTo as string),
  );
  const waiting = view.pings.filter(
    (p) =>
      p.from !== view.me &&
      (p.to === null || p.to === view.me) &&
      !dismissed.has(p.id) &&
      !answered.has(p.id) &&
      now.getTime() - new Date(p.at).getTime() <
        (p.kind === "coming" || p.kind === "cant"
          ? ANSWER_FOR_MS
          : SHOUT_FOR_MS) &&
      people.has(p.from),
  );
  const [opened, setOpened] = useState<string | null>(null);
  const more = Math.max(0, waiting.length - 1);
  const shown = waiting.slice(0, 1);

  return (
    <div
      aria-live="polite"
      // Over the page, not in it: a ping arriving must never push what
      // somebody is about to tap out from under their thumb. At the bottom,
      // one at a time, so it never covers Vanish at the top.
      className="pointer-events-none fixed inset-x-0 bottom-[calc(74px+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-2xl flex-col gap-2 px-3 empty:hidden"
    >
      <AnimatePresence initial={false}>
        {shown.map((p) => {
          const from = people.get(p.from)!;
          const place = p.place ? placeOf(p.place, view.meetup) : undefined;
          const { text, actions } = (() => {
            switch (p.kind) {
              case "where":
                return {
                  text: `${from.name} is looking for you, legend. Where you at?`,
                  actions: (
                    <Act onClick={() => (onCheckIn(), dismiss(p.id))}>
                      📍 Check in
                    </Act>
                  ),
                };
              case "here":
                return {
                  text: `${from.name}: “I'm over here, genius” — ${place?.label ?? "somewhere"}`,
                  actions: place && (
                    <Act onClick={() => (onShow(place.id), dismiss(p.id))}>
                      Show me
                    </Act>
                  ),
                };
              case "herd":
              case "meet":
                return {
                  text:
                    p.kind === "herd"
                      ? `🐃 ${from.name} is rounding up the herd at ${place?.label ?? "the meeting point"}`
                      : `🤝 ${from.name} wants to meet ${p.to ? "you" : "everyone"} at ${place?.label ?? "a spot"}`,
                  actions: (
                    <>
                      <Act onClick={() => onReply(p, "coming")}>On my way</Act>
                      <Act ghost onClick={() => onReply(p, "cant")}>
                        Can&apos;t
                      </Act>
                      {place && !place.offMap && (
                        <Act ghost onClick={() => onShow(place.id)}>
                          Where?
                        </Act>
                      )}
                    </>
                  ),
                };
              case "coming":
                return {
                  text: `✅ ${from.name} is on the way.`,
                  actions: null,
                };
              case "cant":
                return {
                  text: `🙅 ${from.name} can't make it.`,
                  actions: null,
                };
            }
          })();
          const loud =
            opened === p.id ||
            now.getTime() - new Date(p.at).getTime() < LOUD_FOR_MS;
          if (!loud) {
            return (
              <motion.button
                key={`${p.id}-pill`}
                type="button"
                data-ping={p.kind}
                data-compact="true"
                initial={reduced ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setOpened(p.id)}
                className="pointer-events-auto ml-auto inline-flex min-h-11 max-w-full items-center gap-2 rounded-full bg-white px-4 text-[14px] font-bold text-[#070b14] shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
                style={{ boxShadow: `inset 4px 0 0 ${hueColour(from.hue)}` }}
              >
                <span aria-hidden>{from.emoji}</span>
                <span className="truncate">{text}</span>
                {more > 0 && <span className="text-black/55">+{more}</span>}
              </motion.button>
            );
          }
          return (
            <motion.div
              key={p.id}
              data-ping={p.kind}
              layout={!reduced}
              initial={reduced ? false : { opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, x: 80 }}
              className="pointer-events-auto rounded-2xl border-l-4 bg-white px-4 py-3 text-[#070b14] shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
              style={{ borderColor: hueColour(from.hue) }}
            >
              <p className="text-[15px] leading-snug font-semibold">
                <span aria-hidden className="mr-1">
                  {from.emoji}
                </span>
                {text}
              </p>
              <p className="mt-0.5 text-[12px] text-black/55">
                {agoWords(p.at, now)}
                {p.note ? ` · “${p.note}”` : ""}
                {more > 0 ? ` · ${more} more waiting` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {actions}
                <Act ghost onClick={() => dismiss(p.id)}>
                  Dismiss
                </Act>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function Act({
  children,
  onClick,
  ghost,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ghost?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 rounded-full px-3.5 text-[14px] font-bold ${
        ghost ? "bg-black/6 text-black/75" : "bg-[#00843d] text-white"
      }`}
    >
      {children}
    </button>
  );
}
