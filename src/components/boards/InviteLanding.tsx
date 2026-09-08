"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Compass, Users } from "lucide-react";

interface InviteLandingProps {
  readonly token: string;
  readonly valid: boolean;
  readonly role: "editor" | "viewer" | null;
  /** Whether a link with this token exists at all. */
  readonly known: boolean;
  readonly signedIn: boolean;
  readonly displayName: string | null;
}

/**
 * One screen, one button.
 *
 * A signed-out visitor sees what the link offers and a sign-in that returns
 * here — `?next=/invite/<token>` — so accepting is the very next thing that
 * happens rather than something they have to find their way back to. That
 * return trip is the whole difference between a share link that works and one
 * people give up on.
 */
export function InviteLanding({
  token,
  valid,
  role,
  known,
  signedIn,
  displayName,
}: InviteLandingProps) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setJoining(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/invites/${encodeURIComponent(token)}`,
        {
          method: "POST",
        },
      );

      if (response.status === 401) {
        window.location.href = `/auth?next=${encodeURIComponent(`/invite/${token}`)}`;
        return;
      }
      if (!response.ok) {
        setError("This link is no longer good. Ask for a new one.");
        return;
      }

      const { boardId } = await response.json();
      router.replace(`/boards/${boardId}`);
      router.refresh();
    } catch {
      setError("Couldn't join just now. Please try again.");
    } finally {
      setJoining(false);
    }
  }

  const dead = !known || !valid;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#ecdfc4] px-5 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[#8a5a24]/20 bg-white/70 p-7 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#8a5a24]/12">
          {dead ? (
            <Compass className="h-6 w-6 text-[#8a5a24]" aria-hidden />
          ) : (
            <Users className="h-6 w-6 text-[#8a5a24]" aria-hidden />
          )}
        </div>

        {dead ? (
          <>
            <h1 className="font-serif text-2xl text-[#2c1f10]">
              This link has expired
            </h1>
            <p className="mt-2 text-sm text-[#6b5637]">
              Share links can be turned off by whoever made them. Ask for a new
              one — nothing is wrong with your account.
            </p>
            <Link
              href="/discovery"
              className="mt-5 inline-flex min-h-11 items-center rounded-full border border-[#8a5a24]/30 px-5 text-sm font-medium text-[#8a5a24]"
            >
              Explore Passport instead
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-serif text-2xl text-[#2c1f10]">
              You&apos;ve been invited to a board
            </h1>
            <p className="mt-2 text-sm text-[#6b5637]">
              {role === "editor"
                ? "You'll be able to add and remove places on it."
                : "You'll be able to see what's on it."}
            </p>

            <button
              type="button"
              onClick={join}
              disabled={joining}
              className="mt-6 min-h-11 w-full rounded-full bg-[#8a5a24] px-5 text-sm font-medium text-white disabled:opacity-60"
            >
              {joining
                ? "Joining…"
                : signedIn
                  ? `Join as ${displayName}`
                  : "Sign in and join"}
            </button>

            {!signedIn && (
              <p className="mt-3 text-xs text-[#8a7a60]">
                You&apos;ll come straight back here afterwards.
              </p>
            )}

            {error && (
              <p className="mt-4 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
