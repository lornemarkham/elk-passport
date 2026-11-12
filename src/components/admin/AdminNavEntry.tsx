"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * The navigation foundation for admin capabilities, in the GitHub/Linear/
 * Notion sense: administrators quietly gain an extra entry point, everyone
 * else's experience is completely unchanged. Mounted once, globally, in
 * the root layout — renders nothing for anyone who isn't an administrator,
 * so it never touches the visitor-facing UI.
 *
 * **The server decides.** This used to compare the session's email with
 * `NEXT_PUBLIC_ADMIN_EMAILS`, which published the administrators' addresses
 * to every visitor in the JavaScript bundle. It now asks
 * `/api/session/admin`, and the allowlist (`ADMIN_EMAILS`) never leaves the
 * server. Showing or hiding this link is still only a convenience: the
 * workbench enforces access itself (middleware, layouts, every handler).
 */
export function AdminNavEntry() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function ask() {
      fetch("/api/session/admin", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : { admin: false }))
        .then((body: { admin?: boolean }) => {
          if (!cancelled) setIsAdmin(body.admin === true);
        })
        .catch(() => {
          if (!cancelled) setIsAdmin(false);
        });
    }

    // **Asked once, and only of somebody signed in.** This used to ask on
    // mount *and* again on `INITIAL_SESSION`, which Supabase fires the moment
    // anyone subscribes — two server round-trips (each a Supabase auth read)
    // on every page of every experience, for visitors who have no session to
    // ask about (M760). `INITIAL_SESSION` carries the session the browser
    // already holds; a sign-in, sign-out or account change asks again. A
    // token refresh changes nobody's role.
    const { data: subscription } = supabaseBrowser().auth.onAuthStateChange(
      (event, session) => {
        if (event === "INITIAL_SESSION") {
          if (session) ask();
        } else if (event === "SIGNED_OUT") {
          if (!cancelled) setIsAdmin(false);
        } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
          ask();
        }
      },
    );

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  if (!isAdmin) return null;

  return (
    <Link
      href="/admin"
      className="bg-background text-foreground hover:bg-muted fixed right-4 bottom-4 z-50 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm transition-colors"
    >
      <LayoutDashboard className="h-3.5 w-3.5" />
      Curator Workbench
    </Link>
  );
}
