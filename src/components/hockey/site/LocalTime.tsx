"use client";

import { useSyncExternalStore } from "react";

type Kind = "time" | "day" | "dayTime";

const OPTIONS: Record<Kind, Intl.DateTimeFormatOptions> = {
  time: { hour: "numeric", minute: "2-digit" },
  day: { weekday: "short", month: "short", day: "numeric" },
  dayTime: {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  },
};

function format(iso: string, kind: Kind, timeZone?: string) {
  return new Intl.DateTimeFormat("en-CA", {
    ...OPTIONS[kind],
    ...(timeZone ? { timeZone } : {}),
    ...(kind !== "day" ? { timeZoneName: "short" } : {}),
  }).format(new Date(iso));
}

const noop = () => () => {};

/**
 * A puck drop in the reader's own time. The server can't know where the
 * reader is, so it writes Eastern — the league's own clock, labelled — and
 * the browser rewrites it in local time once it's on screen.
 */
export function LocalTime({
  iso,
  kind = "time",
  className,
}: {
  iso: string;
  kind?: Kind;
  className?: string;
}) {
  // false while rendering on the server and hydrating; true after.
  const local = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const text = local ? format(iso, kind) : format(iso, kind, "America/Toronto");
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}
