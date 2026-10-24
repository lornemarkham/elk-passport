import type {
  ArrivalsDigest,
  DigestEntry,
} from "@/domain/conference-arrivals/digest";
import { clock, dayWords } from "@/domain/conference-plans/time";
import { Avatar } from "@/components/conference/kit";

const HOUR = 3_600_000;

const tag = (e: DigestEntry) =>
  e.kind === "landed"
    ? e.inferred
      ? "landed?"
      : "landed"
    : e.kind === "estimated"
      ? "estimate"
      : "scheduled";

/**
 * **When everyone lands, as a line across the day.** One track per day,
 * each person at the minute the board's own time says — scheduled, estimate
 * or landed, labelled as which — and a mark for now. Times nobody shared
 * are listed beside the track, never placed on it.
 */
export function ArrivalsTimeline({
  timeline,
  timeZone,
  now,
  airport,
}: {
  timeline: ArrivalsDigest["timeline"];
  timeZone: string;
  now: Date;
  airport: string;
}) {
  if (!timeline.length) return null;
  return (
    <ol className="space-y-8" data-testid="arrival-timeline">
      {timeline.map((t) => {
        const timed = t.entries.filter((e) => e.at);
        const untimed = t.entries.filter((e) => !e.at);
        const times = timed.map((e) => Date.parse(e.at!));
        const from = times.length
          ? Math.floor(Math.min(...times) / HOUR) * HOUR - HOUR
          : 0;
        const to = times.length
          ? Math.max(
              Math.ceil(Math.max(...times) / HOUR) * HOUR + HOUR,
              from + 6 * HOUR,
            )
          : 0;
        const pos = (ms: number) => ((ms - from) / (to - from)) * 100;
        const ticks: number[] = [];
        const step = to - from > 12 * HOUR ? 3 * HOUR : 2 * HOUR;
        for (let h = from; h <= to; h += step) ticks.push(h);
        const nowIn = now.getTime() >= from && now.getTime() <= to;
        return (
          <li key={t.day}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="cf-serif text-cf-ink text-[18px]">
                {dayWords(new Date(`${t.day}T20:00:00Z`), timeZone, now)}
              </p>
              <p className="text-cf-mist text-[12px]">
                {t.entries.length}{" "}
                {t.entries.length === 1 ? "arrival" : "arrivals"} at {airport}
              </p>
            </div>
            {timed.length ? (
              <div className="relative mx-4 mt-4 h-[120px] select-none">
                <div className="bg-cf-line absolute inset-x-0 top-[58px] h-px" />
                {ticks.map((h) => (
                  <span
                    key={h}
                    className="text-cf-mist absolute top-[100px] -translate-x-1/2 text-[11px] tabular-nums"
                    style={{ left: `${pos(h)}%` }}
                  >
                    {clock(new Date(h), timeZone).replace(":00", "")}
                  </span>
                ))}
                {nowIn ? (
                  <span
                    className="bg-cf-sage absolute top-[34px] h-[48px] w-px"
                    style={{ left: `${pos(now.getTime())}%` }}
                    aria-label={`Now, ${clock(now, timeZone)}`}
                  >
                    <span className="cf-eyebrow text-cf-sage absolute -top-4 -translate-x-1/2">
                      Now
                    </span>
                  </span>
                ) : null}
                {timed.map((e, i) => {
                  const up = i % 2 === 0;
                  const left = pos(Date.parse(e.at!));
                  const who = e.you ? "You" : e.name;
                  return (
                    <div
                      key={e.memberId}
                      className="absolute top-0 h-full -translate-x-1/2"
                      style={{ left: `${left}%` }}
                      title={`${who} · ${e.flight} · ${tag(e)}`}
                    >
                      <span className="absolute top-[45px] left-1/2 -translate-x-1/2">
                        <Avatar name={who} you={e.you} size={26} ring />
                      </span>
                      <span
                        className={`text-cf-slate absolute left-1/2 -translate-x-1/2 text-[11px] whitespace-nowrap ${up ? "top-[18px]" : "top-[76px]"}`}
                      >
                        <span className="text-cf-ink font-semibold">
                          {e.you ? "You" : e.name.split(" ")[0]}
                        </span>{" "}
                        {e.kind === "estimated" ? "~" : ""}
                        {clock(new Date(e.at!), timeZone)}
                      </span>
                      <span className="sr-only">
                        {e.name}, {e.flight}, {tag(e)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : null}
            {untimed.length ? (
              <p className="text-cf-mist mt-2 text-[13px]">
                Also arriving, time not shared:{" "}
                {untimed.map((e) => (e.you ? "you" : e.name)).join(", ")}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
