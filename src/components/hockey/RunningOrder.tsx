"use client";

import { relativeTime } from "@/experience-lab/core/phase";
import type { LiveExperience } from "@/experience-lab/core/engine";
import { ACTS, actOf, nextPhase } from "@/domain/hockey/acts";

/**
 * **Where you are in the night.** Before the game · During · After.
 *
 * One line under the poster. The current act is lit; the others say what
 * they are for, so somebody opening the link on a Wednesday knows there is a
 * vault at the second intermission and awards the morning after — which is
 * most of the reason anybody opens it again.
 *
 * It is a map, not navigation: the night is composed by the clock, and
 * nobody can skip to the morning after. Hidden during a period, like
 * everything else.
 */
export function RunningOrder({ live }: { live: LiveExperience }) {
  const current = actOf(live.phase.id);
  const next = nextPhase(live.definition.phases, live.phase.id);
  const nextAt = next
    ? new Date(live.anchor.getTime() + next.offsetMinutes * 60_000)
    : null;

  return (
    <nav aria-label="The night" className="mx-auto max-w-2xl px-5 pb-2">
      <ol className="grid grid-cols-3 gap-1.5">
        {ACTS.map((act) => {
          const isNow = act.id === current.id;
          return (
            <li
              key={act.id}
              aria-current={isNow ? "step" : undefined}
              className={`rounded-xl border px-2.5 py-2 ${
                isNow
                  ? "border-white/40 bg-white/[0.09]"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <p
                className={`text-[12.5px] font-semibold ${isNow ? "text-white" : "text-white/50"}`}
              >
                {act.label}
              </p>
              <p className="mt-0.5 hidden text-[11.5px] leading-snug text-white/40 sm:block">
                {isNow ? live.phase.label : act.promise}
              </p>
            </li>
          );
        })}
      </ol>
      {next && nextAt && (
        <p className="mt-2 text-[12.5px] text-white/45">
          Now: {live.phase.label}. Next: {next.label}{" "}
          {relativeTime(nextAt, live.now)}.
        </p>
      )}
    </nav>
  );
}
