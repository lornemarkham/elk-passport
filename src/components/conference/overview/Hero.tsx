import Link from "next/link";
import type { ReactNode } from "react";
import { countdown, dateRange } from "@/domain/conference/countdown";
import { KIND_WORDS } from "@/domain/conference/details";
import type { ConferenceSummary } from "@/domain/conference/contracts";
import { Eyebrow, Pill } from "../kit";

/** "Begins in 3 days" · "Day 2 of 3" · "Concluded", from where the conference is. */
export function statusWords(c: ConferenceSummary, now: Date) {
  const cd = countdown(c, now);
  const total =
    (Date.parse(`${c.endsOn ?? c.startsOn}T00:00:00Z`) -
      Date.parse(`${c.startsOn}T00:00:00Z`)) /
      86_400_000 +
    1;
  if (cd.phase === "before")
    return {
      tone: "neutral" as const,
      label: cd.days === 1 ? "Begins tomorrow" : `Begins in ${cd.days} days`,
    };
  if (cd.phase === "during")
    return {
      tone: "live" as const,
      label:
        total > 1
          ? `Day ${cd.day} of ${total} · Under way`
          : "Today · Under way",
    };
  return { tone: "quiet" as const, label: "Concluded" };
}

/**
 * **The conference, introduced.** Its name exactly as the organiser typed it
 * (a conference called "test" is called "test"), its own line of welcome,
 * and four facts in a row: when, where, the venue, and how many are in it.
 * The organiser's colour is the hairline under the name — not a banner.
 * What isn't known yet says so, and an organiser gets the link to fix it.
 */
export function OverviewHero({
  c,
  now,
  participants,
  organiser,
  aside,
}: {
  c: ConferenceSummary;
  now: Date;
  participants: number;
  organiser: boolean;
  aside?: ReactNode;
}) {
  const status = statusWords(c, now);
  const words = KIND_WORDS[c.kind];
  const admin = `/conferences/${c.id}/admin`;
  const facts: { k: string; v: ReactNode; testid: string }[] = [
    { k: "Dates", v: dateRange(c), testid: "fact-dates" },
    { k: "City", v: c.place.label, testid: "fact-city" },
    {
      k: "Venue",
      v: c.venue ? (
        <>
          {c.venue.name}
          {c.venue.address ? (
            <span className="text-cf-mist hidden text-[13px] font-normal sm:block">
              {c.venue.address}
            </span>
          ) : null}
        </>
      ) : organiser ? (
        <Link
          href={`${admin}#details`}
          className="text-cf-slate underline underline-offset-4"
        >
          Add the venue
        </Link>
      ) : (
        <span className="text-cf-mist">To be announced</span>
      ),
      testid: "fact-venue",
    },
    {
      k: participants === 1 ? "Participant" : "Participants",
      v: participants,
      testid: "fact-participants",
    },
  ];

  return (
    <header className="border-cf-line border-b bg-[linear-gradient(180deg,#fbfaf7_0%,#f7f5f0_100%)]">
      <div className="mx-auto grid max-w-[1180px] gap-5 px-4 pt-5 pb-6 sm:gap-10 sm:px-8 sm:pt-14 sm:pb-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-end lg:gap-14">
        <div className="cf-rise min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Eyebrow>{words.noun}</Eyebrow>
            <Pill
              tone={status.tone}
              dot={status.tone === "live"}
              data-testid="countdown"
            >
              {status.label}
            </Pill>
          </div>
          <h1
            className="cf-display text-cf-ink mt-3 text-[32px] leading-[1.02] break-words sm:mt-4 sm:text-[64px] sm:leading-[0.98]"
            data-testid="conference-name"
          >
            {c.name}
          </h1>
          <span
            aria-hidden="true"
            className="mt-3 block h-[2px] w-12 rounded-full sm:mt-6 sm:w-14"
            style={{ background: c.branding.accent }}
          />
          {c.tagline ? (
            <p className="text-cf-slate mt-3 max-w-[52ch] text-[15px] leading-relaxed sm:mt-5 sm:text-[18px]">
              {c.tagline}
            </p>
          ) : null}
          <dl className="border-cf-line mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 sm:mt-8 sm:grid-cols-4 sm:gap-x-6 sm:gap-y-5 sm:pt-6">
            {facts.map((f) => (
              <div key={f.k} className="min-w-0" data-testid={f.testid}>
                <dt className="cf-eyebrow text-cf-mist">{f.k}</dt>
                <dd className="text-cf-ink mt-1 text-[14px] leading-snug font-semibold sm:mt-1.5 sm:text-[15px]">
                  {f.v}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        {aside ? (
          <div className="cf-rise min-w-0 [animation-delay:80ms]">{aside}</div>
        ) : null}
      </div>
    </header>
  );
}
