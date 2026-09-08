"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Compass } from "lucide-react";

import { supabaseBrowser } from "@/lib/supabase/client";
import { safeNext } from "@/lib/auth/safeNext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Sign in, sign up, and go back to whatever you were doing.
 *
 * `?next=` is the whole reason this page is reachable at all now: Passport asks
 * for identity at exactly one moment — you tried to keep something — and the
 * only decent answer to that is to put you back where you were. It is
 * deliberately restricted to same-site paths, because a `next` a stranger can
 * set is an open redirect.
 */
function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));

  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (mode === "signup") {
        const { data, error } = await supabaseBrowser().auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
          },
        });

        if (error) throw error;

        // Whether a confirmation email is required is a Supabase project
        // setting, not something this page can know. So it reports whichever
        // actually happened rather than always claiming the inbox step.
        if (data.session) {
          router.replace(next);
          router.refresh();
        } else {
          setMessage(
            "Check your email to verify your account, then come back and log in.",
          );
        }
      } else {
        const { error } = await supabaseBrowser().auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // `refresh()` and not `push()` alone: the session now lives in a cookie
        // the *server* reads, and every Server Component rendered before this
        // moment resolved an anonymous user. Without the refresh you would land
        // on /discovery signed in and be shown a signed-out page.
        router.replace(next);
        router.refresh();
      }
    } catch (err: unknown) {
      // Narrowed rather than asserted: a thrown value is not guaranteed to
      // be an Error, and `err.message` on a string would have shown the
      // user "undefined" instead of the fallback.
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="bg-background w-full max-w-md rounded-2xl border p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="text-primary mb-4 flex items-center justify-center gap-2">
            <Compass className="h-5 w-5" />
            <span className="font-semibold">ELK Passport</span>
          </div>

          <h1 className="text-3xl font-bold">
            {mode === "signup" ? "Create your Passport" : "Welcome back"}
          </h1>

          <p className="text-muted-foreground mt-2 text-sm">
            {mode === "signup"
              ? "Create an account to save your adventures."
              : "Sign in to continue your adventure."}
          </p>
        </div>

        <div className="mb-8 flex rounded-lg border p-1">
          <button
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              mode === "login" ? "bg-primary text-primary-foreground" : ""
            }`}
            onClick={() => setMode("login")}
          >
            Log In
          </button>

          <button
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              mode === "signup" ? "bg-primary text-primary-foreground" : ""
            }`}
            onClick={() => setMode("signup")}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input
            type="password"
            placeholder="Password"
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? "Please wait..."
              : mode === "signup"
                ? "Create Account"
                : "Log In"}
          </Button>
        </form>

        {message && (
          <p className="mt-5 text-center text-sm text-green-600">{message}</p>
        )}

        {error && (
          <p className="mt-5 text-center text-sm text-red-600">{error}</p>
        )}

        <div className="mt-8 text-center">
          <Link
            href={next}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            ← Back to Passport
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
