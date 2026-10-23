"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Avatar } from "@/experience-lab/ui/atoms";
import type { Participant } from "@/experience-lab/core/types";
import { FanTag, useFan } from "./FanTag";
import styles from "./hockey.module.css";

/**
 * **🔥 Chirp Someone.** Pick a person; Chirp Bot writes three chirps about
 * their team; pick one and it lands in *your* message box, editable, unsent.
 * Nothing is ever posted on anybody's behalf — the person still presses
 * send, or doesn't.
 */
export function ChirpSomeone({
  slug,
  people,
  onChoose,
  onClose,
}: {
  slug: string;
  people: readonly Participant[];
  onChoose: (text: string) => void;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<Participant | null>(null);
  const [chirps, setChirps] = useState<string[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const asked = useRef(0);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  /** Ask for three about `person`. Only the latest answer counts. */
  const ask = async (person: Participant) => {
    const mine = ++asked.current;
    setTarget(person);
    setChirps(null);
    setProblem(null);
    try {
      const res = await fetch(`/hockey/api/occasions/${slug}/chirps`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetId: person.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (mine !== asked.current) return;
      if (!res.ok) setProblem(body.error ?? "Chirp Bot choked. Try again.");
      else setChirps(body.chirps as string[]);
    } catch {
      if (mine === asked.current)
        setProblem("Couldn't reach Chirp Bot. Try again.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="chirp-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88dvh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-t-3xl bg-[#0b1220] px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white ring-1 ring-white/15 sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="chirp-title"
              className={`${styles.wide} text-[28px] leading-none`}
            >
              🔥 Chirp Someone
            </h2>
            <p className="mt-2 text-[14.5px] text-white/70">
              {target
                ? `Three for ${target.name}. Pick one — it goes in your box, and you still press send.`
                : "Who's getting it? Chirp Bot goes after their team, not them."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/70 ring-1 ring-white/15"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!target && (
          <ul className="flex flex-col gap-2" aria-label="Chirp who?">
            {people.map((p) => (
              <li key={p.id}>
                <Target person={p} onPick={() => void ask(p)} />
              </li>
            ))}
          </ul>
        )}

        {target && (
          <>
            {!chirps && !problem && (
              <p className="text-[15px] text-white/70" role="status">
                Chirp Bot is consulting the archives…
              </p>
            )}
            {problem && (
              <p className="text-[15px] text-[#ffb59f]" role="alert">
                {problem}
              </p>
            )}
            {chirps && (
              <ul className="flex flex-col gap-2" aria-label="Pick a chirp">
                {chirps.map((text) => (
                  <li key={text}>
                    <button
                      type="button"
                      onClick={() => onChoose(text)}
                      className="w-full rounded-2xl bg-white/[0.07] px-4 py-3 text-left text-[16px] leading-snug text-white ring-1 ring-white/15 transition hover:ring-[#ff5a36]/60 active:scale-[0.99]"
                    >
                      {text}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  asked.current += 1;
                  setTarget(null);
                }}
                className="min-h-11 text-[14px] text-white/65"
              >
                ← Someone else
              </button>
              <button
                type="button"
                onClick={() => void ask(target)}
                disabled={!chirps && !problem}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold text-white ring-1 ring-white/20 disabled:opacity-40"
              >
                <RefreshCw className="h-4 w-4" /> Three more
              </button>
            </div>
            <p className="text-[12.5px] text-white/45">
              Satire. Chirp Bot roasts teams, never people. If it crosses a
              line, don&apos;t send it.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Target({
  person,
  onPick,
}: {
  person: Participant;
  onPick: () => void;
}) {
  const team = useFan(person.id);
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-[#101826] px-3 py-2 text-left ring-1 ring-white/10 transition active:scale-[0.99]"
    >
      <Avatar person={person} size={36} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-bold">
          {person.name}
        </span>
        <span className="block text-[13px] text-white/55">
          {team ? `${team.city} ${team.name} fan` : "No team. Easy target."}
        </span>
      </span>
      <FanTag personId={person.id} />
    </button>
  );
}
