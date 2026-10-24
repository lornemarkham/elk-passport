"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  Clock,
  RefreshCw,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";
import type { Experience } from "@/domain/experience/types";
import type { ItemView } from "@/lib/adventures/store";
import type { StopDetail } from "@/lib/adventures/propose";
import type { ResponseValue } from "@/lib/adventures/rules";
import { isPassportSuggestion } from "@/lib/adventures/days";
import {
  clockLabel,
  minutesLabel,
  responsesLabel,
  weekdayLabel,
} from "@/lib/adventures/present";
import { placeLabel } from "@/domain/discovery/compose";
import { cn } from "@/lib/utils";
import { Picture } from "../Picture";

const ANSWERS: readonly { value: ResponseValue; label: string }[] = [
  { value: "in", label: "I'm in" },
  { value: "maybe", label: "Maybe" },
  { value: "out", label: "Out" },
];

const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth"];

const control =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors disabled:opacity-40";

/**
 * **One stop on a day.** What, where, when, for how long and why — the
 * builder's reason, the publisher's hours and price in their words, Atlas's
 * word on the day where it gives one — and whether it is decided.
 *
 * _Keep · Replace · Move · Remove._ Replace asks for a different stop in
 * words, through the same change box as everything else, so it previews
 * first. Remove sends something a person chose back to the ideas; only a
 * Passport suggestion nobody kept is taken off entirely.
 */
export function StopCard({
  item,
  name,
  experience,
  detail,
  index,
  count,
  onDay,
  otherDays,
  isOwner,
  tone,
  busy,
  act,
  call,
  requestChange,
}: {
  readonly item: ItemView;
  readonly name: string;
  readonly experience: Experience | undefined;
  readonly detail: StopDetail | undefined;
  readonly index: number;
  readonly count: number;
  readonly onDay: string;
  readonly otherDays: readonly string[];
  readonly isOwner: boolean;
  readonly tone: { readonly bg: string; readonly ink: string };
  readonly busy: boolean;
  readonly act: (
    work: () => Promise<unknown>,
    done?: string,
  ) => Promise<boolean>;
  readonly call: <T = unknown>(
    path: string,
    method: string,
    body?: unknown,
  ) => Promise<T>;
  readonly requestChange: (said: string) => void;
}) {
  const path = `/items/${item.id}`;
  const kept = item.status === "confirmed";
  const passport = isPassportSuggestion(item);
  const where = experience ? placeLabel(experience) : undefined;
  const move = (direction: -1 | 1) =>
    act(() => call(`/move`, "POST", { item: item.id, direction }));

  return (
    <article
      data-testid="plan-item"
      data-status={item.status}
      data-origin={item.origin}
      className={cn(
        "relative rounded-3xl border-2 bg-white p-3 sm:p-4",
        kept
          ? "border-[var(--gh-forest)]/35"
          : "border-dashed border-[var(--gh-line)]",
      )}
    >
      <div className="flex gap-3 sm:gap-4">
        <div className="flex w-20 shrink-0 flex-col gap-2 sm:w-40">
          <Picture
            experience={experience}
            fallbackTitle={name}
            tone={tone.bg}
            showLabel={false}
            className="aspect-square w-full rounded-2xl sm:aspect-[4/3]"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-extrabold"
              style={{ background: tone.bg, color: tone.ink }}
              aria-label={`Stop ${index + 1}`}
            >
              {detail?.arrive !== undefined
                ? clockLabel(detail.arrive)
                : index + 1}
            </span>
            {kept ? (
              <span
                data-testid="stop-kept"
                className="inline-flex items-center gap-1 text-xs font-bold text-[var(--gh-forest)]"
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
                Kept
              </span>
            ) : (
              <span
                data-testid="stop-suggested"
                className="inline-flex items-center gap-1 text-xs font-bold text-[var(--gh-ink-soft)]"
              >
                {passport ? (
                  <>
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    Passport&apos;s suggestion
                  </>
                ) : item.mine ? (
                  "Your pick"
                ) : (
                  "Someone's suggestion"
                )}
              </span>
            )}
          </div>

          <h4 className="ghad-display mt-1.5 text-lg leading-tight font-extrabold tracking-[-0.01em] text-[var(--gh-ink)] sm:text-xl">
            {name}
          </h4>
          {where && (
            <p className="text-sm text-[var(--gh-ink-soft)]">{where}</p>
          )}

          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-[var(--gh-ink)]">
            {detail && (
              <li className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                about {minutesLabel(detail.minutes)}
              </li>
            )}
            {detail?.open && (
              <li data-testid="stop-open" className="font-semibold">
                {detail.open}
              </li>
            )}
            {detail?.cost && <li>{detail.cost}</li>}
          </ul>
          {detail?.because && (
            <p
              className="mt-2 text-sm text-[var(--gh-ink-soft)]"
              data-testid="stop-because"
            >
              {detail.because}
            </p>
          )}
          {item.note && (
            <p className="mt-2 text-sm text-[var(--gh-ink-soft)]">
              {item.note}
            </p>
          )}
          {(detail?.hours ||
            (detail?.notes.length ?? 0) > 0 ||
            detail?.rainPlan) && (
            <details className="group mt-2 text-sm">
              <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-[var(--gh-ink)] underline-offset-4 hover:underline">
                Good to know
              </summary>
              <ul className="mt-1 space-y-1 text-[var(--gh-ink-soft)]">
                {detail?.hours && <li>Published hours: {detail.hours}</li>}
                {detail?.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
                {detail?.rainPlan && (
                  <li>If it rains: {detail.rainPlan.title}</li>
                )}
              </ul>
            </details>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {isOwner && !kept && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              act(
                () => call(path, "PATCH", { status: "confirmed" }),
                `Kept ${name}.`,
              )
            }
            className={cn(
              control,
              "bg-[var(--gh-forest)] text-white hover:brightness-110",
            )}
          >
            <Check className="h-4 w-4" aria-hidden />
            Keep
          </button>
        )}
        {isOwner && index < ORDINALS.length && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              requestChange(
                `swap the ${ORDINALS[index]} on ${weekdayLabel(onDay)}`,
              )
            }
            aria-label={`Replace ${name}`}
            className={cn(
              control,
              "border-2 border-[var(--gh-line)] hover:border-[var(--gh-ink)]/40",
            )}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Replace
          </button>
        )}
        {(isOwner || item.canChange) && (
          <details className="relative">
            <summary
              aria-label={`More for ${name}`}
              className={cn(
                control,
                "cursor-pointer list-none border-2 border-[var(--gh-line)] hover:border-[var(--gh-ink)]/40 [&::-webkit-details-marker]:hidden",
              )}
            >
              More
            </summary>
            <div className="absolute left-0 z-20 mt-2 flex w-60 flex-col items-stretch gap-1 rounded-2xl border border-[var(--gh-line)] bg-white p-2 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.45)] [&>*]:justify-start">
              {isOwner && (
                <>
                  <button
                    type="button"
                    disabled={busy || index === 0}
                    onClick={() => move(-1)}
                    aria-label={`Move ${name} earlier`}
                    className={cn(control, "hover:bg-[var(--gh-cream)]")}
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden />
                    Earlier
                  </button>
                  <button
                    type="button"
                    disabled={busy || index === count - 1}
                    onClick={() => move(1)}
                    aria-label={`Move ${name} later`}
                    className={cn(control, "hover:bg-[var(--gh-cream)]")}
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden />
                    Later
                  </button>
                  {otherDays.length > 0 && (
                    <label className="inline-flex items-center">
                      <span className="sr-only">
                        Move {name} to another day
                      </span>
                      <select
                        className="min-h-11 rounded-full border-2 border-[var(--gh-line)] bg-white px-3 text-sm font-semibold"
                        defaultValue=""
                        disabled={busy}
                        onChange={(e) => {
                          const to = e.target.value;
                          if (to)
                            void act(
                              () => call(path, "PATCH", { onDay: to }),
                              `Moved to ${weekdayLabel(to)}.`,
                            );
                        }}
                      >
                        <option value="">Move to…</option>
                        {otherDays.map((d) => (
                          <option key={d} value={d}>
                            {weekdayLabel(d)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </>
              )}
              {item.canChange && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    passport || (!isOwner && item.mine)
                      ? act(() => call(path, "DELETE"), `Removed ${name}.`)
                      : act(
                          () => call(path, "PATCH", { onDay: null }),
                          `${name} is back in the ideas.`,
                        )
                  }
                  aria-label={`Remove ${name}`}
                  className={cn(
                    control,
                    "text-[var(--gh-ink-soft)] hover:bg-[var(--gh-cream)]",
                  )}
                >
                  {passport || (!isOwner && item.mine) ? (
                    <X className="h-4 w-4" aria-hidden />
                  ) : (
                    <Undo2 className="h-4 w-4" aria-hidden />
                  )}
                  {passport || (!isOwner && item.mine)
                    ? "Remove"
                    : "Back to ideas"}
                </button>
              )}
            </div>
          </details>
        )}
      </div>

      <Answers item={item} name={name} busy={busy} act={act} call={call} />
    </article>
  );
}

/**
 * **In / maybe / out** — everyone answers for themselves, on a stop or an
 * idea. Interest, not commitment (`docs/product/shared-adventures.md`).
 */
export function Answers({
  item,
  name,
  busy,
  act,
  call,
}: {
  readonly item: ItemView;
  readonly name: string;
  readonly busy: boolean;
  readonly act: (
    work: () => Promise<unknown>,
    done?: string,
  ) => Promise<boolean>;
  readonly call: <T = unknown>(
    path: string,
    method: string,
    body?: unknown,
  ) => Promise<T>;
}) {
  const counts = responsesLabel(item.responses);
  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label={`Your answer on ${name}`}
    >
      {ANSWERS.map((answer) => {
        const chosen = item.yourResponse === answer.value;
        return (
          <button
            key={answer.value}
            type="button"
            aria-pressed={chosen}
            disabled={busy}
            onClick={() =>
              act(() =>
                call(`/items/${item.id}/response`, "PUT", {
                  response: chosen ? null : answer.value,
                }),
              )
            }
            className={cn(
              control,
              "min-h-10 px-3.5",
              chosen
                ? "bg-[var(--gh-ink)] text-white"
                : "border-2 border-[var(--gh-line)] hover:border-[var(--gh-ink)]/40",
            )}
          >
            {answer.label}
          </button>
        );
      })}
      {counts && (
        <span className="ml-1 text-sm font-semibold text-[var(--gh-ink-soft)]">
          {counts}
        </span>
      )}
    </div>
  );
}
