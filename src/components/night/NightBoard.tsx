"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";
import {
  Backpack,
  Camera,
  Check,
  ChevronDown,
  CloudSun,
  Heart,
  MapPin,
  RotateCcw,
  Send,
  Sunset,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { AdventurePeople } from "@/components/adventures/AdventurePeople";
import { EveningChooser } from "./EveningChooser";
import { EveningPlan, type PlanActions } from "./EveningPlan";
import { MakeItOurs, type MakeItOursHandle } from "./MakeItOurs";
import { NextDates } from "./NextDates";
import { NightMemories } from "./NightMemories";
import { LeaveTime } from "./LeaveTime";
import { NightNav, isRoom, type Room } from "./NightNav";
import { Plays, type DecidePair, type OpenAt } from "./Plays";
import { sendText } from "./share";
import styles from "./night.module.css";
import type { Experience } from "@/domain/experience/types";
import type { Mood, NightConfig } from "@/domain/date-night/adventures";
import type { Moment } from "@/domain/christmas/recap";
import type {
  AdventureView,
  InviteView,
  ItemView,
} from "@/lib/adventures/store";
import type { PackingTrouble, PackingView } from "@/lib/date-night/night";
import {
  encodeAnswer,
  encodePlay,
  isPlayNote,
  labelOf,
  playsOf,
  waitingOn,
  type AnswerBody,
  type PlayBody,
  type PlayView,
  type Theme,
} from "@/domain/date-night/plays";
import type { DepartureOption } from "@/domain/date-night/adventures/departure";
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
import { ruleOf } from "@/domain/date-night/adventures/itinerary";
import {
  justUs,
  namesOf,
  whenSaid,
} from "@/domain/date-night/adventures/heading";
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

/** Nobody's name yet: the core's word for a member without one. */
const NAMELESS = "A traveller";

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
 * **Date Night, as one thing.** From the top: the hero ("Tonight, just us",
 * the two of you, and — once chosen — the adventure as its star); the
 * adventures to choose from, until one is chosen, then behind Change
 * adventure; our adventure — the one itinerary; just say it, in words; and
 * together — the invitation, what you're bringing, the memories, shown when
 * they're useful and said plainly when they aren't switched on. Every planning action (a card, an ending, a sentence, Change ·
 * Move · Remove · Add) edits the same itinerary, stored as the adventure's
 * own day (`itinerary.ts`, `PUT /api/night/[id]/plan`). The page refreshes
 * itself so the other person's changes appear without a reload.
 */
export function NightBoard({
  view,
  invites,
  packing,
  packingTrouble = null,
  moments,
  sharing,
  experiences,
  config,
  dayStops,
  today,
  now,
  forecast,
  sunsetMinutes,
  focus = null,
}: {
  view: AdventureView;
  invites: readonly InviteView[];
  packing: readonly PackingView[] | null;
  /** Why the list couldn't be read, exactly (`readPacking`). */
  packingTrouble?: { kind: PackingTrouble; code: string | null } | null;
  /** A play a texted link opened (`?p=`). */
  focus?: string | null;
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
  const [chooserOpen, setChooserOpen] = useState(false);
  /** Titles the last change touched, marked on the plan. */
  const [changed, setChanged] = useState<ReadonlySet<string>>(new Set());
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
    // Mark what this change touched: anything new, or longer or shorter.
    // A whole new adventure is all new, so nothing is singled out.
    const same = label === (evening?.title ?? "Our own plan");
    const was = new Map(
      (before ?? []).map((s) => [s.id ?? `${s.key}|${s.title}`, s]),
    );
    setChanged(
      new Set(
        same && before
          ? next
              .filter((s) => {
                const old = was.get(s.id ?? `${s.key}|${s.title}`);
                return !old || Math.abs(old.minutes - s.minutes) >= 5;
              })
              .map((s) => s.title)
          : [],
      ),
    );
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
    ) {
      setPrevious(null);
      setChanged(new Set());
    }
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
    setChooserOpen(false);
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
                return Object.fromEntries(
                  Object.entries(s).filter(([name]) => name !== "key"),
                ) as unknown as PlanStop;
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
    (i) =>
      !i.onDay &&
      i.label &&
      !i.atlasRef &&
      !seeded.has(i.label) &&
      !isPlayNote(i.note),
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
      // The phone's share sheet, else a new text, else a copy (`share.ts`).
      const sent = await sendText(invitationLines.join("\n\n"), url);
      if (sent === "copied")
        toast.success(
          `Invitation copied. Paste it into your texts to ${partner}.`,
        );
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

  /** A night started before packing was switched on has an empty list. */
  async function starterList() {
    setSaving("packing");
    try {
      for (const label of config?.packing ?? [])
        await call(`/api/night/${view.id}/packing`, "POST", { label });
      startRefresh(() => router.refresh());
    } catch {
      toast.error("Couldn't add the list. Try again.");
    } finally {
      setSaving(null);
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

  // ------------------------------------------------------------- playing

  const plays = useMemo(() => playsOf(view.items), [view.items]);
  const waiting = waitingOn(plays).length;
  /** Who a text goes to: the invited person, or whoever planned it. */
  const textee = isOwner
    ? (others[0]?.displayName ?? partner)
    : (ownerName ?? "them");
  /** Their invitation, made once and reused while they haven't joined. */
  const inviteLink = useRef<string | null>(null);

  async function linkTo(playId: string): Promise<string | null> {
    const target = `/night/${encodeURIComponent(view.id)}?p=${playId}`;
    const origin = window.location.origin;
    if (!isOwner || others.length > 0) return `${origin}${target}`;
    // Not in yet: the link is their invitation, and it lands on this.
    try {
      if (!inviteLink.current) {
        const response = await call(
          `/api/adventures/${view.id}/invites`,
          "POST",
          { label: `For ${partner}` },
        );
        inviteLink.current = (await response.json()).path as string;
        startRefresh(() => router.refresh());
      }
      return `${origin}${inviteLink.current}?next=${encodeURIComponent(target)}`;
    } catch {
      return null;
    }
  }

  async function createPlay(body: PlayBody): Promise<string | null> {
    setSaving("play");
    try {
      const response = await call(`/api/adventures/${view.id}/items`, "POST", {
        label: labelOf(body),
        note: encodePlay({ ...body, t: Date.now() }),
      });
      const { id } = (await response.json()) as { id: string };
      startRefresh(() => router.refresh());
      return id;
    } catch {
      toast.error("That didn't save. Try again.");
      return null;
    } finally {
      setSaving(null);
    }
  }

  async function answerPlay(
    play: PlayView,
    body: Omit<AnswerBody, "to" | "t">,
  ): Promise<boolean> {
    setSaving("answer");
    try {
      await call(`/api/adventures/${view.id}/items`, "POST", {
        label: "An answer",
        note: encodeAnswer({ ...body, to: play.id, t: Date.now() }),
      });
      startRefresh(() => router.refresh());
      return true;
    } catch {
      toast.error("That didn't save. Try again.");
      return false;
    } finally {
      setSaving(null);
    }
  }

  async function removePlay(play: PlayView) {
    try {
      await call(`/api/adventures/${view.id}/items/${play.id}`, "DELETE");
      startRefresh(() => router.refresh());
    } catch {
      toast.error("Couldn't take that back. Try again.");
    }
  }

  /** What a "You decide" choice does to the plan, when the owner applies it. */
  async function applyChoice(what: string) {
    const [kind, id] = what.split(":");
    if (kind === "ending" && id && actions) {
      actions.ending(id);
      go("adventure");
    } else if (kind === "evening") {
      const e = evenings.find((x) => x.id === id);
      if (e) await choose(e);
      go("adventure");
    }
  }

  // ---------------------------------------------------------- leave time

  async function useDeparture(option: DepartureOption, leaveAt: number) {
    if (option.evening && option.evening.id !== evening?.id) {
      setConfirm(null);
      const ok = await save(
        [...option.stops],
        option.evening.title,
        `${option.evening.title}, leaving at ${clock(option.stops[0]!.at)}.`,
      );
      if (ok) go("adventure");
      return ok;
    }
    const ok = await save(
      [...option.stops],
      label,
      `Leaving at ${clock(leaveAt)}. ${option.title}.`,
    );
    if (ok) go("adventure");
    return ok;
  }

  // --------------------------------------------------------------- rooms

  const [room, setRoom] = useState<Room>(() =>
    focus ? "together" : today > (day?.on ?? today) ? "memories" : "adventure",
  );
  /** Plays opened from the Adventure room's teaser start their composer. */
  const [start, setStart] = useState<"pick" | "dare" | "decide" | null>(null);
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1);
      if (isRoom(h)) setRoom(h);
    };
    read();
    window.addEventListener("hashchange", read);
    window.addEventListener("popstate", read);
    return () => {
      window.removeEventListener("hashchange", read);
      window.removeEventListener("popstate", read);
    };
  }, []);
  function go(to: Room) {
    setRoom(to);
    if (window.location.hash !== `#${to}`)
      window.history.pushState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#${to}`,
      );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** What the night is about, so the decks can be about it too. */
  const themes = useMemo(() => {
    const out = new Set<Theme>();
    for (const s of plan ?? []) {
      if (!day) break;
      for (const t of ruleOf(evening, s, day).tags)
        if (["hunt", "lake", "swim", "pools", "fire", "dinner"].includes(t))
          out.add(t as Theme);
    }
    return out;
  }, [plan, evening, day]);

  const pairs: DecidePair[] = [
    ...(evening?.endings && evening.endings.length > 1
      ? [
          {
            a: evening.endings[0]!.title,
            b: evening.endings[1]!.title,
            apply: [
              `ending:${evening.endings[0]!.id}`,
              `ending:${evening.endings[1]!.id}`,
            ] as const,
          },
        ]
      : []),
    ...evenings
      .filter((e) => !e.composed && evening && e.id !== evening.id)
      .slice(0, 2)
      .map((e) => ({
        a: evening!.title,
        b: e.title,
        apply: [`evening:${evening!.id}`, `evening:${e.id}`] as const,
      })),
    { a: "Dessert first", b: "Dessert after" },
    { a: "Phones in the glovebox", b: "One photo each, then away" },
    { a: "Your playlist", b: "My playlist" },
  ];

  const packed = (packing ?? []).filter((p) =>
    p.id in ticks ? ticks[p.id] : p.checked,
  ).length;

  // ------------------------------------------------------------ the phase

  const leave = plan?.[0]?.at;
  const home = plan ? homeAt(plan) : undefined;
  const phase: Phase =
    !day || !plan
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
  const backdrop = (plan ? evening?.photo : undefined) ?? PHOTOS.dusk;
  const title = day ? justUs(day.on, today, leave) : "Just us";
  const names = view.members.map((m) =>
    m.isYou && m.displayName === NAMELESS ? "You" : m.displayName,
  );
  const together = namesOf(others.length === 0 ? [...names] : names);
  const youName = view.members.find((m) => m.isYou)?.displayName ?? NAMELESS;
  const invitationLines = [
    ...(config?.invitation ?? ["Come on an adventure with me."]),
    ...(plan && evening && day && leave !== undefined
      ? [
          `${whenSaid(day.on, today, leave)}: ${evening.composed ? "a surprise" : evening.title}. We leave at ${clock(leave)}.`,
        ]
      : []),
  ];
  const timesOf = (e: Evening): readonly [number, number] | undefined => {
    if (!day) return undefined;
    const stops =
      plan && e.id === evening?.id
        ? plan
        : e.composed
          ? null
          : templatePlan(e, sunset, day);
    return stops?.length ? [stops[0]!.at, homeAt(stops)!] : undefined;
  };

  const replacePreview = confirm && (
    <div
      role="alertdialog"
      aria-labelledby="replace-heading"
      data-testid="replace-preview"
      className="mb-3 rounded-[24px] bg-[var(--n-paper)] p-5 ring-2 ring-[var(--n-ember)]"
    >
      <p id="replace-heading" className="text-[17px] font-extrabold">
        Replace our {evening?.title ?? "plan"} with {confirm.evening.title}?
      </p>
      <p className="mt-1 text-[14px] text-[var(--n-ink)]/70">
        You&apos;ve made this one your own. Your changes go with it, and you can
        undo straight after.
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
  );

  // ------------------------------------------------------------ together

  const inviteCard = isOwner && others.length === 0 && (
    <div
      className="relative isolate overflow-hidden rounded-[28px] bg-[var(--n-ink)] p-6 text-[var(--n-cream)] sm:p-8"
      data-testid="invite-card"
    >
      <Image
        src={(plan ? evening?.photo : undefined)?.src ?? PHOTOS.campfire.src}
        alt=""
        fill
        sizes="(min-width: 640px) 672px, 100vw"
        className="-z-10 object-cover opacity-40"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[var(--n-ink)] via-[var(--n-ink)]/85 to-[var(--n-ink)]/40" />
      <p className="text-xs font-extrabold tracking-[0.22em] text-[var(--n-amber)] uppercase">
        For {partner}
      </p>
      <p className="mt-2 font-[family-name:var(--font-fraunces)] text-[30px] leading-[1.05] italic sm:text-[38px]">
        Come on an adventure with me.
      </p>
      <blockquote
        className="mt-5 space-y-2 rounded-2xl bg-white/[0.08] p-4 text-[15px] leading-snug text-white/90 ring-1 ring-white/10"
        data-testid="invite-preview"
      >
        {invitationLines.map((line) => (
          <p key={line}>{line}</p>
        ))}
        <p className="text-white/45">+ a private link</p>
      </blockquote>
      <p className="mt-4 max-w-md text-[13.5px] text-[var(--n-cream)]/70">
        One link, good for one person. {partner} sees this plan, adds stops,
        suggests changes{packing ? " and packs with you" : ""}. Only you change
        the plan itself, and nobody else can open it.
      </p>
      <button
        onClick={invite}
        disabled={busy}
        data-testid="send-invitation"
        className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--n-amber)] px-6 font-extrabold text-[var(--n-ink)] shadow-[0_12px_28px_-12px_rgba(232,163,61,0.9)] disabled:opacity-60"
      >
        <Send className="h-4 w-4" aria-hidden /> Send it to {partner}
      </button>
    </div>
  );

  const togetherCard = others.length > 0 && (
    <div
      className="rounded-[28px] bg-[var(--n-paper)] p-5 ring-1 ring-black/5 sm:p-6"
      data-testid="together-card"
    >
      <p className="flex items-center gap-2 font-[family-name:var(--font-fraunces)] text-[26px] leading-tight italic">
        {together}
        <Heart
          className="h-5 w-5 fill-[var(--n-ember)] text-[var(--n-ember)]"
          aria-hidden
        />
      </p>
      <p className="mt-1.5 text-[14px] leading-snug text-[var(--n-ink)]/70">
        {isOwner
          ? `${others.map((m) => m.displayName).join(" and ")} ${others.length > 1 ? "are" : "is"} in. They see the plan, add their own stops and suggest changes; you decide what the plan becomes.`
          : `You're in. ${ownerName ?? "The planner"} shapes the plan; you add your own stops, and anything you say goes to ${ownerName ?? "them"} as a suggestion.`}{" "}
        Only the two of you can see any of this.
      </p>
    </div>
  );

  const packingPanel = (
    <Panel
      icon={Backpack}
      title="What we're bringing"
      testId="packing-panel"
      off={packing === null}
      open
      offSaid={
        // PGRST205 is the same answer whether the table is missing or the
        // API's cache predates it, so "unseen" stays "not switched on yet".
        packingTrouble?.kind === "refused" ||
        packingTrouble?.kind === "mismatch"
          ? "Not switched on properly"
          : packingTrouble?.kind === "unavailable"
            ? "Can't open it right now"
            : undefined
      }
      offDetail={
        packingTrouble && isOwner
          ? {
              missing: "The packing table isn't in the database yet.",
              unseen:
                "The database's API can't see the packing table. Either its migration hasn't run, or it has and the API's schema cache needs a reload: NOTIFY pgrst, 'reload schema';",
              refused:
                "The packing table is there, but signed-in people aren't allowed to read it: the migration's GRANTs are missing.",
              mismatch:
                "The packing table doesn't match the migration: a column or function it needs is missing.",
              unavailable: "The database didn't answer. Try again in a moment.",
            }[packingTrouble.kind] +
            (packingTrouble.code ? ` (${packingTrouble.code})` : "")
          : undefined
      }
      meta={
        packing && packing.length > 0
          ? `${packed} of ${packing.length} packed`
          : undefined
      }
    >
      {packing && (
        <>
          <div
            className="mb-3 h-1.5 overflow-hidden rounded-full bg-black/5"
            aria-hidden
          >
            <div
              className="h-full rounded-full bg-[var(--n-forest)] transition-[width]"
              style={{
                width: `${packing.length ? (packed / packing.length) * 100 : 0}%`,
              }}
            />
          </div>
          {packing.length === 0 && (config?.packing.length ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => void starterList()}
              disabled={busy}
              data-testid="packing-starter"
              className="mb-3 min-h-12 w-full rounded-2xl bg-[var(--n-forest)]/[0.07] px-4 text-left text-[14px] font-bold text-[var(--n-forest)] disabled:opacity-60"
            >
              Start with our list: {config!.packing.join(", ").toLowerCase()}
            </button>
          )}
          <ul className="grid gap-2 sm:grid-cols-2" data-testid="packing">
            {packing.map((p) => {
              const checked = p.id in ticks ? ticks[p.id]! : p.checked;
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded-2xl bg-white ring-1 ring-black/5"
                >
                  <button
                    onClick={() => tick(p)}
                    role="checkbox"
                    aria-checked={checked}
                    className="flex min-h-12 flex-1 items-center gap-3 px-3 text-left"
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                        checked
                          ? "border-[var(--n-forest)] bg-[var(--n-forest)] text-white"
                          : "border-black/25"
                      }`}
                    >
                      {checked && <Check className="h-4 w-4" aria-hidden />}
                    </span>
                    <span className={checked ? "line-through opacity-60" : ""}>
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
    </Panel>
  );

  const memoriesPanel = (
    <Panel
      icon={Camera}
      title="Our memories"
      testId="memories-panel"
      off={!sharing}
      open
      meta={moments.length > 0 ? String(moments.length) : undefined}
    >
      <p className="mb-3 text-[14px] text-[var(--n-ink)]/65">
        The photo from the lake. The best line of the day. Only the two of you
        can see these.
      </p>
      <NightMemories
        adventureId={view.id}
        moments={moments}
        sharing={sharing}
      />
    </Panel>
  );

  const peoplePanel = (
    <Panel
      icon={Users}
      title="People & invitations"
      id="people"
      meta={String(view.members.length)}
    >
      <AdventurePeople
        adventureId={view.id}
        isOwner={isOwner}
        members={view.members}
        you={view.you}
        invites={invites}
      />
    </Panel>
  );

  const compact = room !== "adventure";
  const opensAt: OpenAt[] = [
    { at: "now", said: "now" },
    ...(leave !== undefined ? [{ at: leave, said: "when we leave" }] : []),
    { at: Math.round(sunset), said: "at sunset" },
    ...(home !== undefined ? [{ at: home, said: "when we're home" }] : []),
  ];
  const badges: Partial<Record<Room, number>> = {
    together: waiting,
    ...(isOwner && others.length === 0 ? { invite: 1 } : {}),
  };
  const teaser = (
    <div
      className="rounded-[24px] bg-[var(--n-forest)] p-4 text-[var(--n-cream)] sm:p-5"
      data-testid="play-teaser"
    >
      <p className="text-[11px] font-extrabold tracking-[0.2em] text-[var(--n-amber)] uppercase">
        {waiting > 0 ? `${waiting} waiting for you` : `Before it even starts`}
      </p>
      <p className="mt-1 font-[family-name:var(--font-fraunces)] text-[22px] leading-tight italic">
        {waiting > 0
          ? `${textee} sent you something.`
          : `Get ${textee} excited. Text something.`}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {(
          [
            ["pick", "⚖️", "This or That"],
            ["dare", "🔥", "Challenge"],
            ["decide", "🫵", "You Decide"],
          ] as const
        ).map(([id, emoji, title]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setStart(id);
              go("together");
            }}
            className="min-h-14 rounded-2xl bg-white/10 px-2 text-[13px] font-bold ring-1 ring-white/15"
          >
            <span aria-hidden className="block text-[18px]">
              {emoji}
            </span>
            {title}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <main
      className={`pb-[calc(84px+env(safe-area-inset-bottom))] md:pb-24 ${styles.night}`}
      data-busy={busy || undefined}
      data-room={room}
    >
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
        <div
          className={`mx-auto flex max-w-5xl flex-col justify-end px-5 sm:px-8 ${
            compact
              ? "min-h-[26svh] pt-16 pb-5"
              : `pt-24 pb-8 ${plan ? "min-h-[54svh]" : "min-h-[62svh]"}`
          }`}
        >
          <p
            className={`text-xs font-extrabold tracking-[0.24em] text-[var(--n-amber)] uppercase ${styles.rise}`}
          >
            {day ? fullDate(day.on) : "Date night"}
          </p>
          <h1
            className={`ghad-display mt-3 max-w-3xl leading-[0.88] font-extrabold tracking-tight text-balance uppercase ${styles.rise} ${
              compact
                ? "text-[clamp(1.9rem,8vw,3.5rem)]"
                : "text-[clamp(2.4rem,11vw,6rem)]"
            }`}
            data-testid="night-title"
          >
            {title}
          </h1>
          <p
            className={`mt-4 max-w-xl font-[family-name:var(--font-fraunces)] text-xl text-white/90 italic ${styles.rise} ${compact ? "hidden md:block" : ""}`}
          >
            {plan && evening ? (
              <>
                <span className="font-semibold not-italic">
                  {evening.composed ? "Passport's surprise" : evening.title}.
                </span>{" "}
                {evening.teaser}
              </>
            ) : (
              (config?.tagline ?? "An adventure for two.")
            )}
          </p>
          <p
            className="mt-4 flex flex-wrap items-center gap-2 text-sm font-semibold text-white/85"
            data-testid="names"
          >
            {names.map((name, i) => (
              <span
                key={view.members[i]!.memberId}
                className="inline-flex items-center gap-2"
              >
                {i > 0 && (
                  <Heart
                    className="h-3.5 w-3.5 fill-[var(--n-ember)] text-[var(--n-ember)]"
                    aria-label="and"
                  />
                )}
                {name}
              </span>
            ))}
            {others.length === 0 && (
              <span className="inline-flex items-center gap-2 text-white/60">
                <Heart className="h-3.5 w-3.5" aria-hidden /> {partner}?
              </span>
            )}
          </p>
          <div
            className={`mt-4 flex-wrap gap-2 text-sm font-semibold ${compact ? "hidden md:flex" : "flex"}`}
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

      <NightNav current={room} onChange={go} badges={badges} />

      {/* ------------------------------------------- ROOM: ADVENTURE */}
      <div id="room-adventure" role="tabpanel" hidden={room !== "adventure"}>
        {/* ------------------------------------- B. CHOOSE OUR ADVENTURE */}
        {day && evenings.length > 0 && !plan && (
          <section
            id="evenings"
            className="mx-auto mt-8 max-w-5xl scroll-mt-16 px-4 sm:px-6"
          >
            <p className="text-xs font-extrabold tracking-[0.22em] text-[var(--n-ember)] uppercase">
              {evenings.length} ways to spend it
            </p>
            <h2 className="ghad-display mt-1 mb-5 text-[30px] leading-[0.95] font-extrabold tracking-tight uppercase sm:text-5xl">
              Choose our adventure
            </h2>
            <EveningChooser
              evenings={evenings}
              chosen={undefined}
              isOwner={isOwner}
              busy={choosing}
              mode="choose"
              timesOf={timesOf}
              onChoose={(e) => void choose(e)}
            />
          </section>
        )}

        {/* ------------------------------------------- C. OUR ADVENTURE */}
        {plan && day && actions && (
          <section
            id="plan"
            className="mx-auto mt-8 max-w-2xl scroll-mt-16 px-4 sm:px-6"
          >
            <EveningPlan
              evening={evening}
              stops={plan}
              sunset={sunset}
              warnings={warnings}
              experiences={experiences}
              isOwner={isOwner}
              busy={busy}
              day={day}
              changed={changed}
              {...(forecast ? { forecast } : {})}
              {...(nextStop !== undefined ? { next: nextStop } : {})}
              actions={actions}
              onLeave={() => go("change")}
              chooserOpen={chooserOpen || confirm !== null}
              onToggleChooser={() => {
                setChooserOpen((o) => !(o || confirm !== null));
                setConfirm(null);
              }}
              chooser={
                evenings.length > 1 ? (
                  <>
                    {replacePreview}
                    <EveningChooser
                      evenings={evenings}
                      chosen={evening}
                      isOwner={isOwner}
                      busy={choosing}
                      mode="change"
                      timesOf={timesOf}
                      onChoose={(e) => void choose(e)}
                    />
                  </>
                ) : undefined
              }
            />
          </section>
        )}

        {plan && (
          <div className="mx-auto mt-8 max-w-2xl px-4 sm:px-6">{teaser}</div>
        )}
      </div>

      {/* ---------------------------------------------- ROOM: CHANGE IT */}
      <div
        id="room-change"
        role="tabpanel"
        hidden={room !== "change"}
        className="mx-auto mt-8 max-w-2xl space-y-8 px-4 sm:px-6"
      >
        {plan && day ? (
          <>
            <LeaveTime
              stops={plan}
              evening={evening}
              day={day}
              sunset={sunset}
              forecast={forecast}
              isOwner={isOwner}
              busy={busy}
              ownerName={ownerName}
              onUse={useDeparture}
              onSuggest={suggest}
            />
            <div id="ours">
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
                onApply={(next) =>
                  save(next, label, "Done. The plan's changed.")
                }
                onUndo={() => void undo()}
                onSuggest={suggest}
              />
            </div>
            {evenings.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  setChooserOpen(true);
                  go("adventure");
                }}
                className="inline-flex min-h-12 items-center gap-2 rounded-full px-5 font-bold text-[var(--n-forest)] ring-1 ring-[var(--n-forest)]/25"
              >
                A different adventure altogether
              </button>
            )}
          </>
        ) : (
          <p className="rounded-[24px] bg-[var(--n-paper)] p-5 text-[15px] ring-1 ring-black/5">
            Choose an adventure first; then you can change when you leave and
            say what you&apos;d like different.
          </p>
        )}
      </div>

      {/* ---------------------------------------------- ROOM: TOGETHER */}
      <section
        id="room-together"
        role="tabpanel"
        hidden={room !== "together"}
        aria-label="Together"
        className="mx-auto mt-8 max-w-2xl space-y-6 px-4 sm:px-6"
      >
        <div id="together" className="scroll-mt-16 space-y-3">
          <Plays
            key={start ?? "plays"}
            plays={plays}
            partner={textee}
            themes={themes}
            pairs={pairs}
            opensAt={opensAt}
            focus={focus}
            busy={busy}
            isOwner={isOwner}
            start={start}
            create={createPlay}
            answer={answerPlay}
            remove={removePlay}
            apply={applyChoice}
            linkTo={linkTo}
          />
        </div>
        {asks.length > 0 && (
          <ul className="space-y-2" data-testid="suggestions">
            {asks.map((item) => {
              const pick = item.label?.match(/^Let's do (.+)$/)?.[1];
              const picked = pick
                ? evenings.find((e) => e.title === pick)
                : undefined;
              const from = item.mine
                ? youName === NAMELESS
                  ? "You"
                  : youName
                : (view.members.find((m) => m.memberId === item.addedBy)
                    ?.displayName ?? "One of you");
              return (
                <li
                  key={item.id}
                  data-testid="suggestion"
                  className="rounded-[24px] bg-[var(--n-paper)] p-4 ring-1 ring-black/5"
                >
                  <p className="text-[11px] font-extrabold tracking-[0.16em] text-[var(--n-ember)] uppercase">
                    {item.mine ? "You suggested" : `From ${from}`}
                  </p>
                  <p className="mt-1 font-[family-name:var(--font-fraunces)] text-[19px] leading-snug italic">
                    “{item.label}”
                  </p>
                  {(isOwner || item.canChange) && (
                    <div className="mt-3 flex items-center gap-2">
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() =>
                            picked
                              ? void choose(picked)
                              : (go("change"),
                                ours.current?.ask(item.label ?? ""))
                          }
                          className="min-h-11 rounded-full bg-[var(--n-forest)] px-5 text-sm font-bold text-white"
                        >
                          {picked ? "Choose it" : "Show me"}
                        </button>
                      )}
                      {item.canChange && (
                        <button
                          type="button"
                          onClick={() => void dismiss(item)}
                          aria-label={`Clear “${item.label}”`}
                          className="ml-auto flex h-11 w-11 items-center justify-center rounded-full text-[var(--n-ink)]/45 hover:bg-black/5"
                        >
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {packingPanel}
      </section>

      {/* ---------------------------------------------- ROOM: MEMORIES */}
      <section
        id="room-memories"
        role="tabpanel"
        hidden={room !== "memories"}
        aria-label="Memories"
        className="mx-auto mt-8 max-w-2xl space-y-3 px-4 sm:px-6"
      >
        <p className="text-xs font-extrabold tracking-[0.22em] text-[var(--n-ember)] uppercase">
          {phase === "after"
            ? "Remember"
            : phase === "during"
              ? "Out there"
              : "For later"}
        </p>
        <h2 className="ghad-display text-[30px] leading-[0.95] font-extrabold tracking-tight uppercase">
          Our memories
        </h2>
        {memoriesPanel}
        {phase === "after" && (
          <Panel icon={RotateCcw} title="Do it again">
            <NextDates townId={day?.townId ?? view.destinationTownId} />
          </Panel>
        )}
      </section>

      {/* ------------------------------------------------ ROOM: INVITE */}
      <section
        id="room-invite"
        role="tabpanel"
        hidden={room !== "invite"}
        aria-label="Invite"
        className="mx-auto mt-8 max-w-2xl space-y-3 px-4 sm:px-6"
      >
        {inviteCard}
        {togetherCard}
        {peoplePanel}
      </section>
    </main>
  );
}

/**
 * One look for everything under Together: an icon, a name, a count, and the
 * thing itself one tap away. A part whose database isn't switched on yet
 * says so on its own line and doesn't open, rather than looking like it
 * works.
 */
function Panel({
  icon: Icon,
  title,
  meta,
  off = false,
  offSaid = "Not switched on yet",
  offDetail,
  open = false,
  testId,
  id,
  children,
}: {
  icon: LucideIcon;
  title: string;
  meta?: string | undefined;
  off?: boolean;
  /** What an off panel says, when it isn't simply "not switched on yet". */
  offSaid?: string | undefined;
  /** Why, exactly, for the owner (`readPacking`). */
  offDetail?: string | undefined;
  open?: boolean;
  testId?: string;
  id?: string;
  children?: React.ReactNode;
}) {
  const head = (
    <span className="flex min-w-0 items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--n-forest)]/[0.08] text-[var(--n-forest)]">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0">
        {title}
        {meta && (
          <span className="ml-2 font-semibold text-[var(--n-ink)]/55">
            {meta}
          </span>
        )}
      </span>
    </span>
  );
  if (off)
    return (
      <div
        className="rounded-[24px] bg-white/40 px-4 text-[15px] font-bold text-[var(--n-ink)]/60 ring-1 ring-black/5"
        data-testid={testId}
        data-off="true"
        id={id}
      >
        <div className="flex min-h-16 items-center justify-between gap-3">
          {head}
          <span className="shrink-0 rounded-full bg-black/5 px-3 py-1 text-[12px] font-semibold">
            {offSaid}
          </span>
        </div>
        {offDetail && (
          <p
            className="pb-4 text-[12.5px] leading-snug font-medium"
            data-testid={testId ? `${testId}-why` : undefined}
          >
            {offDetail}
          </p>
        )}
      </div>
    );
  return (
    <details
      className="group rounded-[24px] bg-white/70 ring-1 ring-black/5"
      open={open || undefined}
      data-testid={testId}
      id={id}
    >
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[15px] font-bold">
        {head}
        <ChevronDown
          className="h-4 w-4 shrink-0 transition group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}
