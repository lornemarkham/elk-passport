"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bookmark, LogOut, UserRound } from "lucide-react";
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
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[#8a5a24]/25 px-4 text-sm font-medium text-[#8a5a24] transition-colors hover:bg-[#8a5a24]/10"
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
        href="/boards"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2.5 text-[#6b5637] transition-colors hover:bg-[#8a5a24]/10"
      >
        <Bookmark className="h-4 w-4" aria-hidden />
        Boards
      </Link>
      <Link
        href="/account"
        data-testid="account-link"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2.5 font-medium text-[#3b2a17] transition-colors hover:bg-[#8a5a24]/10"
      >
        <UserRound className="h-4 w-4 text-[#8a5a24]" aria-hidden />
        <span data-testid="account-name">{displayName}</span>
      </Link>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        data-testid="sign-out-button"
        className="inline-flex min-h-11 items-center gap-1 rounded-full border border-[#8a5a24]/25 px-3 text-xs text-[#6b5637] transition-colors hover:bg-[#8a5a24]/10 disabled:opacity-50"
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden />
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
