import Link from "next/link";
import type { Party } from "@/domain/christmas/discover";
import type { Place } from "@/domain/christmas/itinerary";
import { momentsFor } from "@/domain/christmas/moments";
import type { Need } from "@/domain/christmas/request";

/** The optional extras that suit this evening (`momentsFor`). */
export function Moments({
  party,
  romantic,
  needs,
  displays,
}: {
  readonly party: Party | null;
  readonly romantic: boolean;
  readonly needs: readonly Need[];
  readonly displays: readonly Place[];
}) {
  const m = momentsFor({ party, romantic, needs });
  if (m.items.length === 0) return null;
  const rate = displays.find((d) => d.source === "map");
  return (
    <section
      className="mt-6 rounded-[24px] bg-[#0f3b2b] p-5 text-white"
      data-testid="moments"
      data-kind={m.kind}
    >
      <p className="text-xs font-bold tracking-[0.16em] text-[#ffd98a] uppercase">
        Optional
      </p>
      <h2 className="ghad-display mt-1 text-2xl font-extrabold">{m.title}</h2>
      <p className="mt-1 text-sm text-white/80">{m.line}</p>
      <ul className="mt-3 space-y-2">
        {m.items.map((i) => (
          <li
            key={i.title}
            className="flex gap-3 rounded-2xl bg-white/10 p-3"
            data-testid="moment"
          >
            <span className="text-xl" aria-hidden>
              {i.emoji}
            </span>
            <span>
              <span className="block font-bold">
                {i.href ? (
                  <Link href={i.href} className="underline underline-offset-4">
                    {i.title}
                  </Link>
                ) : i.title === "Rate the displays" && rate ? (
                  <Link
                    href={rate.href}
                    className="underline underline-offset-4"
                  >
                    {i.title}
                  </Link>
                ) : (
                  i.title
                )}
              </span>
              <span className="text-sm text-white/80">{i.line}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
