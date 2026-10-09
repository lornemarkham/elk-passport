"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bookmark, Leaf, LogOut, UserRound } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * **Who you are, and how to stop being them.**
 *
 * Small on purpose. The mission for this layer is that the two states are
 * *understandable*, not that they are beautiful: signed in shows a name and a
 * way out, signed out shows a way in, and neither ever blocks the page behind
 * it.
 *
 * The user is passed in from the server rather than fetched here. A client that
 * resolves its own identity flickers — anonymous on first paint, then the real
 * name — and for a control whose whole job is telling you who you are, a
 * flicker is a lie that corrects itself.
 *
 * Sign-out calls `router.refresh()` after Supabase clears the cookie so every
 * Server Component re-renders against the now-anonymous session. Without it the
 * badge would say "signed out" while the boards rendered upstream still showed
 * the previous person's saved places.
 */
interface AccountControlProps {
  readonly displayName: string | null;
  /** Where to come back to after signing in. */
  readonly returnTo?: string;
}

export function AccountControl({ displayName, returnTo }: AccountControlProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);

  const next = returnTo ?? pathname ?? "/discovery";

  if (!displayName) {
    return (
      <Link
        href={`/auth?next=${encodeURIComponent(next)}`}
        data-testid="sign-in-link"
        className="border-primary/25 text-primary hover:bg-primary/10 inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors"
      >
        <UserRound className="h-4 w-4" aria-hidden />
        Sign in
      </Link>
    );
  }

  async function handleSignOut() {
    setSigningOut(true);
    await supabaseBrowser().auth.signOut();
    router.refresh();
    setSigningOut(false);
  }

  return (
    <div
      className="inline-flex flex-wrap items-center justify-end gap-2 text-sm"
      data-testid="account-control"
    >
      {/* The two places a signed-in person actually needs to reach. Small, and
          on every screen that shows this control, because a consumer app that
          has no way back to your own stuff is not one. */}
      <Link
        href="/october/mine"
        data-testid="october-link"
        className="text-muted-foreground hover:bg-primary/10 inline-flex min-h-11 items-center gap-1.5 rounded-full px-2.5 transition-colors"
      >
        <Leaf className="h-4 w-4" aria-hidden />
        My October
      </Link>
      <Link
        href="/boards"
        className="text-muted-foreground hover:bg-primary/10 inline-flex min-h-11 items-center gap-1.5 rounded-full px-2.5 transition-colors"
      >
        <Bookmark className="h-4 w-4" aria-hidden />
        Boards
      </Link>
      <Link
        href="/account"
        data-testid="account-link"
        className="text-foreground hover:bg-primary/10 inline-flex min-h-11 items-center gap-1.5 rounded-full px-2.5 font-medium transition-colors"
      >
        <UserRound className="text-primary h-4 w-4" aria-hidden />
        <span data-testid="account-name">{displayName}</span>
      </Link>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        data-testid="sign-out-button"
        className="border-primary/25 text-muted-foreground hover:bg-primary/10 inline-flex min-h-11 items-center gap-1 rounded-full border px-3 text-xs transition-colors disabled:opacity-50"
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden />
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
