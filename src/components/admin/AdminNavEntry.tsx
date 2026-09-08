"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * The navigation foundation for admin capabilities, in the GitHub/Linear/
 * Notion sense: administrators quietly gain an extra entry point, everyone
 * else's experience is completely unchanged. Mounted once, globally, in
 * the root layout — renders nothing for anyone who isn't recognized as an
 * admin, so it never touches the visitor-facing UI.
 *
 * Deliberately not a real permissions system: `NEXT_PUBLIC_ADMIN_EMAILS`
 * is a plain allowlist, checked client-side. That's a UX decision, not a
 * security boundary — the real access control is the ADMIN_TOKEN gate the
 * /api/admin/* proxy routes already enforce server-side, which this can't
 * bypass regardless of what it shows or hides. This is the seam a real
 * role check (a `role` column, Supabase custom claims, whatever) plugs
 * into later without moving where the nav entry lives — see
 * project-management/prompts/draft/IMP-007_... for the follow-up.
 */
export function AdminNavEntry() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    if (adminEmails.length === 0) return;

    function checkSession(email: string | undefined) {
      setIsAdmin(!!email && adminEmails.includes(email.toLowerCase()));
    }

    supabaseBrowser()
      .auth.getSession()
      .then(({ data }) => {
        checkSession(data.session?.user.email);
      });

    const { data: subscription } = supabaseBrowser().auth.onAuthStateChange(
      (_event, session) => {
        checkSession(session?.user.email);
      },
    );

    return () => subscription.subscription.unsubscribe();
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
