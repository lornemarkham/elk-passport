/**
 * **Who may operate the Atlas curator workbench, as a pure decision.**
 *
 * No `server-only`, no Next, no Supabase: middleware (edge), route handlers,
 * server components and server actions all call the same function, and a test
 * can call it too. One decision in one place, because a decision restated in
 * four places drifts in exactly one of them.
 *
 * ## The model
 *
 * An administrator is a **signed-in** person whose **verified** email is on the
 * `ADMIN_EMAILS` allowlist. Three refusals, said apart because the fix differs:
 *
 * - `signed-out` — sign in.
 * - `not-approved` — signed in, but not an administrator. Indistinguishable
 *   from "this page does not exist" to the person, on purpose.
 * - `not-configured` — `ADMIN_EMAILS` is empty or unset. **Closed**, never
 *   open: an unset allowlist is a setup step nobody has done, not permission.
 *
 * `ADMIN_EMAILS` is deliberately not `NEXT_PUBLIC_*`. That prefix inlines the
 * value into JavaScript served to every visitor, which would publish the
 * administrators' addresses. The nav entry asks the server instead.
 *
 * This is *who*. `ADMIN_TOKEN` is *what Atlas will accept from Passport*, and
 * lives only on the server; neither substitutes for the other.
 */

/** Every path prefix that is administrative, whichever host it arrives on. */
export const ADMIN_SURFACES = ["/admin", "/api/admin", "/explorer"] as const;

/**
 * Whether a request path belongs to the workbench.
 *
 * Compared case-insensitively and on a segment boundary: `/ADMIN`, `/Admin/x`
 * and `/admin/` are guarded, `/administrator-guide` is not. A guard that only
 * matched the canonical casing would be a guard a capital letter walks around.
 */
export function isAdminSurface(pathname: string): boolean {
  const path = pathname.toLowerCase();
  return ADMIN_SURFACES.some(
    (surface) => path === surface || path.startsWith(`${surface}/`),
  );
}

/** The `ADMIN_EMAILS` list, lower-cased, trimmed, empties dropped. */
export function parseAdminEmails(raw: string | undefined): ReadonlySet<string> {
  return new Set(
    (raw ?? "")
      .split(/[,\s;]+/)
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.includes("@")),
  );
}

export interface AdminCandidate {
  readonly email?: string | null;
  /** Supabase sets this once the address has been proven. */
  readonly email_confirmed_at?: string | null;
}

export type AdminVerdict =
  | { readonly ok: true; readonly email: string }
  | {
      readonly ok: false;
      readonly reason:
        "signed-out" | "unverified" | "not-approved" | "not-configured";
    };

/**
 * The decision.
 *
 * An unverified address is refused even when it is on the list: on a project
 * that allows unconfirmed sign-up, anybody could otherwise register an
 * administrator's address and inherit it.
 */
export function adminVerdict(
  user: AdminCandidate | null | undefined,
  rawAllowlist: string | undefined = process.env.ADMIN_EMAILS,
): AdminVerdict {
  if (!user) return { ok: false, reason: "signed-out" };

  const allowlist = parseAdminEmails(rawAllowlist);
  if (allowlist.size === 0) return { ok: false, reason: "not-configured" };

  const email = user.email?.trim().toLowerCase();
  if (!email) return { ok: false, reason: "not-approved" };
  if (!allowlist.has(email)) return { ok: false, reason: "not-approved" };
  if (!user.email_confirmed_at) return { ok: false, reason: "unverified" };

  return { ok: true, email };
}

/** The HTTP status a refusal maps to. 401 invites a sign-in; 403 does not. */
export function statusFor(
  reason: Exclude<AdminVerdict, { ok: true }>["reason"],
): 401 | 403 {
  return reason === "signed-out" ? 401 : 403;
}
