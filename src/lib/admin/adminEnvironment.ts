/**
 * **Which production settings the curator workbench is still missing.**
 *
 * Names only — never a value. The result is safe to show an administrator and
 * safe to put in a log; it is what `docs/admin-workbench.md`'s activation
 * checklist is checked against.
 */
export interface AdminEnvironmentReport {
  readonly ready: boolean;
  readonly missing: readonly string[];
  readonly warnings: readonly string[];
}

type Env = Readonly<Record<string, string | undefined>>;

const set = (value: string | undefined): boolean => !!value?.trim();

export function adminEnvironment(
  env: Env = process.env,
): AdminEnvironmentReport {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const name of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "ADMIN_EMAILS",
    "ADMIN_TOKEN",
    "ATLAS_SERVICE_TOKEN",
  ]) {
    if (!set(env[name])) missing.push(name);
  }

  const atlas = env.ATLAS_API_URL?.trim();
  if (!atlas) {
    // Unset falls back to a developer's localhost, which in production is
    // simply unreachable — so it is missing, not defaulted.
    if (env.NODE_ENV === "production") missing.push("ATLAS_API_URL");
  } else {
    if (
      /localhost|127\.0\.0\.1|\[::1\]/i.test(atlas) &&
      env.NODE_ENV === "production"
    ) {
      warnings.push("ATLAS_API_URL points at localhost in production.");
    }
    if (/\/api\/?$/.test(atlas)) {
      warnings.push(
        "ATLAS_API_URL ends in /api; Atlas routes are at the root.",
      );
    }
    if (/\/$/.test(atlas)) {
      warnings.push("ATLAS_API_URL has a trailing slash.");
    }
  }

  if (set(env.NEXT_PUBLIC_ADMIN_EMAILS)) {
    warnings.push(
      "NEXT_PUBLIC_ADMIN_EMAILS is set; it is unused and publishes addresses to every visitor. Unset it.",
    );
  }
  for (const name of Object.keys(env)) {
    if (/^NEXT_PUBLIC_.*(ADMIN_TOKEN|SERVICE_TOKEN)/.test(name)) {
      warnings.push(`${name} would be sent to browsers. Remove it.`);
    }
  }

  return { ready: missing.length === 0, missing, warnings };
}
