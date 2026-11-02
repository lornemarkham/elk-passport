"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";
import {
  Check,
  ChevronDown,
  CloudSun,
  Heart,
  MapPin,
  Share2,
  Sunset,
  Trash2,
  X,
} from "lucide-react";
import { AdventurePeople } from "@/components/adventures/AdventurePeople";
import { EveningChooser } from "./EveningChooser";
import { EveningPlan, type PlanActions } from "./EveningPlan";
import { MakeItOurs, type MakeItOursHandle } from "./MakeItOurs";
import { NextDates } from "./NextDates";
import { NightMemories } from "./NightMemories";
import styles from "./night.module.css";
import type { Experience } from "@/domain/experience/types";
import type { Mood, NightConfig } from "@/domain/date-night/adventures";
import type { Moment } from "@/domain/christmas/recap";
import type {
  AdventureView,
  InviteView,
  ItemView,
} from "@/lib/adventures/store";
import type { PackingView } from "@/lib/date-night/night";
import type { DayForecast } from "@/domain/date-night/conditions";
import {
  composeDay,
  DEFAULT_ANSWERS,
  type DayAnswers,
} from "@/domain/date-night/adventures/compose";
import {
  eveningNamed,
  eveningOf,
  PHOTOS,
  type Evening,
} from "@/domain/date-night/adventures/evenings";
import {
  addStop,
  changeStop,
  clock,
  homeAt,
  instantOf,
  layOut,
  moveStop,
  optionStop,
  planFromItems,
  removeStop,
  switchEnding,
  templatePlan,
  untouched,
  warningsFor,
  type PlanStop,
  type StoredStop,
} from "@/domain/date-night/adventures/itinerary";

/** The adventure's name without the heart its database title carries. */
const displayTitle = (title: string) => title.replace(/\s*❤️\s*$/u, "");

const POLL_MS = 15_000;

async function call(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(String(response.status));
  return response;
}

const fullDate = (on: string) =>
  new Date(`${on}T12:00:00Z`).toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

function countdown(on: string, today: string): string {
  const days = Math.round(
    (Date.parse(`${on}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) /
      86_400_000,
  );
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1) return `In ${days} days`;
  return "Relive it";
}

const MOODS: readonly Mood[] = ["romantic", "adventurous", "cozy", "playful"];

/** Two moods and a coin toss on the plunge; the composer does the rest. */
function surpriseAnswers(random: () => number = Math.random): DayAnswers {
  const first = MOODS[Math.floor(random() * MOODS.length)]!;
  const rest = MOODS.filter((m) => m !== first);
  return {
    ...DEFAULT_ANSWERS,
    when: "evening",
    moods: [first, rest[Math.floor(random() * rest.length)]!],
    plunge: random() < 0.5,
  };
}

type Phase = "before" | "during" | "after";

/**
 * **The Markham Adventure, as one thing.** From the top: the hero; choose our
 * adventure; our adventure — the one itinerary; make it ours, in words; and
 * together — the invitation, the packing, the memories, shown when they're
 * useful. Every planning action (a card, an ending, a sentence, Change ·
 * Move · Remove · Add) edits the same itinerary, stored as the adventure's
 * own day (`itinerary.ts`, `PUT /api/night/[id]/plan`). The page refreshes
 * itself so the other person's changes appear without a reload.
 */
export function NightBoard({
  view,
  invites,
  packing,
  moments,
  sharing,
  experiences,
  config,
  dayStops,
  today,
  now,
  forecast,
  sunsetMinutes,
}: {
  view: AdventureView;
  invites: readonly InviteView[];
  packing: readonly PackingView[] | null;
  moments: readonly Moment[];
  sharing: boolean;
  experiences: Record<string, Experience>;
  config: NightConfig | null;
  /** The day's items, with their times as local minutes. */
  dayStops: readonly StoredStop[];
  today: string;
  /** Local minutes after midnight, now. */
  now: number;
  forecast?: DayForecast;
  /** Sunset on the day, local minutes after midnight (legal time). */
  sunsetMinutes: number;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [saving, setSaving] = useState<string | null>(null);
  const [local, setLocal] = useState<PlanStop[] | null>(null);
  const [previous, setPrevious] = useState<PlanStop[] | null>(null);
  const [confirm, setConfirm] = useState<{
    evening: Evening;
    stops: PlanStop[];
  } | null>(null);
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [bring, setBring] = useState("");
  const ours = useRef<MakeItOursHandle>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !saving)
        startRefresh(() => router.refresh());
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [router, saving]);

  const day = config?.day ?? null;
  const sunset = sunsetMinutes;
  const isOwner = view.role === "owner";
  const others = view.members.filter((m) => !m.isYou);
  const otherName = others[0]?.displayName ?? null;
  const ownerName =
    view.members.find((m) => m.role === "owner" && !m.isYou)?.displayName ??
    null;
  const partner = config?.partnerName ?? "your person";
  const evenings = (config?.evenings ?? []).flatMap(
    (id) => eveningOf(id) ?? [],
  );
  const dayAsk = day
    ? (view.days.find((d) => d.onDay === day.on)?.ask ?? null)
    : null;
  const evening =
    eveningNamed(view.destinationLabel) ??
    eveningOf(new URLSearchParams(dayAsk ?? "").get("evening"));

  // The stored day is the itinerary. A night chosen before it was stored
  // this way shows its adventure's own plan until the first change saves it.
  const serverPlan = useMemo(() => {
    if (!day) return null;
    const stored = planFromItems(dayStops, evening, day);
    if (stored) return stored;
    return evening && !evening.composed
      ? templatePlan(evening, sunset, day)
      : null;
  }, [dayStops, evening, day, sunset]);
  const serverKey = JSON.stringify(dayStops);
  // New rows from the server replace what this tab was showing meanwhile.
  const [seen, setSeen] = useState(serverKey);
  if (seen !== serverKey) {
    setSeen(serverKey);
    setLocal(null);
  }
  const plan = local ?? serverPlan;
  const busy = saving !== null || refreshing;

  // ---------------------------------------------------------------- saving

  async function save(
    next: readonly PlanStop[],
    label: string,
    done?: string,
    undoable = true,
  ): Promise<boolean> {
    if (!day) return false;
    setSaving(label);
    const before = plan;
    setLocal([...next]);
    try {
      await call(`/api/night/${view.id}/plan`, "PUT", {
        label,
        stops: next.map((s) => ({
          ...(s.id ? { id: s.id } : {}),
          title: s.title,
          line: s.line,
          at: Math.round(s.at),
          ...(s.atlasRef ? { atlasRef: s.atlasRef } : {}),
        })),
        base: dayStops.map((s) => s.id),
      });
      if (undoable && before) setPrevious(before);
      startRefresh(() => router.refresh());
      if (done)
        toast.success(done, {
          ...(undoable && before
            ? { action: { label: "Undo", onClick: () => void undo(before) } }
            : {}),
        });
      return true;
    } catch {
      setLocal(null);
      toast.error("That didn't save. Try again.");
      return false;
    } finally {
      setSaving(null);
    }
  }

  async function undo(to: readonly PlanStop[] | null = previous) {
    if (!to) return;
    // Ids from before may be gone: the old stops are written fresh.
    const known = new Set(dayStops.map((s) => s.id));
    const restored = to.map(({ id, ...s }) =>
      id && known.has(id) ? { ...s, id } : s,
    );
    if (
      await save(restored, evening?.title ?? "Our own plan", undefined, false)
    )
      setPrevious(null);
  }

  function surprisePlan(): PlanStop[] | null {
    if (!day) return null;
    const composed = composeDay(day, surpriseAnswers());
    if (composed.stops.length === 0) return null;
    const stops: Omit<PlanStop, "at">[] = [
      {
        key: "leave",
        title: "Off we go",
        line: "Warm layers, a thermos, no particular hurry.",
        minutes: 0,
        travel: 0,
      },
    ];
    let end = composed.startAt;
    for (const s of composed.stops) {
      stops.push({
        ...optionStop(
          s.option,
          s.option.phase === "unwind" ? "dinner" : "fun",
          Math.max(0, s.arrive - end),
        ),
        minutes: s.leave - s.arrive,
      });
      end = s.leave;
    }
    stops.push({
      key: "home",
      title: day.finale.title,
      line: day.finale.line,
      minutes: 0,
      travel: 15,
    });
    return layOut(stops, composed.startAt, sunset, eveningOf("surprise"), day);
  }

  async function choose(e: Evening) {
    if (!day) return;
    if (!isOwner) {
      try {
        await call(`/api/adventures/${view.id}/items`, "POST", {
          label: `Let's do ${e.title}`,
        });
        toast.success(
          `Suggested. ${ownerName ?? "The planner"} will see it under Together.`,
        );
        startRefresh(() => router.refresh());
      } catch {
        toast.error("That didn't send. Try again.");
      }
      return;
    }
    const next = e.composed ? surprisePlan() : templatePlan(e, sunset, day);
    if (!next) {
      toast.error("Passport couldn't find a surprise that's open tonight.");
      return;
    }
    if (
      plan &&
      evening &&
      e.id !== evening.id &&
      !untouched(plan, evening, sunset, day)
    ) {
      setConfirm({ evening: e, stops: next });
      document
        .getElementById("evenings")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    await adopt(e, next);
  }

  async function adopt(e: Evening, next: PlanStop[]) {
    setConfirm(null);
    if (await save(next, e.title, `${e.title} is the plan.`))
      document
        .getElementById("plan")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ------------------------------------------------------------ the plan

  const label = evening?.title ?? "Our own plan";
  const actions: PlanActions | null =
    plan && day
      ? {
          move: (i, d) => {
            const next = moveStop(plan, i, d, sunset, evening, day);
            if (next) void save(next, label, `Moved ${plan[i]!.title}.`);
          },
          remove: (i) => {
            const stop = plan[i]!;
            if (!isOwner) {
              if (stop.id) void dropMine(stop.id);
              return;
            }
            const next = removeStop(plan, i, sunset, evening, day);
            if (next) void save(next, label, `Removed ${stop.title}.`);
          },
          change: (i, patch) => {
            const stop = plan[i]!;
            if (!isOwner) {
              if (stop.id) void changeMine(stop.id, patch);
              return;
            }
            // A renamed stop is somebody's own now: it loses its rules.
            const next = changeStop(plan, i, patch, sunset, evening, day).map(
              (s, j) => {
                if (j !== i || patch.title === stop.title) return s;
                const { key: _key, ...own } = s;
                return own;
              },
            );
            void save(next, label, `Changed ${patch.title}.`);
          },
          add: (stop, after) => {
            const next = addStop(
              plan,
              { ...stop, travel: 0 },
              after,
              sunset,
              evening,
              day,
            );
            if (isOwner) void save(next, label, `Added ${stop.title}.`);
            else void addMine(next, stop.title, stop.line);
          },
          ending: (id) => {
            if (!evening) return;
            const to = evening.endings?.find((x) => x.id === id);
            void save(
              switchEnding(plan, evening, id, sunset, day),
              label,
              `${to?.title ?? "The other ending"}. The rest stays as it was.`,
            );
          },
        }
      : null;

  /** The other person's own stop: added through the core, as a proposal. */
  async function addMine(next: PlanStop[], title: string, line: string) {
    if (!day) return;
    const added = next.find((s) => !s.id && s.title === title && !s.key);
    if (!added) return;
    setSaving("add");
    try {
      await call(`/api/adventures/${view.id}/items`, "POST", {
        label: title,
        note: line || null,
        onDay: day.on,
        startsAt: instantOf(day, added.at),
      });
      toast.success(
        `Added. ${ownerName ?? "The planner"} sees it on the plan.`,
      );
      startRefresh(() => router.refresh());
    } catch {
      toast.error("Couldn't add that. Try again.");
    } finally {
      setSaving(null);
    }
  }

  async function changeMine(
    itemId: string,
    patch: { title: string; line: string },
  ) {
    try {
      await call(`/api/adventures/${view.id}/items/${itemId}`, "PATCH", {
        label: patch.title,
        note: patch.line || null,
      });
      startRefresh(() => router.refresh());
    } catch {
      toast.error("Only what you added is yours to change.");
    }
  }

  async function dropMine(itemId: string) {
    try {
      await call(`/api/adventures/${view.id}/items/${itemId}`, "DELETE");
      startRefresh(() => router.refresh());
    } catch {
      toast.error("Only what you added is yours to remove.");
    }
  }

  async function suggest(said: string): Promise<boolean> {
    try {
      await call(`/api/adventures/${view.id}/items`, "POST", {
        label: said.slice(0, 120),
      });
      toast.success(`Sent to ${ownerName ?? "the planner"}.`);
      startRefresh(() => router.refresh());
      return true;
    } catch {
      toast.error("That didn't send. Try again.");
      return false;
    }
  }

  // -------------------------------------------------------------- together

  const seeded = new Set((config?.activities ?? []).map((a) => a.title));
  const asks = view.items.filter(
    (i) => !i.onDay && i.label && !i.atlasRef && !seeded.has(i.label),
  );

  async function invite() {
    setSaving("invite");
    try {
      const response = await call(
        `/api/adventures/${view.id}/invites`,
        "POST",
        {},
      );
      const body = await response.json();
      const url = `${window.location.origin}${body.path}`;
      const text = [
        ...(config?.invitation ?? ["Help me plan our adventure."]),
        url,
      ].join("\n\n");
      // Copied first, always: if the share sheet is dismissed or missing,
      // the invitation is still in hand.
      const copied = await navigator.clipboard
        .writeText(text)
        .then(() => true)
        .catch(() => false);
      if (navigator.share)
        await navigator.share({ text }).catch(() => undefined);
      else if (copied) toast.success("Invitation copied. Send it to them.");
      startRefresh(() => router.refresh());
    } catch {
      toast.error("Couldn't make the invitation. Try again.");
    } finally {
      setSaving(null);
    }
  }

  async function tick(item: PackingView) {
    const next = !(item.id in ticks ? ticks[item.id] : item.checked);
    setTicks((t) => ({ ...t, [item.id]: next }));
    try {
      await call(`/api/night/${view.id}/packing/${item.id}`, "PATCH", {
        checked: next,
      });
      startRefresh(() => router.refresh());
    } catch {
      setTicks((t) => {
        const { [item.id]: _gone, ...rest } = t;
        return rest;
      });
      toast.error("That didn't save. Try again.");
    }
  }

  async function addBring(event: React.FormEvent) {
    event.preventDefault();
    const label = bring.trim();
    if (!label) return;
    try {
      await call(`/api/night/${view.id}/packing`, "POST", { label });
      setBring("");
      startRefresh(() => router.refresh());
    } catch {
      toast.error("Couldn't add that. Try again.");
    }
  }

  async function dropBring(item: PackingView) {
    try {
      await call(`/api/night/${view.id}/packing/${item.id}`, "DELETE");
      startRefresh(() => router.refresh());
    } catch {
      toast.error("Only whoever added it (or the host) can remove it.");
    }
  }

  async function dismiss(item: ItemView) {
    try {
      await call(`/api/adventures/${view.id}/items/${item.id}`, "DELETE");
      startRefresh(() => router.refresh());
    } catch {
      toast.error("Couldn't clear that. Try again.");
    }
  }

  const packed = (packing ?? []).filter((p) =>
    p.id in ticks ? ticks[p.id] : p.checked,
  ).length;

  // ------------------------------------------------------------ the phase

  const leave = plan?.[0]?.at;
  const home = plan ? homeAt(plan) : undefined;
  const phase: Phase = !day
    ? "before"
    : today < day.on
      ? "before"
      : today > day.on
        ? "after"
        : leave !== undefined && now < leave - 60
          ? "before"
          : home !== undefined && now > home + 60
            ? "after"
            : "during";
  const nextStop =
    phase === "during" && plan
      ? Math.max(
          0,
          plan.findIndex((s, i) => {
            const following = plan[i + 1];
            return !following || following.at > now;
          }),
        )
      : undefined;

  const choosing =
    evenings.find((e) => e.title === saving)?.id ?? (busy ? "busy" : null);
  const warnings = plan && day ? warningsFor(plan, sunset, evening, day) : [];
  const backdrop = evening?.photo ?? PHOTOS.dusk;

  const inviteCard = isOwner && others.length === 0 && (
    <div className="relative isolate overflow-hidden rounded-[28px] bg-[var(--n-ink)] p-6 text-[var(--n-cream)]">
      <Image
        src={PHOTOS.campfire.src}
        alt=""
        fill
        sizes="(min-width: 640px) 672px, 100vw"
        className="-z-10 object-cover opacity-45"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[var(--n-ink)] via-[var(--n-ink)]/80 to-transparent" />
      <p className="ghad-display text-[28px] leading-none font-extrabold uppercase">
        Somebody&apos;s missing.
      </p>
      <p className="mt-2 max-w-sm text-[15px] text-[var(--n-cream)]/80">
        One private link, good for one person. {config?.partnerName ?? "They"}{" "}
        sees this plan, adds to it, packs and suggests.
      </p>
      <button
        onClick={invite}
        disabled={busy}
        data-testid="send-invitation"
        className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--n-amber)] px-6 font-bold text-[var(--n-ink)] disabled:opacity-60"
      >
        <Share2 className="h-4 w-4" aria-hidden /> Invite {partner}
      </button>
    </div>
  );

  const packingPanel = (
    <details
      className="group rounded-[24px] bg-white/70 ring-1 ring-black/5"
      data-testid="packing-panel"
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 text-[15px] font-bold">
        <span>
          Packing
          {packing && (
            <span className="ml-2 font-semibold text-[var(--n-ink)]/55">
              {packed} of {packing.length} packed
            </span>
          )}
        </span>
        <ChevronDown
          className="h-4 w-4 transition group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="px-4 pb-4">
        {packing === null ? (
          <p className="rounded-2xl bg-black/5 p-4 text-sm text-[var(--n-ink)]/70">
            The packing list isn&apos;t switched on yet. Everything else works.
          </p>
        ) : (
          <>
            <ul className="grid gap-2 sm:grid-cols-2" data-testid="packing">
              {packing.map((p) => {
                const checked = p.id in ticks ? ticks[p.id]! : p.checked;
                return (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 rounded-2xl bg-[var(--n-paper)] ring-1 ring-black/5"
                  >
                    <button
                      onClick={() => tick(p)}
                      role="checkbox"
                      aria-checked={checked}
                      className="flex min-h-12 flex-1 items-center gap-3 px-3 text-left"
                    >
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                          checked
                            ? "border-[var(--n-forest)] bg-[var(--n-forest)] text-white"
                            : "border-black/25"
                        }`}
                      >
                        {checked && <Check className="h-4 w-4" aria-hidden />}
                      </span>
                      <span
                        className={checked ? "line-through opacity-60" : ""}
                      >
                        {p.label}
                      </span>
                      {checked && p.checkedBy && (
                        <span className="ml-auto text-xs text-[var(--n-ink)]/50">
                          {p.checkedBy}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => dropBring(p)}
                      aria-label={`Remove ${p.label}`}
                      className="flex h-12 w-12 items-center justify-center text-[var(--n-ink)]/40"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
            <form onSubmit={addBring} className="mt-3 flex gap-2">
              <input
                value={bring}
                onChange={(e) => setBring(e.target.value)}
                maxLength={80}
                placeholder="Something to bring"
                aria-label="Add something to bring"
                className="min-h-12 min-w-0 flex-1 rounded-full border border-black/10 bg-white px-5 text-base"
              />
              <button
                disabled={!bring.trim()}
                className="min-h-12 rounded-full bg-[var(--n-forest)] px-5 font-bold text-white disabled:opacity-50"
              >
                Add
              </button>
            </form>
          </>
        )}
      </div>
    </details>
  );

  const memoriesPanel = (
    <details
      className="group rounded-[24px] bg-white/70 ring-1 ring-black/5"
      open={phase === "after" || undefined}
      data-testid="memories-panel"
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 text-[15px] font-bold">
        <span>
          Memories & photos
          {moments.length > 0 && (
            <span className="ml-2 font-semibold text-[var(--n-ink)]/55">
              {moments.length}
            </span>
          )}
        </span>
        <ChevronDown
          className="h-4 w-4 transition group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="px-4 pb-4">
        <p className="mb-3 text-[14px] text-[var(--n-ink)]/65">
          The photo from the lake. The best line of the day. Only the two of you
          can see these.
        </p>
        <NightMemories
          adventureId={view.id}
          moments={moments}
          sharing={sharing}
        />
      </div>
    </details>
  );

  return (
    <main className={`pb-24 ${styles.night}`} data-busy={busy || undefined}>
      {/* ------------------------------------------------------ A. HERO */}
      <header className="relative isolate overflow-hidden bg-[var(--n-ink)] text-white">
        <div className="absolute inset-0 -z-10" aria-hidden>
          <Image
            src={backdrop.src}
            alt=""
            fill
            priority
            sizes="100vw"
            className={`object-cover ${styles.drift}`}
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,20,16,0.55)_0%,rgba(20,20,16,0.05)_35%,rgba(20,20,16,0.7)_72%,var(--n-ink)_100%)]" />
        </div>
        <div className="mx-auto flex min-h-[62svh] max-w-5xl flex-col justify-end px-5 pt-24 pb-8 sm:px-8">
          <p
            className={`text-xs font-extrabold tracking-[0.24em] text-[var(--n-amber)] uppercase ${styles.rise}`}
          >
            {day ? fullDate(day.on) : "Date night"}
          </p>
          <h1
            className={`ghad-display mt-3 max-w-3xl text-[clamp(2.4rem,11vw,6rem)] leading-[0.88] font-extrabold tracking-tight text-balance uppercase ${styles.rise}`}
          >
            {displayTitle(view.title)}
          </h1>
          <p
            className={`mt-4 max-w-xl font-[family-name:var(--font-fraunces)] text-xl text-white/90 italic ${styles.rise}`}
          >
            {config?.tagline ?? "An adventure for two."}
          </p>
          <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-white/85">
            {view.members.map((m, i) => (
              <span key={m.memberId} className="inline-flex items-center gap-2">
                {i > 0 && (
                  <Heart
                    className="h-3.5 w-3.5 fill-[var(--n-ember)] text-[var(--n-ember)]"
                    aria-label="and"
                  />
                )}
                {m.isYou ? "You" : m.displayName}
              </span>
            ))}
            {others.length === 0 && (
              <span className="inline-flex items-center gap-2 text-white/60">
                <Heart className="h-3.5 w-3.5" aria-hidden /> {partner}
              </span>
            )}
          </p>
          <div
            className="mt-4 flex flex-wrap gap-2 text-sm font-semibold"
            data-testid="conditions"
          >
            {day && (
              <span
                className="rounded-full bg-[var(--n-ember)] px-3.5 py-1.5"
                data-testid="countdown"
              >
                {countdown(day.on, today)}
                {leave !== undefined ? ` · leave ${clock(leave)}` : ""}
              </span>
            )}
            {day && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 backdrop-blur">
                <MapPin className="h-4 w-4" aria-hidden /> {day.area}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 backdrop-blur">
              <Sunset className="h-4 w-4" aria-hidden /> Sunset {clock(sunset)}
            </span>
            {forecast && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 backdrop-blur"
                title={`${forecast.source}, ${forecast.covers}`}
              >
                <CloudSun className="h-4 w-4" aria-hidden />
                {[
                  forecast.highC !== undefined
                    ? `High ${Math.round(forecast.highC)}°`
                    : null,
                  forecast.words[0] ?? null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            )}
          </div>
          <p className="mt-4 text-[11px] text-white/50">
            Photo: {backdrop.where} · {backdrop.credit}, {backdrop.license}
          </p>
        </div>
      </header>

      <nav
        aria-label="This adventure"
        className="sticky top-0 z-20 border-b border-black/5 bg-[var(--n-cream)]/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 sm:px-5">
          {[
            ["#evenings", "Adventures"],
            ...(plan
              ? [
                  ["#plan", "Our plan"],
                  ["#ours", "Make it ours"],
                ]
              : []),
            ["#together", "Together"],
          ].map(([href, text]) => (
            <a
              key={href}
              href={href}
              className="inline-flex min-h-12 shrink-0 items-center rounded-full px-4 text-sm font-bold hover:bg-black/5"
            >
              {text}
            </a>
          ))}
        </div>
      </nav>

      {/* ------------------------------------- B. CHOOSE OUR ADVENTURE */}
      {day && evenings.length > 0 && (
        <section
          id="evenings"
          className="mx-auto mt-8 max-w-5xl scroll-mt-16 px-4 sm:px-6"
        >
          <p className="text-xs font-extrabold tracking-[0.22em] text-[var(--n-ember)] uppercase">
            {plan
              ? "Choose another adventure"
              : `${fullDate(day.on).split(",")[0]} night`}
          </p>
          <h2 className="ghad-display mt-1 mb-4 text-[30px] leading-[0.95] font-extrabold tracking-tight uppercase sm:text-5xl">
            {plan ? "Or something else" : "Choose our adventure"}
          </h2>
          <EveningChooser
            evenings={evenings}
            chosen={plan ? evening : undefined}
            isOwner={isOwner}
            busy={choosing}
            compact={plan !== null}
            homeOf={(e) =>
              e.composed ? undefined : homeAt(templatePlan(e, sunset, day))
            }
            onChoose={(e) => void choose(e)}
          />
          {confirm && (
            <div
              role="alertdialog"
              aria-labelledby="replace-heading"
              data-testid="replace-preview"
              className="mt-4 rounded-[24px] bg-[var(--n-paper)] p-5 ring-2 ring-[var(--n-ember)]"
            >
              <p id="replace-heading" className="text-[17px] font-extrabold">
                Replace our {evening?.title ?? "plan"} with{" "}
                {confirm.evening.title}?
              </p>
              <p className="mt-1 text-[14px] text-[var(--n-ink)]/70">
                You&apos;ve made this one your own. Your changes go with it, and
                you can undo straight after.
              </p>
              <ol className="mt-3 space-y-1 text-[14px]">
                {confirm.stops.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-16 shrink-0 font-bold tabular-nums">
                      {clock(s.at)}
                    </span>
                    {s.title}
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="replace-confirm"
                  disabled={busy}
                  onClick={() => void adopt(confirm.evening, confirm.stops)}
                  className="min-h-12 rounded-full bg-[var(--n-ember)] px-6 font-bold text-white disabled:opacity-60"
                >
                  Replace it
                </button>
                <button
                  type="button"
                  onClick={() => setConfirm(null)}
                  className="min-h-12 rounded-full px-5 font-bold ring-1 ring-black/15"
                >
                  Keep ours
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ------------------------------------------- C. OUR ADVENTURE */}
      {plan && day && actions && (
        <section
          id="plan"
          className="mx-auto mt-10 max-w-2xl scroll-mt-16 px-4 sm:px-6"
        >
          <EveningPlan
            evening={evening}
            stops={plan}
            sunset={sunset}
            warnings={warnings}
            experiences={experiences}
            isOwner={isOwner}
            busy={busy}
            {...(nextStop !== undefined ? { next: nextStop } : {})}
            actions={actions}
          />
        </section>
      )}

      {/* --------------------------------------------- D. MAKE IT OURS */}
      {plan && day && (
        <div className="mx-auto mt-8 max-w-2xl px-4 sm:px-6">
          <MakeItOurs
            handle={ours}
            stops={plan}
            evening={evening}
            day={day}
            sunset={sunset}
            isOwner={isOwner}
            ownerName={ownerName}
            busy={busy}
            canUndo={isOwner && previous !== null}
            onApply={(next) => save(next, label, "Done. The plan's changed.")}
            onUndo={() => void undo()}
            onSuggest={suggest}
          />
        </div>
      )}

      {/* ------------------------------------------------- E. TOGETHER */}
      <section
        id="together"
        className="mx-auto mt-12 max-w-2xl scroll-mt-16 space-y-3 px-4 sm:px-6"
      >
        <p className="text-xs font-extrabold tracking-[0.22em] text-[var(--n-ember)] uppercase">
          {phase === "after"
            ? "Remember"
            : phase === "during"
              ? "Out there"
              : "Before we go"}
        </p>
        <h2 className="ghad-display text-[30px] leading-[0.95] font-extrabold tracking-tight uppercase">
          Together
        </h2>
        {phase === "after" && memoriesPanel}
        {inviteCard}
        {asks.length > 0 && (
          <ul className="space-y-2" data-testid="suggestions">
            {asks.map((item) => {
              const pick = item.label?.match(/^Let's do (.+)$/)?.[1];
              const picked = pick
                ? evenings.find((e) => e.title === pick)
                : undefined;
              return (
                <li
                  key={item.id}
                  data-testid="suggestion"
                  className="flex items-center gap-3 rounded-2xl bg-[var(--n-paper)] p-3 ring-1 ring-black/5"
                >
                  <Heart
                    className="h-4 w-4 shrink-0 fill-[var(--n-ember)] text-[var(--n-ember)]"
                    aria-hidden
                  />
                  <p className="min-w-0 flex-1 text-[14.5px]">
                    <span className="font-bold">
                      {item.mine
                        ? "You"
                        : (view.members.find((m) => m.memberId === item.addedBy)
                            ?.displayName ?? "One of you")}
                      :
                    </span>{" "}
                    “{item.label}”
                  </p>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() =>
                        picked
                          ? void choose(picked)
                          : ours.current?.ask(item.label ?? "")
                      }
                      className="min-h-11 shrink-0 rounded-full bg-[var(--n-forest)] px-4 text-sm font-bold text-white"
                    >
                      {picked ? "Choose it" : "Show me"}
                    </button>
                  )}
                  {item.canChange && (
                    <button
                      type="button"
                      onClick={() => void dismiss(item)}
                      aria-label={`Clear “${item.label}”`}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--n-ink)]/45"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {phase !== "after" && packingPanel}
        {phase !== "after" && memoriesPanel}
        {phase === "after" && packingPanel}
        <details
          className="group rounded-[24px] bg-white/70 ring-1 ring-black/5"
          id="people"
        >
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 text-[15px] font-bold">
            <span>
              People & invitations
              <span className="ml-2 font-semibold text-[var(--n-ink)]/55">
                {view.members.length}
              </span>
            </span>
            <ChevronDown
              className="h-4 w-4 transition group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <div className="px-3 pb-4">
            <AdventurePeople
              adventureId={view.id}
              isOwner={isOwner}
              members={view.members}
              you={view.you}
              invites={invites}
            />
          </div>
        </details>
        {phase === "after" && (
          <details className="group rounded-[24px] bg-white/70 ring-1 ring-black/5">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 text-[15px] font-bold">
              Do it again
              <ChevronDown
                className="h-4 w-4 transition group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <NextDates townId={day?.townId ?? view.destinationTownId} />
          </details>
        )}
      </section>
    </main>
  );
}
