"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * **Sign in with Google.**
 *
 * The code is complete and the flow is the same PKCE round trip as a recovery
 * link — provider consent, back to `/auth/callback?code=...`, exchanged for a
 * session cookie server-side.
 *
 * **Whether it works is a Supabase project setting, not a code question.** The
 * provider is disabled on this project today, so **nothing is rendered at
 * all**. It used to render disabled, with the reason in a `title` — which is
 * invisible on a phone and to most screen readers, so what a person actually
 * met was a greyed-out Google button and no explanation. Not offering a way
 * in that does not exist is the more truthful of the two.
 *
 * `NEXT_PUBLIC_GOOGLE_SSO_ENABLED=true` brings it back, and that is the only
 * thing to change once the provider is configured in the Supabase dashboard.
 */
export const googleSignInAvailable = (): boolean =>
  process.env.NEXT_PUBLIC_GOOGLE_SSO_ENABLED === "true";

export function GoogleButton({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    // No navigation here on purpose — signInWithOAuth redirects the page.
  }

  if (!googleSignInAvailable()) return null;

  return (
    <div>
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="flex min-h-11 w-full items-center justify-center gap-2.5 rounded-md border text-sm font-medium transition-colors hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.27-4.74 3.27-8.09Z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5a11 11 0 0 0-9.82 6.05l3.66 2.84c.87-2.6 3.3-4.64 6.16-4.64Z"
          />
        </svg>
        {busy ? "Redirecting…" : "Continue with Google"}
      </button>
    </div>
  );
}
