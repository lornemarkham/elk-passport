"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Camera,
  Check,
  CloudSun,
  Heart,
  Plus,
  Share2,
  Sparkles,
  Sunset,
  Trash2,
} from "lucide-react";
import { AdventurePeople } from "@/components/adventures/AdventurePeople";
import { Picture } from "@/components/adventures/Picture";
import { AdventureJourney } from "@/components/adventures/journey/AdventureJourney";
import { DayStory } from "./DayStory";
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

const POLL_MS = 15_000;

const VOTES: readonly { value: ResponseValue; label: string }[] = [
  { value: "in", label: "Love it" },
  { value: "maybe", label: "Maybe" },
  { value: "out", label: "Nope" },
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
        <p className="text-xs font-bold tracking-[0.2em] text-[#9f3a4f] uppercase">
          {kicker}
        </p>
      )}
      <h2 className="ghad-display mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {note && (
        <p className="mt-2 max-w-xl text-[15px] text-[var(--gh-ink-soft)]">
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
  hero,
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
  saved: readonly Experience[];
  today: string;
  atlasDown: boolean;
  forecast?: DayForecast;
  sunset?: string;
  /** The picture the night opens on: a real photo of where it goes. */
  hero?: Experience;
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

  return (
    <main className={`pb-24 ${styles.night}`}>
      <header className="relative isolate overflow-hidden bg-[#12060b] text-white">
        <div className="absolute inset-0 -z-10" aria-hidden>
          <Picture
            experience={hero}
            fallbackTitle=""
            tone="#3b0f1f"
            priority
            showLabel={false}
            className={`h-full w-full ${styles.drift}`}
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,6,11,0.45)_0%,rgba(18,6,11,0.1)_38%,rgba(18,6,11,0.82)_78%,#12060b_100%)]" />
        </div>
        <div className="mx-auto flex min-h-[82svh] max-w-5xl flex-col justify-end px-5 pt-24 pb-10 sm:px-8">
          <p
            className={`text-xs font-bold tracking-[0.24em] text-white/80 uppercase ${styles.rise}`}
          >
            {day ? `${fullDate(day.on)} · ${day.area}` : "Date night"}
          </p>
          <h1
            className={`ghad-display mt-3 max-w-3xl text-5xl leading-[0.95] font-extrabold tracking-tight text-balance sm:text-7xl ${styles.rise}`}
          >
            {view.title}
          </h1>
          <p
            className={`mt-4 max-w-xl text-lg text-white/90 sm:text-xl ${styles.rise}`}
          >
            {config?.tagline ?? "An adventure for two."}
          </p>
          <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-white/85">
            {view.members.map((m, i) => (
              <span key={m.memberId} className="inline-flex items-center gap-2">
                {i > 0 && (
                  <Heart
                    className="h-3.5 w-3.5 fill-rose-400 text-rose-400"
                    aria-label="and"
                  />
                )}
                {m.isYou ? "You" : m.displayName}
              </span>
            ))}
            {others.length === 0 && (
              <span className="inline-flex items-center gap-2 text-white/60">
                <Heart className="h-3.5 w-3.5" aria-hidden /> your favourite
                person
              </span>
            )}
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-sm font-semibold">
            {day && (
              <span
                className="rounded-full bg-rose-500/90 px-3.5 py-1.5"
                data-testid="countdown"
              >
                {countdown(day.on, today)}
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
            {sunset && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 backdrop-blur">
                <Sunset className="h-4 w-4" aria-hidden /> Sunset {sunset}
              </span>
            )}
          </div>
          {hero && (
            <p className="mt-6 text-[11px] text-white/55">
              Photo: {hero.title}
            </p>
          )}
        </div>
      </header>

      <nav
        aria-label="This date"
        className="sticky top-0 z-20 border-b border-black/5 bg-[#fbf4ef]/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 sm:px-5">
          {[
            ["#day", "The day"],
            ...(onDay.length > 0 ? [["#details", "Details"]] : []),
            ["#ideas", "Wild ideas"],
            ["#packing", "Packing"],
            ["#memories", "Memories"],
            ["#next", "Next time"],
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

      {isOwner && others.length === 0 && (
        <div className="mx-auto mt-8 max-w-5xl px-4 sm:px-6">
          <div className="flex flex-col items-start gap-4 rounded-[28px] bg-[#3b0f1f] p-6 text-white sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="ghad-display text-2xl font-extrabold">
                Somebody&apos;s missing.
              </p>
              <p className="mt-1 max-w-md text-sm text-white/75">
                One private link, good for one person, with the invitation
                attached. Only the two of you will ever see this page.
              </p>
            </div>
            <button
              onClick={invite}
              disabled={busy}
              data-testid="send-invitation"
              className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-white px-6 font-bold text-[#3b0f1f] disabled:opacity-60"
            >
              <Share2 className="h-4 w-4" aria-hidden /> Send the invitation
            </button>
          </div>
        </div>
      )}

      {day && (
        <Section
          id="day"
          wide
          kicker="Start · Explore · Experience · Unwind · Remember"
          title={onDay.length > 0 ? "The day" : "Let's make a day of it"}
          note={
            onDay.length > 0
              ? "Swipe through it. Every stop is a real place. Swap anything, change the mood, or say what you want in the details below."
              : undefined
          }
        >
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
          />
        </Section>
      )}

      {day && onDay.length > 0 && (
        <Section
          id="details"
          wide
          kicker="The fine print"
          title="Details, travel & changes"
          note="Drive times, hours and directions for each stop. Say I'm in, Maybe or Out, keep what you love, or ask for a change in your own words."
        >
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
        </Section>
      )}

      <Section
        id="ideas"
        kicker="For this one, or the next"
        title="Wild ideas"
        note={
          otherName
            ? `The things that might not fit Monday. Vote, and you'll see what ${otherName} thinks.`
            : "The things that might not fit Monday. Vote now; your favourite person votes when they join."
        }
      >
        <ul className="grid gap-4 sm:grid-cols-2">
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
            return (
              <li
                key={item.id}
                data-testid="idea"
                className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/10"
              >
                {item.atlasRef ? (
                  <Picture
                    experience={experience}
                    fallbackTitle={title}
                    tone="#5b1a2b"
                    className="h-40 w-full"
                  />
                ) : (
                  <div className="flex h-24 items-center justify-center bg-gradient-to-br from-[#fbe3cf] to-[#f3b99a] text-5xl">
                    <span aria-hidden>{activity?.emoji ?? "✨"}</span>
                  </div>
                )}
                <div className="p-4">
                  <h3 className="text-lg font-bold">{title}</h3>
                  {item.note && <p className="mt-1 text-sm">{item.note}</p>}
                  {item.atlasRef ? (
                    <p className="text-muted-foreground mt-2 text-xs">
                      A real place from Atlas. Check access and conditions
                      before you go.
                    </p>
                  ) : (
                    <p className="text-muted-foreground mt-2 text-xs">
                      Our own idea, not checked by Passport.
                    </p>
                  )}
                  {activity?.caution && (
                    <p className="mt-2 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900">
                      ⚠️ {activity.caution}
                    </p>
                  )}
                  <div
                    role="group"
                    aria-label={`Your vote on ${title}`}
                    className="mt-4 grid grid-cols-3 gap-2"
                  >
                    {VOTES.map((v) => (
                      <button
                        key={v.value}
                        onClick={() => vote(item, v.value)}
                        aria-pressed={mineNow === v.value}
                        className={`min-h-12 rounded-2xl border text-sm font-bold transition ${
                          mineNow === v.value
                            ? v.value === "in"
                              ? "border-[#5b1a2b] bg-[#5b1a2b] text-white"
                              : v.value === "maybe"
                                ? "border-amber-500 bg-amber-100"
                                : "border-slate-500 bg-slate-200"
                            : "bg-white"
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                  {otherName && (
                    <p
                      className="text-muted-foreground mt-2 text-xs"
                      data-testid="their-vote"
                    >
                      {otherName}:{" "}
                      {theirNow
                        ? VOTES.find((v) => v.value === theirNow)!.label
                        : "hasn't voted yet"}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <form onSubmit={suggest} className="mt-4 flex gap-2">
          <input
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            maxLength={120}
            placeholder="Suggest something (it needn't be in Atlas)"
            aria-label="Suggest an adventure"
            className="min-h-12 flex-1 rounded-2xl border px-4 text-base"
          />
          <button
            disabled={busy || !idea.trim()}
            className="inline-flex min-h-12 items-center gap-1 rounded-2xl bg-[#5b1a2b] px-4 font-bold text-white disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden /> Add
          </button>
        </form>
        {config && (
          <button
            onClick={mystery}
            disabled={busy}
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#5b1a2b] font-bold text-[#5b1a2b] disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" aria-hidden /> Let Passport pick a
            mystery
          </button>
        )}
      </Section>

      <Section
        id="packing"
        kicker="Don't forget"
        title="Packing list"
        note={
          packing
            ? `${packed} of ${packing.length} packed. Either of you can tick or add.`
            : undefined
        }
      >
        {packing === null ? (
          <p className="text-muted-foreground rounded-2xl bg-black/5 p-4 text-sm">
            The packing list isn&apos;t switched on yet. Everything else works.
          </p>
        ) : (
          <>
            <ul className="grid gap-2" data-testid="packing">
              {packing.map((p) => {
                const checked = p.id in ticks ? ticks[p.id]! : p.checked;
                return (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 rounded-2xl bg-white ring-1 ring-black/10"
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
                            ? "border-[#5b1a2b] bg-[#5b1a2b] text-white"
                            : ""
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
                        <span className="text-muted-foreground ml-auto text-xs">
                          {p.checkedBy}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => dropBring(p)}
                      aria-label={`Remove ${p.label}`}
                      className="text-muted-foreground flex h-12 w-12 items-center justify-center"
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
                className="min-h-12 flex-1 rounded-2xl border px-4 text-base"
              />
              <button
                disabled={!bring.trim()}
                className="min-h-12 rounded-2xl bg-[#5b1a2b] px-4 font-bold text-white disabled:opacity-50"
              >
                Add
              </button>
            </form>
          </>
        )}
      </Section>

      <Memories adventureId={view.id} moments={moments} sharing={sharing} />

      <NextDates townId={day?.townId ?? view.destinationTownId} />

      <div id="people" className="mx-auto mt-14 max-w-2xl px-4 sm:px-6">
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
                className="min-h-12 rounded-2xl bg-[#5b1a2b] px-5 font-bold text-white disabled:opacity-50"
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
