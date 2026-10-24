"use client";

import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import type { DayEntry } from "@/domain/conference/agenda";
import { clock } from "@/domain/conference-plans/time";
import { EmptyNote } from "../kit";
import { lookFor } from "./kinds";
import { CalendarExport } from "./CalendarExport";
import { SessionActions } from "./SessionActions";
import { useMySchedule } from "./mySchedule";
import { useNow } from "./useNow";

/**
 * **My Schedule: what you marked, and what you said you're in for.** An
 * enhancement, not a gate — the whole agenda is everyone's and stays one tap
 * away. Saved lines come from this device; plans come from the plans you
 * answered _I'm in_.
 */
export function MyScheduleView({
  conferenceId,
  timeZone,
  serverNow,
  days,
}: {
  conferenceId: string;
  timeZone: string;
  serverNow: string;
  days: readonly {
    readonly ymd: string;
    readonly label: string;
    readonly entries: readonly DayEntry[];
  }[];
}) {
  const now = useNow(serverNow, 60_000);
  const s = useMySchedule(conferenceId);
  const base = `/conferences/${conferenceId}`;
  const mine = days
    .map((d) => ({
      ...d,
      entries: d.entries.filter((e) =>
        e.source === "plan" ? e.mine === "in" : s.isSaved(e.id),
      ),
    }))
    .filter((d) => d.entries.length);

  return (
    <div data-testid="my-schedule">
      <p className="text-cf-slate max-w-[60ch] text-[14px] leading-relaxed">
        Everything on the agenda is for everyone — you don&apos;t need to save
        it to know where to be. Star the ones you don&apos;t want to miss and
        they gather here, with plans you said you&apos;re in for.
      </p>
      <div className="mt-4">
        <CalendarExport conferenceId={conferenceId} mineOnly />
      </div>
      {!mine.length ? (
        <div className="mt-6">
          <EmptyNote
            title="Nothing saved yet."
            action={{ href: `${base}/schedule`, label: "Browse the agenda" }}
          >
            Open any session and tap <strong>Save</strong>. It stays on this
            device.
          </EmptyNote>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {mine.map((d) => (
            <section key={d.ymd}>
              <h2 className="cf-eyebrow text-cf-mist">{d.label}</h2>
              <ul className="mt-3 space-y-3">
                {d.entries.map((e) => {
                  const look = lookFor(e.kind);
                  const past = Date.parse(e.startsAt) < now.getTime();
                  return (
                    <li
                      key={`${e.source}-${e.id}-${e.occurrenceId ?? ""}`}
                      className={`border-cf-line rounded-2xl border bg-white p-4 ${past ? "opacity-60" : ""}`}
                      data-mine={e.id}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-cf-ink w-[64px] shrink-0 pt-0.5 text-[14px] font-semibold tabular-nums">
                          {clock(new Date(e.startsAt), timeZone)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="cf-eyebrow text-cf-mist flex items-center gap-1.5">
                            {e.source === "plan" ? (
                              <>Plan with colleagues · you&apos;re in</>
                            ) : (
                              <>
                                <Star
                                  aria-hidden="true"
                                  className="h-3 w-3"
                                  fill="currentColor"
                                />
                                {look.label}
                              </>
                            )}
                          </p>
                          <p className="cf-serif text-cf-ink mt-1 text-[17px] leading-snug">
                            {e.source === "plan" ? (
                              <Link href={`${base}/plans#plan-${e.id}`}>
                                {e.title}
                              </Link>
                            ) : (
                              <Link href={`${base}/schedule/${e.id}`}>
                                {e.title}
                              </Link>
                            )}
                          </p>
                          <p className="text-cf-slate mt-1 flex items-center gap-1.5 text-[13px]">
                            <MapPin
                              aria-hidden="true"
                              className="h-3.5 w-3.5"
                              strokeWidth={1.8}
                            />
                            {e.where ?? "Location not given"}
                          </p>
                          {e.source === "agenda" ? (
                            <div className="mt-3">
                              <SessionActions
                                conferenceId={conferenceId}
                                id={e.id}
                                kind={e.kind}
                                title={e.title}
                                past={past}
                              />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
