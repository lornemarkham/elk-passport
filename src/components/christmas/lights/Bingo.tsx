"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Printer, Shuffle, Share2 } from "lucide-react";
import { card, FREE, lines } from "@/domain/christmas/lights/bingo";

/**
 * **Christmas Lights Bingo.** Tap a square when someone spots it. The card
 * lives on this phone; sharing sends the same card, not the marks. Print it
 * for the back seat.
 */
export function Bingo({ seed: given }: { readonly seed: number }) {
  const [seed, setSeed] = useState(given);
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [say, setSay] = useState<string | null>(null);

  useEffect(() => {
    const load = () => {
      try {
        const v: unknown = JSON.parse(
          localStorage.getItem(`passport.christmas.bingo.${seed}`) ?? "[]",
        );
        setMarked(
          new Set(
            Array.isArray(v)
              ? v.filter((n): n is number => typeof n === "number")
              : [],
          ),
        );
      } catch {
        setMarked(new Set());
      }
    };
    load();
  }, [seed]);

  const squares = card(seed);
  const done = lines(marked);
  const toggle = (i: number) => {
    if (i === 12) return;
    const next = new Set(marked);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setMarked(next);
    try {
      localStorage.setItem(
        `passport.christmas.bingo.${seed}`,
        JSON.stringify([...next]),
      );
    } catch {
      /* not kept */
    }
  };
  const inLine = new Set(done.flat());

  async function share() {
    const url = `${location.origin}/christmas/lights/bingo?card=${seed}`;
    try {
      if (navigator.share)
        await navigator.share({
          title: "Christmas Lights Bingo",
          text: "Same card — first to a line wins!",
          url,
        });
      else {
        await navigator.clipboard.writeText(url);
        setSay("Link copied — everyone who opens it gets this same card.");
      }
    } catch {
      setSay(url);
    }
  }

  return (
    <div data-testid="bingo">
      <div className="print:hidden">
        <Link
          href="/christmas/lights"
          className="text-sm font-bold tracking-[0.18em] text-[#ffd98a] uppercase hover:underline"
        >
          ← The lights map
        </Link>
        <h1 className="ghad-display mt-3 text-5xl leading-[0.95] font-extrabold text-white">
          Christmas Lights Bingo
        </h1>
        <p className="mt-2 text-lg text-white/90">
          Spot it from the street, tap the square. Five in a row wins the last
          candy cane.
        </p>
      </div>
      <h1 className="ghad-display hidden text-3xl font-extrabold print:block">
        Christmas Lights Bingo
      </h1>
      {done.length > 0 && (
        <p
          className="mt-4 rounded-2xl bg-[#ffd98a] p-3 text-center text-xl font-extrabold text-[#082319] print:hidden"
          role="status"
          data-testid="bingo-win"
        >
          🎉 BINGO!{" "}
          {done.length > 1 ? `${done.length} lines!` : "That's a line!"}
        </p>
      )}
      <div
        className="mt-5 grid grid-cols-5 gap-1.5 sm:gap-2"
        aria-label="Bingo card"
      >
        {squares.map((s, i) => {
          const on = i === 12 || marked.has(i);
          return (
            <button
              key={`${seed}-${i}`}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(i)}
              data-testid="bingo-square"
              className={`flex aspect-square items-center justify-center rounded-xl p-1 text-center text-[11px] leading-tight font-bold sm:text-sm print:border print:border-black print:bg-white print:text-black ${
                on
                  ? inLine.has(i)
                    ? "bg-[#ffd98a] text-[#082319] shadow-[0_0_14px_rgba(255,217,138,.8)]"
                    : "bg-[#b3242f] text-white"
                  : "bg-white text-[#082319]"
              }`}
            >
              {s === FREE ? "☕ Hot chocolate! (free)" : s}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-white/75 print:text-black">
        No photos needed — just eyes. Please don&apos;t photograph people or
        peer into homes.
      </p>
      <div className="mt-5 flex flex-wrap gap-2 print:hidden">
        <button
          type="button"
          onClick={() => void share()}
          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#ffd98a] px-5 font-extrabold text-[#082319]"
          data-testid="bingo-share"
        >
          <Share2 className="h-5 w-5" aria-hidden /> Share this card
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 font-bold text-[#082319]"
        >
          <Printer className="h-5 w-5" aria-hidden /> Print
        </button>
        <button
          type="button"
          onClick={() => {
            setMarked(new Set());
            setSeed(1 + Math.floor(Math.random() * 2_000_000_000));
          }}
          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white/15 px-5 font-bold text-white"
        >
          <Shuffle className="h-5 w-5" aria-hidden /> New card
        </button>
      </div>
      {say && (
        <p className="mt-2 text-sm text-white" role="status">
          {say}
        </p>
      )}
    </div>
  );
}
