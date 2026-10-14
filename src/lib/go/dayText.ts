import { clockLabel } from "@/domain/day/brief";
import type { DayPlanned } from "@/domain/day/build";
import type { Timeline } from "@/domain/day/timeline";
import { durationLabel } from "@/lib/routing/legs";

/**
 * **The day as plain text**, for a notes app or a message: the one form of
 * "offline" that needs no service worker, no account and no print. It says
 * what the screen says — including what is only about and what nobody
 * published — because text pasted into Notes is read in a car park with no
 * signal and nobody to ask.
 */
export function dayAsText(day: DayPlanned, timeline?: Timeline): string {
  const town = day.brief.town?.name.replace(/,\s*BC$/, "");
  const at = (n: number, about: boolean) =>
    `${about ? "about " : ""}${clockLabel(n)}`;
  // The opening is where a request nothing offered is said first.
  const lines: string[] = [day.title, day.opening, ""];
  if (day.brief.startAt !== undefined)
    lines.push(
      `Leave ${town ? `${town} ` : ""}${day.brief.startsNow ? "now, about " : ""}${clockLabel(day.brief.startAt)}`,
      "",
    );
  day.stops.forEach((stop, i) => {
    const t = timeline?.stops[i];
    lines.push(
      `${i + 1}. ${stop.experience.title}${
        t ? ` — ${at(t.arrive, t.basis === "allowance")}` : ""
      } (about ${durationLabel(stop.minutes)})`,
    );
    if (stop.cost) lines.push(`   ${stop.cost}`);
    if (stop.open) lines.push(`   ${stop.open}`);
    else if (stop.hours) lines.push(`   Published hours: ${stop.hours}`);
    else if (stop.experience.schedule?.onDate?.reading === "conflicting")
      lines.push("   Sources argue about whether it's open — call ahead.");
    else lines.push("   No published hours — check before you go.");
    for (const note of stop.notes) lines.push(`   ${note}`);
    if (stop.rainPlan)
      lines.push(`   If it rains: ${stop.rainPlan.experience.title}`);
  });
  if (timeline?.home && town)
    lines.push(
      "",
      `Home ${at(timeline.home.arrive, true)}${
        timeline.home.basis === "allowance" ? " (roads not measured)" : ""
      }${
        timeline.homeBy !== undefined
          ? ` (you said by ${clockLabel(timeline.homeBy)})`
          : ""
      }`,
    );
  if (day.unknowns.length > 0)
    lines.push(
      "",
      "Check before you go:",
      ...day.unknowns.map((u) => `- ${u}`),
    );
  lines.push("", "Made with Passport — go have a day.");
  return lines.join("\n");
}
