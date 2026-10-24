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
              <ul className="mt-3 sm:hidden" data-testid="arrival-list-phone">
                {timed.map((e, i) => {
                  const at = Date.parse(e.at!);
                  const prev = i ? Date.parse(timed[i - 1]!.at!) : -Infinity;
                  const nowHere =
                    nowIn && now.getTime() > prev && now.getTime() <= at;
                  const who = e.you ? "You" : e.name;
                  return (
                    <li key={e.memberId}>
                      {nowHere ? (
                        <NowRule label={clock(now, timeZone)} />
                      ) : null}
                      <div className="flex min-h-12 items-center gap-3 py-1.5">
                        <span className="text-cf-ink w-[68px] shrink-0 text-[13px] font-semibold whitespace-nowrap tabular-nums">
                          {e.kind === "estimated" ? "~" : ""}
                          {clock(new Date(e.at!), timeZone)}
                        </span>
                        <Avatar name={who} you={e.you} size={28} />
                        <span className="min-w-0 flex-1">
                          <span className="text-cf-ink block truncate text-[14px] font-semibold">
                            {who}
                          </span>
                          <span className="text-cf-mist block truncate text-[12px]">
                            {e.flight}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 text-[11px] font-semibold ${
                            e.kind === "landed"
                              ? "text-cf-sage"
                              : e.kind === "estimated"
                                ? "text-[#a8741a]"
                                : "text-cf-mist"
                          }`}
                        >
                          {tag(e)}
                        </span>
                      </div>
                    </li>
                  );
                })}
                {nowIn && now.getTime() > Date.parse(timed.at(-1)!.at!) ? (
                  <li>
                    <NowRule label={clock(now, timeZone)} />
                  </li>
                ) : null}
              </ul>
            ) : null}
            {timed.length ? (
              <div className="relative mx-4 mt-4 hidden h-[120px] select-none sm:block">
                <div className="bg-cf-line absolute inset-x-0 top-[58px] h-px" />
                {ticks.map((h) => (
                  <span
                    key={h}
                    className="text-cf-mist absolute top-[100px] -translate-x-1/2 text-[11px] whitespace-nowrap tabular-nums"
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
                        {e.name}, {e.flight} ({tag(e)})
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

/** "Now" across the phone's list, between the last time passed and the next. */
function NowRule({ label }: { label: string }) {
  return (
    <div
      className="text-cf-sage flex items-center gap-2 py-1"
      aria-label={`Now, ${label}`}
    >
      <span className="cf-eyebrow">Now</span>
      <span className="bg-cf-sage h-px flex-1" />
      <span className="text-[11px] font-semibold tabular-nums">{label}</span>
    </div>
  );
}
