"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Check,
  DoorOpen,
  MapPin,
  Plus,
  Utensils,
  Moon,
} from "lucide-react";
import { Avatar } from "@/experience-lab/ui/atoms";
import type { LiveExperience, LivePrompt } from "@/experience-lab/core/engine";
import type { Block } from "@/experience-lab/core/types";
import { sameName } from "@/domain/collections/places";
import { clockAt, gameWhen } from "@/domain/hockey/countdown";
import type { NearbyPlace } from "@/domain/hockey/nearby";
import { planItems, type PlanItem } from "@/domain/hockey/plan";
import { nextGameAfter } from "@/domain/hockey/schedule";
import { OurSeats } from "./OurSeats";
import { RunItBack } from "./RunItBack";
import {
  BallotVenueCard,
  NearbyVenueCard,
  PlanPhoto,
  VenueSkeleton,
  VoteCount,
} from "./VenueCard";
import type { SharedNight } from "./useSharedNight";
import styles from "./hockey.module.css";

type Nearby = {
  places: NearbyPlace[];
  arena?: { atlasId: string; at: [number, number] };
  outage?: string;
};

const DINNER = "pregame-spot";

/** Phases after the night is over, when Run it back leads Plan. */
const AFTER_THE_NIGHT = new Set(["morning", "again"]);

/**
 * **Plan: what we're doing, then the votes that decide it.**
 *
 * The group's evolving plan leads — eating, meeting, puck drop, leaving —
 * each line the current leader of its vote, a tie said as a tie, and nothing
 * from a sealed question. Under it, the votes themselves: the dinner vote as
 * photographs of real places near the arena, from Atlas through Passport's
 * own picture rule, and everything else near the arena one swipe away.
 */
export function PlanTab({
  night,
  blocks,
}: {
  night: SharedNight;
  blocks: readonly Block[];
}) {
  const { live } = night;
  // Our seats walks from these places too, so a night without the dinner
  // vote still asks for them.
  const wantsNearby = Boolean(live.me);
  const nearby = useNearby(night.state.slug, wantsNearby);
  const items = planItems(live.prompts);
  const eating = items.find((i) => i.id === DINNER);

  return (
    <div className="flex flex-col gap-9">
      <GroupPlan live={live} items={items} nearby={nearby.data} />

      {/* The morning after, the seats are history and Run it back leads.
          (Shown then, its late-loading height pushed Run it back off screen.) */}
      {live.me && !AFTER_THE_NIGHT.has(live.phase.id) && (
        <OurSeats
          slug={night.state.slug}
          nearby={nearby.data}
          dinner={eating?.leaders.length === 1 ? eating.leaders[0] : undefined}
          say={night.say}
        />
      )}

      {blocks.map((block) => {
        if (block.kind === "runItBack") {
          if (!night.series) return null;
          return (
            <section
              key={block.id}
              id="run-it-back"
              aria-label="Run it back"
              className="scroll-mt-4"
            >
              <RunItBack
                live={live}
                series={night.series}
                suggestion={nextGameAfter(live.definition.anchorAt)}
                modules={night.modules}
              />
            </section>
          );
        }
        if (block.kind !== "promptGroup") return null;
        return (block.promptIds ?? []).map((id) => {
          const prompt = live.prompts.find((p) => p.prompt.id === id);
          if (!prompt) return null;
          return id === DINNER ? (
            <DinnerVote
              key={id}
              night={night}
              prompt={prompt}
              nearby={nearby}
            />
          ) : (
            <ChoiceVote key={id} night={night} prompt={prompt} />
          );
        });
      })}
    </div>
  );
}

// --------------------------------------------------------------- the plan

/** The plan on its own, for the periods, when the page is otherwise asleep. */
export function PlanSummary({ live }: { live: LiveExperience }) {
  return (
    <GroupPlan live={live} items={planItems(live.prompts)} nearby={null} />
  );
}

const ICON = {
  "pregame-spot": Utensils,
  "meet-spot": MapPin,
  "hard-out": DoorOpen,
  postgame: Moon,
} as const;

function GroupPlan({
  live,
  items,
  nearby,
}: {
  live: LiveExperience;
  items: readonly PlanItem[];
  nearby: Nearby | null;
}) {
  const anchor = new Date(live.definition.anchorAt);
  const after = live.phaseNumber >= phaseIndex(live, "after");
  const shown = items.filter((i) => i.id !== "postgame" || after);
  const puck = gameWhen(anchor).split(" · ")[1];
  const next = whatsNext(live, anchor);

  return (
    <section
      aria-labelledby="plan-title"
      className="overflow-hidden rounded-[24px] bg-[#f4f8fc] text-[#0b1220] shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]"
    >
      <div className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-2">
        <h2
          id="plan-title"
          className={`${styles.display} text-[28px] leading-none`}
        >
          The plan
        </h2>
        <span className="text-[13px] font-semibold text-[#0b1220]/60">
          So far · by vote
        </span>
      </div>
      <ul className="divide-y divide-[#0b1220]/10">
        {shown.map((item) => (
          <PlanRow key={item.id} item={item} nearby={nearby} />
        ))}
        {!after && (
          <li className="flex items-center gap-3.5 px-5 py-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0b1220] text-white">
              <CalendarClock className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[12px] font-bold tracking-[0.12em] text-[#0b1220]/55 uppercase">
                Puck drop
              </span>
              <span className="block text-[17px] font-bold">
                {puck} · picks seal
              </span>
            </span>
          </li>
        )}
      </ul>
      {next && (
        <p className="bg-[#0b1220] px-5 py-3 text-[14.5px] leading-snug font-medium text-white">
          <span className="font-bold text-[#ffd84d]">Next: </span>
          {next}
        </p>
      )}
    </section>
  );
}

function PlanRow({ item, nearby }: { item: PlanItem; nearby: Nearby | null }) {
  const Icon = ICON[item.id as keyof typeof ICON] ?? MapPin;
  const leader = item.leaders.length === 1 ? item.leaders[0] : undefined;
  const photo =
    item.id === DINNER && leader
      ? placeFor(leader, nearby?.places)?.image
      : undefined;
  const value =
    item.leaders.length === 0
      ? "Nobody's voted yet"
      : leader
        ? leader
        : `Tied: ${item.leaders.join(" / ")}`;

  return (
    <li>
      <a
        href={`#vote-${item.id}`}
        className="flex items-center gap-3.5 px-5 py-3.5 transition hover:bg-[#0b1220]/[0.04]"
      >
        <PlanPhoto
          url={photo?.url}
          fallback={
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0b1220] text-white">
              <Icon className="h-5 w-5" />
            </span>
          }
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-bold tracking-[0.12em] text-[#0b1220]/55 uppercase">
            {item.label}
            {item.locked && " · locked in"}
          </span>
          <span
            className={`block text-[17px] leading-snug font-bold [overflow-wrap:anywhere] ${
              item.leaders.length === 0 ? "text-[#0b1220]/50" : ""
            }`}
          >
            {value}
          </span>
        </span>
        {item.votes > 0 && (
          <span className="shrink-0 text-right text-[13px] leading-tight font-semibold text-[#0b1220]/60">
            {item.votes} {item.votes === 1 ? "vote" : "votes"}
            {item.mine === undefined && !item.locked && (
              <span className="block text-[#c2410c]">yours?</span>
            )}
          </span>
        )}
      </a>
    </li>
  );
}

function phaseIndex(live: LiveExperience, id: string): number {
  return live.definition.phases.findIndex((p) => p.id === id);
}

/** One honest line about what happens next, from the schedule alone. */
function whatsNext(live: LiveExperience, anchor: Date): string | null {
  const puck = clockAt(anchor, 0);
  const warmup = live.definition.phases.find((p) => p.id === "warmup");
  switch (live.phase.id) {
    case "before":
      return warmup
        ? `Votes close at ${clockAt(anchor, warmup.offsetMinutes)} on game day. Picks seal at puck drop, ${puck}`
        : `Picks seal at puck drop, ${puck}`;
    case "warmup":
      return `Last call. Picks seal at ${puck}`;
    case "after":
      return "Vote on where next. Nobody has to go home yet.";
    case "morning":
    case "again":
      return "The receipts are in Play. The next one is below.";
    default:
      return null;
  }
}

// ------------------------------------------------------------ the votes

function placeFor(
  label: string,
  places: readonly NearbyPlace[] | undefined,
): NearbyPlace | undefined {
  return (
    places?.find((p) => p.name === label) ??
    places?.find((p) => sameName(p.name, label))
  );
}

function VoteHead({
  prompt,
  live,
  subtitle,
}: {
  prompt: LivePrompt;
  live: LiveExperience;
  subtitle?: string;
}) {
  const lock = live.definition.phases.find(
    (p) => p.id === prompt.prompt.locksAtPhaseId,
  );
  const anchor = new Date(live.definition.anchorAt);
  return (
    <div className="mb-4">
      <h3
        id={`vote-${prompt.prompt.id}-title`}
        className={`${styles.wide} text-[26px] leading-[1.05] text-balance text-white`}
      >
        {prompt.prompt.question}
      </h3>
      <p className="mt-1.5 text-[15px] leading-snug text-white/70">
        {prompt.locked
          ? "Voting's closed. This is what the group decided."
          : (subtitle ?? prompt.prompt.hint)}
        {!prompt.locked && lock && (
          <span className="text-white/55">
            {" "}
            Closes {clockAt(anchor, lock.offsetMinutes)}
          </span>
        )}
      </p>
    </div>
  );
}

function DinnerVote({
  night,
  prompt,
  nearby,
}: {
  night: SharedNight;
  prompt: LivePrompt;
  nearby: ReturnType<typeof useNearby>;
}) {
  const { live } = night;
  const canVote = Boolean(live.me) && prompt.open;
  const mine = prompt.myResponse?.value;
  const top = Math.max(0, ...prompt.tally.map((o) => o.voters.length));
  const tied = prompt.tally.filter((o) => o.voters.length === top).length > 1;
  const onBallot = useMemo(
    () => new Set(prompt.tally.map((o) => o.label)),
    [prompt.tally],
  );
  const person = (id?: string) =>
    live.participants.find((p) => p.id === id)?.name;
  // Real places lead. The concourse is the template's zero-effort joke, and a
  // fine answer — it stays on the vote, below the places, as the easy way out.
  const real = prompt.tally.filter((o) => o.optionId !== "concourse");
  const easy = prompt.tally.filter((o) => o.optionId === "concourse");
  const card = (option: (typeof prompt.tally)[number], i: number) => {
    const place = placeFor(option.label, nearby.data?.places);
    return (
      <BallotVenueCard
        key={option.optionId}
        label={option.label}
        detail={option.detail}
        emoji={option.emoji}
        place={place}
        voters={option.voters}
        share={option.share}
        standing={
          top > 0 && option.voters.length === top
            ? tied
              ? "tied"
              : "leading"
            : undefined
        }
        chosen={mine === option.optionId}
        canVote={canVote}
        onVote={() => night.respond(prompt.prompt.id, option.optionId)}
        addedBy={option.addedBy ? person(option.addedBy) : undefined}
        priority={i < 2}
      />
    );
  };

  return (
    <section
      id={`vote-${DINNER}`}
      aria-labelledby={`vote-${DINNER}-title`}
      className="scroll-mt-4"
    >
      <VoteHead
        prompt={prompt}
        live={live}
        subtitle="Real places a short walk from the arena. Tap to vote, add anywhere, change your mind until it closes."
      />
      <div className="flex flex-col gap-4">
        {real.map((option, i) => card(option, i))}
      </div>

      {live.me && prompt.open && (
        <NearbyExplorer
          nearby={nearby}
          onBallot={onBallot}
          onAdd={(atlasId) =>
            void night.send({ type: "nominate", promptId: DINNER, atlasId })
          }
          venue={live.definition.kicker.split(" · ")[0]}
          lead={real.length === 0}
        />
      )}

      {easy.length > 0 && (
        <div className="mt-7">
          <p className="mb-2.5 text-[14px] font-semibold tracking-[0.08em] text-white/60 uppercase">
            Or keep it easy
          </p>
          <div className="flex flex-col gap-4">
            {easy.map((option) => card(option, 99))}
          </div>
        </div>
      )}

      {canVote && prompt.prompt.openToSuggestions && (
        <AddYourOwn
          placeholder="Somewhere else? Type a name"
          onAdd={(label) => night.addOption(prompt.prompt.id, label)}
        />
      )}
    </section>
  );
}

const FILTERS = [
  { id: "all", label: "All" },
  { id: "eat", label: "Restaurants" },
  { id: "drink", label: "Bars & pubs" },
] as const;

const drinks = (p: NearbyPlace) =>
  /bar|pub|lounge|brew|tap|tavern|saloon|wine|cocktail/i.test(p.subtype ?? "");

function NearbyExplorer({
  nearby,
  onBallot,
  onAdd,
  venue,
  lead,
}: {
  nearby: ReturnType<typeof useNearby>;
  onBallot: ReadonlySet<string>;
  onAdd: (atlasId: string) => void;
  venue: string;
  /** Nothing real is on the vote yet: open with the best places, full width. */
  lead: boolean;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  // Nearest first, and what is already on the vote after what is not.
  const places = (nearby.data?.places ?? [])
    .filter((p) =>
      filter === "all" ? true : filter === "drink" ? drinks(p) : !drinks(p),
    )
    .sort(
      (a, b) => Number(onBallot.has(a.name)) - Number(onBallot.has(b.name)),
    );
  // The server sends places with photographs first; the first three, while the
  // vote is empty, are the ones a group sees before anything else.
  const featured = lead
    ? places.filter((p) => !onBallot.has(p.name)).slice(0, 3)
    : [];
  const shelf = places.filter((p) => !featured.includes(p));

  return (
    <div className="mt-7" aria-label={`More near ${venue}`} role="region">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h4 className={`${styles.wide} text-[20px] leading-tight text-white`}>
            {lead ? `Near ${venue}` : `More near ${venue}`}
          </h4>
          <p className="mt-1 text-[14px] leading-snug text-white/65">
            {lead
              ? "Real places a short walk away. Add the ones you'd actually go to and the group votes."
              : "What Passport and Atlas know within a short walk. Add one and it's on the vote."}
          </p>
        </div>
        {nearby.data && nearby.data.places.length > 0 && (
          <span className="shrink-0 text-[13px] font-semibold text-white/60">
            {nearby.data.places.length} places
          </span>
        )}
      </div>

      {nearby.data && nearby.data.places.length > 0 && (
        <div className="mt-3 flex gap-2" role="group" aria-label="Show">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`min-h-10 rounded-full px-3.5 text-[14px] font-semibold whitespace-nowrap transition ${
                filter === f.id
                  ? "bg-white text-[#0b1220]"
                  : "bg-white/[0.08] text-white/85 hover:bg-white/[0.14]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {nearby.state === "loading" && (
        <div
          className={`${styles.noScrollbar} -mx-4 mt-4 flex gap-3 overflow-hidden px-4`}
        >
          <VenueSkeleton />
          <VenueSkeleton />
        </div>
      )}
      {nearby.state === "loading" && (
        <p className="mt-2 text-[14px] text-white/65" role="status">
          Asking Atlas what&apos;s near the arena — the first look can take a
          few seconds.
        </p>
      )}

      {(nearby.state === "failed" ||
        (nearby.data?.outage && nearby.data.places.length === 0)) && (
        <p className="mt-4 rounded-2xl bg-white/[0.06] px-4 py-3.5 text-[15px] text-white/80">
          Passport can&apos;t reach its map of the city right now. Type a place
          below instead — it counts just the same.{" "}
          <button
            type="button"
            onClick={nearby.retry}
            className="inline-flex min-h-11 items-center font-bold text-white underline underline-offset-4"
          >
            Try again
          </button>
        </p>
      )}
      {nearby.data?.outage && nearby.data.places.length > 0 && (
        <p className="mt-4 text-[14px] text-white/70">
          Passport&apos;s full map isn&apos;t answering, so this is the short
          list it keeps itself.
        </p>
      )}
      {nearby.data &&
        !nearby.data.outage &&
        nearby.data.places.length === 0 && (
          <p className="mt-4 rounded-2xl bg-white/[0.06] px-4 py-3.5 text-[15px] text-white/80">
            Passport doesn&apos;t know anywhere within a short walk yet. Type
            one below — you know more than it does.
          </p>
        )}

      {featured.length > 0 && (
        <ul className="mt-4 flex flex-col gap-4">
          {featured.map((place, i) => (
            <li key={place.atlasId}>
              <NearbyVenueCard
                place={place}
                onBallot={onBallot.has(place.name)}
                canAdd
                onAdd={() => onAdd(place.atlasId)}
                wide
                priority={i === 0}
              />
            </li>
          ))}
        </ul>
      )}
      {shelf.length > 0 && (
        <>
          {featured.length > 0 && (
            <h5
              className={`${styles.wide} mt-6 text-[17px] leading-tight text-white`}
            >
              More near {venue}
            </h5>
          )}
          <ul
            className={`${styles.noScrollbar} -mx-4 mt-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2`}
          >
            {shelf.map((place) => (
              <li key={place.atlasId} className="flex">
                <NearbyVenueCard
                  place={place}
                  onBallot={onBallot.has(place.name)}
                  canAdd
                  onAdd={() => onAdd(place.atlasId)}
                />
              </li>
            ))}
          </ul>
        </>
      )}
      {nearby.data && nearby.data.places.length > 0 && (
        <p className="mt-2 text-[12.5px] leading-snug text-white/55">
          Walks are straight lines at a walking pace, so the real one is longer.
          Photos are the places&apos; own, via Atlas.
        </p>
      )}
    </div>
  );
}

function ChoiceVote({
  night,
  prompt,
}: {
  night: SharedNight;
  prompt: LivePrompt;
}) {
  const { live } = night;
  const canVote = Boolean(live.me) && prompt.open;
  const mine = prompt.myResponse?.value;
  // Once you've voted (or it's closed), the question folds to your answer
  // and the group's — the plan above already says how it's going, and four
  // options you have dealt with are four screens of scrolling.
  const [expanded, setExpanded] = useState(false);
  const top = Math.max(0, ...prompt.tally.map((o) => o.voters.length));
  const folded = (mine !== undefined || prompt.locked) && !expanded;
  const shown = folded
    ? prompt.tally.filter(
        (o) => o.optionId === mine || (top > 0 && o.voters.length === top),
      )
    : prompt.tally;
  const hidden = prompt.tally.length - shown.length;

  return (
    <section
      id={`vote-${prompt.prompt.id}`}
      aria-labelledby={`vote-${prompt.prompt.id}-title`}
      className="scroll-mt-4"
    >
      <VoteHead prompt={prompt} live={live} />
      <ul className="flex flex-col gap-2.5">
        {shown.map((option) => {
          const chosen = mine === option.optionId;
          return (
            <li key={option.optionId}>
              <button
                type="button"
                disabled={!canVote}
                aria-pressed={chosen}
                onClick={() => {
                  night.respond(prompt.prompt.id, option.optionId);
                  setExpanded(false);
                }}
                className={`relative w-full overflow-hidden rounded-2xl px-4 py-3.5 text-left transition active:scale-[0.99] disabled:cursor-default ${
                  chosen
                    ? "bg-[#1a2234] ring-2 ring-[#ffd84d]"
                    : "bg-[#101826] ring-1 ring-white/10 hover:ring-white/30"
                }`}
              >
                {option.share > 0 && (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 bg-white/[0.07] transition-[width] duration-500"
                    style={{ width: `${Math.round(option.share * 100)}%` }}
                  />
                )}
                <span className="relative flex items-center gap-3.5">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[22px]"
                    aria-hidden
                  >
                    {option.emoji ?? "📍"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[17px] leading-snug font-semibold text-white">
                      {option.label}
                      {chosen && (
                        <Check
                          className="h-4 w-4 shrink-0 text-[#ffd84d]"
                          strokeWidth={3}
                          aria-label="your vote"
                        />
                      )}
                    </span>
                    {option.detail && (
                      <span className="mt-0.5 block text-[14px] leading-snug text-white/65">
                        {option.detail}
                      </span>
                    )}
                    {option.addedBy && (
                      <span className="mt-0.5 block text-[12.5px] text-white/50">
                        {live.participants.find((p) => p.id === option.addedBy)
                          ?.name ?? "Someone"}{" "}
                        added this
                      </span>
                    )}
                  </span>
                  {option.voters.length > 0 && (
                    <span className="flex shrink-0 -space-x-1.5">
                      {option.voters.slice(0, 3).map((p) => (
                        <Avatar key={p.id} person={p} size={26} />
                      ))}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-2.5 flex items-center justify-between gap-3">
        {hidden > 0 || expanded ? (
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={!folded}
            className="min-h-11 text-[14.5px] font-semibold text-white underline-offset-4 hover:underline"
          >
            {expanded
              ? "Done"
              : canVote
                ? `Change my vote · ${hidden} more`
                : `See all ${prompt.tally.length} options`}
          </button>
        ) : (
          <span />
        )}
        {prompt.tally.some((o) => o.voters.length > 0) && (
          <VoteCount voters={prompt.tally.flatMap((o) => o.voters)} />
        )}
      </div>
      {canVote && !folded && prompt.prompt.openToSuggestions && (
        <AddYourOwn
          placeholder="Suggest somewhere else"
          onAdd={(label) => night.addOption(prompt.prompt.id, label)}
        />
      )}
    </section>
  );
}

function AddYourOwn({
  placeholder,
  onAdd,
}: {
  placeholder: string;
  onAdd: (label: string) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <form
      className="mt-4 flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!draft.trim()) return;
        onAdd(draft.trim());
        setDraft("");
      }}
    >
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        maxLength={80}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-h-12 min-w-0 flex-1 rounded-2xl bg-white/[0.07] px-4 text-[16px] text-white ring-1 ring-white/15 outline-none placeholder:text-white/45 focus:ring-white/40"
      />
      <button
        type="submit"
        disabled={!draft.trim()}
        className="inline-flex min-h-12 items-center gap-1.5 rounded-2xl bg-white px-4 text-[15px] font-bold text-[#0b1220] disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
        Add
      </button>
    </form>
  );
}

// ------------------------------------------------------------ the places

/**
 * Food and drink near the arena, asked for once per page and kept: the list
 * does not change while somebody is looking at it, and the vote's photographs
 * come from it.
 */
function useNearby(slug: string, enabled: boolean) {
  const [data, setData] = useState<Nearby | null>(null);
  const [failed, setFailed] = useState(false);
  // Atlas's first corpus read after a cold start can take 8-19 s and can fail;
  // ask again once on our own, then leave "Try again" to the person.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || data) return;
    let current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    fetch(`/hockey/api/occasions/${slug}/nearby`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((body: Nearby) => current && setData(body))
      .catch(() => {
        if (!current) return;
        setFailed(true);
        if (attempt === 0) timer = setTimeout(() => setAttempt(1), 4000);
      });
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [enabled, data, slug, attempt]);

  const state: "idle" | "loading" | "failed" | "ready" = !enabled
    ? "idle"
    : data
      ? "ready"
      : failed
        ? "failed"
        : "loading";
  const retry = () => {
    setData(null);
    setFailed(false);
    setAttempt((n) => n + 1);
  };
  return { data, state, retry };
}
