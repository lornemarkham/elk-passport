"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Compass } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { DEFAULT_NEXT, safeNext } from "@/lib/auth/safeNext";
import { experienceHomeFor } from "@/lib/domains/experience-domains";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/auth/PasswordField";
import {
  friendlyAuthError,
  PASSWORD_RULE,
  passwordProblem,
} from "@/lib/auth/passwordPolicy";

/**
 * **Choose a new password.**
 *
 * Reached only through `/auth/callback`, which has already exchanged the
 * recovery code for a real session. So the authority to change the password is
 * that session — not a token this page reads out of the URL, and nothing
 * sensitive is ever in the address bar for a browser to keep in history.
 *
 * If somebody opens this page without having come through a link, there is no
 * session and the page says so rather than presenting a form that cannot work.
 */
function UpdatePasswordForm() {
  const router = useRouter();
  // Where the reset began, threaded here from `/auth/forgot` through the
  // callback. Sending somebody who started in October back to Passport's
  // generic Discovery is how a password reset becomes a change of product.
  const next = useSearchParams().get("next");
  const [checking, setChecking] = useState(true);
  const [recoverable, setRecoverable] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabaseBrowser()
      .auth.getUser()
      .then(({ data }) => {
        if (cancelled) return;
        setRecoverable(Boolean(data.user));
        setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    if (password !== confirmation) {
      return setError("Those two passwords don't match.");
    }

    setSaving(true);
    setError("");
    try {
      const { error } = await supabaseBrowser().auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
    } catch (err: unknown) {
      setError(
        friendlyAuthError(
          err instanceof Error ? err.message : "Something went wrong.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  /**
   * Sign out everywhere, then send them to sign in with the new password.
   *
   * `scope: "global"` is the point: whoever prompted this reset may have had
   * access, and a new password that leaves their existing sessions alive has
   * not actually taken anything back. Signing in again immediately afterwards
   * is also the only honest proof the new password works.
   */
  async function finish() {
    await supabaseBrowser().auth.signOut({ scope: "global" });
    const destination = next
      ? `/auth?notice=password-updated&next=${encodeURIComponent(
          safeNext(
            next,
            experienceHomeFor(window.location.host) ?? DEFAULT_NEXT,
          ),
        )}`
      : "/auth?notice=password-updated";
    router.replace(destination);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="bg-background w-full max-w-md rounded-2xl border p-7">
        <div className="text-primary mb-5 flex items-center justify-center gap-2">
          <Compass className="h-5 w-5" aria-hidden />
          <span className="font-semibold">ELK Passport</span>
        </div>

        {checking ? (
          <p className="text-muted-foreground text-center text-sm">
            Checking your link…
          </p>
        ) : done ? (
          <div className="text-center">
            <h1 className="text-2xl font-bold">Password updated</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              We&apos;ve signed you out everywhere else. Sign in with your new
              password.
            </p>
            <Button onClick={finish} className="mt-6 min-h-11 w-full">
              Go to sign in
            </Button>
          </div>
        ) : !recoverable ? (
          <div className="text-center">
            <h1 className="text-2xl font-bold">This link has expired</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Reset links last an hour and work once. Ask for a fresh one —
              nothing is wrong with your account.
            </p>
            <Link
              href="/auth/forgot"
              className="bg-primary text-primary-foreground mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-md px-5 text-sm font-medium"
            >
              Send a new link
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-center text-2xl font-bold">
              Choose a new password
            </h1>
            <p
              id="password-rule"
              className="text-muted-foreground mt-2 mb-6 text-center text-sm"
            >
              {PASSWORD_RULE}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <PasswordField
                value={password}
                onChange={setPassword}
                placeholder="New password"
                autoComplete="new-password"
                describedBy="password-rule"
                invalid={Boolean(error)}
              />
              <PasswordField
                value={confirmation}
                onChange={setConfirmation}
                placeholder="Confirm new password"
                autoComplete="new-password"
                invalid={Boolean(error)}
              />
              <Button
                type="submit"
                className="min-h-11 w-full"
                disabled={saving}
              >
                {saving ? "Saving…" : "Update password"}
              </Button>
            </form>

            {error && (
              <p className="mt-5 text-center text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}

/** `useSearchParams` needs a Suspense boundary at the page level. */
export default function UpdatePasswordPage() {
  return (
    <Suspense>
      <UpdatePasswordForm />
    </Suspense>
  );
}
