import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

/**
 * **Ideas for the next one** — themes, not destinations. Each opens
 * Discovery with the sentence already said, so Atlas finds the real places
 * (ADR 005), and anything worth keeping is saved with Discovery's own heart
 * into the one Saved (ADR 010). Nothing here names a place.
 */
const THEMES: readonly (readonly [string, string, string])[] = [
  [
    "🥶",
    "Cold plunge, then hot chocolate",
    "a lake to swim in and somewhere warm for hot chocolate after",
  ],
  ["🔥", "Fire & marshmallows", "a campfire spot with a view for two"],
  [
    "🌲",
    "Snowshoes & a hot dinner",
    "snowshoeing for a couple, then dinner somewhere cozy",
  ],
  ["♨️", "Hot springs", "hot springs worth the drive"],
  ["✨", "Stargazing", "somewhere dark to look at the stars"],
  [
    "🚗",
    "A winter drive",
    "a beautiful drive with a view and a cafe on the way",
  ],
  ["🍷", "A hidden restaurant", "a romantic dinner somewhere hidden"],
  ["🏔️", "A weekend away", "a romantic weekend away, cabin or lodge"],
];

export function NextDates({ townId }: { townId: string | null }) {
  return (
    <section id="next" className="mt-4 scroll-mt-16">
      <p className="text-xs font-bold tracking-[0.2em] text-[var(--n-ember,#c2571a)] uppercase">
        Next time
      </p>
      <h2 className="ghad-display mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
        Already thinking about the next one?
      </h2>
      <p className="mt-2 max-w-xl text-[15px] text-[var(--gh-ink-soft)]">
        Tap one and Passport shows the real places Atlas knows for it. Heart
        anything good and it waits in Saved for another date.
      </p>
      <ul
        className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"
        data-testid="next-dates"
      >
        {THEMES.map(([, title, sentence]) => (
          <li key={title}>
            <Link
              href={`/discovery?${new URLSearchParams({
                ask: sentence,
                ...(townId ? { at: townId } : {}),
              }).toString()}`}
              className="group flex h-full min-h-20 flex-col justify-end rounded-3xl bg-white/80 p-4 ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <span className="mt-3 flex items-end justify-between gap-2 text-[15px] leading-tight font-bold">
                {title}
                <ArrowUpRight
                  className="h-4 w-4 shrink-0 text-[var(--n-ember,#c2571a)] opacity-60 transition group-hover:opacity-100"
                  aria-hidden
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/saved"
        className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-[var(--n-forest,#1f3a2e)] underline-offset-4 hover:underline"
      >
        Open Saved →
      </Link>
    </section>
  );
}
