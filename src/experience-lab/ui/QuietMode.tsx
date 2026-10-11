"use client";

import { Avatar, personColor } from "./atoms";
import type { LiveExperience } from "../core/engine";

/**
 * **What Passport looks like while the thing it is about is happening.**
 *
 * The design principle this exists to obey: *the real experience is the star,
 * and Passport must not compete with it.* During play there is nothing to
 * answer, nothing to scroll, and nothing that rewards looking — the page is a
 * score, your position, and an explicit promise that it will come back.
 *
 * It is the only screen in the lab designed to be closed. That felt wrong to
 * build and immediately right to use, and it is the strongest argument in
 * here that attention should be a first-class property of a phase rather than
 * something a designer remembers.
 */
export function QuietMode({ live }: { live: LiveExperience }) {
  const latest = live.moments.find((m) => m.kind === "result");
  const mine = live.standings.find((row) => row.participant.id === live.me?.id);

  return (
    <div className="mx-auto max-w-2xl px-5 pt-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-8 text-center">
        {latest ? (
          <>
            <p className="text-3xl">{latest.emoji}</p>
            <p className="font-heading mt-2 text-2xl font-bold text-white">
              {latest.text}
            </p>
          </>
        ) : (
          <p className="font-heading text-2xl font-bold text-white">
            It&apos;s happening.
          </p>
        )}

        {mine && live.isCompetitive && (
          <p className="mt-4 flex items-center justify-center gap-2 text-[14px] text-white/60">
            <Avatar person={mine.participant} size={22} />
            You&apos;re
            <span
              className="font-semibold"
              style={{ color: personColor(mine.participant.hue) }}
            >
              {ordinal(mine.rank)}
            </span>
            of {live.standings.length}
          </p>
        )}

        <p className="mt-6 text-[13.5px] leading-relaxed text-white/40">
          Nothing to do right now. Passport will have something at the next
          break.
        </p>
      </div>

      <p className="mt-3 text-center text-[12px] text-white/25">
        Put your phone away.
      </p>
    </div>
  );
}

function ordinal(n: number): string {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}
