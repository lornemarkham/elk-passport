"use client";

import Image from "next/image";
import { Car, Check, Clock3, Dices, Heart, MapPin } from "lucide-react";
import type { Evening } from "@/domain/date-night/adventures/evenings";
import { clock } from "@/domain/date-night/adventures/itinerary";
import { cn } from "@/lib/utils";

/**
 * **Choose our adventure.** The adventures as big photographs you swipe
 * through — where, how long, what makes it special, one button. Once one is
 * chosen the strip goes small (the itinerary is the page now) and the chosen
 * one says so. Choosing is the owner's; anyone else suggests. What happens on
 * a tap — straight in, or a preview first when the plan has been made the
 * couple's own — is the board's to decide.
 */
export function EveningChooser({
  evenings,
  chosen,
  isOwner,
  busy,
  compact,
  timesOf,
  onChoose,
}: {
  readonly evenings: readonly Evening[];
  readonly chosen: Evening | undefined;
  readonly isOwner: boolean;
  readonly busy: string | null;
  /** A plan exists: the cards step back. */
  readonly compact: boolean;
  /** When each adventure leaves and gets you home: the chosen one as planned. */
  readonly timesOf: (e: Evening) => readonly [number, number] | undefined;
  readonly onChoose: (e: Evening) => void;
}) {
  const ordered =
    compact && chosen
      ? [chosen, ...evenings.filter((e) => e.id !== chosen.id)]
      : evenings;
  return (
    <ol
      data-testid="evenings"
      className={cn(
        "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2",
        !compact &&
          "gap-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4",
      )}
    >
      {ordered.map((e, i) => {
        const on = chosen?.id === e.id;
        const surprise = Boolean(e.composed);
        const times = timesOf(e);
        const label =
          busy === e.id
            ? "Packing the truck…"
            : on && surprise && isOwner
              ? "Surprise us again"
              : on
                ? "Our adventure"
                : !isOwner
                  ? "Suggest this one"
                  : chosen
                    ? "Choose this instead"
                    : surprise
                      ? "Surprise us"
                      : "Let's do this";
        return (
          <li
            key={e.id}
            data-testid="evening"
            data-chosen={on || undefined}
            aria-label={e.title}
            aria-current={on || undefined}
            className={cn(
              "flex shrink-0 snap-center flex-col overflow-hidden rounded-[26px] bg-[var(--n-paper)] shadow-[0_24px_60px_-30px_rgba(20,30,20,0.7)]",
              compact
                ? "w-[68vw] max-w-[280px]"
                : "w-[84vw] max-w-[360px] sm:w-auto sm:max-w-none",
              on ? "ring-[3px] ring-[var(--n-ember)]" : "ring-1 ring-black/5",
            )}
          >
            <div
              className={cn(
                "relative w-full overflow-hidden",
                compact ? "aspect-[16/9]" : "aspect-[5/4]",
              )}
            >
              <Image
                src={e.photo.src}
                alt={e.photo.alt}
                fill
                sizes={
                  compact
                    ? "280px"
                    : "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 84vw"
                }
                priority={i === 0}
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/10" />
              {e.pick && (
                <p className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--n-amber)] px-3 py-1 text-[11px] font-extrabold tracking-[0.14em] text-[var(--n-ink)] uppercase">
                  <Heart className="h-3.5 w-3.5 fill-current" aria-hidden />
                  {e.pick}
                </p>
              )}
              {on && (
                <p className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-[var(--n-ember)] px-3 py-1 text-[11px] font-extrabold tracking-wide text-white uppercase">
                  <Check className="h-3.5 w-3.5" aria-hidden /> Chosen
                </p>
              )}
              <div className="absolute inset-x-4 bottom-3 text-white">
                {!compact && (
                  <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/85">
                    {surprise ? (
                      <Dices className="h-4 w-4" aria-hidden />
                    ) : (
                      <Car className="h-4 w-4" aria-hidden />
                    )}
                    {e.drive}
                  </p>
                )}
                <h3
                  className={cn(
                    "ghad-display leading-[0.95] font-extrabold tracking-tight uppercase",
                    compact ? "text-[22px]" : "mt-1 text-[30px]",
                  )}
                >
                  {e.title}
                </h3>
              </div>
            </div>
            <div
              className={cn("flex flex-1 flex-col", compact ? "p-3" : "p-5")}
            >
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] font-semibold text-[var(--n-ink)]/70">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" aria-hidden /> {e.where}
                </span>
                {times && (
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden />
                    {clock(times[0])} – {clock(times[1])}
                  </span>
                )}
              </p>
              {!compact && (
                <>
                  <p className="mt-3 text-[16px] leading-snug text-[var(--n-ink)]">
                    {e.line}
                  </p>
                  <ul className="mt-4 flex flex-wrap gap-1.5">
                    {e.highlights.map((h) => (
                      <li
                        key={h}
                        className="rounded-full bg-[var(--n-forest)]/[0.08] px-3 py-1 text-[13px] font-semibold text-[var(--n-forest)]"
                      >
                        {h}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <button
                onClick={() => onChoose(e)}
                disabled={busy !== null || (on && (!isOwner || !surprise))}
                data-testid="choose-evening"
                className={cn(
                  "min-h-12 rounded-full px-5 text-base font-bold transition disabled:opacity-70",
                  compact ? "mt-3" : "mt-5",
                  on
                    ? "bg-[var(--n-forest)]/10 text-[var(--n-forest)]"
                    : "bg-[var(--n-ember)] text-white shadow-[0_10px_24px_-12px_rgba(194,87,26,0.9)]",
                )}
              >
                {label}
              </button>
              {!compact && (
                <p className="mt-3 text-[11px] text-[var(--n-ink)]/50">
                  Photo: {e.photo.where} ·{" "}
                  <a
                    href={e.photo.page}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {e.photo.credit}, {e.photo.license}
                  </a>
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
