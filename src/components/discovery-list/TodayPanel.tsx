"use client";

import { CloudRain, Sun, Users } from "lucide-react";
import type { Experience } from "@/domain/experience/types";
import {
  answerFor,
  childEvidence,
  shelterOf,
  type Company,
  type DayWeather,
  type Situation,
  type Window,
} from "@/domain/discovery/situation";

/**
 * **Where a person brings a situation instead of a search query.**
 *
 * The scenario Discovery failed:
 *
 * > *I've got my five-year-old niece for about seven hours. It's pissing rain.
 * > What the hell should we do?*
 *
 * Nothing there is searchable. Every control Discovery offered — a search box,
 * intent chips, type filters — asked *what are you looking for* when the
 * honest answer is *I have no idea, that's why I'm here*.
 *
 * ## What each side says
 *
 * Passport states what it can know and the person should never type: the day,
 * and the real forecast — Environment Canada hourly, with its source named.
 * The person states the two things Passport cannot know: **who is with them**
 * and **how long they have**. Two taps, no questionnaire, and everything else
 * — budget, driving tolerance, interests — stays unknown until a reaction
 * teaches it.
 *
 * ## Why the answer is small, and sometimes an admission
 *
 * Measured on the live corpus: 81 subjects carry evidence a child could do
 * something there, and **71 of them are plainly outdoor**. Exactly ten say
 * anything that is not. So on a wet day the truthful answer to this scenario
 * is mostly *Atlas does not know* — and this panel says that, rather than
 * recommending a playground in a downpour and letting somebody drive to it.
 *
 * That admission is the product working. A confident shortlist built on
 * nothing would be the fabricated intelligence the doctrine forbids.
 */
export function TodayPanel({
  today,
  weather,
  experiences,
  situation,
  onSituation,
}: {
  /** Written out, e.g. `Saturday, October 11`. */
  readonly today: string;
  /** The real forecast, or nothing when Passport could not get one. */
  readonly weather?: DayWeather & { readonly area?: string };
  /** The pool the answer is drawn from — already scoped and feed-filtered. */
  readonly experiences: readonly Experience[];
  readonly situation: Situation;
  readonly onSituation: (next: Situation) => void;
}) {
  const answer = answerFor(experiences, situation, { wet: weather?.wet });
  const asked = Boolean(situation.company);

  return (
    <section
      data-testid="today-panel"
      className="rounded-2xl border border-[#8a5a24]/20 bg-[#f7ecd3]/50 p-5"
    >
      {/* What Passport already knows, said once and never asked for. */}
      <p
        data-testid="today-known"
        className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium tracking-wide text-[#8a5a24] uppercase"
      >
        <span>{today}</span>
        {weather && (
          <>
            <span aria-hidden className="text-[#8a5a24]/40">
              ·
            </span>
            <span className="inline-flex items-center gap-1">
              {weather.wet ? (
                <CloudRain className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Sun className="h-3.5 w-3.5" aria-hidden />
              )}
              {weather.description ?? (weather.wet ? "Rain expected" : "Dry")}
              {weather.area ? ` in ${weather.area}` : ""}
            </span>
          </>
        )}
      </p>

      <h2 className="font-heading mt-2 text-xl text-[#2b2015] sm:text-2xl">
        Who&apos;s with you today?
      </h2>
      <p className="mt-1 text-sm text-[#2b2015]/55">
        Two taps. Passport already knows the date and the sky.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <Choice
          label="Who"
          icon={Users}
          options={COMPANY}
          selected={situation.company}
          onPick={(value) =>
            onSituation({
              ...situation,
              company: value === situation.company ? undefined : value,
            })
          }
        />
        {asked && (
          <Choice
            label="How long"
            options={WINDOW}
            selected={situation.window}
            onPick={(value) =>
              onSituation({
                ...situation,
                window: value === situation.window ? undefined : value,
              })
            }
          />
        )}
      </div>

      {asked && (
        <Answer answer={answer} situation={situation} weather={weather} />
      )}
    </section>
  );
}

const COMPANY: readonly { value: Company; label: string }[] = [
  { value: "alone", label: "Just me" },
  { value: "child", label: "With a young child" },
  { value: "group", label: "With friends" },
];

const WINDOW: readonly { value: Window; label: string }[] = [
  { value: "an-hour", label: "An hour or so" },
  { value: "half-day", label: "Half a day" },
  { value: "all-day", label: "The whole day" },
];

function Choice<T extends string>({
  label,
  icon: Icon,
  options,
  selected,
  onPick,
}: {
  readonly label: string;
  readonly icon?: typeof Users;
  readonly options: readonly { value: T; label: string }[];
  readonly selected?: T;
  readonly onPick: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex min-w-[4.5rem] items-center gap-1.5 text-xs font-medium text-[#2b2015]/45">
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
        {label}
      </span>
      {options.map((option) => {
        const on = selected === option.value;
        return (
          <button
            key={option.value}
            type="button"
            data-testid={`situation-${option.value}`}
            aria-pressed={on}
            onClick={() => onPick(option.value)}
            className={
              on
                ? "inline-flex min-h-11 items-center rounded-full bg-[#2b2015] px-4 text-sm font-medium text-[#f7ecd3]"
                : "inline-flex min-h-11 items-center rounded-full border border-[#8a5a24]/25 px-4 text-sm font-medium text-[#2b2015]/75 transition-colors hover:border-[#8a5a24]/55 hover:text-[#2b2015]"
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * What Passport can say — and, more often, what it cannot.
 *
 * Three honest outcomes, and only the first is a recommendation:
 *
 * 1. evidence exists and the weather does not argue with it;
 * 2. evidence exists but every bit of it is outdoor and it is raining;
 * 3. Atlas holds nothing for this situation at all.
 */
function Answer({
  answer,
  situation,
  weather,
}: {
  readonly answer: ReturnType<typeof answerFor>;
  readonly situation: Situation;
  readonly weather?: DayWeather;
}) {
  if (situation.company !== "child") {
    return (
      <p
        data-testid="today-answer"
        className="mt-5 border-t border-[#8a5a24]/15 pt-4 text-sm text-[#2b2015]/60"
      >
        Passport cannot narrow this down yet — Atlas states what a place offers,
        and almost nothing about who it suits. Everything below is the full list
        for today.
      </p>
    );
  }

  const { matches, weatherAgainst } = answer;
  const sheltered = matches.filter((e) => shelterOf(e) !== "outdoor");
  const allOutdoor = matches.length > 0 && weatherAgainst === matches.length;
  // Wet: lead with what the weather does not already argue against, and offer
  // nothing at all when every option is one the rain rules out.
  const shortlist = weather?.wet ? sheltered : matches;

  return (
    <div
      data-testid="today-answer"
      className="mt-5 border-t border-[#8a5a24]/15 pt-4"
    >
      {matches.length === 0 ? (
        <p className="text-sm text-[#2b2015]/60">
          Atlas does not yet know what any of these places offer a young child.
          Nothing below is filtered for her — it is the ordinary list.
        </p>
      ) : (
        <>
          <p className="text-sm text-[#2b2015]">
            <strong className="font-semibold">{matches.length}</strong> places
            say what a child could actually do there.
          </p>

          {weather?.wet && (
            <p
              data-testid="today-weather-caveat"
              className="mt-2 text-sm text-[#2b2015]/70"
            >
              {allOutdoor ? (
                <>
                  Every one of them is outdoors, and rain is forecast.{" "}
                  <strong className="font-semibold">
                    Passport cannot tell you which places near you are indoors
                  </strong>{" "}
                  — Atlas does not record that yet, so it is not going to guess
                  and send you out in it.
                </>
              ) : (
                <>
                  {weatherAgainst} of them are outdoors and rain is forecast.
                  Passport does not know whether the other {sheltered.length}{" "}
                  are under cover.
                </>
              )}
            </p>
          )}

          {/* **The list must agree with the caveat above it.**
              The first version printed the caveat and then led with six
              outdoor parks — swimming, picnic areas, a playground — on a
              showery afternoon. Saying "these are all outdoors and it is
              raining" and then recommending them anyway is worse than either
              half alone. When the day is wet, the ones Atlas has not called
              outdoor come first; when every one of them is outdoor, there is
              nothing honest to put here at all. */}
          {shortlist.length > 0 && (
            <>
              {/* **Labelled for what it is.** On a wet day these are not
                  recommendations — Atlas states no indoor/outdoor fact, so
                  the honest claim is only that the rain does not already rule
                  them out. A tennis court is obviously outside; Passport is
                  not going to pretend it knows that, and is not going to
                  pretend it does not matter either. */}
              <p className="mt-3 text-xs font-medium tracking-wide text-[#2b2015]/45 uppercase">
                {weather?.wet
                  ? "Not ruled out by the rain — Passport cannot tell which are under cover"
                  : "What she could do there"}
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {shortlist.slice(0, 6).map((experience) => (
                  <li
                    key={experience.id}
                    data-testid="today-suggestion"
                    className="rounded-lg border border-[#8a5a24]/20 bg-white/40 px-3 py-2 text-xs"
                  >
                    <span className="font-medium text-[#2b2015]">
                      {experience.title}
                    </span>
                    <span className="block text-[#2b2015]/55">
                      {childEvidence(experience).join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
