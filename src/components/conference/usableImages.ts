"use client";

import { useEffect, useState } from "react";
import { photoUsable } from "@/domain/hockey/nearby";

/**
 * Which of these photographs actually load and are photographs (Passport's
 * photo rule: no logos, no icons). Asked once per list. An editorial row
 * shows only places whose picture works, rather than beige rectangles where
 * a picture failed; the full shelves in Explore still list every place.
 */
export function useUsableImages(
  urls: readonly (string | undefined)[],
  timeoutMs = 4000,
): ReadonlySet<string> | null {
  const key = urls.filter(Boolean).join("|");
  const [ok, setOk] = useState<{
    key: string;
    set: ReadonlySet<string>;
  } | null>(null);
  useEffect(() => {
    let live = true;
    const list = key ? key.split("|") : [];
    Promise.all(
      list.map(
        (url) =>
          new Promise<string | null>((resolve) => {
            const img = new Image();
            img.referrerPolicy = "no-referrer";
            const timer = window.setTimeout(() => resolve(null), timeoutMs);
            img.onload = () => {
              window.clearTimeout(timer);
              resolve(
                photoUsable(img.naturalWidth, img.naturalHeight) ? url : null,
              );
            };
            img.onerror = () => {
              window.clearTimeout(timer);
              resolve(null);
            };
            img.src = url;
          }),
      ),
    ).then((r) => {
      if (live) setOk({ key, set: new Set(r.filter((u): u is string => !!u)) });
    });
    return () => {
      live = false;
    };
  }, [key, timeoutMs]);
  return ok && ok.key === key ? ok.set : null;
}
