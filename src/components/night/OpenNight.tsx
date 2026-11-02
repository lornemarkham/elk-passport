"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Photo } from "@/domain/date-night/adventures/evenings";
import styles from "./night.module.css";

/**
 * **The front door.** A landscape, the title, when, and one button. It says
 * nothing about who or where: the adventure is made for you when you press
 * it (signed in), and is yours alone until you invite somebody.
 */
export function OpenNight({
  slug,
  title,
  lines,
  when,
  signedIn,
  backdrop,
}: {
  slug: string;
  title: string;
  /** "Tomorrow, we disappear for a little while." and the like. */
  lines: readonly string[];
  /** "Monday, November 2", "Around 5 PM". */
  when: readonly string[];
  signedIn: boolean;
  /** A landscape to open on. Never anything about whose night it is. */
  backdrop: Photo;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const here = `/auth?next=${encodeURIComponent(`/${slug}`)}`;

  async function open() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/night/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (response.status === 401) {
        window.location.href = here;
        return;
      }
      if (!response.ok) throw new Error(String(response.status));
      const { id } = await response.json();
      window.location.href = `/night/${id}`;
    } catch {
      setError("Couldn't start just now. Please try again.");
      setBusy(false);
    }
  }

  const button =
    "group mt-9 inline-flex min-h-14 items-center gap-3 self-start rounded-full bg-[var(--n-amber)] pr-3 pl-7 text-lg font-extrabold text-[var(--n-ink)] shadow-[0_18px_40px_-14px_rgba(232,163,61,0.8)] transition active:scale-[0.98] disabled:opacity-60 sm:self-center";
  const arrow = (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--n-ink)] text-[var(--n-amber)] transition group-hover:translate-x-0.5">
      <ArrowRight className="h-5 w-5" aria-hidden />
    </span>
  );

  return (
    <main
      className={`relative isolate flex min-h-[100svh] flex-col justify-end overflow-hidden px-6 pt-24 pb-12 text-white sm:items-center sm:text-center ${styles.night} bg-[var(--n-ink)]`}
    >
      <div className="absolute inset-0 -z-10" aria-hidden>
        <Image
          src={backdrop.src}
          alt=""
          fill
          priority
          sizes="100vw"
          className={`object-cover ${styles.drift}`}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,20,16,0.55)_0%,rgba(20,20,16,0.1)_30%,rgba(20,20,16,0.55)_60%,rgba(20,20,16,0.95)_100%)]" />
      </div>
      <p
        className={`text-xs font-extrabold tracking-[0.28em] text-[var(--n-amber)] uppercase ${styles.rise}`}
      >
        An adventure for two
      </p>
      <h1
        className={`ghad-display mt-3 max-w-3xl text-[56px] leading-[0.86] font-extrabold tracking-tight text-balance uppercase sm:text-8xl ${styles.rise}`}
      >
        {title}
      </h1>
      <div className={`mt-6 max-w-md space-y-1 ${styles.rise}`}>
        {lines.map((line, i) => (
          <p
            key={line}
            className={
              i === 0
                ? "font-[family-name:var(--font-fraunces)] text-[22px] leading-snug italic"
                : "text-[17px] text-white/80"
            }
          >
            {line}
          </p>
        ))}
      </div>
      <p
        className={`mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] font-bold tracking-wide uppercase sm:justify-center ${styles.rise}`}
        data-testid="when"
      >
        {when.map((w, i) => (
          <span key={w} className="inline-flex items-center gap-3">
            {i > 0 && (
              <span className="h-1 w-1 rounded-full bg-[var(--n-amber)]" />
            )}
            {w}
          </span>
        ))}
      </p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-100">
          {error}
        </p>
      )}
      {signedIn ? (
        <button onClick={open} disabled={busy} className={button}>
          {busy ? "Packing the truck…" : "Let's find some trouble"}
          {arrow}
        </button>
      ) : (
        <Link href={here} className={button}>
          Let&apos;s find some trouble
          {arrow}
        </Link>
      )}
      <p className="mt-5 max-w-xs text-xs text-white/55">
        Private. Only the people you invite can see it.
        {!signedIn && " You'll sign in first."}
      </p>
      <p className="mt-6 text-[10px] text-white/40">
        Photo: {backdrop.where} · {backdrop.credit}, {backdrop.license}
      </p>
    </main>
  );
}
