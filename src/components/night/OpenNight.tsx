"use client";

import { useState } from "react";
import Link from "next/link";

/** Press once: your own copy of the night is opened, or made. */
export function OpenNight({
  slug,
  title,
  tagline,
  signedIn,
}: {
  slug: string;
  title: string;
  tagline: string;
  signedIn: boolean;
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
    <main className="flex min-h-[80vh] flex-col items-center justify-center bg-gradient-to-b from-[#3b0f1f] via-[#7a2a2a] to-[#e9a15b] px-6 py-16 text-center text-white">
      <p className="text-5xl" aria-hidden>
        🧭❤️
      </p>
      <h1 className="mt-4 max-w-md text-4xl leading-tight font-extrabold text-balance">
        {title}
      </h1>
      <p className="mt-3 max-w-sm text-lg text-white/85">{tagline}</p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-100">
          {error}
        </p>
      )}
      {signedIn ? (
        <button
          onClick={open}
          disabled={busy}
          className="mt-8 min-h-12 rounded-full bg-white px-7 text-base font-bold text-[#7a2a2a] shadow-lg disabled:opacity-60"
        >
          {busy ? "Packing the car…" : "Open our adventure"}
        </button>
      ) : (
        <Link
          href={`/auth?next=${encodeURIComponent(`/${slug}`)}`}
          className="mt-8 inline-flex min-h-12 items-center rounded-full bg-white px-7 text-base font-bold text-[#7a2a2a] shadow-lg"
        >
          Sign in to begin
        </Link>
      )}
      <p className="mt-6 max-w-xs text-xs text-white/70">
        Private. Only the people you invite can see it.
      </p>
    </main>
  );
}
