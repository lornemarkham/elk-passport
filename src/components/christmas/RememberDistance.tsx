"use client";

import { useEffect } from "react";

/** The cookie `rememberedKm` reads — kept in step with `KM_COOKIE`. */
const KM_COOKIE = "xm-km";

/** Set at once, before a navigation, so the next page already opens on it. */
export function rememberDistance(km: number): void {
  document.cookie = `${KM_COOKIE}=${km}; path=/; max-age=31536000; SameSite=Lax`;
}

/**
 * Remembers how far somebody chose to look, on this browser only, for a
 * year — so Christmas opens on the same radius next time (owner brief
 * 2026-11-22: "remember the user's last preference"). A number, nothing
 * else, and not read by any analytics.
 */
export function RememberDistance({ km }: { readonly km: number }) {
  useEffect(() => rememberDistance(km), [km]);
  return null;
}
