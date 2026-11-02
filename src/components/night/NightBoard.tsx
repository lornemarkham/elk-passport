"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";
import {
  Camera,
  Check,
  ChevronDown,
  CloudSun,
  Coffee,
  Feather,
  Flame,
  Gift,
  Heart,
  Lightbulb,
  MountainSnow,
  Plus,
  Share2,
  Snowflake,
  Sparkles,
  Sunset,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { AdventurePeople } from "@/components/adventures/AdventurePeople";
import { Picture } from "@/components/adventures/Picture";
import { AdventureJourney } from "@/components/adventures/journey/AdventureJourney";
import { DayStory } from "./DayStory";
import { EveningChooser } from "./EveningChooser";
import { EveningPlan } from "./EveningPlan";
import { NextDates } from "./NextDates";
import styles from "./night.module.css";
import { shrinkPhoto } from "@/components/christmas/photo";
import type { Experience } from "@/domain/experience/types";
import type {
  NightActivity,
  NightConfig,
} from "@/domain/date-night/adventures";
import type { Moment } from "@/domain/christmas/recap";
import type {
  AdventureView,
  InviteView,
  ItemView,
} from "@/lib/adventures/store";
import type { ResponseValue } from "@/lib/adventures/rules";
import type { PackingView } from "@/lib/date-night/night";
import type { DayDetail } from "@/lib/adventures/propose";
import type { DayForecast } from "@/domain/date-night/conditions";
import type { SavedForAdventure } from "@/domain/occasion/saved";
import { spokenClock } from "@/domain/date-night/adventures/compose";
import {
  eveningNamed,
  eveningOf,
  PHOTOS,
} from "@/domain/date-night/adventures/evenings";

/** Artwork for the ideas that aren't places: drawn, not emoji. */
const IDEA_ICONS: Readonly<Record<string, LucideIcon>> = {
  "king-eddie": Snowflake,
  "grouse-and-backroads": Feather,
  "fire-and-food": Flame,
  "snowmobile-scouting": MountainSnow,
  "hot-chocolate": Coffee,
  mystery: Gift,
};

/** The adventure's name without the heart its database title carries. */
const displayTitle = (title: string) => title.replace(/\s*❤️\s*$/u, "");

const POLL_MS = 15_000;

const VOTES: readonly { value: ResponseValue; label: string }[] = [
  { value: "in", label: "Love it" },
  { value: "maybe", label: "Maybe" },
  { value: "out", label: "Pass" },
];

async function call(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(String(response.status));
  return response;
}

function Section({
  id,
  kicker,
  title,
  note,
  wide,
  children,
}: {
  id: string;
  kicker?: string;
  title: string;
  note?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`mx-auto mt-14 scroll-mt-16 px-4 sm:px-6 ${wide ? "max-w-5xl" : "max-w-2xl"}`}
    >
      {kicker && (
        <p className="text-xs font-extrabold tracking-[0.22em] text-[var(--n-ember)] uppercase">
          {kicker}
        </p>
      )}
      <h2 className="ghad-display mt-1 text-[34px] leading-[0.95] font-extrabold tracking-tight uppercase sm:text-5xl">
        {title}
      </h2>
      {note && (
        <p className="mt-2 max-w-xl text-[15px] text-[var(--n-ink)]/65">
          {note}
        </p>
      )}
      <div className="mt-5">{children}</div>
    </section>
  );
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

/**
 * **The board for two.** Everything it shows is read from the adventure core
 * (items, votes, members, packing, memories); the page refreshes itself so
 * the other person's choices appear without a reload. A tap is applied here
 * at once and confirmed by the server a moment later.
 */
export function NightBoard({
  view,
  invites,
  packing,
  moments,
  sharing,
  atlasNames,
  experiences,
  config,
  details,
  saved,
  today,
  atlasDown,
  forecast,
  sunset,
  sunsetMinutes,
}: {
  view: AdventureView;
  invites: readonly InviteView[];
  packing: readonly PackingView[] | null;
  moments: readonly Moment[];
  sharing: boolean;
  atlasNames: Record<string, string>;
  experiences: Record<string, Experience>;
  config: NightConfig | null;
  details: Record<string, DayDetail>;
  saved: SavedForAdventure;
  today: string;
  atlasDown: boolean;
  forecast?: DayForecast;
  sunset?: string;
  /** Sunset on the day, local minutes after midnight (legal time). */
  sunsetMinutes?: number;
}) {
  const router = useRouter();
  const [mine, setMine] = useState<Record<string, ResponseValue | null>>({});
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [idea, setIdea] = useState("");
  const [bring, setBring] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [router]);

  const isOwner = view.role === "owner";
  const others = view.members.filter((m) => !m.isYou);
  const otherName = others[0]?.displayName ?? null;
  const activities = new Map<string, NightActivity>(
    (config?.activities ?? []).map((a) => [a.title, a]),
  );

  const yours = (item: ItemView): ResponseValue | null =>
    item.id in mine ? mine[item.id]! : item.yourResponse;

  /** What everybody but you answered, from the counts the core gives. */
  const theirs = (item: ItemView): ResponseValue | null => {
    const left = { ...item.responses };
    const own = item.yourResponse;
    if (own) left[own] = Math.max(0, left[own] - 1);
    return left.in > 0
      ? "in"
      : left.maybe > 0
        ? "maybe"
        : left.out > 0
          ? "out"
          : null;
  };

  const day = config?.day ?? null;
  const onDay = day
    ? view.items
        .filter((i) => i.onDay === day.on)
        .sort((a, b) => a.position - b.position)
    : [];
  const ideas = view.items.filter((i) => !i.onDay);
  const dayAsk = day
    ? (view.days.find((d) => d.onDay === day.on)?.ask ?? null)
    : null;
  const evening = config?.evenings
    ? (eveningNamed(view.destinationLabel) ??
      eveningOf(new URLSearchParams(dayAsk ?? "").get("evening")))
    : undefined;

  async function vote(item: ItemView, value: ResponseValue) {
    const next = yours(item) === value ? null : value;
    setMine((m) => ({ ...m, [item.id]: next }));
    try {
      await call(
        `/api/adventures/${view.id}/items/${item.id}/response`,
        "PUT",
        {
          response: next,
        },
      );
      router.refresh();
    } catch {
      setMine((m) => {
        const { [item.id]: _gone, ...rest } = m;
        return rest;
      });
      toast.error("That didn't save. Try again.");
    }
  }

  async function suggest(event: React.FormEvent) {
    event.preventDefault();
    const label = idea.trim();
    if (!label) return;
    setBusy(true);
    try {
      await call(`/api/adventures/${view.id}/items`, "POST", { label });
      setIdea("");
      toast.success("Added. Now it needs a vote.");
      router.refresh();
    } catch {
      toast.error("Couldn't add that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function mystery() {
    setBusy(true);
    try {
      await call(`/api/night/${view.id}/mystery`, "POST");
      toast.success("Passport has chosen. Brace yourselves.");
      router.refresh();
    } catch {
      toast.error("Passport is out of surprises for now.");
    } finally {
      setBusy(false);
    }
  }

  async function tick(item: PackingView) {
    const next = !(item.id in ticks ? ticks[item.id] : item.checked);
    setTicks((t) => ({ ...t, [item.id]: next }));
    try {
      await call(`/api/night/${view.id}/packing/${item.id}`, "PATCH", {
        checked: next,
      });
      router.refresh();
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
      router.refresh();
    } catch {
      toast.error("Couldn't add that. Try again.");
    }
  }

  async function dropBring(item: PackingView) {
    try {
      await call(`/api/night/${view.id}/packing/${item.id}`, "DELETE");
      router.refresh();
    } catch {
      toast.error("Only whoever added it (or the host) can remove it.");
    }
  }

  async function invite() {
    setBusy(true);
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
      router.refresh();
    } catch {
      toast.error("Couldn't make the invitation. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const packed = (packing ?? []).filter((p) =>
    p.id in ticks ? ticks[p.id] : p.checked,
  ).length;

  const sunsetSaid =
    sunsetMinutes !== undefined ? spokenClock(sunsetMinutes) : sunset;
  const backdrop = evening?.photo ?? PHOTOS.dusk;
  const partner = config?.partnerName ?? "your person";
  const inviteCard = isOwner && others.length === 0 && (
    <div className="mx-auto mt-12 max-w-2xl px-4 sm:px-6">
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
          can vote, suggest, pack and make it theirs.
        </p>
        <button
          onClick={invite}
          disabled={busy}
          data-testid="send-invitation"
          className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--n-amber)] px-6 font-bold text-[var(--n-ink)] disabled:opacity-60"
        >
          <Share2 className="h-4 w-4" aria-hidden /> Invite {partner}
        </button>
        <p className="mt-2 text-xs text-[var(--n-cream)]/55">
          Send the invitation
        </p>
      </div>
    </div>
  );

  const chooser = day && config?.evenings && (
    <Section
      id="evenings"
      kicker={evening ? "Changed your mind?" : "Monday night"}
      title={evening ? "Or other trouble" : "Pick your trouble"}
      wide
    >
      <EveningChooser
        adventureId={view.id}
        isOwner={isOwner}
        day={day}
        evenings={config.evenings}
        chosen={evening}
        hasDay={onDay.length > 0}
        ownerName={
          view.members.find((m) => m.role === "owner" && !m.isYou)
            ?.displayName ?? null
        }
      />
    </Section>
  );

  const planned = day && (evening || onDay.length > 0);

  return (
    <main className={`pb-24 ${styles.night}`}>
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
        <div className="mx-auto flex min-h-[68svh] max-w-5xl flex-col justify-end px-5 pt-24 pb-9 sm:px-8">
          <p
            className={`text-xs font-extrabold tracking-[0.24em] text-[var(--n-amber)] uppercase ${styles.rise}`}
          >
            {day ? `${fullDate(day.on)} · Around 5 PM` : "Date night"}
          </p>
          <h1
            className={`ghad-display mt-3 max-w-3xl text-[52px] leading-[0.88] font-extrabold tracking-tight text-balance uppercase sm:text-8xl ${styles.rise}`}
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
          <div className="mt-5 flex flex-wrap gap-2 text-sm font-semibold">
            {day && (
              <span
                className="rounded-full bg-[var(--n-ember)] px-3.5 py-1.5"
                data-testid="countdown"
              >
                {countdown(day.on, today)}
              </span>
            )}
            {sunsetSaid && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 backdrop-blur">
                <Sunset className="h-4 w-4" aria-hidden /> Sunset{" "}
                {sunsetSaid.replace(/(\d)(am|pm)$/, "$1 $2")}
              </span>
            )}
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
          <p className="mt-5 text-[11px] text-white/50">
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
            ...(planned ? [["#plan", "The plan"]] : []),
            ...(config?.evenings ? [["#evenings", "Adventures"]] : []),
            ["#ideas", "Ideas"],
            ["#packing", "Packing"],
            ["#memories", "Memories"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="inline-flex min-h-12 shrink-0 items-center rounded-full px-4 text-sm font-bold hover:bg-black/5"
            >
              {label}
            </a>
          ))}
        </div>
      </nav>

      {!planned && chooser}

      {planned && day && (
        <section
          id="plan"
          className="mx-auto mt-12 max-w-2xl scroll-mt-16 px-4 sm:px-6"
        >
          <EveningPlan
            evening={evening}
            day={day}
            sunset={sunsetMinutes ?? 17 * 60 + 33}
            dayItems={onDay}
            ask={dayAsk}
            detail={details[day.on]}
            experiences={experiences}
          />
        </section>
      )}

      {inviteCard}

      {planned && chooser}

      {day && (
        <div className="mx-auto mt-10 max-w-5xl space-y-3 px-4 sm:px-6">
          {onDay.length > 0 && (
            <details
              id="details"
              className="group scroll-mt-16 rounded-[24px] bg-white/70 ring-1 ring-black/5"
            >
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 text-[15px] font-bold">
                Times, travel, changes & the printable guide
                <ChevronDown
                  className="h-4 w-4 transition group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <div className="px-3 pb-5 sm:px-5">
                <AdventureJourney
                  adventureId={view.id}
                  isOwner={isOwner}
                  items={onDay}
                  atlasNames={atlasNames}
                  experiences={experiences}
                  startsOn={view.startsOn}
                  endsOn={view.endsOn}
                  days={view.days}
                  details={details}
                  townId={view.destinationTownId}
                  today={today}
                  saved={saved}
                  atlasDown={atlasDown}
                  examples={[
                    "One more stop",
                    "Find somewhere cozy for a drink",
                    "Make it more adventurous",
                    "Keep everything within 20 minutes",
                    "Home by 9",
                  ]}
                />
              </div>
            </details>
          )}
          {isOwner && (
            <details
              id="day"
              className="group scroll-mt-16 rounded-[24px] bg-white/70 ring-1 ring-black/5"
            >
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 text-[15px] font-bold">
                Plan it yourself, stop by stop
                <ChevronDown
                  className="h-4 w-4 transition group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <div className="px-3 pb-5 sm:px-5">
                <DayStory
                  adventureId={view.id}
                  isOwner={isOwner}
                  day={day}
                  dayItems={onDay}
                  ask={dayAsk}
                  detail={details[day.on]}
                  experiences={experiences}
                  planned={view.startsOn === day.on}
                  otherName={otherName}
                  planLabel="Our own plan"
                />
              </div>
            </details>
          )}
        </div>
      )}

      <Section
        id="ideas"
        kicker="Love it · Maybe · Pass"
        title="Other trouble we could get into"
        note={
          otherName
            ? `For Monday, or the next one. You'll see what ${otherName} thinks.`
            : `For Monday, or the next one. ${config?.partnerName ?? "Your person"} votes when they join.`
        }
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {ideas.map((item) => {
            const activity = item.label
              ? activities.get(item.label)
              : undefined;
            const experience = item.atlasRef
              ? experiences[item.atlasRef]
              : undefined;
            const title =
              item.atlasRef && !item.label
                ? (atlasNames[item.atlasRef] ??
                  experience?.title ??
                  "A place Atlas knows")
                : (item.label ?? "An idea");
            const mineNow = yours(item);
            const theirNow = theirs(item);
            const Icon = IDEA_ICONS[activity?.id ?? ""] ?? Lightbulb;
            return (
              <li
                key={item.id}
                data-testid="idea"
                className="overflow-hidden rounded-[24px] bg-[var(--n-paper)] shadow-[0_14px_40px_-30px_rgba(20,30,20,0.8)] ring-1 ring-black/5"
              >
                <div className="flex gap-4 p-4">
                  {item.atlasRef ? (
                    <Picture
                      experience={experience}
                      fallbackTitle=""
                      tone="#1f3a2e"
                      showLabel={false}
                      className="h-20 w-20 shrink-0 rounded-2xl"
                    />
                  ) : (
                    <div
                      aria-hidden
                      className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(150deg,var(--n-forest),#12241b)] text-[var(--n-amber)]"
                    >
                      <Icon className="h-8 w-8" strokeWidth={1.75} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="text-[17px] leading-tight font-extrabold">
                      {title}
                    </h3>
                    {item.note && (
                      <p className="mt-1 text-[14px] leading-snug text-[var(--n-ink)]/75">
                        {item.note}
                      </p>
                    )}
                    <p className="mt-1.5 text-xs text-[var(--n-ink)]/50">
                      {item.atlasRef
                        ? "A real place from Atlas."
                        : activity
                          ? "Our own idea, not checked by Passport."
                          : `Suggested by ${item.mine ? "you" : (item.addedBy ?? "one of you")}.`}
                    </p>
                    {(activity?.caution || item.atlasRef) && (
                      <details className="mt-1.5 text-xs">
                        <summary className="cursor-pointer font-semibold text-[var(--n-forest)]">
                          Before you go
                        </summary>
                        <p className="mt-1 text-[var(--n-ink)]/70">
                          {activity?.caution ??
                            "Check access and conditions before you go."}
                        </p>
                      </details>
                    )}
                  </div>
                </div>
                <div
                  role="group"
                  aria-label={`Your vote on ${title}`}
                  className="grid grid-cols-3 gap-2 px-4 pb-4"
                >
                  {VOTES.map((v) => (
                    <button
                      key={v.value}
                      onClick={() => vote(item, v.value)}
                      aria-pressed={mineNow === v.value}
                      className={`min-h-11 rounded-full text-sm font-bold ring-1 transition ${
                        mineNow === v.value
                          ? v.value === "in"
                            ? "bg-[var(--n-ember)] text-white ring-[var(--n-ember)]"
                            : v.value === "maybe"
                              ? "bg-[var(--n-amber)]/40 ring-[var(--n-amber)]"
                              : "bg-black/10 ring-black/20"
                          : "bg-white ring-black/10"
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
                {otherName && (
                  <p
                    className="-mt-2 px-4 pb-3 text-xs text-[var(--n-ink)]/55"
                    data-testid="their-vote"
                  >
                    {otherName}:{" "}
                    {theirNow
                      ? VOTES.find((v) => v.value === theirNow)!.label
                      : "hasn't voted yet"}
                  </p>
                )}
              </li>
            );
          })}
        </ul>

        <form onSubmit={suggest} className="mt-4 flex gap-2">
          <input
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            maxLength={120}
            placeholder="Suggest something new"
            aria-label="Suggest an adventure"
            className="min-h-12 flex-1 rounded-full border border-black/10 bg-white px-5 text-base"
          />
          <button
            disabled={busy || !idea.trim()}
            className="inline-flex min-h-12 items-center gap-1 rounded-full bg-[var(--n-forest)] px-5 font-bold text-white disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden /> Add
          </button>
        </form>
        {config && (
          <button
            onClick={mystery}
            disabled={busy}
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-dashed border-[var(--n-forest)]/50 font-bold text-[var(--n-forest)] disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" aria-hidden /> Let Passport pick a
            mystery
          </button>
        )}
      </Section>

      <Section
        id="packing"
        kicker="Don't forget"
        title="The packing list"
        note={
          packing
            ? `${packed} of ${packing.length} packed. Either of you can tick or add.`
            : undefined
        }
      >
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
                className="min-h-12 flex-1 rounded-full border border-black/10 bg-white px-5 text-base"
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
      </Section>

      <Memories adventureId={view.id} moments={moments} sharing={sharing} />

      <details className="group mx-auto mt-14 max-w-5xl px-4 sm:px-6">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 text-[15px] font-bold text-[var(--n-forest)]">
          Ideas for next time
          <ChevronDown
            className="h-4 w-4 transition group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <NextDates townId={day?.townId ?? view.destinationTownId} />
      </details>

      <div id="people" className="mx-auto mt-10 max-w-2xl px-4 sm:px-6">
        <AdventurePeople
          adventureId={view.id}
          isOwner={isOwner}
          members={view.members}
          you={view.you}
          invites={invites}
        />
      </div>
    </main>
  );
}

function Memories({
  adventureId,
  moments,
  sharing,
}: {
  adventureId: string;
  moments: readonly Moment[];
  sharing: boolean;
}) {
  const router = useRouter();
  const [words, setWords] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  async function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    if (!chosen) return;
    try {
      setPhoto(await shrinkPhoto(chosen));
    } catch {
      toast.error("That photo wouldn't shrink. Try another.");
    }
  }

  async function share(event: React.FormEvent) {
    event.preventDefault();
    if (!words.trim() && !photo) return;
    setBusy(true);
    try {
      await call(`/christmas/api/${adventureId}/moments`, "POST", {
        kind: "moment",
        text: words.trim() || null,
        photo,
      });
      setWords("");
      setPhoto(null);
      if (file.current) file.current.value = "";
      router.refresh();
    } catch {
      toast.error("Couldn't share that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      id="memories"
      kicker="Remember"
      title="Memories"
      note="The photo from the lake. The best line of the day. Only the two of you can see these."
    >
      {!sharing ? (
        <p className="text-muted-foreground rounded-2xl bg-black/5 p-4 text-sm">
          Sharing memories isn&apos;t switched on yet. Everything else works.
        </p>
      ) : (
        <>
          <ul className="grid gap-3">
            {moments.map((m) => (
              <li
                key={m.id}
                className="overflow-hidden rounded-3xl bg-white ring-1 ring-black/10"
              >
                {m.hasPhoto && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/christmas/api/${adventureId}/moments/${m.id}/photo`}
                    alt={m.text ?? "A shared photo"}
                    className="max-h-96 w-full object-cover"
                  />
                )}
                <div className="p-3 text-sm">
                  {m.text && <p>{m.text}</p>}
                  <p className="text-muted-foreground mt-1 text-xs">
                    {m.mine ? "You" : m.by}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <form onSubmit={share} className="mt-4 grid gap-2">
            <textarea
              value={words}
              onChange={(e) => setWords(e.target.value)}
              maxLength={600}
              rows={2}
              placeholder="A moment worth keeping"
              aria-label="A moment worth keeping"
              className="rounded-2xl border p-3 text-base"
            />
            <div className="flex gap-2">
              <label className="inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border font-bold">
                <Camera className="h-4 w-4" aria-hidden />
                {photo ? "Photo ready" : "Add a photo"}
                <input
                  ref={file}
                  type="file"
                  accept="image/*"
                  onChange={pick}
                  className="sr-only"
                />
              </label>
              <button
                disabled={busy || (!words.trim() && !photo)}
                className="min-h-12 rounded-2xl bg-[var(--n-forest)] px-5 font-bold text-white disabled:opacity-50"
              >
                Share
              </button>
            </div>
          </form>
        </>
      )}
    </Section>
  );
}
