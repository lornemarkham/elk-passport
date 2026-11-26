"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  ExternalLink,
  Info,
  Lock,
  MapPin,
  Navigation,
  Share2,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import {
  ADVENT_COOKIE,
  ADVENT_DISTANCES,
  AGE_BANDS,
  BUDGET_CHOICES,
  DOORS,
  INTEREST_CHOICES,
  SETTING_CHOICES,
  WHO_CHOICES,
  dayOf,
  daysBetween,
  longDay,
  writePrefs,
  type AdventPrefs,
  type Stage,
} from "@/domain/christmas/advent/model";
import {
  optionAt,
  type AdventOption,
  type DayPlan,
} from "@/domain/christmas/advent/pick";
import {
  EMPTY_PROGRESS,
  PROGRESS_KEY,
  completedCount,
  open as openDay,
  progressLine,
  readProgress,
  swap as swapDay,
  toggleDone,
  type Progress,
} from "@/domain/christmas/advent/progress";
import { cn } from "@/lib/utils";
import styles from "./advent.module.css";

// ------------------------------------------------- progress on this browser

/** Where progress lives when the browser refuses storage (private mode). */
let memory: string | null = null;
let cached: { raw: string | null; value: Progress } = {
  raw: null,
  value: EMPTY_PROGRESS,
};
const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(PROGRESS_KEY) ?? memory;
  } catch {
    return memory;
  }
}

function snapshot(): Progress {
  const raw = readRaw();
  if (raw !== cached.raw) cached = { raw, value: readProgress(raw) };
  return cached.value;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function store(next: Progress) {
  memory = JSON.stringify(next);
  try {
    window.localStorage.setItem(PROGRESS_KEY, memory);
  } catch {
    // Not saved past this visit; the calendar still works now.
  }
  for (const l of listeners) l();
}

/**
 * **Advent Adventure, on the phone** — the board of 25 doors, the reveal,
 * Swap, Mark completed, Share and the family's choices.
 *
 * The server sends only the days that have come (a future door has nothing
 * in the page to peek at); progress is this browser's (`progress.ts`); the
 * family's choices are a cookie, and saving them asks the server for new
 * doors (`router.refresh`).
 */
export function AdventCalendar({
  plans,
  today,
  stage,
  preview = false,
  prefs,
  said,
  townName,
  lightsHref,
  plannerBase,
  outage,
}: {
  readonly plans: readonly DayPlan[];
  readonly today: string;
  readonly stage: Stage;
  /** Advent Preview Mode: every door is open; Surprise me picks any door. */
  readonly preview?: boolean;
  readonly prefs: AdventPrefs;
  /** The family has told us something already. */
  readonly said: boolean;
  readonly townName: string;
  readonly lightsHref: string;
  /** `/christmas/itinerary?at=…` — an idea's sentence is added to it. */
  readonly plannerBase: string;
  readonly outage: boolean;
}) {
  const progress = useSyncExternalStore(
    subscribe,
    snapshot,
    () => EMPTY_PROGRESS,
  );
  const [showing, setShowing] = useState<number>();
  const [fresh, setFresh] = useState(false);
  const [shaking, setShaking] = useState<number>();
  const [note, setNote] = useState<string>();
  const [choosing, setChoosing] = useState(false);
  const save = useCallback((next: Progress) => store(next), []);

  const byDay = useMemo(
    () => new Map(plans.map((p) => [p.n, p] as const)),
    [plans],
  );
  const todayPlan = plans.find((p) => p.date === today);
  const done = completedCount(progress);
  const total = stage === "after" || stage === "over" ? 34 : DOORS;

  const reveal = (n: number, surprise = false) => {
    if (!byDay.has(n)) return;
    save(openDay(progress, n));
    setFresh(surprise || !progress.opened.includes(n));
    setShowing(n);
  };

  // Preview: Surprise me opens a door not yet opened (any, once all have been).
  const surpriseAny = () => {
    const unopened = plans.filter((p) => !progress.opened.includes(p.n));
    const pool = unopened.length ? unopened : plans;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) reveal(pick.n, true);
  };

  const knock = (n: number) => {
    const date = dayOf(n).date;
    setShaking(n);
    setNote(
      `Door ${n} opens on ${longDay(date)} — ${daysBetween(today, date)} sleep${daysBetween(today, date) === 1 ? "" : "s"}. No peeking!`,
    );
    window.setTimeout(() => setShaking(undefined), 500);
  };

  const shown = showing !== undefined ? byDay.get(showing) : undefined;
  const firstDoor = dayOf(1).date;

  return (
    <div className="space-y-6">
      {/* Progress and the two big buttons, above the board on a phone. */}
      <section aria-label="Your Advent" className="space-y-2">
        <div className="flex items-center gap-3 rounded-[18px] bg-[#082319] px-4 py-2.5 text-white">
          <p
            className="min-w-0 flex-1 text-sm leading-tight font-extrabold sm:text-base"
            data-testid="advent-progress"
          >
            {progressLine(done)}
          </p>
          <div
            className={`${styles.bar} w-20 shrink-0 sm:w-40`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
            aria-label={`Adventures completed: ${done} of ${total}, saved on this browser`}
          >
            <div
              className={styles.barFill}
              style={{ width: `${Math.min(100, (done / total) * 100)}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-bold text-white/75">
            {done}/{total}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() =>
              preview
                ? surpriseAny()
                : todayPlan
                  ? reveal(todayPlan.n, true)
                  : setNote(
                      `The first door opens on ${longDay(firstDoor)}. Come back then!`,
                    )
            }
            className="flex min-h-12 items-center justify-center gap-2 rounded-[18px] bg-[#b3242f] px-3 font-extrabold text-white shadow-[0_8px_20px_rgba(179,36,47,0.3)] hover:brightness-110"
            data-testid="advent-surprise"
          >
            <Sparkles className="h-5 w-5 text-[#ffd98a]" aria-hidden />
            Surprise me
          </button>
          <button
            type="button"
            onClick={() => setChoosing(true)}
            className="flex min-h-12 items-center justify-center gap-2 rounded-[18px] bg-white px-3 font-extrabold text-[#082319] ring-1 ring-black/10 hover:ring-black/30"
            data-testid="advent-prefs-open"
          >
            <SlidersHorizontal className="h-5 w-5 text-[#b3242f]" aria-hidden />
            {said ? "Your choices" : "Make it yours"}
          </button>
        </div>
      </section>

      {note && (
        <p
          role="status"
          className="flex items-start justify-between gap-3 rounded-2xl bg-[#ffd98a] px-4 py-3 font-semibold text-[#082319]"
          data-testid="advent-note"
        >
          <span>{note}</span>
          <button
            type="button"
            onClick={() => setNote(undefined)}
            aria-label="Dismiss"
            className="-m-1 p-1"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </p>
      )}

      {outage && (
        <p className="rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-black/10">
          The event listings aren&apos;t answering just now, so today&apos;s
          doors hold our ideas. Real events come back when they do.
        </p>
      )}

      {stage === "after" && (
        <NewYearStrip
          plans={plans.filter((p) => p.n > DOORS)}
          today={today}
          progress={progress}
          onOpen={(n) => reveal(n)}
        />
      )}

      <section aria-labelledby="doors-title">
        <h2 id="doors-title" className="sr-only">
          {stage === "after" || stage === "over"
            ? "Your Advent, door by door"
            : "The 25 doors"}
        </h2>
        <ol className={styles.board} data-testid="advent-doors">
          {Array.from({ length: DOORS }, (_, i) => i + 1).map((n) => {
            const plan = byDay.get(n);
            const isToday = dayOf(n).date === today;
            // A door still shut (after the preview) shows no trace of having
            // been opened; its completed mark still counts in the total.
            const opened = Boolean(plan) && progress.opened.includes(n);
            const did = plan ? progress.done[n] : undefined;
            const option = plan
              ? optionAt(plan, progress.swaps[n] ?? 0)
              : undefined;
            const label = plan
              ? `Door ${n}${isToday ? ", today" : ""}${did ? ", completed" : opened ? `, ${option?.title ?? "opened"}` : ", ready to open"}`
              : `Door ${n}, opens ${longDay(dayOf(n).date)}`;
            return (
              <li key={n} className={styles.slot}>
                <div className={styles.inside} aria-hidden>
                  <span className="text-2xl sm:text-4xl">
                    {did ? "⭐" : (option?.emoji ?? "🎁")}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => (plan ? reveal(n) : knock(n))}
                  aria-label={label}
                  data-testid={`door-${n}`}
                  data-state={
                    did ? "done" : opened ? "open" : plan ? "ready" : "locked"
                  }
                  className={cn(
                    styles.door,
                    styles[`c${(n * 7) % 5}` as "c0"],
                    (opened || did) && styles.ajar,
                    !plan && styles.locked,
                    isToday && !opened && styles.today,
                    shaking === n && styles.shake,
                  )}
                >
                  <span className={styles.number}>{n}</span>
                  {!plan && (
                    <Lock className="mt-1 h-3 w-3 opacity-70" aria-hidden />
                  )}
                  {did && (
                    <Check
                      className="absolute top-1 right-1 h-4 w-4 rounded-full bg-[#ffd98a] p-0.5 text-[#082319]"
                      aria-hidden
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ol>
        {stage === "doors" && (
          <p className="mt-3 text-sm text-[var(--gh-ink-soft)]">
            After Christmas: a New Year&apos;s adventure every day until January
            3.
          </p>
        )}
      </section>

      {stage === "over" && (
        <NewYearStrip
          plans={plans.filter((p) => p.n > DOORS)}
          today={today}
          progress={progress}
          onOpen={(n) => reveal(n)}
        />
      )}

      {shown && (
        <Reveal
          plan={shown}
          option={optionAt(shown, progress.swaps[shown.n] ?? 0)}
          done={progress.done[shown.n]?.title}
          fresh={fresh}
          today={today}
          townName={townName}
          lightsHref={lightsHref}
          plannerBase={plannerBase}
          onSwap={() => {
            setFresh(true);
            save(swapDay(progress, shown.n));
          }}
          onDone={(o) =>
            save(
              toggleDone(
                progress,
                shown.n,
                o && { key: o.key, title: o.title, emoji: o.emoji },
              ),
            )
          }
          onClose={() => setShowing(undefined)}
        />
      )}

      {choosing && (
        <PrefsSheet prefs={prefs} onClose={() => setChoosing(false)} />
      )}
    </div>
  );
}

/** After Christmas: nine days to January 3, each a round token. */
function NewYearStrip({
  plans,
  today,
  progress,
  onOpen,
}: {
  readonly plans: readonly DayPlan[];
  readonly today: string;
  readonly progress: Progress;
  readonly onOpen: (n: number) => void;
}) {
  const days = Array.from({ length: 9 }, (_, i) => dayOf(26 + i));
  return (
    <section
      aria-labelledby="ny-title"
      className={`${styles.sky} rounded-[26px] p-4 sm:p-5`}
      data-testid="advent-new-year"
    >
      <h2
        id="ny-title"
        className="ghad-display text-2xl font-extrabold tracking-tight"
      >
        🎆 New Year&apos;s adventures
      </h2>
      <p className="mt-1 text-sm text-white/85">
        Boxing Day to January 3 — one a day, the same way.
      </p>
      <ol className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1">
        {days.map((d) => {
          const plan = plans.find((p) => p.n === d.n);
          const did = progress.done[d.n];
          const isToday = d.date === today;
          const label = new Intl.DateTimeFormat("en-CA", {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          }).format(new Date(`${d.date}T12:00:00Z`));
          return (
            <li key={d.n} className="shrink-0 snap-start">
              <button
                type="button"
                disabled={!plan}
                onClick={() => onOpen(d.n)}
                data-testid={`ny-day-${d.n}`}
                className={cn(
                  "flex h-20 w-16 flex-col items-center justify-center rounded-2xl text-sm font-extrabold",
                  plan
                    ? "bg-white text-[#082319]"
                    : "bg-white/15 text-white/70",
                  isToday && "ring-4 ring-[#ffd98a]",
                )}
                aria-label={`${label}${plan ? "" : ", not yet"}${did ? ", completed" : ""}`}
              >
                <span className="text-xl" aria-hidden>
                  {did ? "⭐" : plan ? "🎆" : "🔒"}
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Reveal({
  plan,
  option,
  done,
  fresh,
  today,
  townName,
  lightsHref,
  plannerBase,
  onSwap,
  onDone,
  onClose,
}: {
  readonly plan: DayPlan;
  readonly option: AdventOption | undefined;
  readonly done: string | undefined;
  readonly fresh: boolean;
  readonly today: string;
  readonly townName: string;
  readonly lightsHref: string;
  readonly plannerBase: string;
  readonly onSwap: () => void;
  readonly onDone: (o: AdventOption | undefined) => void;
  readonly onClose: () => void;
}) {
  const [shared, setShared] = useState<string>();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const html = document.documentElement;
    const was = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      html.style.overflow = was;
    };
  }, [onClose]);

  const heading =
    plan.n === 0
      ? "A warm-up for today"
      : plan.door
        ? `Door ${plan.n}`
        : (plan.name ?? "New Year's adventure");
  const dayLine = `${plan.name && plan.door ? `${plan.name} · ` : ""}${longDay(plan.date)}`;
  const past = plan.date < today;

  const share = async () => {
    if (!option) return;
    const url =
      option.details !== undefined
        ? new URL(option.details, window.location.origin).toString()
        : new URL("/christmas/advent", window.location.origin).toString();
    const text = `${plan.door ? `Door ${plan.n} of our Advent Adventure` : "Our holiday adventure"}: ${option.title} ${option.emoji}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: option.title, text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} — ${url}`);
      setShared("Copied — paste it to whoever's coming.");
    } catch (error) {
      if ((error as Error)?.name !== "AbortError")
        setShared("Couldn't share from this browser.");
    }
  };

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reveal-title"
        className={cn(styles.sheet, fresh && styles.pop)}
        data-testid="advent-reveal"
        data-kind={option?.kind}
      >
        {fresh && (
          <div className={cn(styles.burst, styles.sparkle)} aria-hidden />
        )}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-[#b3242f] uppercase">
              {heading}
            </p>
            <p className="text-sm font-semibold text-[var(--gh-ink-soft)]">
              {dayLine}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-m-1 grid h-11 w-11 place-items-center rounded-full hover:bg-black/5"
            aria-label="Close"
            data-testid="advent-close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {option ? (
          <article className="mt-3" key={option.key}>
            <div className="flex items-start gap-3">
              <span className="text-5xl leading-none" aria-hidden>
                {done ? "⭐" : option.emoji}
              </span>
              <div className="min-w-0">
                <span
                  className={cn(
                    "inline-block rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase",
                    option.kind === "event"
                      ? "bg-[#0f3b2b] text-white"
                      : "bg-[#f3ead8] text-[#5b4a2e]",
                  )}
                  data-testid="reveal-kind"
                >
                  {option.kind === "event"
                    ? `Real event near ${townName}`
                    : "An idea, not a listing"}
                </span>
                <h3
                  id="reveal-title"
                  className="ghad-display mt-1.5 text-2xl leading-tight font-extrabold text-balance"
                  data-testid="reveal-title"
                >
                  {option.title}
                </h3>
              </div>
            </div>
            {option.line && option.line.length >= 24 && (
              <p className="mt-3 line-clamp-4 text-base text-[var(--gh-ink-soft)]">
                {option.line}
              </p>
            )}
            <ul className="mt-3 space-y-1.5 text-sm">
              {option.when && (
                <li className="flex gap-2">
                  <CalendarDays
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#b3242f]"
                    aria-hidden
                  />
                  <span data-testid="reveal-when">{option.when}</span>
                </li>
              )}
              {option.where && (
                <li className="flex gap-2">
                  <MapPin
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#b3242f]"
                    aria-hidden
                  />
                  <span>
                    {option.where}
                    {option.km !== undefined &&
                      ` · about ${option.km} km from ${townName}`}
                  </span>
                </li>
              )}
              {option.kind === "event" && (
                <li className="flex gap-2">
                  <Tag
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#b3242f]"
                    aria-hidden
                  />
                  <span>
                    {option.free
                      ? "Free, the organiser says"
                      : option.price
                        ? `In the organiser's words — ${option.price}`
                        : "Price not listed — check before you go"}
                  </span>
                </li>
              )}
              {option.careful && (
                <li className="flex gap-2 text-[#5b4a2e]">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{option.careful}</span>
                </li>
              )}
            </ul>
            <p className="mt-3 text-xs text-[var(--gh-ink-soft)]">
              {option.because}
              {past &&
                option.kind === "event" &&
                " Its day has passed, but it's still on — you can catch up today."}
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onDone(option)}
                aria-pressed={Boolean(done)}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 text-sm font-extrabold",
                  done
                    ? "bg-[#ffd98a] text-[#082319]"
                    : "bg-[#0f3b2b] text-white hover:brightness-110",
                )}
                data-testid="advent-done"
              >
                <Check className="h-5 w-5" aria-hidden />
                {done ? "Completed!" : "Mark completed"}
              </button>
              <button
                type="button"
                onClick={onSwap}
                disabled={Boolean(done) || plan.options.length < 2}
                className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl bg-white px-2 text-sm font-extrabold ring-1 ring-black/10 hover:ring-black/30 disabled:opacity-40"
                data-testid="advent-swap"
              >
                <Shuffle className="h-5 w-5 text-[#b3242f]" aria-hidden />
                Swap
              </button>
              <button
                type="button"
                onClick={share}
                className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl bg-white px-2 text-sm font-extrabold ring-1 ring-black/10 hover:ring-black/30"
                data-testid="advent-share"
              >
                <Share2 className="h-5 w-5 text-[#b3242f]" aria-hidden />
                Share
              </button>
            </div>
            {shared && (
              <p role="status" className="mt-2 text-sm font-semibold">
                {shared}
              </p>
            )}
            {done && done !== option.title && (
              <p className="mt-2 text-sm text-[var(--gh-ink-soft)]">
                You did: {done}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
              {option.directions && (
                <a
                  href={option.directions}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[#b3242f] px-4 text-white"
                  data-testid="reveal-directions"
                >
                  <Navigation className="h-4 w-4" aria-hidden />
                  Directions
                </a>
              )}
              {option.details && (
                <Link
                  href={option.details}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-4 ring-1 ring-black/10"
                  data-testid="reveal-details"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  Details &amp; source
                </Link>
              )}
              {option.plan && (
                <Link
                  href={`${plannerBase}&say=${encodeURIComponent(option.plan)}`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-4 ring-1 ring-black/10"
                >
                  <Sparkles className="h-4 w-4 text-[#b3242f]" aria-hidden />
                  Find real places for it
                </Link>
              )}
              {option.lights && (
                <Link
                  href={lightsHref}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-4 ring-1 ring-black/10"
                >
                  <MapPin className="h-4 w-4 text-[#b3242f]" aria-hidden />
                  Open the lights map
                </Link>
              )}
            </div>
          </article>
        ) : (
          <p className="mt-4">Nothing behind this door yet — try again soon.</p>
        )}
      </div>
    </div>
  );
}

/** The family's choices: one sheet of taps, every one optional. */
function PrefsSheet({
  prefs,
  onClose,
}: {
  readonly prefs: AdventPrefs;
  readonly onClose: () => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<AdventPrefs>(prefs);
  const [saving, setSaving] = useState(false);

  const chip = (on: boolean) =>
    cn(
      "inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 px-3.5 text-sm font-semibold",
      on
        ? "border-[#b3242f] bg-[#b3242f] text-white"
        : "border-black/10 bg-white hover:border-black/30",
    );

  const apply = () => {
    setSaving(true);
    const seed = draft.seed || Math.floor(Math.random() * 1e8) + 1;
    const value = encodeURIComponent(writePrefs({ ...draft, seed }));
    document.cookie = `${ADVENT_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 120}; samesite=lax`;
    router.refresh();
    window.setTimeout(onClose, 150);
  };

  const row = (title: string, children: React.ReactNode) => (
    <fieldset className="mt-4">
      <legend className="text-sm font-bold">{title}</legend>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="prefs-title"
        className={styles.sheet}
        data-testid="advent-prefs"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="prefs-title"
              className="ghad-display text-2xl font-extrabold"
            >
              Make it yours
            </h2>
            <p className="text-sm text-[var(--gh-ink-soft)]">
              All optional. Tap what fits; skip the rest.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-m-1 grid h-11 w-11 place-items-center rounded-full hover:bg-black/5"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {row(
          "Who's coming?",
          WHO_CHOICES.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-pressed={draft.who === c.value}
              className={chip(draft.who === c.value)}
              onClick={() => {
                const { who, ...rest } = draft;
                setDraft(who === c.value ? rest : { ...rest, who: c.value });
              }}
            >
              <span aria-hidden>{c.emoji}</span>
              {c.label}
            </button>
          )),
        )}
        {row(
          "Kids' ages",
          AGE_BANDS.map((b) => {
            const on = draft.ages.includes(b.age);
            return (
              <button
                key={b.age}
                type="button"
                aria-pressed={on}
                className={chip(on)}
                onClick={() =>
                  setDraft({
                    ...draft,
                    ages: on
                      ? draft.ages.filter((a) => a !== b.age)
                      : [...draft.ages, b.age],
                  })
                }
              >
                {b.label}
              </button>
            );
          }),
        )}
        {row(
          "How far will you go?",
          ADVENT_DISTANCES.map((km) => (
            <button
              key={km}
              type="button"
              aria-pressed={draft.km === km}
              className={chip(draft.km === km)}
              onClick={() => setDraft({ ...draft, km })}
            >
              {km} km
            </button>
          )),
        )}
        {row(
          "Budget",
          BUDGET_CHOICES.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-pressed={draft.budget === c.value}
              className={chip(draft.budget === c.value)}
              onClick={() => setDraft({ ...draft, budget: c.value })}
            >
              {c.label}
            </button>
          )),
        )}
        {row(
          "Indoors or out?",
          SETTING_CHOICES.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-pressed={draft.setting === c.value}
              className={chip(draft.setting === c.value)}
              onClick={() => setDraft({ ...draft, setting: c.value })}
            >
              {c.label}
            </button>
          )),
        )}
        {row(
          "What do you love?",
          INTEREST_CHOICES.map((c) => {
            const on = draft.interests.includes(c.value);
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={on}
                className={chip(on)}
                onClick={() =>
                  setDraft({
                    ...draft,
                    interests: on
                      ? draft.interests.filter((i) => i !== c.value)
                      : [...draft.interests, c.value],
                  })
                }
              >
                <span aria-hidden>{c.emoji}</span>
                {c.label}
              </button>
            );
          }),
        )}
        <p className="mt-4 text-xs text-[var(--gh-ink-soft)]">
          Where you are is the place at the top of the page. Your choices stay
          on this browser.
        </p>
        <button
          type="button"
          onClick={apply}
          disabled={saving}
          className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#b3242f] px-6 text-base font-extrabold text-white hover:brightness-110 disabled:opacity-60"
          data-testid="advent-prefs-save"
        >
          {saving ? "Choosing your doors…" : "Save — pick my adventures"}
        </button>
      </div>
    </div>
  );
}
