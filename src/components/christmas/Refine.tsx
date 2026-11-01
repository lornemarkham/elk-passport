import { SlidersHorizontal } from "lucide-react";
import { TOWN_GROUPS, townById } from "@/domain/discovery/towns";
import {
  DEFAULT_KM,
  DISTANCES,
  HOURS,
  type Ask,
} from "@/domain/christmas/discover";
import { THEMES } from "@/domain/christmas/themes";

const field =
  "min-h-12 w-full rounded-2xl border-2 border-black/10 bg-white px-3 text-base focus:border-[#0f3b2b] focus:outline-none";
const label = "block text-sm font-bold text-[var(--gh-ink-soft)]";

/** What the form says it already knows, in one line. */
export function askSummary(ask: Ask): string {
  const town = townById(ask.at);
  const bits = [
    town ? `${ask.km} km of ${town.name.replace(/,\s*BC$/, "")}` : "Anywhere",
    ask.from
      ? ask.to && ask.to !== ask.from
        ? `${ask.from} → ${ask.to}`
        : ask.from
      : "any dates",
    ask.party
      ? `${ask.people ? `${ask.people} · ` : ""}${ask.party}`
      : ask.people
        ? `${ask.people} people`
        : "",
    ask.ages.length ? `ages ${ask.ages.join(", ")}` : "",
    ask.budget === "free" ? "free or by donation" : "",
    ask.hours ? `${ask.hours === 8 ? "all day" : `${ask.hours}h`}` : "",
  ];
  return bits.filter(Boolean).join(" · ");
}

/**
 * **Refine** — everything a family may tell Passport, and none of it asked
 * first (doctrine §4: constraints are progressive). A plain GET form, so it
 * works before the page's script arrives and every answer is a shareable
 * URL. Closed by default on a phone; one line says what is already set.
 */
export function Refine({
  ask,
  open = false,
}: {
  readonly ask: Ask;
  readonly open?: boolean;
}) {
  return (
    <details
      open={open}
      className="group rounded-[24px] bg-white ring-1 ring-black/5"
      data-testid="refine"
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal className="h-5 w-5 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Refine</span>
          <span className="block truncate text-sm text-[var(--gh-ink-soft)]">
            {askSummary(ask)}
          </span>
        </span>
        <span className="text-sm font-semibold underline underline-offset-4 group-open:hidden">
          Change
        </span>
      </summary>
      <form
        method="get"
        action="/christmas/discover"
        className="grid gap-4 border-t border-black/5 p-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        <label className="space-y-1">
          <span className={label}>Where are you?</span>
          <select name="at" defaultValue={ask.at ?? ""} className={field}>
            <option value="">Anywhere</option>
            {TOWN_GROUPS.map((g) => (
              <optgroup key={g.area} label={g.area}>
                {g.towns.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name.replace(/,\s*BC$/, "")}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className={label}>How far will you go?</span>
          <select
            name="km"
            defaultValue={String(ask.km ?? DEFAULT_KM)}
            className={field}
          >
            {DISTANCES.map((km) => (
              <option key={km} value={km}>
                Within {km} km
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className={label}>From</span>
            <input
              type="date"
              name="from"
              defaultValue={ask.from}
              className={field}
            />
          </label>
          <label className="space-y-1">
            <span className={label}>To</span>
            <input
              type="date"
              name="to"
              defaultValue={ask.to}
              className={field}
            />
          </label>
        </div>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <label className="space-y-1">
            <span className={label}>Who&apos;s coming?</span>
            <select name="who" defaultValue={ask.party ?? ""} className={field}>
              <option value="">Not saying</option>
              <option value="family">Family with kids</option>
              <option value="friends">Friends</option>
              <option value="couple">The two of us</option>
              <option value="solo">Just me</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className={label}>How many</span>
            <input
              type="number"
              name="n"
              min={1}
              max={40}
              inputMode="numeric"
              defaultValue={ask.people}
              className={field}
            />
          </label>
        </div>
        <label className="space-y-1">
          <span className={label}>Children&apos;s ages</span>
          <input
            type="text"
            name="ages"
            inputMode="numeric"
            placeholder="e.g. 4, 9"
            defaultValue={ask.ages.join(", ")}
            className={field}
            pattern="^[0-9 ,]*$"
          />
          <span className="block text-xs text-[var(--gh-ink-soft)]">
            Atlas is asked about the youngest.
          </span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className={label}>Budget</span>
            <select name="budget" defaultValue={ask.budget} className={field}>
              <option value="any">Any</option>
              <option value="free">Free or by donation</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className={label}>Time you have</span>
            <select
              name="hours"
              defaultValue={ask.hours ? String(ask.hours) : ""}
              className={field}
            >
              <option value="">Any</option>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {h === 8
                    ? "All day"
                    : h === 4
                      ? "Half a day"
                      : `${h} hour${h > 1 ? "s" : ""}`}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="sm:col-span-2 lg:col-span-3">
          <legend className={label}>What you&apos;re into</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {THEMES.map((t) => (
              <label
                key={t.id}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 border-black/10 px-4 text-sm font-semibold has-[:checked]:border-[#b3242f] has-[:checked]:bg-[#b3242f] has-[:checked]:text-white"
              >
                <input
                  type="checkbox"
                  name="theme"
                  value={t.id}
                  defaultChecked={ask.themes.includes(t.id)}
                  className="sr-only"
                />
                <span aria-hidden>{t.emoji}</span> {t.label}
              </label>
            ))}
          </div>
        </fieldset>
        <p className="text-sm text-[var(--gh-ink-soft)] sm:col-span-2 lg:col-span-2">
          Prices show only where the organiser states them, so &ldquo;free or by
          donation&rdquo; keeps just what&apos;s stated that way for everybody.
          Unknown is never treated as no.
        </p>
        <button
          type="submit"
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#0f3b2b] px-6 text-base font-bold text-white hover:brightness-110"
          data-testid="refine-submit"
        >
          Show me
        </button>
      </form>
    </details>
  );
}
