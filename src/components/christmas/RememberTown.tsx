"use client";

import { useEffect } from "react";

/**
 * Remembers the town somebody chose, on this browser only, for a year — so
 * Christmas opens where they are next time. A town is a place name they
 * tapped, not a position (the lights and Discovery never read GPS here); the
 * cookie carries nothing else and is not read by any analytics.
 */
export function RememberTown({ town }: { readonly town: string }) {
  useEffect(() => {
    document.cookie = `xm-town=${encodeURIComponent(town)}; path=/; max-age=31536000; SameSite=Lax`;
  }, [town]);
  return null;
}
