"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { grantAwards } from "@/experience-lab/core/scoring";
import { recapText } from "@/domain/hockey/recap";
import type { GameView } from "@/app/hockey/_server/game";
import type { SharedNight } from "./useSharedNight";

/**
 * **The one thing that leaves the night: the recap, ready to paste.**
 *
 * Shown in the after act once somebody has points; "so far" until every call is made. On a phone it opens
 * the share sheet; anywhere else it copies. The text is shown first, so a
 * person can see it is funny before they send it.
 */
export function RecapShare({
  night,
  nhl,
  result,
}: {
  night: SharedNight;
  nhl?: GameView | null;
  result?: string;
}) {
  const { live, definition } = night;
  const [done, setDone] = useState(false);
  const awards = grantAwards(
    definition.awards,
    live.standings,
    live.prompts.flatMap((p) => p.responses),
  );
  const game = nhl?.game?.state === "final" ? nhl.game : null;
  const text = recapText({
    title: definition.title,
    result:
      result ??
      (game
        ? `${game.home.abbrev} ${game.home.score}–${game.away.score} ${game.away.abbrev}`
        : undefined),
    standings: live.standings,
    settled: live.settled,
    awards: live.settled ? awards : [],
    url: typeof window === "undefined" ? undefined : window.location.href,
  });
  if (!text) return null;

  const send = async () => {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
      }
      setDone(true);
      window.setTimeout(() => setDone(false), 2500);
    } catch {
      // The person closed the share sheet; nothing to say.
    }
  };

  return (
    <section aria-label="Share the recap">
      <pre className="rounded-2xl bg-black/30 p-4 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-white/75">
        {text}
      </pre>
      <button
        type="button"
        onClick={() => void send()}
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-semibold text-black"
      >
        {done ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
        {done ? "Sent — now wait for the replies" : "Share the recap"}
      </button>
    </section>
  );
}
