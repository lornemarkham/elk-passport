"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

/**
 * Share this page as it is — the phone's own share sheet where there is one,
 * otherwise the link copied. The address already holds the choice.
 */
export function ShareLink({
  title,
  text,
  testId = "share",
}: {
  readonly title: string;
  readonly text: string;
  readonly testId?: string;
}) {
  const [said, setSaid] = useState("");
  async function share() {
    const url = location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setSaid("Link copied — paste it to the family chat.");
    } catch {
      setSaid(url);
    }
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={share}
        className="inline-flex min-h-12 items-center gap-2 rounded-full px-5 font-bold text-[#b3242f] ring-2 ring-[#b3242f] hover:bg-[#b3242f]/5"
        data-testid={testId}
      >
        <Share2 className="h-5 w-5" aria-hidden />
        Share
      </button>
      {said && (
        <span role="status" className="text-sm text-[var(--gh-ink-soft)]">
          {said}
        </span>
      )}
    </span>
  );
}
