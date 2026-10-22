import Link from "next/link";
import { Avatar } from "@/experience-lab/ui/atoms";
import { editionLabel } from "@/domain/hockey/edition";
import type { Cup, CupResult } from "@/domain/hockey/series";

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Vancouver",
  });

function outcome(result: CupResult): string {
  if (result.status === "upcoming") return "Still to play";
  if (result.status === "no-result") return "Nobody called the results";
  const names = result.champions.map((c) => c.name).join(" & ");
  return `${names}${result.unofficial ? " (some results never called)" : ""}`;
}

/**
 * **The Sycle Cup — worth nothing, contested bitterly, and it persists.**
 *
 * The one trophy that outlives a night. Not a running points table: the lab
 * tested carrying points over and wrote down why it does not ("a defending
 * champion is funny, a head start is not"), so each night's leaderboard
 * still starts at zero, and what accumulates is _who has held the Cup_.
 *
 * Read from nights this person was at, and nothing else. Two people on the
 * same run who went to different nights will see different rolls, and that
 * is the privacy model working, not a bug.
 */
export function CupRoll({ cup, currentId }: { cup: Cup; currentId?: string }) {
  const holder = cup.holding;
  return (
    <div className="rounded-2xl border border-amber-200/20 bg-[linear-gradient(160deg,oklch(0.32_0.06_80/0.35),transparent_60%)] p-4">
      <p className="text-[12px] tracking-wide text-amber-100/60 uppercase">
        🏆 The Sycle Cup
      </p>
      <p className="mt-1.5 text-[17px] leading-snug font-semibold text-white">
        {holder.length === 0
          ? "Nobody has won it yet. Somebody has to."
          : holder.length === 1
            ? `${holder[0].emoji} ${holder[0].name} holds it, and will tell you.`
            : `${holder.map((h) => h.name).join(" and ")} share it, which satisfies nobody.`}
      </p>

      {cup.holders.length > 0 && (
        <ul
          aria-label="Titles"
          className="mt-3 flex flex-col gap-1.5 border-t border-white/10 pt-3"
        >
          {cup.holders.map((h) => (
            <li
              key={h.participant.id}
              className="flex items-center justify-between gap-3 text-[14px]"
            >
              <span className="flex items-center gap-2">
                <Avatar person={h.participant} size={22} />
                {h.participant.name}
              </span>
              <span className="text-white/60">
                {"🏆".repeat(Math.min(h.titles, 5))}
                {h.titles > 5 ? ` ×${h.titles}` : ""}
                <span className="ml-2 text-[12.5px] text-white/40">
                  {h.played} {h.played === 1 ? "night" : "nights"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <ol
        aria-label="Every night"
        className="mt-3 flex flex-col gap-1 border-t border-white/10 pt-3"
      >
        {cup.nights.map((n) => (
          <li key={n.id} className="text-[13px]">
            <Link
              href={`/hockey/${n.id}`}
              aria-current={n.id === currentId ? "page" : undefined}
              className="flex min-h-9 items-baseline justify-between gap-3 text-white/55 hover:text-white aria-[current=page]:text-white"
            >
              <span>
                {editionLabel(n.edition)} · {n.opponent} · {day(n.startsAt)}
              </span>
              <span className="text-right text-white/70">{outcome(n)}</span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[12px] text-white/55">
        Points reset every night. The Cup does not. You only see nights you were
        at.
      </p>
    </div>
  );
}
