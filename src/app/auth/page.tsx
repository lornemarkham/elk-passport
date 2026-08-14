"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Compass } from "lucide-react";

import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AuthPage() {
  const router = useRouter();

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
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: "http://localhost:3100/auth",
          },
        });

        if (error) throw error;

        setMessage(
          "Check your email to verify your account before continuing.",
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.push("/atlas-test");
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
            href="/"
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            ← Back to Passport
          </Link>
        </div>
      </div>
    </main>
  );
}
