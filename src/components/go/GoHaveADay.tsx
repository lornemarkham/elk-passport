"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CloudRain, Printer, Sun } from "lucide-react";
import type { Experience } from "@/domain/experience/types";
import {
  clockLabel,
  heardIn,
  hoursPhrase,
  partyPhrase,
  readBrief,
  removedStop,
  replacedStop,
  reviseBrief,
  stopCountChange,
  type BriefContext,
  type DayBrief,
  type Party,
} from "@/domain/day/brief";
import {
  alternativesFor,
  buildDay,
  MAX_STOPS,
  type DayPlanned,
  type PlanWeather,
} from "@/domain/day/build";
import { OFFLINE_MODES, modeById } from "./modes";
import { townById } from "@/domain/discovery/towns";
import { ZONE } from "@/domain/experience/eventTime";
import { carryBrief } from "@/domain/day/carry";
import { DayItinerary, type StopControls } from "./DayItinerary";

/**
 * **"What kind of day do you want?"**
 *
 * One box, six doors, and a day that changes when you talk to it. The
 * conversation is deliberately not a chatbot: there is no assistant persona,
 * no typing indicator and no thread. You say a thing, the day rearranges, it
 * says back in one line what it heard, and the sentence you said stays
 * visible so you can see what it is working from.
 *
 * ## Talking and touching are the same conversation
 *
 * The doctrine (§3): *do not force every action through a chat conversation.*
 * Every stop has its own controls — keep, swap, more or less time, earlier,
 * later, remove — and every one of them has a sentence that does the same
 * thing ("swap the second", "remove the last", "add a stop", "home by 5").
 * Neither is the real interface with the other bolted on.
 *
 * ## What it keeps
 *
 * ```
 * brief     what they asked for — revised one dimension at a time
 * keep      stops they kept or picked; every revision leaves them alone
 * order     the order they set by hand, if they did
 * minutes   time they set on a stop by hand
 * without   stops they swapped out or removed
 * count     how many stops they asked for
 * ```
 *
 * ## Where the intelligence is
 *
 * In `readBrief` and `buildDay`, both pure and both tested, both running in
 * the browser against the pool this page was already given. That means no
 * round trip per revision, no spend per revision, and — the part that
 * matters — **no key required for any of it to work**. A model, if one is
 * ever wired in, should fill the same `DayBrief` and never choose a place.
 * No such route exists yet; this page does not call one.
 */
const REVISIONS = [
  "Make it cheaper",
  "More outdoors",
  "Out of the rain",
  "Less driving",
  "Make it weirder",
  "Make it more adventurous",
  "Shorter",
  "Longer",
] as const;

const PARTIES: readonly {
  readonly party: Party;
  readonly label: string;
  readonly says: string;
}[] = [
  { party: "solo", label: "Just me", says: "just me" },
  { party: "couple", label: "The two of us", says: "the two of us" },
  { party: "family", label: "Family", says: "with the kids" },
  { party: "friends", label: "Friends", says: "with friends" },
];

interface Shaping {
  readonly without: readonly string[];
  readonly keep: readonly string[];
  readonly order: readonly string[] | null;
  readonly minutes: Readonly<Record<string, number>>;
  readonly count: number | null;
}

const FRESH: Shaping = {
  without: [],
  keep: [],
  order: null,
  minutes: {},
  count: null,
};

export function GoHaveADay({
  pool,
  today,
  initialSay,
  initialMode,
  childAge,
  townId,
  on,
  simulatedWeather,
  keep = NONE,
}: {
  readonly pool: readonly Experience[];
  /** `YYYY-MM-DD` where the subjects are. */
  readonly today: string;
  readonly initialSay?: string;
  readonly initialMode?: string;
  readonly childAge?: number;
  readonly townId?: string;
  readonly on?: string;
  /** Development only, labelled as simulated wherever it shows. */
  readonly simulatedWeather?: PlanWeather;
  /**
   * Ids picked in Discovery (`?with=`), built around rather than replaced.
   * They start the day as kept — the same `keep` the stop's own Keep button
   * sets — so un-keeping or removing one works exactly as on any other stop.
   */
  readonly keep?: readonly string[];
}) {
  const seed =
    initialSay ??
    modeById(initialMode)?.says ??
    (keep.length > 0 ? "Half a day" : "");
  const day0 = on ?? today;
  const context = (): BriefContext =>
    day0 === today ? { nowMinutes: minutesNow() } : {};
  const fallback = fallbackFrom(childAge, townId, day0);
  // A new sentence starts the shaping over, but what was picked in Discovery
  // stays picked: it came from somewhere else and the sentence didn't name it.
  const fresh: Shaping = keep.length > 0 ? { ...FRESH, keep } : FRESH;

  const [draft, setDraft] = useState(seed);
  const [brief, setBrief] = useState<DayBrief | null>(
    seed ? readBrief(seed, fallback, context()) : null,
  );
  const [shaping, setShaping] = useState<Shaping>(fresh);
  const [swapping, setSwapping] = useState<number | undefined>();
  const [change, setChange] = useState("");
  const [reply, setReply] = useState<string[]>([]);
  const [before, setBefore] = useState<readonly string[] | null>(null);
  const [fetched, setFetched] = useState<{
    key: string;
    weather: PlanWeather | null;
  } | null>(null);

  // **The forecast for the town the sentence names, today only.** The
  // official Environment Canada forecast for the nearest city it publishes,
  // fetched for a town centre — never a person's own position — and labelled
  // with that city wherever it shows.
  const town = brief?.town;
  const forecastKey = town && day0 === today ? town.id : null;
  useEffect(() => {
    if (simulatedWeather || !forecastKey || !town) return;
    if (fetched?.key === forecastKey) return;
    let live = true;
    fetch("/api/environment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        latitude: town.latitude,
        longitude: town.longitude,
      }),
    })
      .then((r) => (r.ok ? r.json() : {}))
      .then((body: { weather?: PlanWeather }) => {
        if (live)
          setFetched({ key: forecastKey, weather: body.weather ?? null });
      })
      .catch(() => {
        if (live) setFetched({ key: forecastKey, weather: null });
      });
    return () => {
      live = false;
    };
  }, [forecastKey, town, simulatedWeather, fetched?.key]);

  const weather: PlanWeather | undefined =
    simulatedWeather ??
    (fetched && fetched.key === forecastKey
      ? (fetched.weather ?? undefined)
      : undefined);

  const day = useMemo(
    () =>
      brief
        ? buildDay({
            pool,
            brief,
            without: shaping.without,
            keep: shaping.keep,
            picked: keep,
            ...(shaping.order ? { order: shaping.order } : {}),
            minutes: shaping.minutes,
            ...(shaping.count !== null ? { count: shaping.count } : {}),
            ...(weather ? { weather } : {}),
          })
        : null,
    [pool, brief, shaping, weather, keep],
  );

  const alternatives = useMemo(
    () =>
      brief && day && swapping !== undefined
        ? alternativesFor({
            pool,
            brief,
            day,
            index: swapping,
            without: shaping.without,
            ...(weather ? { weather } : {}),
          })
        : [],
    [pool, brief, day, swapping, shaping.without, weather],
  );

  const ids = day?.stops.map((s) => s.experience.id) ?? [];
  const remember = () => setBefore(ids);
  /** A small edit speaks for itself; an old reply would only mislead. */
  const quiet = () => {
    setReply([]);
    setBefore(null);
  };

  const start = (said: string) => {
    if (!said.trim()) return;
    setShaping(fresh);
    setSwapping(undefined);
    setReply([]);
    setBefore(null);
    setBrief(readBrief(said, fallback, context()));
    setDraft(said);
  };

  /** One sentence, routed to whichever part of the day it is about. */
  const talk = (said: string) => {
    if (!brief || !day || !said.trim()) return;
    const n = day.stops.length;

    const swap = replacedStop(said);
    if (swap !== undefined) {
      if (swap <= n) {
        setSwapping(swap - 1);
        setReply([
          `Here are a few instead of ${day.stops[swap - 1]!.experience.title}.`,
        ]);
      } else setReply([`There is no stop ${swap} in this day.`]);
      return;
    }
    const drop = removedStop(said, n);
    if (drop !== undefined) {
      if (drop <= n && n > 1) {
        setReply([`Removed ${day.stops[drop - 1]!.experience.title}.`]);
        controls.onRemove(drop - 1);
      } else setReply(["That would leave nothing to do."]);
      return;
    }
    const more = stopCountChange(said);
    if (more !== undefined) {
      const count = Math.min(MAX_STOPS, Math.max(1, n + more));
      remember();
      setShaping((s) => ({ ...s, count }));
      setReply([
        count === n
          ? more > 0
            ? `${MAX_STOPS} is the most — past that it's a checklist.`
            : "One stop is as few as a day gets."
          : `${count} stops now.`,
      ]);
      return;
    }

    const next = reviseBrief(brief, said, context());
    const heard = heardIn(brief, next);
    if (heard.length === 0) {
      setReply([
        "I didn't catch a change in that. Try “home by 5”, “no hiking”, “cheaper”, “just the two of us”, or “swap the second”.",
      ]);
      return;
    }
    remember();
    setBrief(next);
    // A revision rebuilds everything the person has not claimed. What they
    // kept and the time they set stay; a hand-set order does not survive a
    // new set of stops.
    setShaping((s) => ({ ...s, order: null }));
    setSwapping(undefined);
    setReply(heard);
  };

  const controls: StopControls = {
    onKeep: (index) => {
      const id = ids[index];
      if (!id) return;
      setShaping((s) => ({
        ...s,
        keep: s.keep.includes(id)
          ? s.keep.filter((k) => k !== id)
          : [...s.keep, id],
      }));
      quiet();
    },
    onSwap: (index) =>
      setSwapping((open) => (open === index ? undefined : index)),
    onChoose: (index, id) => {
      const out = ids[index];
      if (!out) return;
      remember();
      setShaping((s) => ({
        ...s,
        without: [...s.without, out],
        // Picking it is a choice: it is kept like anything else they chose.
        keep: [...s.keep.filter((k) => k !== out), id],
        order: ids.map((x) => (x === out ? id : x)),
      }));
      setSwapping(undefined);
      setReply([
        `Swapped in ${pool.find((e) => e.id === id)?.title ?? "that"}.`,
      ]);
    },
    onRemove: (index) => {
      const out = ids[index];
      if (!out || ids.length <= 1) return;
      remember();
      setShaping((s) => ({
        ...s,
        without: [...s.without, out],
        keep: s.keep.filter((k) => k !== out),
        order: ids.filter((x) => x !== out),
        count: ids.length - 1,
      }));
      setSwapping(undefined);
    },
    onMove: (index, by) => {
      const to = index + by;
      if (to < 0 || to >= ids.length) return;
      const order = [...ids];
      [order[index], order[to]] = [order[to]!, order[index]!];
      setShaping((s) => ({ ...s, order }));
      setSwapping(undefined);
      quiet();
    },
    onTime: (index, by) => {
      const stop = day?.stops[index];
      if (!stop) return;
      const minutes = Math.min(8 * 60, Math.max(15, stop.minutes + by));
      setShaping((s) => ({
        ...s,
        minutes: { ...s.minutes, [stop.experience.id]: minutes },
      }));
      quiet();
    },
    onRainPlan: (index) => {
      const plan = day?.stops[index]?.rainPlan;
      if (plan) controls.onChoose(index, plan.experience.id);
    },
  };

  const changed = day && before ? diff(before, day) : null;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 sm:py-12 lg:px-10">
      <p
        className="text-[11px] font-semibold tracking-[0.12em] uppercase"
        style={{ color: "var(--ghad-accent)" }}
      >
        Go offline
      </p>
      <h1 className="ghad-display mt-2 max-w-[18ch] text-[34px] leading-[0.95] font-extrabold tracking-[-0.045em] text-balance text-[#111] sm:text-[60px]">
        What kind of day do you want?
      </h1>
      <p className="mt-4 max-w-[58ch] text-[16px] leading-relaxed text-black/60">
        Say it however you&apos;d say it to a friend — who&apos;s coming, how
        long you&apos;ve got, when you need to be home. We&apos;ll build you a
        day out of real places, print it, and then you can leave your phone in
        the glovebox.
      </p>

      <form
        className="mt-6 flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          start(draft);
        }}
      >
        <input
          data-testid="go-say"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Leave at 10, home by 4, the two of us, near Vernon"
          aria-label="What kind of day do you want?"
          className="min-h-14 flex-1 rounded-full bg-white px-5 text-[16px] text-[#111] ring-1 ring-black/15 ring-inset placeholder:text-black/35 focus:ring-2 focus:ring-black/50 focus:outline-none"
        />
        <button
          type="submit"
          data-testid="go-build"
          style={{
            backgroundColor: "var(--ghad-accent)",
            color: "var(--ghad-accent-ink)",
          }}
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full px-7 text-[16px] font-semibold"
        >
          Build my day
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </form>

      {/* The six doors. Each is a sentence, read by the same parser — see
          `modes.ts`. Folded away once there is a day, because by then the
          day is the thing. */}
      {!day && (
        <div className="mt-8">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase">
            Or pick a shape of day
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {OFFLINE_MODES.map((mode) => (
              <li key={mode.id}>
                <button
                  type="button"
                  data-testid={`go-mode-${mode.id}`}
                  onClick={() => start(mode.says)}
                  className="group h-full w-full rounded-2xl p-4 text-left ring-1 ring-black/12 transition-colors ring-inset hover:ring-black/40"
                >
                  <span
                    aria-hidden
                    className="block h-[3px] w-7"
                    style={{ backgroundColor: "var(--ghad-accent)" }}
                  />
                  <span className="ghad-display mt-3 block text-[20px] leading-[1.05] font-extrabold tracking-[-0.03em] text-[#111]">
                    {mode.title}
                  </span>
                  <span className="mt-1 block text-[14px] leading-relaxed text-black/55">
                    {mode.blurb}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {day && brief && (
        <section
          data-testid="go-day"
          className="mt-10 border-t border-black/10 pt-8"
        >
          <WorkingFrom brief={brief} day={day} />
          <Who brief={brief} onSay={talk} today={day0} />
          {weather && <Forecast weather={weather} />}
          {day.stops.length > 0 && (
            <div
              className="mt-6 rounded-2xl bg-black/[0.03] p-4"
              data-testid="go-talk"
            >
              <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  talk(change);
                  setChange("");
                }}
              >
                <input
                  data-testid="go-change"
                  value={change}
                  onChange={(event) => setChange(event.target.value)}
                  placeholder="Change something — “home by 5”, “no hiking”, “swap the second”"
                  aria-label="Change something about the day"
                  className="min-h-12 flex-1 rounded-full bg-white px-5 text-[15px] text-[#111] ring-1 ring-black/15 ring-inset placeholder:text-black/35 focus:ring-2 focus:ring-black/50 focus:outline-none"
                />
                <button
                  type="submit"
                  data-testid="go-change-submit"
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#111] px-6 text-[15px] font-semibold text-white"
                >
                  Change it
                </button>
              </form>
              {(reply.length > 0 || changed) && (
                <p
                  data-testid="go-reply"
                  aria-live="polite"
                  className="mt-2 text-[14px] text-black/70"
                >
                  {[...reply, ...(changed ? [changed] : [])].join(" ")}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {REVISIONS.map((label) => (
                  <button
                    key={label}
                    type="button"
                    data-testid={`go-revise-${label.toLowerCase().replace(/\W+/g, "-")}`}
                    onClick={() => talk(label)}
                    className="inline-flex min-h-10 items-center rounded-full px-4 text-[13px] font-semibold text-black/70 ring-1 ring-black/15 ring-inset hover:ring-black/45"
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  data-testid="go-add-stop"
                  onClick={() => talk("add a stop")}
                  disabled={day.stops.length >= MAX_STOPS}
                  className="inline-flex min-h-10 items-center rounded-full px-4 text-[13px] font-semibold text-black/70 ring-1 ring-black/15 ring-inset hover:ring-black/45 disabled:opacity-30"
                >
                  Add a stop
                </button>
              </div>
            </div>
          )}

          <div className="mt-8">
            <DayItinerary
              day={day}
              controls={controls}
              {...(swapping !== undefined ? { swapping } : {})}
              alternatives={alternatives}
            />
          </div>

          {day.stops.length > 0 && (
            <>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={`/go/print?${printQuery(brief, day)}`}
                  data-testid="go-print"
                  style={{
                    backgroundColor: "var(--ghad-accent)",
                    color: "var(--ghad-accent-ink)",
                  }}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-[15px] font-semibold"
                >
                  <Printer className="h-4 w-4" aria-hidden />
                  Print our adventure
                </Link>
                <Link
                  href="/discovery"
                  className="inline-flex min-h-12 items-center px-5 text-[15px] font-semibold text-black/55 hover:text-[#111]"
                >
                  Keep looking instead
                </Link>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

/**
 * **What it is working from**, so a misreading is visible and correctable.
 * Things the person said look solid; things the plan assumed look dashed and
 * say they were assumed.
 */
function WorkingFrom({
  brief,
  day,
}: {
  readonly brief: DayBrief;
  readonly day: DayPlanned;
}) {
  const chips: { label: string; assumed?: boolean }[] = [];
  if (brief.hours !== undefined)
    chips.push({ label: hoursPhrase(brief.hours) });
  else chips.push({ label: "4 hours — assumed", assumed: true });
  if (brief.startAt !== undefined)
    chips.push({
      label: brief.startsNow
        ? `Leaving now (${clockLabel(brief.startAt)})`
        : `Leave ${clockLabel(brief.startAt)}`,
      ...(brief.startsNow ? { assumed: true } : {}),
    });
  if (brief.homeBy !== undefined)
    chips.push({ label: `Home by ${clockLabel(brief.homeBy)}` });
  if (brief.town)
    chips.push({ label: `From ${brief.town.name.replace(/,\s*BC$/, "")}` });
  if (brief.childAge !== undefined)
    chips.push({ label: `With a ${brief.childAge}-year-old` });
  else if (brief.party)
    chips.push({ label: `For ${partyPhrase(brief.party)}` });
  if (brief.budget !== undefined)
    chips.push({ label: brief.budget === 0 ? "Free" : `$${brief.budget}` });
  if (brief.shelter)
    chips.push({
      label: brief.shelter === "indoor" ? "Under cover" : "Outdoors",
    });
  if (brief.appetite) chips.push({ label: brief.appetite });
  for (const interest of brief.interests) chips.push({ label: interest });
  for (const no of brief.avoid ?? []) chips.push({ label: `no ${no}` });
  if (day.radiusKm !== undefined && brief.town)
    chips.push({
      label: day.radiusAssumed
        ? `within ${day.radiusKm} km — the plan's circle`
        : `within ${day.radiusKm} km`,
      ...(day.radiusAssumed ? { assumed: true } : {}),
    });

  return (
    <div data-testid="go-working-from">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase">
        Working from
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <li
            key={chip.label}
            className={`rounded-full px-3 py-1 text-[13px] ${chip.assumed ? "border border-dashed border-black/30 text-black/50" : "border border-transparent bg-black/[0.06] font-semibold text-[#111]"}`}
          >
            {chip.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * **Who is coming.** Offered, never demanded (§4): the day is already built,
 * and this changes it if they want it to. An age goes to Atlas — the page
 * reloads with `?age=` so the verdict is Atlas's, as on Discovery.
 */
function Who({
  brief,
  onSay,
  today,
}: {
  readonly brief: DayBrief;
  readonly onSay: (said: string) => void;
  readonly today: string;
}) {
  const askAge = brief.party === "family" && brief.childAge === undefined;
  const ageHref = (age: number) => {
    const params = new URLSearchParams();
    params.set("say", brief.said);
    params.set("age", String(age));
    if (brief.town) params.set("at", brief.town.id);
    params.set("on", brief.on ?? today);
    return `/go?${params.toString()}`;
  };
  return (
    <div className="mt-4" data-testid="go-who">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase">
        Who&apos;s coming?
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5" role="group">
        {PARTIES.map((p) => (
          <button
            key={p.party}
            type="button"
            data-testid={`go-party-${p.party}`}
            aria-pressed={brief.party === p.party}
            onClick={() => onSay(p.says)}
            className={`inline-flex min-h-9 items-center rounded-full px-3.5 text-[13px] font-semibold ring-1 ring-inset ${brief.party === p.party ? "bg-[#111] text-white ring-[#111]" : "text-black/65 ring-black/15 hover:ring-black/45"}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {askAge && (
        <div className="mt-3" data-testid="go-ask-age">
          <p className="text-[13px] text-black/55">
            How old is the youngest? Atlas will check where they&apos;re
            admitted.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {[2, 4, 6, 8, 10, 12, 14].map((age) => (
              <Link
                key={age}
                href={ageHref(age)}
                data-testid={`go-age-${age}`}
                className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-full px-3 text-[13px] font-semibold text-black/65 ring-1 ring-black/15 ring-inset hover:ring-black/45"
              >
                {age}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** The forecast, with whose forecast it is. Simulated says so first. */
function Forecast({ weather }: { readonly weather: PlanWeather }) {
  const Icon = weather.wet ? CloudRain : Sun;
  return (
    <p
      data-testid="go-forecast"
      className={`mt-4 flex items-start gap-2 rounded-xl px-3 py-2 text-[14px] ${weather.wet ? "bg-sky-50 text-sky-950" : "bg-black/[0.03] text-black/70"}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>
        <span className="font-semibold">
          {weather.wet ? "Rain likely today" : "No rain expected today"}
        </span>
        {weather.description && ` — ${weather.description}`}
        {weather.chance !== undefined && `, ${weather.chance}% at worst`}.{" "}
        <span className="text-black/50">
          {weather.source}
          {weather.area ? `, for ${weather.area}` : ""}.
        </span>
      </span>
    </p>
  );
}

/** What changed in the stops, in a sentence. */
function diff(before: readonly string[], day: DayPlanned): string | null {
  const now = day.stops.map((s) => s.experience.id);
  const added = day.stops.filter((s) => !before.includes(s.experience.id));
  const gone = before.length - (now.length - added.length);
  if (added.length === 0 && gone === 0) return "The stops stayed the same.";
  const parts: string[] = [];
  if (added.length > 0)
    parts.push(`In: ${added.map((s) => s.experience.title).join(", ")}.`);
  if (gone > 0) parts.push(`${gone} out.`);
  return parts.join(" ");
}

/** Minutes after midnight, where the subjects are. */
const minutesNow = (): number => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: ZONE,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
};

const NONE: readonly string[] = [];

const fallbackFrom = (
  childAge: number | undefined,
  townId: string | undefined,
  on: string,
): Partial<DayBrief> => ({
  ...(childAge !== undefined ? { childAge } : {}),
  ...(townById(townId) ? { town: townById(townId)! } : {}),
  on,
});

/**
 * The guide's URL carries the **stop ids**, not the sentence.
 *
 * A printed page has to be the day somebody looked at. Re-running the builder
 * from the brief could hand them a different afternoon between pressing print
 * and the paper coming out, which is exactly the kind of small betrayal that
 * stops people trusting a thing they are about to drive somewhere with. The
 * time they set by hand and the rain plans they were shown travel with it for
 * the same reason.
 */
function printQuery(brief: DayBrief, day: DayPlanned): string {
  const params = new URLSearchParams();
  params.set("stops", day.stops.map((s) => s.experience.id).join(","));
  params.set("say", brief.said);
  params.set("b", carryBrief(brief));
  if (brief.hours !== undefined) params.set("hours", String(brief.hours));
  if (brief.childAge !== undefined) params.set("age", String(brief.childAge));
  if (brief.town) params.set("at", brief.town.id);
  if (brief.on) params.set("on", brief.on);
  const set = day.stops
    .filter((s) => s.timeSet)
    .map((s) => `${s.experience.id}:${s.minutes}`);
  if (set.length > 0) params.set("mins", set.join(","));
  const rain = day.stops
    .filter((s) => s.rainPlan)
    .map((s) => `${s.experience.id}~${s.rainPlan!.experience.id}`);
  if (rain.length > 0) params.set("rain", rain.join(","));
  return params.toString();
}
