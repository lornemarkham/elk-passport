"use client";

import { CloudRain, LoaderCircle, MapPin, Sun, Users } from "lucide-react";
import type { Experience } from "@/domain/experience/types";
import {
  answerFor,
  directionsFor,
  directionsWanted,
  distinctDirections,
  type Company,
  type DayWeather,
  type PlaceContext,
  type Point,
  type Situation,
  type Window,
} from "@/domain/discovery/situation";
import {
  rainBecause,
  rainLine,
  splitByRain,
  standsUpToRain,
} from "@/domain/discovery/environment";
import {
  ageBecause,
  ageLine,
  excludesAge,
  needsAdult,
  splitByAge,
} from "@/domain/discovery/suitability";
import {
  distanceLabel,
  distanceTo,
  nearestFirst,
  NEAR_KM,
} from "@/domain/discovery/proximity";
import { placeLabel } from "@/domain/discovery/compose";

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
 *
 * ## Whose weather it is
 *
 * It said "Vernon" because the corpus is about Vernon, which is a fact about
 * Atlas and not about the reader. So the area is now labelled for what it is —
 * *the Vernon area*, a default — and a person can replace it with their own by
 * tapping once. Nothing is claimed about where they are until they do, and
 * nothing is remembered after they leave. See `useHere` for the full path a
 * position takes.
 */
export function TodayPanel({
  today,
  weather,
  experiences,
  situation,
  onSituation,
  place,
  origin,
  withinLabel,
  childAge,
  onChildAge,
  ask,
}: {
  /** Written out, e.g. `Saturday, October 11`. */
  readonly today: string;
  /**
   * The forecast to state — the reader's own once they have shared where they
   * are, the corpus's area until then. Resolved by the surface, which also
   * owns `place`, because the page outside this panel now answers to the same
   * position.
   */
  readonly weather?: DayWeather & { readonly area?: string };
  readonly place: PlaceContext;
  /**
   * The category chosen below, if any — so this panel can say it is **not**
   * answering within it.
   *
   * Reported by a real person: the panel said "81 places say what a child
   * could actually do there" directly above a catalogue reading "120 results"
   * for *Farms & markets*, and nothing on the page said whether one was a
   * subset of the other, or whether choosing a category had narrowed the
   * panel. It had not. Two honest numbers about two different questions read
   * as one broken number until the page says which is which.
   */
  readonly withinLabel?: string;
  /** The child's age, where somebody said one. Never defaulted. */
  readonly childAge?: number;
  readonly onChildAge: (age: number | undefined) => void;
  /** Where the reader is, so a suggestion can say how far it is. */
  readonly origin?: Point;
  /** `undefined` where the browser cannot do this, or has already been asked. */
  readonly ask?: () => void;
  /** The pool the answer is drawn from — already scoped and feed-filtered. */
  readonly experiences: readonly Experience[];
  readonly situation: Situation;
  readonly onSituation: (next: Situation) => void;
}) {
  const shown = weather;
  const answer = answerFor(experiences, situation, { wet: shown?.wet });
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
        {shown && (
          <>
            <Dot />
            <span className="inline-flex items-center gap-1">
              {shown.wet ? (
                <CloudRain className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Sun className="h-3.5 w-3.5" aria-hidden />
              )}
              {shown.description ?? (shown.wet ? "Rain expected" : "Dry")}
            </span>
            {shown.area && (
              <>
                <Dot />
                {/* **"Vernon" and "the Vernon area" are different claims.**
                    One says the forecast is for Vernon; the other says it is
                    the area's default and not about the reader. The second is
                    what the page can honestly say until somebody taps. */}
                <span data-testid="today-area">
                  {place.state === "observed"
                    ? shown.area
                    : `${shown.area} area`}
                </span>
              </>
            )}
          </>
        )}
      </p>

      {/* One line, and only where there is something true to say. No modal, no
          up-front explanation of what geolocation is: the offer is the
          explanation, and the sentence beside it is what is wrong without it. */}
      <p
        data-testid="today-place"
        className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#2b2015]/50"
      >
        <span>{placeNote(place, shown?.area)}</span>
        {ask && (
          <button
            type="button"
            data-testid="use-my-location"
            onClick={ask}
            className="inline-flex min-h-8 items-center gap-1 rounded-full border border-[#8a5a24]/30 px-2.5 text-xs font-medium text-[#8a5a24] transition-colors hover:border-[#8a5a24]/60 hover:text-[#2b2015]"
          >
            <MapPin className="h-3 w-3" aria-hidden />
            Use my location
          </button>
        )}
        {place.state === "asking" && (
          <span
            data-testid="location-asking"
            className="inline-flex items-center gap-1 text-[#8a5a24]"
          >
            <LoaderCircle className="h-3 w-3 animate-spin" aria-hidden />
            Finding your area…
          </span>
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
        {/* **Asked, never assumed.** Atlas can say whether a seven-year-old
            is admitted somewhere — but only if it is told seven. "With a young
            child" is not an age, and defaulting it to five would invent the
            one fact this is for. Declining is a real answer. */}
        {situation.company === "child" && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-w-[4.5rem] items-center gap-1.5 text-xs font-medium text-[#2b2015]/45">
              How old
            </span>
            {AGES.map((age) => {
              const on = childAge === age;
              return (
                <button
                  key={age}
                  type="button"
                  data-testid={`child-age-${age}`}
                  aria-pressed={on}
                  onClick={() => onChildAge(on ? undefined : age)}
                  className={
                    on
                      ? "inline-flex min-h-11 items-center rounded-full bg-[#2b2015] px-3.5 text-sm font-medium text-[#f7ecd3]"
                      : "inline-flex min-h-11 items-center rounded-full border border-[#8a5a24]/25 px-3.5 text-sm font-medium text-[#2b2015]/75 transition-colors hover:border-[#8a5a24]/55"
                  }
                >
                  {age}
                </button>
              );
            })}
            {childAge !== undefined && (
              <button
                type="button"
                data-testid="child-age-clear"
                onClick={() => onChildAge(undefined)}
                className="inline-flex min-h-11 items-center px-2 text-xs font-medium text-[#2b2015]/45 hover:text-[#2b2015]/70"
              >
                Rather not say
              </button>
            )}
          </div>
        )}

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
        <Answer
          answer={answer}
          situation={situation}
          weather={shown}
          {...(origin ? { origin } : {})}
          {...(withinLabel ? { withinLabel } : {})}
          {...(childAge !== undefined ? { childAge } : {})}
        />
      )}
    </section>
  );
}

const Dot = () => (
  <span aria-hidden className="text-[#8a5a24]/40">
    ·
  </span>
);

/**
 * What the page can honestly say about whose weather this is.
 *
 * Every branch names the gap rather than papering over it. The silent version
 * of this product showed a Vernon forecast to somebody in Kamloops and said
 * nothing at all.
 */
export function placeNote(
  place: PlaceContext,
  area: string | undefined,
): string {
  const theArea = area ? `the ${area} area` : "this area";
  switch (place.state) {
    case "observed":
      // The distance is only worth saying when there is one. Standing in
      // Vernon, "about 0 km away" reads as a broken template rather than as
      // the good news it is.
      return place.km !== undefined && place.km >= 1
        ? `Nearest forecast to you — ${place.area}, about ${place.km} km away.`
        : `Nearest forecast to you — ${place.area}.`;
    case "asking":
      return "";
    case "unavailable":
      switch (place.lapse) {
        case "denied":
          return `Showing ${theArea}, since Passport can't see where you are.`;
        case "no-forecast":
          // They did share, and there is genuinely nothing to show them.
          return `Environment Canada publishes no forecast near you — showing ${theArea} instead.`;
        default:
          // `failed`: a fix or a lookup that did not work, which is not worth
          // explaining to somebody who only wanted to know about the rain.
          return `Showing ${theArea}.`;
      }
    default:
      return area
        ? `Forecast for ${theArea} — not for wherever you are.`
        : "Passport has no forecast for today.";
  }
}

/**
 * What the list of directions is called, which is the only place the stated
 * length of day appears in words. It describes how many ideas are below it,
 * never how the day is divided.
 */
const LEAD: Record<string, string> = {
  "an-hour": "One thing you could do",
  "half-day": "A couple of ideas for the afternoon",
  "all-day": "A few different ideas for the day",
  none: "Things you could do",
};

/**
 * The ages offered. Atlas accepts 0–17; these are the ones somebody is likely
 * to tap, and any whole year in range works if it arrives in the URL.
 */
const AGES = [2, 4, 6, 8, 10, 13] as const;

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
  origin,
  withinLabel,
  childAge,
}: {
  readonly answer: ReturnType<typeof answerFor>;
  readonly situation: Situation;
  readonly weather?: DayWeather;
  readonly origin?: Point;
  readonly withinLabel?: string;
  readonly childAge?: number;
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

  const { matches: doable } = answer;

  /**
   * **Atlas's verdict, once somebody has said an age.**
   *
   * `CHILD_DOABLE` — Passport's list of fourteen affordance words — answered
   * *what could a child do here*. It never answered *is this child admitted*,
   * and it could not: a 19+ venue with a playground passed it.
   *
   * `candidate-suitability/1` answers the second question when asked, so an
   * age removes what Atlas says is shut to them and promotes what Atlas says
   * is open. With no age, nothing here changes — because nothing is known.
   */
  const byAge = splitByAge(doable, childAge);
  const matches =
    childAge === undefined
      ? doable
      : doable.filter((e) => !excludesAge(e, childAge));
  const shutOut = childAge === undefined ? [] : byAge.excluded;
  // **Atlas's four answers, not Passport's two.** The previous version asked
  // one question — is this plainly outdoor — of a word list that contained
  // `picnic shelter`, so every park with a dry corner was reported as ruled
  // out by the rain. These come from `candidate-environment/1`.
  const { stands, against, uncertain, unknown } = splitByRain(matches);
  const wet = Boolean(weather?.wet);

  /**
   * **Verbs, not nouns.** This answered *"what could we do today?"* with six
   * place names in corpus order — *Coldstream Park, Kin Beach, Peace Arch
   * Park* — which is a list of records, and does not tell somebody that
   * finding a playground and going skating are two different afternoons.
   *
   * `directionsFor` groups the same evidence by what Atlas says you can **do**
   * there, and each direction carries its own places as proof. How many are
   * offered comes from the length of day they stated; which places are named
   * under each comes from where they are.
   */
  const wanted = directionsWanted(situation.window);
  const directions = directionsFor(matches, situation, { wet })
    .map((direction) => ({
      ...direction,
      // **Shelter first on a wet day, then nearest.** A direction can hold
      // both a park with a picnic shelter and one that is out in the open;
      // showing them is more useful than hiding the second, but the one that
      // can take the rain has to be the one named first.
      places: wet
        ? [
            ...nearestFirst(direction.places.filter(standsUpToRain), origin),
            ...nearestFirst(
              direction.places.filter((p) => !standsUpToRain(p)),
              origin,
            ),
          ]
        : nearestFirst(direction.places, origin),
      near: origin
        ? direction.places.filter((p) => {
            const km = distanceTo(p, origin);
            return km !== undefined && km <= NEAR_KM;
          }).length
        : 0,
    }))
    // Once Passport knows where they are, a direction with four places within
    // reach beats one with nine on the coast. Evidence still breaks the tie.
    .sort(
      (a, b) =>
        Number(a.ruledOutByRain) - Number(b.ruledOutByRain) ||
        (origin ? b.near - a.near : 0) ||
        b.places.length - a.places.length,
    );
  // Four different ideas should be four different ideas: Swimming and Beach
  // both opened with Kal Beach and Kin Beach before this.
  const offered = distinctDirections(directions, wanted);

  /**
   * **Which three places each idea names, so two ideas do not look alike.**
   *
   * Measured in Vernon: *Swimming* and *Beach* both opened with Kal Beach and
   * Kin Beach. The verbs are genuinely different — Kalavista Boat Launch is
   * under Beach and not under Swimming — so neither should be dropped. What
   * was wrong is that each named the same lake first.
   *
   * So a later idea names a place an earlier one has not, where it has one.
   * A choice **among** places Atlas states for that verb, never a claim beyond
   * them, and the count beside the verb is still the full evidence.
   */
  const spoken = new Set<string>();
  const naming = offered.map((direction) => {
    const fresh = direction.places.filter((place) => !spoken.has(place.id));
    // Deduplicated: a direction with one place had `fresh` and `places`
    // holding the same row, and named it twice.
    const named = [
      ...new Map(
        [...fresh, ...direction.places].map((place) => [place.id, place]),
      ).values(),
    ].slice(0, 3);
    for (const place of named) spoken.add(place.id);
    return { direction, named };
  });

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
            say what a child could actually do there
            {withinLabel ? (
              <>
                {" "}
                — across everything Passport knows, not just{" "}
                <span className="font-medium">{withinLabel}</span>
              </>
            ) : null}
            .
          </p>

          {/* **What Atlas says about this particular child**, kept apart from
              what it says about the activity. A stated rule and a turn of
              phrase are different claims and are counted separately. */}
          {childAge !== undefined && (
            <p
              data-testid="today-age"
              className="mt-2 text-sm text-[#2b2015]/70"
            >
              For a {childAge}-year-old, Atlas states a rule admitting{" "}
              <strong className="font-semibold">{byAge.welcome.length}</strong>{" "}
              of them
              {byAge.described.length > 0 && (
                <> · {byAge.described.length} are described for families</>
              )}
              {shutOut.length > 0 && (
                <> · {shutOut.length} are shut to them and are not offered</>
              )}
              {byAge.unclear.length > 0 && (
                <> · {byAge.unclear.length} it cannot settle</>
              )}
              . It says nothing either way about{" "}
              {byAge.unknown.length + byAge.priced.length}.
            </p>
          )}

          {wet && (
            <p
              data-testid="today-weather-caveat"
              className="mt-2 text-sm text-[#2b2015]/70"
            >
              {stands.length > 0 ? (
                <>
                  <strong className="font-semibold">
                    {stands.length} of them say the rain does not stop them
                  </strong>
                  {against.length > 0 && (
                    <> · {against.length} are out in the open</>
                  )}
                  {uncertain.length > 0 && (
                    <> · {uncertain.length} may not be running today</>
                  )}
                  {unknown.length > 0 && (
                    <>
                      {" "}
                      · Atlas says nothing either way about the other{" "}
                      {unknown.length}
                    </>
                  )}
                  .
                </>
              ) : (
                <>
                  Rain is forecast, and{" "}
                  <strong className="font-semibold">
                    none of these say they can take it
                  </strong>
                  .{" "}
                  {against.length > 0 && (
                    <>{against.length} are out in the open, and </>
                  )}
                  Atlas says nothing either way about {unknown.length} — so
                  Passport is not going to pick one and send you out in it.
                </>
              )}
            </p>
          )}

          {offered.length > 0 && (
            <>
              {/* **The one number here that is a judgement, said as one.**
                  Atlas states a duration for 17 candidates out of 2,683, so
                  Passport cannot know how long any of this takes. The length
                  of day decides how many different ideas to offer, and
                  nothing else. */}
              <p className="mt-4 text-xs font-medium tracking-wide text-[#2b2015]/45 uppercase">
                {LEAD[situation.window ?? "none"]}
              </p>

              <ul className="mt-2 flex flex-col gap-2">
                {naming.map(({ direction, named }) => {
                  return (
                    <li
                      key={direction.doing}
                      data-testid="today-direction"
                      data-doing={direction.doing}
                      className="rounded-xl border border-[#8a5a24]/20 bg-white/40 px-3 py-2.5"
                    >
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-heading text-base text-[#2b2015] first-letter:uppercase">
                          {direction.doing}
                        </span>
                        <span className="text-xs text-[#2b2015]/50 tabular-nums">
                          {direction.places.length}{" "}
                          {direction.places.length === 1 ? "place" : "places"}
                          {origin && direction.near > 0
                            ? ` · ${direction.near} within ${NEAR_KM} km`
                            : ""}
                        </span>
                        {direction.ruledOutByRain && (
                          <span
                            data-testid="today-direction-rained-out"
                            className="text-xs font-medium text-[#8a5a24]"
                          >
                            every one of these is out in the open
                          </span>
                        )}
                      </p>
                      {/* The proof, nearest first. Atlas's names, Atlas's
                          evidence — and a distance only where both positions
                          are stated. */}
                      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        {named.map((place) => {
                          // Where it is: a distance where both positions are
                          // stated, the town Atlas states otherwise, and
                          // nothing at all when it knows neither.
                          const where =
                            distanceLabel(distanceTo(place, origin)) ??
                            placeLabel(place);
                          // And what the rain does to it, from
                          // `candidate-environment/1` — carrying its own
                          // provenance, so a derived reading says it was
                          // derived rather than passing as a promise.
                          const shelter = wet ? rainLine(place) : undefined;
                          const admits = ageLine(place, childAge);
                          const adult = needsAdult(place, childAge);
                          // The sentence Atlas read the shelter from, kept on
                          // the element rather than printed under every one of
                          // twelve places. Provenance preserved, not shouted.
                          const because =
                            (wet ? rainBecause(place) : undefined) ??
                            ageBecause(place, childAge);
                          return (
                            <li
                              key={place.id}
                              data-testid="today-direction-place"
                              {...(because ? { title: because } : {})}
                              className="text-xs text-[#2b2015]/55"
                            >
                              {place.title}
                              {where ? (
                                <span className="text-[#2b2015]/40">
                                  {" "}
                                  · {where}
                                </span>
                              ) : null}
                              {shelter ? (
                                <span
                                  data-testid="today-shelter"
                                  className="text-[#8a5a24]"
                                >
                                  {" "}
                                  · {shelter}
                                </span>
                              ) : null}
                              {admits ? (
                                <span
                                  data-testid="today-admits"
                                  className="text-[#2b6b45]"
                                >
                                  {" "}
                                  · {admits}
                                </span>
                              ) : null}
                              {adult ? (
                                <span
                                  data-testid="today-supervision"
                                  className="text-[#8a5a24]"
                                >
                                  {" "}
                                  · an adult must come too
                                </span>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  );
                })}
              </ul>

              <p className="mt-2 text-xs text-[#2b2015]/40">
                Ideas, not a plan. Passport does not know how long any of these
                take, or whether they are open.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
