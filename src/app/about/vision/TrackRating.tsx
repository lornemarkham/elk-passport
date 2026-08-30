"use client";

import { useEffect, useState } from "react";
import { Heart, HelpCircle, X } from "lucide-react";

type Rating = "love" | "maybe" | "no";

function storageKey(trackId: string): string {
  return `passport-vision:rating:${trackId}`;
}

const OPTIONS: { rating: Rating; label: string; Icon: typeof Heart }[] = [
  { rating: "love", label: "Love", Icon: Heart },
  { rating: "maybe", label: "Maybe", Icon: HelpCircle },
  { rating: "no", label: "No", Icon: X },
];

/**
 * One track's Love/Maybe/No, persisted to localStorage per `trackId` —
 * this is a personal audition tool, not a shared/social feature, so
 * per-browser local state is the right amount of infrastructure for it.
 * Clicking the already-selected rating clears it, so "I haven't decided
 * yet" is always reachable again.
 */
export function TrackRating({ trackId }: { trackId: string }) {
  const [rating, setRating] = useState<Rating | null>(null);

  // Read once, after mount — localStorage doesn't exist during SSR.
  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey(trackId));
    if (stored === "love" || stored === "maybe" || stored === "no")
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a real external source (localStorage) after mount, not a derivable-from-props value
      setRating(stored);
  }, [trackId]);

  function choose(next: Rating) {
    const cleared = rating === next;
    setRating(cleared ? null : next);
    if (cleared) {
      window.localStorage.removeItem(storageKey(trackId));
    } else {
      window.localStorage.setItem(storageKey(trackId), next);
    }
  }

  return (
    <div className="flex items-center gap-1">
      {OPTIONS.map(({ rating: r, label, Icon }) => (
        <button
          key={r}
          type="button"
          onClick={() => choose(r)}
          aria-pressed={rating === r}
          title={label}
          className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
            rating === r
              ? "border-current bg-current/15"
              : "border-current/20 opacity-40 hover:opacity-70"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
