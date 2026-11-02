"use client";

import { useState } from "react";
import Link from "next/link";
import { Picture } from "@/components/adventures/Picture";
import type { Experience } from "@/domain/experience/types";
import styles from "./night.module.css";

/** Press once: your own copy of the night is opened, or made. */
export function OpenNight({
  slug,
  title,
  tagline,
  signedIn,
  backdrop,
}: {
  slug: string;
  title: string;
  tagline: string;
  signedIn: boolean;
  /** A landscape to open on. Never anything about whose night it is. */
  backdrop?: Experience;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        window.location.href = `/auth?next=${encodeURIComponent(`/${slug}`)}`;
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

  return (
    <main className="relative isolate flex min-h-[88svh] flex-col justify-end overflow-hidden bg-[#12060b] px-6 pt-24 pb-14 text-white sm:items-center sm:text-center">
      <div className="absolute inset-0 -z-10" aria-hidden>
        <Picture
          experience={backdrop}
          fallbackTitle=""
          tone="#3b0f1f"
          priority
          showLabel={false}
          className={`h-full w-full ${styles.drift}`}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,6,11,0.5)_0%,rgba(18,6,11,0.2)_40%,rgba(18,6,11,0.92)_85%)]" />
      </div>
      <p
        className={`text-xs font-bold tracking-[0.24em] text-white/75 uppercase ${styles.rise}`}
      >
        Date night · by Passport
      </p>
      <h1
        className={`ghad-display mt-3 max-w-2xl text-5xl leading-[0.95] font-extrabold tracking-tight text-balance sm:text-7xl ${styles.rise}`}
      >
        {title}
      </h1>
      <p className={`mt-4 max-w-md text-lg text-white/85 ${styles.rise}`}>
        {tagline}
      </p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-100">
          {error}
        </p>
      )}
      {signedIn ? (
        <button
          onClick={open}
          disabled={busy}
          className="mt-8 min-h-12 self-start rounded-full bg-white px-7 text-base font-bold text-[#3b0f1f] shadow-lg disabled:opacity-60 sm:self-center"
        >
          {busy ? "Packing the car…" : "Open our adventure"}
        </button>
      ) : (
        <Link
          href={`/auth?next=${encodeURIComponent(`/${slug}`)}`}
          className="mt-8 inline-flex min-h-12 items-center self-start rounded-full bg-white px-7 text-base font-bold text-[#3b0f1f] shadow-lg sm:self-center"
        >
          Sign in to begin
        </Link>
      )}
      <p className="mt-6 max-w-xs text-xs text-white/65">
        Private. Only the people you invite can see it.
      </p>
    </main>
  );
}
