import Link from "next/link";

/**
 * **The way into Arena Mode from the night's Plan tab.** One fixed-height
 * card, rendered with the page (nothing loads late, so nothing below it
 * jumps), only for nights at Rogers Arena — the one building Passport has a
 * map of.
 */
export function ArenaDoor({ slug }: { slug: string }) {
  return (
    <Link
      href={`/hockey/${slug}/arena`}
      data-testid="arena-door"
      className="group relative flex min-h-[104px] items-center gap-4 overflow-hidden rounded-[28px] bg-gradient-to-br from-[#00205b] to-[#00843d] p-4 text-white shadow-[0_20px_50px_-24px_#00843d]"
    >
      <svg
        viewBox="0 0 80 56"
        aria-hidden
        className="h-16 w-20 shrink-0 transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
      >
        <ellipse cx="40" cy="28" rx="38" ry="26" fill="#0e172b" opacity="0.6" />
        <ellipse cx="40" cy="28" rx="30" ry="19" fill="#46536b" />
        <rect x="20" y="17" width="40" height="22" rx="10" fill="#f4f8fc" />
        <line
          x1="40"
          x2="40"
          y1="17"
          y2="39"
          stroke="#e03a3e"
          strokeWidth="1.5"
        />
        <circle cx="14" cy="16" r="5" fill="#ffd84d" />
        <circle cx="64" cy="40" r="5" fill="#7dffb0" />
        <circle cx="66" cy="14" r="5" fill="#f472b6" />
      </svg>
      <span className="min-w-0">
        <span className="block text-[20px] leading-tight font-extrabold">
          Arena Mode
        </span>
        <span className="block text-[14px] leading-snug text-white/85">
          Find the herd, the beer and the washrooms. Check in, start a side
          quest.
        </span>
      </span>
    </Link>
  );
}

export const isRogersArena = (where: string | undefined) =>
  !where || /rogers arena/i.test(where);
