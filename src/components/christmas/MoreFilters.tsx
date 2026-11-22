import Form from "next/form";
import { SlidersHorizontal } from "lucide-react";
import { SubmitButton } from "@/components/loading/SubmitButton";
import { DEFAULT_KM, HOURS, type Ask } from "@/domain/christmas/discover";
import { THEMES } from "@/domain/christmas/themes";

const field =
  "min-h-12 w-full rounded-2xl border-2 border-black/10 bg-white px-3 text-base focus:border-[#0f3b2b] focus:outline-none";
const label = "block text-sm font-bold text-[var(--gh-ink-soft)]";

/** How many of the optional filters are on, for the closed line. */
export function moreCount(ask: Ask): number {
  return (
    (ask.ages.length ? 1 : 0) +
    (ask.budget === "free" ? 1 : 0) +
    (ask.hours ? 1 : 0) +
    (ask.themes.length > 1 ? 1 : 0) +
    (ask.unplaced ? 1 : 0)
  );
}

/**
 * **More filters** — closed, optional and never asked first (owner brief
 * 2026-11-22: no questionnaire between a family and results). Who is coming
 * and how many belong to Plan My Route, so they are not here. A plain GET
 * form: where, when and how far ride along unchanged.
 */
export function MoreFilters({ ask }: { readonly ask: Ask }) {
  const on = moreCount(ask);
  return (
    <details
      className="group rounded-[24px] bg-white ring-1 ring-black/5"
      data-testid="more-filters"
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-5 py-2 [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal className="h-5 w-5 shrink-0" aria-hidden />
        <span className="flex-1 font-bold">
          More filters
          {on > 0 && (
            <span className="ml-2 rounded-full bg-[#b3242f] px-2 py-0.5 text-xs text-white">
              {on} on
            </span>
          )}
        </span>
        <span className="text-sm font-semibold underline underline-offset-4 group-open:hidden">
          Show
        </span>
      </summary>
      <Form
        action="/christmas/discover"
        className="grid gap-4 border-t border-black/5 p-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        {ask.at && <input type="hidden" name="at" value={ask.at} />}
        {ask.km !== DEFAULT_KM && (
          <input type="hidden" name="km" value={ask.km} />
        )}
        {ask.when ? (
          <input type="hidden" name="when" value={ask.when} />
        ) : (
          <>
            {ask.from && <input type="hidden" name="from" value={ask.from} />}
            {ask.to && <input type="hidden" name="to" value={ask.to} />}
          </>
        )}
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
            We check the youngest child&apos;s age against the organiser&apos;s
            own rules.
          </span>
        </label>
        <label className="space-y-1">
          <span className={label}>Price</span>
          <select name="budget" defaultValue={ask.budget} className={field}>
            <option value="any">Any</option>
            <option value="free">Stated free or by donation</option>
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
        <fieldset className="sm:col-span-2 lg:col-span-3">
          <legend className={label}>
            Combine categories{" "}
            <span className="font-normal">
              — tick more than one to see them together
            </span>
          </legend>
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
                  className="h-4 w-4 accent-white"
                />
                <span aria-hidden>{t.emoji}</span> {t.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-start gap-3 sm:col-span-2">
          <input
            type="checkbox"
            name="place"
            value="all"
            defaultChecked={ask.unplaced}
            className="mt-1 h-5 w-5"
            data-testid="show-unplaced"
          />
          <span className="text-base">
            <span className="font-bold">
              Show listings with no confirmed location
            </span>
            <span className="block text-sm text-[var(--gh-ink-soft)]">
              Kept on their own shelf — they could be anywhere, so they are
              never counted as near.
            </span>
          </span>
        </label>
        <SubmitButton
          pending="Finding…"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#0f3b2b] px-6 text-base font-bold text-white hover:brightness-110"
          data-testid="more-submit"
        >
          Apply
        </SubmitButton>
      </Form>
    </details>
  );
}
