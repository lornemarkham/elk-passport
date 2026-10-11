"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { challengeById, phonePlaceById, stakeSentence } from "@/lib/detox/pact";
import { useOffline } from "@/lib/detox/store";

/**
 * **The last screen before the phone goes away.**
 *
 * Deliberately almost empty: no nav, no feed, nothing to scroll. It says the
 * pact once, says what time the phones went away so nobody has to remember,
 * and offers exactly one thing to press — on the way back in.
 *
 * There is no live timer. A ticking clock is a reason to look at a screen,
 * and the only person who should be counting is whoever owes the ice cream.
 */
export function PocketScreen() {
  const { current } = useOffline();
  const pact = current?.pact;
  const place = phonePlaceById(pact?.phone);
  const since = current?.leftAt
    ? new Intl.DateTimeFormat("en-CA", {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(current.leftAt))
    : undefined;

  return (
    <div className="mx-auto flex min-h-[100svh] max-w-[46rem] flex-col px-6 py-10 sm:py-16">
      <p
        className="text-[11px] font-semibold tracking-[0.12em] uppercase"
        style={{ color: "var(--ghad-accent)" }}
      >
        Go offline
      </p>
      <h1 className="ghad-display mt-3 text-[56px] leading-[0.88] font-extrabold tracking-[-0.055em] text-[#111] sm:text-[96px]">
        Put me
        <br />
        away.
      </h1>
      <p
        data-testid="offline-since"
        className="mt-6 text-[17px] leading-relaxed text-black/65"
      >
        {since ? `Phones away since ${since}. ` : ""}
        {place
          ? `${place.label}. ${place.line}`
          : "Have a hell of a day. We'll be here after."}
      </p>

      {pact && pact.challenges.length > 0 && (
        <section className="mt-10 border-t-2 border-black/80 pt-5">
          <h2 className="text-[11px] font-semibold tracking-[0.12em] text-black/45 uppercase">
            The pact — read it once
          </h2>
          <p className="mt-3 text-[16px] font-semibold text-[#111]">
            {stakeSentence(pact.stake)}
          </p>
          <ol className="mt-3 flex flex-col gap-2">
            {pact.challenges.map((id, index) => (
              <li
                key={id}
                data-testid="offline-pocket-card"
                className="flex gap-3 text-[16px] leading-relaxed text-black/75"
              >
                <span
                  className="ghad-display font-extrabold tabular-nums"
                  style={{ color: "var(--ghad-accent)" }}
                >
                  {index + 1}
                </span>
                {challengeById(id)?.line}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-[14px] text-black/45">
            Short on memory? Write them on the back of your printed guide.
          </p>
        </section>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-3 pt-14">
        <Link
          href="/detox/back"
          data-testid="offline-back"
          className="inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-[15px] font-semibold text-[#111] ring-1 ring-black/20 ring-inset hover:ring-black/50"
        >
          We&apos;re back
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <span className="text-[13px] text-black/40">
          That&apos;s the only button. Go on.
        </span>
      </div>
    </div>
  );
}
