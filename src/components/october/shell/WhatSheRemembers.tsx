"use client";

import { useState, useSyncExternalStore } from "react";
import {
  describe,
  forgetEverything,
  whatOctoberRemembers,
} from "@/lib/october/remembers";

/**
 * **What October remembers, said plainly, with a way to make her forget.**
 *
 * Found You and Witching Hour keep a few of a visitor's own choices so she
 * can be the same presence when they come back (`lib/october/remembers`).
 * Anything that remembers a person should be able to show them what it
 * remembers and stop, so this lists it — one sentence per recorded fact —
 * and offers to forget all of it.
 *
 * It says *this browser* every time because that is the truth: the rest of
 * My October follows an account to any device, and this does not. Nothing is
 * rendered on the server, and nothing at all for somebody she has not met.
 */
export function WhatSheRemembers() {
  // A string, so the snapshot is stable between reads.
  const remembered = useSyncExternalStore(
    () => () => {},
    () => describe(whatOctoberRemembers()).join("\n"),
    () => "",
  );
  const [forgotten, setForgotten] = useState(false);

  if (forgotten) {
    return (
      <section className="mt-16 border-t border-[#e9e6da]/10 pt-6">
        <p
          className="text-sm text-[#e9e6da]/60 italic"
          data-testid="october-forgot"
        >
          She has forgotten. As far as she knows, you have never been here.
        </p>
      </section>
    );
  }
  if (!remembered) return null;

  return (
    <section
      className="mt-16 border-t border-[#e9e6da]/10 pt-6"
      aria-labelledby="october-remembers-heading"
      data-testid="what-she-remembers"
    >
      <h2
        id="october-remembers-heading"
        className="text-[11px] font-medium tracking-[0.2em] text-[#d09a4e] uppercase"
      >
        What October remembers
      </h2>
      <p className="mt-2 text-sm text-[#e9e6da]/60">
        Only in this browser, and only what you did in front of her. It is not
        part of your account and does not follow you to another device.
      </p>
      <ul className="mt-4 space-y-1.5 text-base text-[#e9e6da]/80">
        {remembered.split("\n").map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          forgetEverything();
          setForgotten(true);
        }}
        className="mt-5 inline-flex min-h-11 items-center text-sm text-[#e9e6da]/60 underline underline-offset-4 hover:text-[#e9e6da]"
      >
        Make her forget
      </button>
    </section>
  );
}
