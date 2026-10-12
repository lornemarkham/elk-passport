"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * One screen, one button — and, the first time, one name.
 *
 * Signed out: a sign-in that comes straight back here (`?next=`). Signed in:
 * "what should the group call you?", pre-filled with whatever Passport already
 * calls you, because a coworker whose name shows up as `lorne.markham` on the
 * roster is a coworker who looks like a bug.
 */
export function JoinNight({
  token,
  valid,
  signedIn,
  displayName,
}: {
  token: string;
  valid: boolean;
  signedIn: boolean;
  displayName: string | null;
}) {
  const [name, setName] = useState(displayName ?? "");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const back = `/auth?next=${encodeURIComponent(`/hockey/join/${token}`)}`;

  async function join() {
    setJoining(true);
    setError(null);
    try {
      const res = await fetch("/hockey/api/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, name: name.trim() || undefined }),
      });
      if (res.status === 401) {
        window.location.href = back;
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "That link didn't work.");
        return;
      }
      window.location.href = `/hockey/${body.id}`;
    } finally {
      setJoining(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[oklch(0.14_0.015_260)] px-6 text-white">
      <div className="w-full max-w-sm text-center">
        <p className="text-[44px]" aria-hidden>
          🏒
        </p>
        {!valid ? (
          <>
            <h1 className="mt-3 font-serif text-[28px] leading-tight">
              This link has done its job.
            </h1>
            <p className="mt-3 text-[15px] text-white/60">
              Each invitation lets in one person, once. It&apos;s been used,
              revoked, or the night is over. Ask whoever sent it for a fresh
              one.
            </p>
            {signedIn && (
              <Link
                href="/hockey"
                className="mt-6 inline-block text-[14px] text-white/70 underline"
              >
                Your nights
              </Link>
            )}
          </>
        ) : !signedIn ? (
          <>
            <h1 className="mt-3 font-serif text-[28px] leading-tight">
              Somebody wants you there.
            </h1>
            <p className="mt-3 text-[15px] text-white/60">
              You&apos;ve been invited to something private on Passport. Sign in
              — or make an account, it takes a minute — and you&apos;ll see what
              you&apos;re in for.
            </p>
            <a
              href={back}
              className="mt-6 inline-block w-full rounded-full bg-white py-3 text-[15px] font-semibold text-black"
            >
              Sign in to see it
            </a>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void join();
            }}
          >
            <h1 className="mt-3 font-serif text-[28px] leading-tight">
              You&apos;re in. Almost.
            </h1>
            <p className="mt-3 text-[15px] text-white/60">
              What should everyone call you? Pick carefully. It goes on the
              leaderboard.
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              aria-label="Your name"
              className="mt-5 w-full rounded-full border border-white/20 bg-black/20 px-4 py-3 text-center text-[16px] text-white focus:border-white/50 focus:outline-none"
            />
            <button
              type="submit"
              disabled={joining}
              className="mt-3 w-full rounded-full bg-white py-3 text-[15px] font-semibold text-black disabled:opacity-50"
            >
              {joining ? "Getting you in…" : "I'm in"}
            </button>
            {error && (
              <p role="alert" className="mt-3 text-[14px] text-white/75">
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
