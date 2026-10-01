import Link from "next/link";
import type { OctoberPlace } from "@/domain/environment/places";
import { daylightAt, type LightPhase } from "@/domain/environment/daylight";
import type { Environment } from "@/domain/environment/types";
import type { TemporalContext } from "@/domain/october/temporal";
import { SIMULATED_SOURCE } from "@/lib/environment/scenario";

/**
 * **Where October is standing, and what it can see from there.**
 *
 * The thing that was missing. A person who chose Kelowna had no way to tell
 * whether the page was thinking about Kelowna, Vernon or the whole valley —
 * and when the answer to "is the product using my area" is *squint at the
 * results and guess*, the area is not a product feature.
 *
 * So the place is stated, at the top, in the largest environmental type on the
 * page, with the way to change it immediately beside it. Underneath: the day,
 * when it gets dark, and what the sky is doing. Four facts in one line, not
 * four widgets.
 */
export function RightNow({
  area,
  environment,
  now,
  when,
  phase,
  simulated,
}: {
  readonly area: OctoberPlace | undefined;
  readonly environment: Environment | undefined;
  readonly now: Date;
  readonly when: TemporalContext;
  readonly phase: LightPhase | undefined;
  /** Dev scenario label. Present only on a developer's own machine. */
  readonly simulated?: string;
}) {
  if (!area) {
    return (
      <div
        data-testid="right-now-unset"
        className="rounded-xl border border-dashed border-[#e9e6da]/15 px-4 py-3"
      >
        <p className="text-sm text-[#e9e6da]/60">
          {when.headline ? (
            <span className="font-medium text-[#f3efe4]">{when.headline} </span>
          ) : null}
          October does not know where you are yet.
        </p>
        <Link
          href="/october/area"
          className="mt-1 inline-flex min-h-11 items-center text-sm text-[#d09a4e] underline-offset-4 hover:underline"
        >
          Choose your October area →
        </Link>
      </div>
    );
  }

  const town = area.name.replace(/,\s*BC$/i, "");
  const light = daylightAt(area.latitude, area.longitude, now);
  const darkAt = light
    ? light.sunset
        .toLocaleTimeString("en-CA", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: "America/Vancouver",
        })
        .replace(/\s?([ap])\.?m\.?/i, (_, p: string) => ` ${p.toUpperCase()}M`)
    : undefined;

  // The sky, for the hours that matter from where we are in the day.
  const tonight = environment?.nights.find((n) => n.day === when.day);
  const sky = tonight
    ? tonight.sky === "precipitating"
      ? "Rain tonight"
      : tonight.sky === "clear" || tonight.sky === "mainly-clear"
        ? "Clear tonight"
        : tonight.sky === "unknown"
          ? undefined
          : "Cloudy tonight"
    : undefined;

  const nowTemp = nearestHourTemp(environment, now);
  const partOfDay =
    phase === "night" ? "night" : phase === "dusk" ? "evening" : "afternoon";

  return (
    <div data-testid="right-now">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p
          data-testid="right-now-place"
          className="font-heading text-xl tracking-tight text-[#f3efe4]"
        >
          {town}
        </p>
        <Link
          href="/october/area"
          data-testid="change-area"
          className="min-h-11 text-xs text-[#d09a4e]/80 underline-offset-4 hover:underline"
        >
          change
        </Link>
      </div>

      <p
        data-testid="right-now-facts"
        className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-sm text-[#e9e6da]/55"
      >
        <span>
          {when.weekday} {partOfDay}
        </span>
        {nowTemp !== undefined ? (
          <span className="text-[#e9e6da]/40">· {nowTemp}°C now</span>
        ) : null}
        {darkAt ? (
          <span className="text-[#e9e6da]/40">· dark at {darkAt}</span>
        ) : null}
        {sky ? <span className="text-[#d09a4e]">· {sky}</span> : null}
      </p>

      {when.headline ? (
        <p
          data-testid="temporal"
          className="mt-1.5 text-sm font-medium text-[#f3efe4]"
        >
          {when.headline}
        </p>
      ) : null}

      {/* Attribution, and — on a developer's machine — the loud warning that
          none of this is real. */}
      {environment ? (
        <p
          data-testid="environment-source"
          className={`mt-1 text-[11px] ${
            environment.provenance.source === SIMULATED_SOURCE
              ? "font-medium tracking-wider text-[#ff6b6b] uppercase"
              : "text-[#e9e6da]/25"
          }`}
        >
          {environment.provenance.source}
          {simulated ? ` · ${simulated}` : ""}
        </p>
      ) : null}
    </div>
  );
}

/** The temperature for the hour we are actually in, where hourly reaches it. */
function nearestHourTemp(
  environment: Environment | undefined,
  now: Date,
): number | undefined {
  if (!environment) return undefined;
  let best: number | undefined;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const hour of environment.hourly) {
    if (hour.temperatureC === undefined) continue;
    const gap = Math.abs(Date.parse(hour.at) - now.getTime());
    // Only if it is genuinely about now — an hour either side, no more.
    if (gap < bestGap && gap <= 3_600_000) {
      bestGap = gap;
      best = hour.temperatureC;
    }
  }
  return best === undefined ? undefined : Math.round(best);
}
