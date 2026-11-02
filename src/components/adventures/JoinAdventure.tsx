"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Compass, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * **The other end of an invitation link.**
 *
 * What the link may say is decided by the database: whether it still works,
 * and what kind of adventure it is for. Not the name, not who started it, not
 * who's in — a forwarded link must not leak the group. Signing in is asked
 * for at the moment of joining, and comes straight back here.
 */
export function JoinAdventure({
  token,
  state,
  kindLabel,
  signedIn,
  invitation = null,
  backdrop = null,
  next = null,
}: {
  token: string;
  state: "valid" | "revoked" | "expired" | "used-up" | "unknown";
  kindLabel: string | null;
  signedIn: boolean;
  /** A kind's own words for the invitation, in place of the generic ones. */
  invitation?: readonly string[] | null;
  /** A kind's own photograph to open on (a public, licensed landscape). */
  backdrop?: { readonly src: string; readonly credit: string } | null;
  /**
   * Where to land once joined: the thing the link was texted about (a Date
   * Night play, `/night/<id>?p=<item>`). Checked by the page.
   */
  next?: string | null;
}) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const here = `/adventures/join/${token}${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  async function join() {
    setJoining(true);
    setError(null);
    try {
      const response = await fetch("/api/adventures/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (response.status === 401) {
        window.location.href = `/auth?next=${encodeURIComponent(here)}`;
        return;
      }
      if (!response.ok) {
        setError("This link is no longer good. Ask for a new one.");
        return;
      }
      const { id } = await response.json();
      // Only somewhere inside the adventure just joined.
      const inside =
        next &&
        (next === `/night/${encodeURIComponent(id)}` ||
          next.startsWith(`/night/${encodeURIComponent(id)}?`));
      router.replace(inside ? next : `/adventures/${id}`);
      router.refresh();
    } catch {
      setError("Couldn't join just now. Please try again.");
    } finally {
      setJoining(false);
    }
  }

  const dead = state !== "valid";
  const deadReason =
    state === "used-up"
      ? "Somebody already used this link — it was for one person."
      : state === "revoked"
        ? "Whoever made this link turned it off."
        : state === "expired"
          ? "This link has expired."
          : "This link doesn't go anywhere.";

  const action = signedIn ? (
    <Button onClick={join} disabled={joining}>
      {joining ? "Joining…" : "I'm in — join"}
    </Button>
  ) : (
    <Link
      href={`/auth?next=${encodeURIComponent(here)}`}
      className="bg-primary text-primary-foreground inline-block rounded-full px-4 py-2 text-sm font-medium"
    >
      Sign in to join
    </Link>
  );

  if (backdrop && invitation && !dead)
    return (
      <main className="relative isolate flex min-h-[100svh] flex-col justify-end overflow-hidden bg-[#1c1b18] px-6 pt-24 pb-12 text-white sm:items-center sm:text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- a fixed public photograph */}
        <img
          src={backdrop.src}
          alt=""
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(20,20,16,0.5)_0%,rgba(20,20,16,0.15)_35%,rgba(20,20,16,0.95)_100%)]" />
        <div data-testid="invitation" className="max-w-md">
          <p className="text-xs font-extrabold tracking-[0.28em] text-[#e8a33d] uppercase">
            You&apos;re invited
          </p>
          <h1 className="ghad-display mt-3 text-[40px] leading-[0.92] font-extrabold tracking-tight text-balance">
            {invitation[0]}
          </h1>
          {invitation.slice(1).map((line, i) => (
            <p
              key={line}
              className={
                i === invitation.length - 2
                  ? "mt-4 font-[family-name:var(--font-fraunces)] text-xl italic"
                  : "mt-4 text-[17px] leading-snug text-white/85"
              }
            >
              {line}
            </p>
          ))}
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-100">
            {error}
          </p>
        )}
        <div className="mt-8 [&_a]:min-h-12 [&_a]:bg-[#e8a33d] [&_a]:px-7 [&_a]:py-3.5 [&_a]:text-base [&_a]:font-extrabold [&_a]:text-[#1c1b18] [&_button]:min-h-12 [&_button]:rounded-full [&_button]:bg-[#e8a33d] [&_button]:px-7 [&_button]:text-base [&_button]:font-extrabold [&_button]:text-[#1c1b18]">
          {action}
        </div>
        <p className="mt-6 text-[10px] text-white/40">
          Photo: {backdrop.credit}
        </p>
      </main>
    );

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-md rounded-2xl border p-7 text-center">
        <div className="bg-muted mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
          {dead ? (
            <Compass className="h-6 w-6" aria-hidden />
          ) : (
            <Users className="h-6 w-6" aria-hidden />
          )}
        </div>
        {dead ? (
          <>
            <h1 className="text-xl font-semibold">That link&apos;s done</h1>
            <p className="text-muted-foreground mt-2 text-sm">{deadReason}</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Ask whoever sent it for a new one.
            </p>
            {next && (
              <Link
                href={next}
                data-testid="already-in"
                className="bg-primary text-primary-foreground mt-4 inline-block rounded-full px-4 py-2 text-sm font-medium"
              >
                Already in? Open it
              </Link>
            )}
          </>
        ) : (
          <>
            {invitation ? (
              <div data-testid="invitation">
                <h1 className="text-xl font-semibold">{invitation[0]}</h1>
                {invitation.slice(1).map((line) => (
                  <p key={line} className="text-muted-foreground mt-2 text-sm">
                    {line}
                  </p>
                ))}
              </div>
            ) : (
              <>
                <h1 className="text-xl font-semibold">
                  You&apos;re invited to a {kindLabel ?? "Passport adventure"}
                </h1>
                <p className="text-muted-foreground mt-2 text-sm">
                  Join to see what it is, who&apos;s going and what&apos;s
                  planned.
                </p>
              </>
            )}
            {error && (
              <p role="alert" className="text-destructive mt-3 text-sm">
                {error}
              </p>
            )}
            <div className="mt-5">{action}</div>
          </>
        )}
      </div>
    </main>
  );
}
