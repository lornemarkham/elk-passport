import { inkOn, safeAccent } from "@/domain/conference/branding";
import { countdown, dateRange } from "@/domain/conference/countdown";
import { KIND_WORDS } from "@/domain/conference/details";
import type { ConferenceDetails } from "@/domain/conference/types";

function countdownWords(details: ConferenceDetails, now: Date): string {
  const c = countdown(details, now);
  const noun = KIND_WORDS[details.kind].noun;
  if (c.phase === "before")
    return c.days === 1 ? "Tomorrow." : `${c.days} days to go.`;
  if (c.phase === "during")
    return c.day === 1 ? "Today's the day." : `Day ${c.day}.`;
  return `That was the ${noun}. Keep what you loved.`;
}

/** The conference in its own colours: name, place, dates, countdown. */
export function Hero({
  details,
  now,
  children,
}: {
  details: ConferenceDetails;
  now: Date;
  children?: React.ReactNode;
}) {
  const accent = safeAccent(details.branding.accent);
  const ink = inkOn(accent);
  return (
    <header style={{ background: accent, color: ink }}>
      <div className="mx-auto max-w-[760px] px-5 pt-10 pb-8 sm:pt-16">
        <p className="text-[13px] font-bold tracking-[0.16em] uppercase opacity-75">
          {details.place.label} · {dateRange(details)}
        </p>
        <h1 className="mt-2 text-[40px] leading-[0.95] font-black tracking-[-0.03em] sm:text-[60px]">
          {details.name}
        </h1>
        {details.tagline ? (
          <p className="mt-3 max-w-[52ch] text-[18px] opacity-85">
            {details.tagline}
          </p>
        ) : null}
        <p className="mt-5 text-[22px] font-extrabold" data-testid="countdown">
          {countdownWords(details, now)}
        </p>
        {children}
      </div>
    </header>
  );
}
