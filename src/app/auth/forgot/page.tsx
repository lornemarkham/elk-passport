"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Compass } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useExperienceName } from "@/components/auth/ExperienceName";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { friendlyAuthError } from "@/lib/auth/passwordPolicy";
import { DEFAULT_NEXT, safeNext } from "@/lib/auth/safeNext";
import { experienceHomeFor } from "@/lib/domains/experience-domains";

/**
 * **Ask for a reset link.**
 *
 * ## The one thing this screen must not do
 *
 * It must not say whether an account exists. "No account with that email" is a
 * helpful sentence and a way for anybody to test whether a given person has a
 * Passport account, which is not information Passport should hand out. So the
 * answer is identical either way: *we've sent a link if that address has an
 * account*. Supabase's own API is built the same way and does not tell us
 * either.
 *
 * The redirect goes through `/auth/callback`, which exchanges the PKCE code for
 * a session and only then forwards to the page where a new password is chosen.
 *
 * ## It remembers where the person started
 *
 * `?next=` is threaded all the way to the far side of the email: into the
 * callback, through the update-password screen, and into the sign-in that
 * follows. Without it the chain forgot twice over, and somebody who began in
 * I Am October finished in Passport's generic Discovery — a different
 * product, reached by resetting a password.
 */
function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  // "ELK Passport" on an October sign-in named the wrong product at the one
  // moment the product is asking to be trusted with a password. Outside an
  // experience this is the string it always was.
  const experience = useExperienceName();
  const wordmark = experience === "Passport" ? "ELK Passport" : experience;
  const next = searchParams.get("next");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setError("");

    try {
      const { error } = await supabaseBrowser().auth.resetPasswordForEmail(
        email.trim(),
        {
          // The callback forwards to update-password, which in turn needs to
          // know where the whole thing started — so the destination is
          // nested inside the callback's own `next`.
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            next
              ? `/auth/update-password?next=${encodeURIComponent(safeNext(next, experienceHomeFor(window.location.host) ?? DEFAULT_NEXT))}`
              : "/auth/update-password",
          )}`,
        },
      );

      // A refusal here is a transport or rate-limit problem, never "no such
      // account" — Supabase does not disclose that and neither does this.
      if (error) throw error;
      setSent(true);
    } catch (err: unknown) {
      setError(
        friendlyAuthError(
          err instanceof Error ? err.message : "Something went wrong.",
        ),
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="bg-background w-full max-w-md rounded-2xl border p-7">
        <div className="text-primary mb-5 flex items-center justify-center gap-2">
          <Compass className="h-5 w-5" aria-hidden />
          <span className="font-semibold">{wordmark}</span>
        </div>

        {sent ? (
          <div className="text-center">
            <h1 className="text-2xl font-bold">Check your email</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              If <span className="font-medium">{email}</span> has an account, a
              reset link is on its way. It expires in an hour.
            </p>
            <p className="text-muted-foreground mt-4 text-xs">
              Nothing arrived? Check spam, then try again in a minute — reset
              emails are rate limited.
            </p>
            <Link
              href="/auth"
              className="mt-6 inline-flex min-h-11 items-center text-sm font-medium underline"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-center text-2xl font-bold">
              Reset your password
            </h1>
            <p className="text-muted-foreground mt-2 mb-6 text-center text-sm">
              We&apos;ll email you a link to choose a new one.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                aria-label="Email address"
                placeholder="Email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-11 text-base"
              />
              <Button
                type="submit"
                className="min-h-11 w-full"
                disabled={sending || email.trim().length === 0}
              >
                {sending ? "Sending…" : "Send reset link"}
              </Button>
            </form>

            {error && (
              <p className="mt-5 text-center text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <div className="mt-7 text-center">
              <Link
                href={next ? `/auth?next=${encodeURIComponent(next)}` : "/auth"}
                className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center text-sm"
              >
                ← Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

/**
 * `useSearchParams` forces a Suspense boundary at the page level; without one
 * the whole route opts out of static rendering and Next says so at build.
 */
export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
