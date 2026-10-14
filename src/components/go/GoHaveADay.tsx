"use client";

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bookmark,
  CloudRain,
  Copy,
  Printer,
  Sun,
} from "lucide-react";
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
  travelPhrase,
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
import { TOWN_GROUPS, townById } from "@/domain/discovery/towns";
import { ageIn, nearestTown } from "@/domain/day/intent";
import { needsStart } from "@/domain/day/start";
import { distanceKm } from "@/lib/environment/geo";
import { useHere } from "@/lib/location/useHere";
import { AtlasRecovery } from "./AtlasRecovery";
import { ZONE } from "@/domain/experience/eventTime";
import { dayQueryFor, writeDayQuery } from "@/lib/domains/integration/dayQuery";
import { offlineHref } from "@/lib/detox/day";
import { DayItinerary, type StopControls } from "./DayItinerary";
import { KeptDays } from "./KeptDays";
import type { Timeline } from "@/domain/day/timeline";
import { dayAsText } from "@/lib/go/dayText";
import { readKeptDays, withKept, writeKeptDays } from "@/lib/go/keptDays";
import { readLastStart, writeLastStart } from "@/lib/go/lastStart";
import type { TravelMode } from "@/lib/routing/journey";

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

/** What it takes to take a change back. */
interface Snapshot {
  readonly draft: string;
  readonly brief: DayBrief | null;
  readonly shaping: Shaping;
}

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

/** What one tab remembers of a shaped day at one `/go` address. */
interface Saved {
  readonly draft: string;
  readonly brief: DayBrief | null;
  readonly shaping: Shaping;
  readonly by: TravelMode;
}

const noSubscription = () => () => {};

/** What each `/go` address had saved when this visit to it began. */
const FIRST_READS = new Map<string, string | null>();
const firstRead = (key: string): string | null => {
  if (!FIRST_READS.has(key)) {
    let value: string | null = null;
    try {
      value = window.sessionStorage.getItem(key);
    } catch {
      // Storage unavailable: nothing was saved.
    }
    FIRST_READS.set(key, value);
  }
  return FIRST_READS.get(key) ?? null;
};

/**
 * **The shaped day survives Back.** Shaping lives in the page, so going to
 * the paper and back used to rebuild the day from the URL and drop every keep,
 * swap, time and order — and "Then go offline" handed over a day nobody
 * shaped. This tab keeps it in `sessionStorage`, keyed by what this `/go`
 * address asked, and never sends it anywhere. The server renders the fresh
 * day; the saved one replaces it once the browser can read storage.
 */
/** Where this tab keeps the shaped day for one `/go` address. */
const memoryKeyFor = (a: {
  readonly say?: string | undefined;
  readonly mode?: string | undefined;
  readonly age?: number | undefined;
  readonly at?: string | undefined;
  readonly on: string;
  readonly keep: readonly string[];
}) =>
  `ghad.go:${[a.say, a.mode, a.age, a.at, a.on, a.keep.join(",")].join("|")}`;

export function GoHaveADay(props: GoProps) {
  const { initialSay, initialMode, childAge, townId, on, today, keep } = props;
  const memoryKey = memoryKeyFor({
    say: initialSay,
    mode: initialMode,
    age: childAge,
    at: townId,
    on: on ?? today,
    keep: keep ?? [],
  });
  // Read once per visit: the day being shaped writes to the same key, and
  // re-reading it mid-visit would only remount what is already on screen.
  const raw = useSyncExternalStore(
    noSubscription,
    () => firstRead(memoryKey),
    () => null,
  );
  useEffect(() => () => void FIRST_READS.delete(memoryKey), [memoryKey]);
  const saved = useMemo(() => {
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as Saved;
    } catch {
      return undefined;
    }
  }, [raw]);
  return (
    <ShapedDay
      key={`${memoryKey}|${saved ? "saved" : "fresh"}`}
      {...props}
      memoryKey={memoryKey}
      saved={saved}
    />
  );
}

type GoProps = Omit<Parameters<typeof ShapedDay>[0], "memoryKey" | "saved">;

function ShapedDay({
  pool,
  today,
  initialSay,
  initialMode,
  childAge,
  townId,
  on,
  simulatedWeather,
  atlas = "ok",
  keep = NONE,
  memoryKey,
  saved,
}: {
  /** `unreachable` when Atlas did not answer: say so, build nothing. */
  readonly atlas?: "ok" | "unreachable";
  /** Where this tab keeps the shaped day (`sessionStorage`). */
  readonly memoryKey: string;
  /** The day this tab shaped last time it was at this address. */
  readonly saved?: Saved | undefined;
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

  const [draft, setDraft] = useState(saved?.draft ?? seed);
  /** The sentence the day on screen was built from (`draft` is the live box). */
  const [built, setBuilt] = useState(saved?.draft ?? seed);
  const [brief, setBrief] = useState<DayBrief | null>(() =>
    saved ? saved.brief : seed ? readBrief(seed, fallback, context()) : null,
  );
  const [shaping, setShaping] = useState<Shaping>(saved?.shaping ?? fresh);
  const [swapping, setSwapping] = useState<number | undefined>();
  const [change, setChange] = useState("");
  const [reply, setReply] = useState<string[]>([]);
  const [by, setBy] = useState<TravelMode>(saved?.by ?? "driving");
  const [before, setBefore] = useState<readonly string[] | null>(null);
  const [timeline, setTimeline] = useState<Timeline | undefined>();
  const [noted, setNoted] = useState<{ text: string; query: string } | null>(
    null,
  );
  /** The last thing they did, so it can be taken back. */
  const [undo, setUndo] = useState<Snapshot | null>(null);
  const router = useRouter();
  const [asking, startAsking] = useTransition();
  /** Bumped when a sentence is built, so the answer is brought into view. */
  // A day that arrives in the address (Discovery's "Plan a day around this")
  // is brought into view on arrival too; a day restored from this tab is not,
  // because the person already scrolled where they wanted it.
  const [reveal, setReveal] = useState(seed && !saved ? 1 : 0);
  useEffect(() => {
    if (reveal === 0) return;
    // On a phone the answer starts well below the box that was just tapped:
    // without this, pressing Build looks like nothing happened (M200 #10).
    // The section takes focus, so a screen reader starts at "Your day"; the
    // eye goes to what matters first — what could not be found if anything,
    // else the stops themselves. Scrolling to the section's top left the
    // first stop below the fold on a phone, under the chips and the change
    // panel.
    const result = document.getElementById("go-result");
    result?.focus?.({ preventScroll: true });
    const target =
      document.getElementById("go-not-found") ??
      document.getElementById("go-stops") ??
      result;
    target?.scrollIntoView?.({
      block: "start",
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [reveal]);
  const here = useHere();
  /** The town they chose last time — offered, never applied (`lastStart`). */
  const lastStart = useSyncExternalStore(
    noSubscription,
    readLastStart,
    () => undefined,
  );
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
    fetch("/api/environment/here", {
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

  // Kept for this tab only, so Back from the paper returns to this day.
  // **Only under the address this day was mounted at.** After a hand-off to a
  // new address (a new age) this instance can render once with the new key
  // before it is replaced; writing then would overwrite the day that was
  // carried there with this one's stale state.
  const [mountedAt] = useState(memoryKey);
  useEffect(() => {
    if (memoryKey !== mountedAt) return;
    // The server-rendered, not-yet-hydrated instance must not overwrite what
    // the tab already kept before the saved day has been adopted (`saved`):
    // that race lost a kept day's order on every hard load.
    if (!saved && parses(firstRead(memoryKey))) return;
    try {
      window.sessionStorage.setItem(
        memoryKey,
        JSON.stringify({ draft, brief, shaping, by } satisfies Saved),
      );
    } catch {
      // Private mode or full storage: Back rebuilds from the URL, as before.
    }
  }, [memoryKey, mountedAt, saved, draft, brief, shaping, by]);

  // **No starting point, no day.** A day built with nowhere to start spans the
  // province, so until there is a town — said, carried in, or chosen — the page
  // asks (`StartPanel`). It never picks one.
  const starting = brief ? needsStart(brief) : false;
  const day = useMemo(
    () =>
      brief && !starting
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
    [pool, brief, starting, shaping, weather, keep],
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
  /**
   * **The day as one query** (`dayQueryFor`): the stops in the order shown,
   * the minutes set by hand, the rain plans shown, the mode. A printed page and
   * the phone in the glovebox have to be the day somebody looked at.
   */
  const query = brief && day ? writeDayQuery(dayQueryFor(brief, day, by)) : "";
  /** Everything needed to put the day back exactly as it was. */
  const snapshot = () => setUndo({ draft: built, brief, shaping });
  const remember = () => {
    snapshot();
    setBefore(ids);
  };
  /** A small edit speaks for itself; an old reply would only mislead. */
  const quiet = () => {
    snapshot();
    setReply([]);
    setBefore(null);
  };
  const takeBack = () => {
    if (!undo) return;
    setDraft(undo.draft);
    // A start the person chose is not part of the change being taken back.
    setBrief(
      undo.brief && !undo.brief.town && brief?.town
        ? { ...undo.brief, town: brief.town }
        : undo.brief,
    );
    setShaping(undo.shaping);
    setSwapping(undefined);
    setBefore(null);
    setReply(["Taken back."]);
    setBuilt(undo.draft);
    setUndo(null);
  };

  /**
   * **A different child means a different Atlas answer**, because Atlas is
   * what says where a six-year-old is admitted. So the page is read again for
   * that age — and the shaped day goes with it: the new address finds it in
   * this tab's storage, so nothing kept, set or ordered is lost on the way.
   */
  /** `shown` is the sentence the top box should hold at the new address. */
  const carryToAge = (next: DayBrief, nextShaping: Shaping, shown: string) => {
    const age = next.childAge;
    if (age === undefined) return false;
    const params = new URLSearchParams();
    params.set("say", next.said);
    params.set("age", String(age));
    if (next.town) params.set("at", next.town.id);
    params.set("on", day0);
    if (keep.length > 0) params.set("with", keep.join(","));
    const key = memoryKeyFor({
      say: next.said,
      age,
      at: next.town?.id,
      on: day0,
      keep,
    });
    try {
      window.sessionStorage.setItem(
        key,
        JSON.stringify({
          draft: shown,
          brief: next,
          shaping: nextShaping,
          by,
        } satisfies Saved),
      );
    } catch {
      return false;
    }
    setReply([
      `Asking Atlas where a ${age}-year-old is admitted — your kept stops come with you.`,
    ]);
    // `scroll: false`: the day stays where they were looking at it.
    startAsking(() =>
      router.push(`/go?${params.toString()}`, { scroll: false }),
    );
    return true;
  };

  /** What this tab already knows about the start and the child. */
  const known: Partial<DayBrief> = {
    ...fallback,
    ...(brief?.town ? { town: brief.town } : {}),
    ...(brief?.childAge !== undefined ? { childAge: brief.childAge } : {}),
  };

  const start = (said: string) => {
    if (!said.trim()) return;
    let next = readBrief(said, known, context());
    // The child from the last sentence is not a fact about this one: "just
    // me, a quiet walk" is not a family day.
    if (
      known.childAge !== undefined &&
      ageIn(said.toLowerCase()) === undefined &&
      next.party !== undefined &&
      next.party !== "family"
    ) {
      next = readBrief(said, { ...known, childAge: undefined }, context());
    }
    // **A new sentence is not permission to throw the day away.** What was
    // kept stays kept; the rest is rebuilt from the new words, and the old
    // day can be taken back.
    const kept = day
      ? shaping.keep.filter((id) =>
          day.stops.some((s) => s.experience.id === id),
        )
      : [];
    const nextShaping: Shaping = {
      ...fresh,
      keep: [...new Set([...fresh.keep, ...kept])],
    };
    if (brief) snapshot();
    setSwapping(undefined);
    setBefore(null);
    const named = kept
      .map((id) => pool.find((e) => e.id === id)?.title)
      .filter(Boolean);
    if (next.childAge !== undefined && next.childAge !== childAge) {
      if (carryToAge(next, nextShaping, said)) return;
    }
    setShaping(nextShaping);
    setReply(
      named.length > 0
        ? [`Rebuilt from your new sentence. Still kept: ${named.join(", ")}.`]
        : [],
    );
    setBrief(next);
    setDraft(said);
    setBuilt(said);
    setReveal((n) => n + 1);
  };

  /** Starting somewhere: chosen by the person, never inferred. */
  const startFrom = (townId: string, tapped = true) => {
    const town = townById(townId);
    if (!brief || !town) return;
    // Only a town tapped from the list is remembered — never one worked out
    // from a position, which is not stored.
    if (tapped) writeLastStart(town.id);
    setBrief({ ...brief, town });
    setReply([]);
    setReveal((n) => n + 1);
  };

  /** Plan without something nothing Atlas holds offers — only when asked to. */
  const planWithout = (activity: string) => {
    if (!brief) return;
    snapshot();
    setBrief({
      ...brief,
      interests: brief.interests.filter((i) => i !== activity),
      setAside: [...(brief.setAside ?? []), activity],
    });
    setReply([`Planning without ${activity}.`]);
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
    if (next.childAge !== brief.childAge && next.childAge !== childAge) {
      remember();
      if (carryToAge(next, { ...shaping, order: null }, built)) return;
    }
    // **A request nothing offers must not wipe a day that works.** If the
    // revision would leave nothing, or nothing but what was kept (a kept stop
    // survives a request that builds no day), say so and leave the day alone.
    if (day.stops.length > 0 && heard.length > 0) {
      const trial = buildDay({
        pool,
        brief: next,
        without: shaping.without,
        keep: shaping.keep,
        picked: keep,
        minutes: shaping.minutes,
        ...(weather ? { weather } : {}),
      });
      const missing = trial.unmet ?? [];
      const onlyKept = trial.stops.every(
        (s) =>
          shaping.keep.includes(s.experience.id) ||
          keep.includes(s.experience.id),
      );
      if (
        missing.length >= new Set(next.interests).size &&
        missing.length > 0 &&
        onlyKept &&
        trial.stops.length < day.stops.length
      ) {
        setReply([
          ...missing.map(
            (u) =>
              `Nothing Atlas holds says it offers ${u.activity} within reach of ${next.town?.name.replace(/,\s*BC$/, "") ?? "the start"}.${u.nearest ? ` The nearest it can place is ${u.nearest.title}, ${u.nearest.km} km away.` : ""}`,
          ),
          heard.length > 1
            ? "I haven't changed anything, so say the rest on its own."
            : "I've left your day as it was.",
        ]);
        return;
      }
    }
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
    setReply([...heard, ...keptNote(brief, next, shaping.keep, pool)]);
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
    onRestore: (id) => {
      remember();
      setShaping((s) => ({
        ...s,
        without: s.without.filter((w) => w !== id),
        keep: s.keep.includes(id) ? s.keep : [...s.keep, id],
        order: [...ids, id],
        count: Math.min(MAX_STOPS, ids.length + 1),
      }));
      setSwapping(undefined);
    },
    onRainPlan: (index) => {
      const plan = day?.stops[index]?.rainPlan;
      if (plan) controls.onChoose(index, plan.experience.id);
    },
  };

  const changed = day && before ? diff(before, day) : null;
  // A note is about the day as it was when it was said; reshape and it is stale.
  const note = noted && noted.query === query ? noted.text : "";
  const isKept = note.startsWith("Kept");

  const setAside = shaping.without.flatMap((id) => {
    const e = pool.find((x) => x.id === id);
    return e && !ids.includes(id) ? [{ id, title: e.title }] : [];
  });

  /** **Keep this day**, on this device: the address, the shaping, the print query. */
  const keepDay = () => {
    if (!day || !brief) return;
    const ok = writeKeptDays(
      withKept(readKeptDays(), {
        id: query,
        title: day.title,
        stops: ids,
        keptAt: new Date().toISOString(),
        href: `${window.location.pathname}${window.location.search}`,
        memoryKey,
        shaped: JSON.stringify({ draft, brief, shaping, by } satisfies Saved),
        query,
      }),
    );
    setNoted({
      query,
      text: ok
        ? "Kept on this device. It's under “Days you kept” next time you open Go have a day."
        : "Couldn't keep it — this browser won't let the page store anything.",
    });
  };

  /** **Take it with you as words**: a share sheet on a phone, the clipboard elsewhere. */
  const takeAsText = async () => {
    if (!day) return;
    const text = dayAsText(day, timeline);
    try {
      if (typeof navigator.share === "function" && isTouchDevice()) {
        await navigator.share({ title: day.title, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setNoted({
        query,
        text: "Copied. Paste it into Notes and it works with no signal.",
      });
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      setNoted({ query, text: "Couldn't copy it — print it instead." });
    }
  };
  const unmetNow = day?.unmet ?? [];
  const retryParams = new URLSearchParams();
  if (draft.trim()) retryParams.set("say", draft.trim());
  if (childAge !== undefined) retryParams.set("age", String(childAge));
  if (townId) retryParams.set("at", townId);
  if (on) retryParams.set("on", on);
  if (keep.length > 0) retryParams.set("with", keep.join(","));

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
      {/* Conference lives inside Go Have a Day (owner decision, 2026-10-13):
          no separate domain, one visible door from this page. */}
      <p className="mt-3 text-[15px] text-black/60">
        Going somewhere with a group?{" "}
        <Link
          href="/conferences"
          data-testid="go-conference"
          className="font-semibold text-[#111] underline underline-offset-4"
        >
          Conference
        </Link>
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

      {atlas === "unreachable" && (
        <AtlasRecovery
          said={draft.trim()}
          retryHref={`/go?${retryParams.toString()}`}
        />
      )}

      {brief && starting && atlas !== "unreachable" && (
        <StartPanel
          brief={brief}
          near={
            here.at
              ? nearestTown(
                  { latitude: here.at.latitude, longitude: here.at.longitude },
                  distanceKm,
                )
              : undefined
          }
          located={Boolean(here.at)}
          last={townById(lastStart)}
          picked={keep.flatMap((id) => {
            const title = pool.find((e) => e.id === id)?.title;
            return title ? [title] : [];
          })}
          onAskLocation={here.ask}
          onStart={startFrom}
        />
      )}

      {/* The six doors. Each is a sentence, read by the same parser — see
          `modes.ts`. Folded away once there is a day, because by then the
          day is the thing. */}
      {!brief && atlas !== "unreachable" && (
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

      {atlas !== "unreachable" && day && brief && (
        <section
          id="go-result"
          tabIndex={-1}
          aria-label="Your day"
          data-testid="go-day"
          className="mt-10 border-t border-black/10 pt-8"
        >
          <WorkingFrom brief={brief} day={day} />
          <Who brief={brief} onSay={talk} />
          {weather && <Forecast weather={weather} />}
          {unmetNow.length > 0 && (
            <NotFound
              day={day}
              onSetAside={planWithout}
              onWider={() => talk("go further")}
            />
          )}
          {(day.stops.length > 0 || unmetNow.length > 0) && (
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
                  {asking && " …"}
                </p>
              )}
              {undo && (
                <button
                  type="button"
                  data-testid="go-undo"
                  onClick={takeBack}
                  className="mt-2 inline-flex min-h-10 items-center rounded-full px-4 text-[13px] font-semibold text-[#111] ring-1 ring-black/30 ring-inset hover:ring-black/60"
                >
                  Undo that
                </button>
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

          <div
            id="go-stops"
            className="mt-8 scroll-mt-4"
            hidden={day.stops.length === 0 && unmetNow.length > 0}
          >
            <DayItinerary
              day={day}
              by={by}
              onBy={setBy}
              controls={controls}
              {...(swapping !== undefined ? { swapping } : {})}
              alternatives={alternatives}
              setAside={setAside}
              onTimeline={setTimeline}
            />
          </div>

          {day.stops.length > 0 && (
            <>
              <div
                data-testid="go-actions"
                className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-black/10 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none"
              >
                {note && (
                  <p
                    data-testid="go-note"
                    role="status"
                    className="mb-2 max-w-[60ch] text-[14px] text-black/70"
                  >
                    {note}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
                  <Link
                    href={`/go/print?${query}`}
                    data-testid="go-print"
                    style={{
                      backgroundColor: "var(--ghad-accent)",
                      color: "var(--ghad-accent-ink)",
                    }}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold"
                  >
                    <Printer className="h-4 w-4" aria-hidden />
                    Print our adventure
                  </Link>
                  <button
                    type="button"
                    data-testid="go-keep-day"
                    onClick={keepDay}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#111] px-6 text-[15px] font-semibold text-white"
                  >
                    <Bookmark className="h-4 w-4" aria-hidden />
                    {isKept ? "Kept ✓" : "Keep this day"}
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  data-testid="go-copy"
                  onClick={takeAsText}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-[15px] font-semibold text-[#111] ring-1 ring-black/20 ring-inset hover:ring-black/50"
                >
                  <Copy className="h-4 w-4" aria-hidden />
                  Take it as text
                </button>
                {/* The end of planning: the same day, the same query, handed
                    to Go Offline — the exact stops in the exact order. */}
                <Link
                  href={offlineHref(query)}
                  data-testid="go-offline"
                  className="inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-[15px] font-semibold text-[#111] ring-1 ring-black/20 ring-inset hover:ring-black/50"
                >
                  Then go offline
                  <ArrowRight className="h-4 w-4" aria-hidden />
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
      {(!day || atlas === "unreachable") && <KeptDays />}
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
  readonly day?: DayPlanned;
}) {
  const chips: { label: string; assumed?: boolean }[] = [];
  if (brief.hours !== undefined)
    chips.push({ label: hoursPhrase(brief.hours) });
  else chips.push({ label: "4 hours — assumed", assumed: true });
  if (brief.startAt !== undefined)
    chips.push({
      label: brief.startsNow
        ? `Leaving now (${clockLabel(brief.startAt)})`
        : brief.startFromWhen
          ? `Leave ${clockLabel(brief.startAt)} — ${brief.when === "evening" ? "tonight" : `this ${brief.when}`}`
          : `Leave ${clockLabel(brief.startAt)}`,
      ...(brief.startsNow || brief.startFromWhen ? { assumed: true } : {}),
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
  for (const aside of brief.setAside ?? [])
    chips.push({ label: `planning without ${aside}`, assumed: true });
  if (brief.withinMinutes !== undefined)
    chips.push({
      label: `Up to ${travelPhrase(brief.withinMinutes)} away — searching ${brief.withinKm} km in a straight line (assumes ~48 km/h): a search estimate, not a drive time`,
      assumed: true,
    });
  else if (day?.radiusKm !== undefined && brief.town)
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
}: {
  readonly brief: DayBrief;
  readonly onSay: (said: string) => void;
}) {
  const askAge = brief.party === "family" && brief.childAge === undefined;
  return (
    <div className="mt-4" data-testid="go-who">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase">
        Who&apos;s coming?
      </p>
      <div
        className="mt-2 flex flex-wrap gap-1.5"
        role="group"
        aria-label="Who is coming"
      >
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
          <div
            className="mt-1.5 flex flex-wrap gap-1.5"
            role="group"
            aria-label="Youngest's age"
          >
            {[2, 4, 6, 8, 10, 12, 14].map((age) => (
              <button
                key={age}
                type="button"
                onClick={() => onSay(`youngest is ${age}`)}
                data-testid={`go-age-${age}`}
                className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-full px-3 text-[13px] font-semibold text-black/65 ring-1 ring-black/15 ring-inset hover:ring-black/45"
              >
                {age}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * **Where does the adventure begin?** Asked, because a day built from nowhere
 * spans the province (M200: Vancouver, then 173 km, then 83 km more). Every
 * answer is the person's: a town they tap, or — only if they ask — the town
 * nearest a position the browser gives them. Nothing is guessed, and a
 * position is never stored or sent.
 */
function StartPanel({
  brief,
  near,
  located,
  last,
  picked,
  onAskLocation,
  onStart,
}: {
  readonly brief: DayBrief;
  readonly near: ReturnType<typeof nearestTown>;
  readonly located: boolean;
  /** The town they chose last time on this device, offered first. */
  readonly last: ReturnType<typeof townById>;
  /** What they picked in Discovery, which the day will be built around. */
  readonly picked: readonly string[];
  readonly onAskLocation: (() => void) | undefined;
  readonly onStart: (townId: string, tapped?: boolean) => void;
}) {
  return (
    <section
      id="go-result"
      tabIndex={-1}
      aria-labelledby="go-where-title"
      data-testid="go-where"
      className="mt-10 border-t border-black/10 pt-8"
    >
      <WorkingFrom brief={brief} />
      <h2
        id="go-where-title"
        className="ghad-display mt-6 text-[28px] leading-tight font-extrabold tracking-[-0.03em] text-[#111]"
      >
        Where does the adventure begin?
      </h2>
      <p className="mt-2 max-w-[58ch] text-[15px] leading-relaxed text-black/60">
        I&apos;ve kept what you said. A day needs somewhere to start from, or it
        could span the whole province, and I won&apos;t pick that for you.
      </p>
      {picked.length > 0 && (
        <p
          data-testid="go-where-picked"
          className="mt-2 max-w-[58ch] text-[15px] leading-relaxed text-black/60"
        >
          The day will be built around what you picked:{" "}
          <span className="font-semibold text-[#111]">{picked.join(", ")}</span>
          .
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {last && (
          <button
            type="button"
            data-testid="go-start-last"
            onClick={() => onStart(last.id)}
            className="inline-flex min-h-11 items-center rounded-full bg-[#111] px-5 text-[14px] font-semibold text-white"
          >
            {last.name.replace(/,\s*BC$/, "")} — where you started last time
          </button>
        )}
        {onAskLocation && !located && (
          <button
            type="button"
            data-testid="go-use-location"
            onClick={onAskLocation}
            className="inline-flex min-h-11 items-center rounded-full bg-[#111] px-5 text-[14px] font-semibold text-white"
          >
            Use my location
          </button>
        )}
        {located && near && (
          <button
            type="button"
            data-testid="go-start-nearest"
            onClick={() => onStart(near.town.id, false)}
            className="inline-flex min-h-11 items-center rounded-full bg-[#111] px-5 text-[14px] font-semibold text-white"
          >
            Start from {near.town.name.replace(/,\s*BC$/, "")} — nearest to you
          </button>
        )}
        {located && !near && (
          <p data-testid="go-start-far" className="text-[14px] text-black/60">
            You&apos;re not near a town Passport covers yet — pick one below.
          </p>
        )}
        <p className="text-[12px] text-black/45">
          Your position is rounded to about 1 km, then sent only to ask
          Environment Canada for the nearest forecast. Not stored. A town you
          tap is remembered on this device, to offer next time.
        </p>
      </div>
      {TOWN_GROUPS.map((group) => (
        <div key={group.area} className="mt-5">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase">
            {group.area}
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {group.towns.map((town) => (
              <li key={town.id}>
                <button
                  type="button"
                  data-testid={`go-start-${town.id}`}
                  onClick={() => onStart(town.id)}
                  className="inline-flex min-h-10 items-center rounded-full px-4 text-[14px] font-semibold text-black/70 ring-1 ring-black/15 ring-inset hover:ring-black/50"
                >
                  {town.name.replace(/,\s*BC$/, "")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/**
 * **"We couldn't find that."** Said before anything else is offered, with
 * what Atlas does know, and with the one honest way forward that keeps the
 * request visible: plan without it, because the person said to.
 */
function NotFound({
  day,
  onSetAside,
  onWider,
}: {
  readonly day: DayPlanned;
  readonly onSetAside: (activity: string) => void;
  readonly onWider: () => void;
}) {
  const unmet = day.unmet ?? [];
  return (
    <div
      id="go-not-found"
      data-testid="go-not-found"
      role="status"
      className="mt-6 scroll-mt-4 rounded-2xl bg-amber-50 p-5 text-amber-950 ring-1 ring-amber-900/20 ring-inset"
    >
      <h2 className="ghad-display text-[22px] leading-tight font-extrabold tracking-[-0.02em]">
        {day.stops.length > 0
          ? `Not in this day: ${unmet.map((u) => u.activity).join(", ")}`
          : `Nothing for ${unmet.map((u) => u.activity).join(" or ")} — so there isn't a day to offer yet`}
      </h2>
      <p
        data-testid="go-not-found-says"
        className="mt-2 text-[15px] leading-relaxed"
      >
        {day.opening}
      </p>
      <p className="mt-2 text-[14px] text-amber-950/70">
        {day.stops.length > 0
          ? "The rest of what you asked for is below. "
          : "I haven't swapped in something else. "}
        You asked for {unmet.map((u) => u.activity).join(" and ")}; that stays
        on the page until you tell me otherwise.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {unmet.map((u) => (
          <button
            key={u.activity}
            type="button"
            data-testid={`go-without-${u.activity.replace(/\W+/g, "-")}`}
            onClick={() => onSetAside(u.activity)}
            className="inline-flex min-h-10 items-center rounded-full bg-[#111] px-4 text-[13px] font-semibold text-white"
          >
            Plan the day without {u.activity}
          </button>
        ))}
        <button
          type="button"
          data-testid="go-wider"
          onClick={onWider}
          className="inline-flex min-h-10 items-center rounded-full px-4 text-[13px] font-semibold text-[#111] ring-1 ring-black/30 ring-inset"
        >
          Look further out
        </button>
      </div>
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

/** A change of town leaves what they kept alone — and says it did. */
function keptNote(
  before: DayBrief,
  after: DayBrief,
  keep: readonly string[],
  pool: readonly Experience[],
): string[] {
  if (after.town?.id === before.town?.id) return [];
  const names = keep
    .map((id) => pool.find((e) => e.id === id)?.title)
    .filter((t): t is string => Boolean(t));
  return names.length > 0 ? [`Still kept: ${names.join(", ")}.`] : [];
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

/** Whether a stored value is a saved day this page could adopt. */
const parses = (raw: string | null): boolean => {
  if (!raw) return false;
  try {
    JSON.parse(raw);
    return true;
  } catch {
    return false;
  }
};

/** A phone or tablet: where a share sheet beats a clipboard. */
const isTouchDevice = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(pointer: coarse)").matches === true;

const fallbackFrom = (
  childAge: number | undefined,
  townId: string | undefined,
  on: string,
): Partial<DayBrief> => ({
  ...(childAge !== undefined ? { childAge } : {}),
  ...(townById(townId) ? { town: townById(townId)! } : {}),
  on,
});
