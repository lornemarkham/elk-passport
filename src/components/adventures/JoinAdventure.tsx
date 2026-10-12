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
}: {
  token: string;
  state: "valid" | "revoked" | "expired" | "used-up" | "unknown";
  kindLabel: string | null;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const here = `/adventures/join/${token}`;

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
      router.replace(`/adventures/${id}`);
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
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">
              You&apos;re invited to a {kindLabel ?? "Passport adventure"}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Join to see what it is, who&apos;s going and what&apos;s planned.
            </p>
            {error && (
              <p role="alert" className="text-destructive mt-3 text-sm">
                {error}
              </p>
            )}
            <div className="mt-5">
              {signedIn ? (
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
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
