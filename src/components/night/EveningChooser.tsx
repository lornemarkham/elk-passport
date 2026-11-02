"use client";

import Image from "next/image";
import { ArrowRight, Car, Clock3, Dices, Heart } from "lucide-react";
import type { Evening } from "@/domain/date-night/adventures/evenings";
import { clock } from "@/domain/date-night/adventures/itinerary";

/**
 * **Choose our adventure.** Before anything is chosen, the adventures are
 * invitations: one tall photograph each, the name, one line, when, and one
 * button — the same shape every time, swiped through on a phone. Once one
 * is chosen it is the page's star (the hero and the plan), and the others
 * wait as a short list behind **Change adventure** (`mode="change"`).
 * Choosing is the owner's; anyone else suggests. What a tap does — straight
 * in, or a preview first when the plan is already the couple's own — is the
 * board's to decide.
 */
export function EveningChooser({
  evenings,
  chosen,
  isOwner,
  busy,
  mode,
  timesOf,
  onChoose,
}: {
  readonly evenings: readonly Evening[];
  readonly chosen: Evening | undefined;
  readonly isOwner: boolean;
  readonly busy: string | null;
  /** `choose`: the invitations. `change`: the others, once one is chosen. */
  readonly mode: "choose" | "change";
  /** When each adventure leaves and gets you home: the chosen one as planned. */
  readonly timesOf: (e: Evening) => readonly [number, number] | undefined;
  readonly onChoose: (e: Evening) => void;
}) {
  const label = (e: Evening) => {
    const surprise = Boolean(e.composed);
    if (busy === e.id) return "Packing the truck…";
    if (chosen?.id === e.id) return surprise ? "Surprise us again" : "Ours";
    if (!isOwner) return "Suggest this one";
    if (chosen) return surprise ? "Surprise us instead" : "Choose this instead";
    return surprise ? "Surprise us" : "Let's do this";
  };
  const when = (e: Evening) => {
    const t = timesOf(e);
    return t ? `${clock(t[0])} – ${clock(t[1])}` : null;
  };

  if (mode === "change") {
    // The chosen one is above; only a surprise can be drawn again.
    const others = evenings.filter(
      (e) => e.id !== chosen?.id || (e.composed && isOwner),
    );
    return (
      <ul data-testid="evenings" className="grid gap-2">
        {others.map((e) => (
          <li
            key={e.id}
            data-testid="evening"
            data-chosen={chosen?.id === e.id || undefined}
            aria-label={e.title}
          >
            <button
              type="button"
              onClick={() => onChoose(e)}
              disabled={busy !== null}
              data-testid="choose-evening"
              className="flex w-full items-center gap-3 rounded-[22px] bg-[var(--n-paper)] p-2 pr-3 text-left ring-1 ring-black/5 transition hover:ring-[var(--n-ember)]/40 disabled:opacity-60"
            >
              <span className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl">
                <Image
                  src={e.photo.src}
                  alt=""
                  fill
                  sizes="72px"
                  className="object-cover"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[15.5px] leading-tight font-extrabold">
                  {e.title}
                  {e.pick && (
                    <span className="shrink-0 rounded-full bg-[var(--n-amber)]/25 px-2 py-0.5 text-[10.5px] font-extrabold tracking-wide whitespace-nowrap text-[var(--n-ember)] uppercase">
                      {e.pick}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-[var(--n-ink)]/65">
                  {e.teaser}
                </span>
                <span className="mt-1 block text-[12.5px] font-extrabold text-[var(--n-ember)]">
                  {label(e)}
                  {when(e) && (
                    <span className="ml-2 font-semibold text-[var(--n-ink)]/45 tabular-nums">
                      {when(e)}
                    </span>
                  )}
                </span>
              </span>
              <ArrowRight
                className="h-5 w-5 shrink-0 text-[var(--n-ember)]"
                aria-hidden
              />
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ol
      data-testid="evenings"
      className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0"
    >
      {evenings.map((e, i) => {
        const surprise = Boolean(e.composed);
        const times = when(e);
        return (
          <li
            key={e.id}
            data-testid="evening"
            aria-label={e.title}
            className="w-[82vw] max-w-[380px] shrink-0 snap-center sm:w-auto sm:max-w-none"
          >
            <article className="group relative isolate flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-[30px] bg-[var(--n-ink)] text-white shadow-[0_30px_60px_-30px_rgba(20,30,20,0.85)] sm:aspect-[5/4]">
              <Image
                src={e.photo.src}
                alt={e.photo.alt}
                fill
                sizes="(min-width: 640px) 50vw, 82vw"
                priority={i === 0}
                className="-z-10 object-cover transition duration-700 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(0,0,0,0.25)_0%,rgba(0,0,0,0)_28%,rgba(0,0,0,0.35)_52%,rgba(16,16,12,0.94)_100%)]" />
              {e.pick && (
                <p className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--n-amber)] px-3 py-1 text-[11px] font-extrabold tracking-[0.14em] text-[var(--n-ink)] uppercase">
                  <Heart className="h-3.5 w-3.5 fill-current" aria-hidden />
                  {e.pick}
                </p>
              )}
              <div className="p-5">
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] font-bold tracking-wide text-white/80">
                  <span className="inline-flex items-center gap-1.5">
                    {surprise ? (
                      <Dices className="h-4 w-4" aria-hidden />
                    ) : (
                      <Car className="h-4 w-4" aria-hidden />
                    )}
                    {e.drive}
                  </span>
                  {times && (
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      <Clock3 className="h-4 w-4" aria-hidden />
                      {times}
                    </span>
                  )}
                </p>
                <h3 className="ghad-display mt-2 text-[clamp(1.9rem,8vw,2.4rem)] leading-[0.92] font-extrabold tracking-tight uppercase sm:text-[2.6rem]">
                  {e.title}
                </h3>
                <p className="mt-2 font-[family-name:var(--font-fraunces)] text-[17px] leading-snug text-white/90 italic">
                  {e.teaser}
                </p>
                <button
                  onClick={() => onChoose(e)}
                  disabled={busy !== null}
                  data-testid="choose-evening"
                  className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--n-amber)] px-5 text-base font-extrabold text-[var(--n-ink)] shadow-[0_12px_28px_-12px_rgba(232,163,61,0.9)] transition active:scale-[0.98] disabled:opacity-70"
                >
                  {label(e)}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </article>
            <p className="mt-2 px-2 text-[10.5px] text-[var(--n-ink)]/45">
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
          </li>
        );
      })}
    </ol>
  );
}
