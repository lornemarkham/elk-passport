"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Compass } from "lucide-react";

import { supabaseBrowser } from "@/lib/supabase/client";
import { useExperienceName } from "@/components/auth/ExperienceName";
import { DEFAULT_NEXT, safeNext } from "@/lib/auth/safeNext";
import { experienceHomeFor } from "@/lib/domains/experience-domains";
import {
  friendlyAuthError,
  PASSWORD_RULE,
  passwordProblem,
} from "@/lib/auth/passwordPolicy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordField } from "@/components/auth/PasswordField";
import {
  GoogleButton,
  googleSignInAvailable,
} from "@/components/auth/GoogleButton";

/**
 * Sign in, sign up, and go back to whatever you were doing.
 *
 * `?next=` exists because Passport asks for identity at exactly one moment —
 * you tried to keep something — and the only decent answer is to put you back
 * where you were. It is restricted to same-site paths; a `next` a stranger can
 * set is an open redirect at the most valuable possible moment.
 *
 * `?notice=` is how the flows that leave this page report back: a used-up
 * recovery link, a cancelled Google consent screen, a password that was just
 * changed. They are states a person can be in, not errors, and they read that
 * way.
 */
const NOTICES: Record<string, string> = {
  "password-updated":
    "Password updated. Sign in with your new one — you've been signed out everywhere else.",
  "link-expired":
    "That link has expired or was already used. Ask for a fresh one below.",
  "link-incomplete": "That link was incomplete. Ask for a fresh one below.",
};

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // "ELK Passport" on an October sign-in named the wrong product at the one
  // moment the product is asking to be trusted with a password. Outside an
  // experience this is the string it always was.
  const experience = useExperienceName();
  const wordmark = experience === "Passport" ? "ELK Passport" : experience;
  // **Resolved when it is used, not when it is rendered.** The fallback
  // depends on the host, and reading `window` during render would make the
  // server and the browser disagree. Every use below is inside a handler.
  const asked = searchParams.get("next");
  const nextDestination = () =>
    safeNext(asked, experienceHomeFor(window.location.host) ?? DEFAULT_NEXT);
  /**
   * The same destination for things rendered rather than navigated to.
   *
   * It cannot consult `window`, so when nothing was asked for it falls back
   * to `/` — which is October's own front door on `iamoctober.com` and
   * Passport's home everywhere else. One link, correct on both, no host
   * check and nothing for hydration to disagree about.
   */
  const renderNext = asked ? safeNext(asked, "/") : "/";
  const noticeKey = searchParams.get("notice");
  const notice = noticeKey
    ? (NOTICES[noticeKey] ?? decodeURIComponent(noticeKey))
    : "";

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    // Checked before the request so somebody is told their password is too
    // short by the form that stated the rule, not by a server round trip.
    if (mode === "signup") {
      const problem = passwordProblem(password);
      if (problem) return setError(problem);
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabaseBrowser().auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextDestination())}`,
          },
        });
        if (error) throw error;

        // Whether a confirmation email is required is a project setting this
        // page cannot know, so it reports whichever actually happened rather
        // than always claiming the inbox step.
        if (data.session) {
          router.replace(nextDestination());
          router.refresh();
        } else {
          setMessage(
            "Check your email to confirm your account, then come back and sign in.",
          );
        }
      } else {
        const { error } = await supabaseBrowser().auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        // `refresh()` and not `replace()` alone: the session now lives in a
        // cookie the *server* reads, and every Server Component rendered
        // before this moment resolved an anonymous user.
        router.replace(nextDestination());
        router.refresh();
      }
    } catch (err: unknown) {
      setError(
        friendlyAuthError(
          err instanceof Error ? err.message : "Something went wrong.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="bg-background w-full max-w-md rounded-2xl border p-7 shadow-sm">
        <div className="mb-7 text-center">
          <div className="text-primary mb-4 flex items-center justify-center gap-2">
            <Compass className="h-5 w-5" aria-hidden />
            <span className="font-semibold">{wordmark}</span>
          </div>
          <h1 className="text-3xl font-bold">
            {mode === "signup" ? `Create your ${experience}` : "Welcome back"}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {mode === "signup"
              ? "An account keeps what you save, on any device."
              : "Sign in to pick up where you left off."}
          </p>
        </div>

        {notice && (
          <p
            className="mb-6 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-sm text-amber-900"
            role="status"
          >
            {notice}
          </p>
        )}

        {/* Both of these disappear together: an "or" above a single option
            is a seam where a second option used to be. */}
        {googleSignInAvailable() ? (
          <>
            <GoogleButton next={renderNext} />
            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-current opacity-10" />
              <span className="text-muted-foreground text-xs">or</span>
              <span className="h-px flex-1 bg-current opacity-10" />
            </div>
          </>
        ) : null}

        <div
          className="mb-6 flex rounded-lg border p-1"
          role="tablist"
          aria-label="Sign in or create an account"
        >
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className={`min-h-11 flex-1 rounded-md py-2 text-sm font-medium transition ${
                mode === m ? "bg-primary text-primary-foreground" : ""
              }`}
              onClick={() => {
                setMode(m);
                setError("");
                setMessage("");
              }}
            >
              {m === "login" ? "Log In" : "Sign Up"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            // A placeholder is not a name: it disappears on focus and most
            // screen readers do not announce it. Both auth screens relied on
            // one, so neither email field had an accessible name at all.
            aria-label="Email address"
            placeholder="Email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-11 text-base"
          />

          <PasswordField
            value={password}
            onChange={setPassword}
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            describedBy={mode === "signup" ? "password-rule" : undefined}
            invalid={Boolean(error)}
          />

          {mode === "signup" && (
            <p id="password-rule" className="text-muted-foreground text-xs">
              {PASSWORD_RULE}
            </p>
          )}

          <Button type="submit" className="min-h-11 w-full" disabled={loading}>
            {loading
              ? "Please wait…"
              : mode === "signup"
                ? "Create account"
                : "Log in"}
          </Button>
        </form>

        {/* On the login tab only. Offering a reset beside "create an account"
            is noise; offering it beside a failed sign-in is the whole point,
            and the error message points here too. */}
        {mode === "login" && (
          <div className="mt-4 text-center">
            <Link
              href={
                asked
                  ? `/auth/forgot?next=${encodeURIComponent(asked)}`
                  : "/auth/forgot"
              }
              className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center text-sm underline"
            >
              Forgot your password?
            </Link>
          </div>
        )}

        {message && (
          <p className="mt-5 text-center text-sm text-green-700" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="mt-5 text-center text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-7 text-center">
          <Link
            href={renderNext}
            className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center text-sm"
          >
            ← Back
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function AuthPage() {
  // `useSearchParams` suspends during prerender; without a boundary the whole
  // route opts out of static rendering with a build-time error.
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
