"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  Check,
  Footprints,
  Lock,
  MapPin,
  Moon,
  Plus,
  Ticket,
  Utensils,
} from "lucide-react";
import { Avatar } from "@/experience-lab/ui/atoms";
import type { LiveExperience, LivePrompt } from "@/experience-lab/core/engine";
import type { Block } from "@/experience-lab/core/types";
import { sameName } from "@/domain/collections/places";
import { clockAt } from "@/domain/hockey/countdown";
import type { NearbyPlace } from "@/domain/hockey/nearby";
import {
  DECISIONS,
  decisionVote,
  needsMyVote,
  planItems,
  voteValue,
  type DecisionId,
  type PlanItem,
} from "@/domain/hockey/plan";
import { nextGameAfter } from "@/domain/hockey/schedule";
import {
  GettingThereEditor,
  SeatsEditor,
  gettingThereSummary,
  seatsSummary,
  useSeats,
} from "./OurSeats";
import { ArenaDoor, isRogersArena } from "./arena/ArenaDoor";
import { RunItBack } from "./RunItBack";
import { MeetingSpots } from "./MeetingSpots";
import {
  BallotRow,
  BallotVenueCard,
  NearbyVenueCard,
  PlanPhoto,
  VenueSkeleton,
  VoteButton,
  VoteCount,
} from "./VenueCard";
import type { SharedNight } from "./useSharedNight";
import styles from "./hockey.module.css";

type Nearby = {
  places: NearbyPlace[];
  meeting?: NearbyPlace[];
  arena?: { atlasId: string; at: [number, number] };
  outage?: string;
};

const DINNER = "pregame-spot";
const MEET = "meet-spot";

/** Phases after the night is over, when Run it back leads Plan. */
const AFTER_THE_NIGHT = new Set(["morning", "again"]);

const ICON: Record<DecisionId, typeof MapPin> = {
  before: Utensils,
  "getting-there": Footprints,
  meeting: MapPin,
  seats: Ticket,
  after: Moon,
};

/** One of the five decisions: its line on the plan, and its part of the night. */
interface Decision {
  readonly id: DecisionId;
  readonly label: string;
  readonly value: string;
  /** Nothing decided yet: said quietly. */
  readonly muted: boolean;
  /** A line under the value: votes so far, locked. */
  readonly meta?: string;
  readonly photo?: string;
  /** What is waiting on this person, said the way a friend would. */
  readonly nudge?: string;
  readonly locked?: boolean;
  /** Its part of the page; none, and the line on the plan is all there is. */
  readonly body?: ReactNode;
  /** A heading for a part that is not a vote (a vote asks its own question). */
  readonly title?: string;
  /** The part is a light panel (seats, the walk), not a dark vote. */
  readonly light?: boolean;
}

/**
 * **Plan: the night, card by card.**
 *
 * The plan leads — five lines, each where its decision stands (the leader of
 * its vote, a tie as a tie, nobody yet) and a nudge where it is waiting on
 * you; tap one and the page goes to it. Under it, the night in the order it
 * happens, every part open: where we eat as photographs of real places the
 * group argues over, getting there, where we meet as cards, our seats, Arena
 * Mode's door, and after the game. Every vote, seat and nomination is the
 * same data through the same endpoints as Release 2; the recovery is the
 * presentation the overhaul (f3b1aa3) and the coworker polish (b5eb736) had,
 * with everything since kept (see `docs/product/hockey/RECOVERY.md`).
 */
export function PlanTab({
  night,
  blocks,
}: {
  night: SharedNight;
  blocks: readonly Block[];
}) {
  const { live } = night;
  const me = Boolean(live.me);
  // The walk and the dinner vote's photographs come from these places.
  const nearby = useNearby(night.state.slug, me);
  // The morning after, the seats are history and Run it back leads.
  const ahead = me && !AFTER_THE_NIGHT.has(live.phase.id);
  const seats = useSeats(night.state.slug, ahead);
  const items = planItems(live.prompts);
  const eating = items.find((i) => i.id === DINNER);

  // Only the questions this phase puts on the page take votes.
  const onPage = new Set(
    blocks.flatMap((b) =>
      b.kind === "promptGroup" ? (b.promptIds ?? []) : [],
    ),
  );
  const votable = (id: string) =>
    onPage.has(id) ? live.prompts.find((p) => p.prompt.id === id) : undefined;
  const vote = (id: string) => {
    const prompt = votable(id);
    if (!prompt) return null;
    if (id === DINNER)
      return (
        <DinnerVote key={id} night={night} prompt={prompt} nearby={nearby} />
      );
    return id === MEET ? (
      <MeetingSpots
        key={id}
        night={night}
        prompt={prompt}
        places={nearby.data?.meeting}
        loading={nearby.state === "loading"}
        meetup={seats.view?.available ? seats.view : null}
        saveMeetup={seats.saveMeetup}
        head={<VoteHead prompt={prompt} live={live} />}
      >
        <ChoiceVote night={night} prompt={prompt} bare />
      </MeetingSpots>
    ) : (
      <ChoiceVote key={id} night={night} prompt={prompt} />
    );
  };

  const rows = voteDecisions(live, items, nearby.data, (id) => {
    const order =
      id === "after" && gameIsOver(live)
        ? ["postgame", "hard-out"]
        : (DECISIONS.find((d) => d.id === id)?.promptIds ?? []);
    const votes = order.map(vote).filter(Boolean);
    return votes.length > 0 ? (
      <div className="flex flex-col gap-10">{votes}</div>
    ) : undefined;
  });

  if (ahead) {
    const seat = seatsSummary(seats.view);
    const walk = gettingThereSummary(seats.view);
    rows.push(
      {
        id: "getting-there",
        label: "Getting there",
        title: "Meet at the arena, walk in together",
        value: walk.value,
        muted: !seats.view?.meetup,
        nudge: walk.needsMe ? "set it" : undefined,
        light: true,
        body: (
          <GettingThereEditor
            seats={seats}
            nearby={nearby.data}
            dinner={
              eating?.leaders.length === 1 ? eating.leaders[0] : undefined
            }
          />
        ),
      },
      {
        id: "seats",
        label: "Our seats",
        title: "Who's sitting where",
        value: seat.value,
        muted: seat.needsMe && !seats.view?.seats.length,
        nudge: seat.needsMe && seats.view?.available ? "add yours" : undefined,
        light: true,
        body: <SeatsEditor seats={seats} say={night.say} />,
      },
    );
  }

  const order = DECISIONS.map((d) => d.id);
  const sorted = [...rows].sort(
    (a, b) => order.indexOf(a.id) - order.indexOf(b.id),
  );
  const door = ahead && isRogersArena(live.definition.kicker);

  // Where we eat leads: the photographs are the experience. The plan card is
  // the quiet "so far" under it, and its lines still go to every part.
  const section = (row: Decision) =>
    row.body ? (
      <DecisionSection key={row.id} row={row}>
        {/* Arena Mode's door sits with the seats: once you're in, it's the building. */}
        {row.id === "seats" && door && (
          <div className="mt-4">
            <ArenaDoor slug={night.state.slug} />
          </div>
        )}
      </DecisionSection>
    ) : null;
  const lead = sorted.find((r) => r.id === "before" && r.body);
  const rest = sorted.filter((r) => r !== lead);

  return (
    <div className="flex flex-col gap-10">
      {lead && section(lead)}

      <PlanCard live={live} rows={sorted} />

      {rest.map(section)}

      {blocks.map((block) =>
        block.kind === "runItBack" && night.series ? (
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
        ) : null,
      )}
    </div>
  );
}

// --------------------------------------------------------------- the plan

/** The plan on its own, for the periods, when the page is otherwise asleep. */
export function PlanSummary({ live }: { live: LiveExperience }) {
  const rows = voteDecisions(live, planItems(live.prompts), null, () => null);
  return <PlanCard live={live} rows={rows} />;
}

function gameIsOver(live: LiveExperience): boolean {
  const after = live.definition.phases.findIndex((p) => p.id === "after");
  return after >= 0 && live.phaseNumber >= after;
}

/** The three decisions a vote settles, each with its votes as its part. */
function voteDecisions(
  live: LiveExperience,
  items: readonly PlanItem[],
  nearby: Nearby | null,
  bodyOf: (id: DecisionId) => ReactNode,
): Decision[] {
  const over = gameIsOver(live);
  return (["before", "meeting", "after"] as const).flatMap((id): Decision[] => {
    const item = decisionVote(id, items, over);
    if (!item) return [];
    const body = bodyOf(id) ?? undefined;
    const leader = item.leaders.length === 1 ? item.leaders[0] : undefined;
    return [
      {
        id,
        label: DECISIONS.find((d) => d.id === id)!.label,
        value: voteValue(item),
        muted: item.leaders.length === 0,
        meta:
          item.voters > 0
            ? `${item.voters} ${item.voters === 1 ? "vote" : "votes"}${
                item.mine && !item.locked ? ` · you: ${item.mine}` : ""
              }`
            : undefined,
        photo:
          id === "before" && leader
            ? placeFor(leader, nearby?.places)?.image?.url
            : undefined,
        locked: item.locked,
        nudge: body && needsMyVote(item) ? "yours?" : undefined,
        body,
      },
    ];
  });
}

function PlanCard({
  live,
  rows,
}: {
  live: LiveExperience;
  rows: readonly Decision[];
}) {
  const anchor = new Date(live.definition.anchorAt);
  const next = whatsNext(live, anchor);
  const order = DECISIONS.map((d) => d.id);
  const sorted = [...rows].sort(
    (a, b) => order.indexOf(a.id) - order.indexOf(b.id),
  );

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
        {sorted.map((row) => (
          <PlanLine key={row.id} row={row} />
        ))}
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

/**
 * One line of the plan. Where its part is on the page, the line goes there;
 * where it isn't (a closed vote, the periods), it is only a statement.
 */
function PlanLine({ row }: { row: Decision }) {
  const Icon = ICON[row.id];
  const face = (
    <>
      <PlanPhoto
        url={row.photo}
        fallback={
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0b1220] text-white">
            <Icon className="h-5 w-5" />
          </span>
        }
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-bold tracking-[0.12em] text-[#0b1220]/55 uppercase">
          {row.label}
        </span>
        <span
          className={`block text-[17px] leading-snug font-bold [overflow-wrap:anywhere] ${
            row.muted ? "text-[#0b1220]/50" : ""
          }`}
        >
          {row.value}
        </span>
        {(row.meta || row.locked) && (
          <span className="flex items-center gap-1 text-[13px] font-semibold text-[#0b1220]/55">
            {row.locked && <Lock className="h-3.5 w-3.5" aria-hidden />}
            {[row.locked && "Locked in", row.meta].filter(Boolean).join(" · ")}
          </span>
        )}
      </span>
      {row.nudge && (
        <span className="shrink-0 text-[13px] font-bold text-[#c2410c]">
          {row.nudge}
        </span>
      )}
      {row.body && (
        <ArrowDown aria-hidden className="h-4 w-4 shrink-0 text-[#0b1220]/40" />
      )}
    </>
  );

  return (
    <li>
      {row.body ? (
        <button
          type="button"
          onClick={() => goTo(row.id)}
          className="flex min-h-[68px] w-full items-center gap-3.5 px-5 py-3 text-left transition hover:bg-[#0b1220]/[0.04]"
        >
          {face}
        </button>
      ) : (
        <div className="flex min-h-[68px] items-center gap-3.5 px-5 py-3">
          {face}
        </div>
      )}
    </li>
  );
}

/** Scroll a decision's part of the page to just under the sticky game bar. */
function goTo(id: DecisionId) {
  const el = document.getElementById(`decision-${id}`);
  if (!el) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  // The places near the arena and the seats arrive late and grow the page
  // above; for a moment, follow the part if that moves it — unless the person
  // has started scrolling themselves.
  let first = true;
  const follow = new ResizeObserver(() => {
    if (first) first = false;
    else el.scrollIntoView({ block: "start" });
  });
  const stop = () => {
    follow.disconnect();
    window.removeEventListener("wheel", stop);
    window.removeEventListener("touchstart", stop);
  };
  follow.observe(document.body);
  window.addEventListener("wheel", stop, { passive: true });
  window.addEventListener("touchstart", stop, { passive: true });
  setTimeout(stop, 2500);
}

/**
 * A decision's part of the night, always open: its name as a kicker, then
 * the vote's own question and cards, or a heading over the light panel.
 */
function DecisionSection({
  row,
  children,
}: {
  row: Decision;
  children?: ReactNode;
}) {
  const Icon = ICON[row.id];
  return (
    <section
      id={`decision-${row.id}`}
      aria-labelledby={`decision-${row.id}-label`}
      className="scroll-mt-20"
    >
      <p
        id={`decision-${row.id}-label`}
        className="mb-2 flex items-center gap-2 text-[13px] font-bold tracking-[0.14em] text-[#ffd84d] uppercase"
      >
        <Icon className="h-4 w-4" aria-hidden />
        {row.label}
      </p>
      {row.title && (
        <h3
          className={`${styles.wide} mb-4 text-[26px] leading-[1.05] text-balance text-white`}
        >
          {row.title}
        </h3>
      )}
      {row.light ? (
        <div className="overflow-hidden rounded-[24px] bg-[#f4f8fc] pt-4 pb-2 text-[#0b1220] shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]">
          {row.body}
        </div>
      ) : (
        row.body
      )}
      {children}
    </section>
  );
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
    <div className="mb-3">
      <h3
        id={`vote-${prompt.prompt.id}-title`}
        className={`${styles.wide} text-[24px] leading-[1.05] text-balance text-white`}
      >
        {prompt.prompt.question}
      </h3>
      <p className="mt-1 text-[14px] leading-snug text-white/70">
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
    () => new Map(prompt.tally.map((o) => [o.label, o])),
    [prompt.tally],
  );
  const person = (id?: string) =>
    live.participants.find((p) => p.id === id)?.name;
  // Real places lead, as photographs. The concourse is the template's
  // zero-effort answer, and a fine one — one row under them, the easy way out.
  const real = prompt.tally.filter((o) => o.optionId !== "concourse");
  const easy = prompt.tally.filter((o) => o.optionId === "concourse");
  const venue = live.definition.kicker.split(" · ")[0];
  const standing = (option: (typeof prompt.tally)[number]) =>
    top > 0 && option.voters.length === top
      ? tied
        ? ("tied" as const)
        : ("leading" as const)
      : undefined;

  // A card's "Add & vote" is two writes: put the place on the ballot (the
  // same nominate as ever), then, once the ballot has it, vote for it. The
  // second waits for the first to show up in the tally; a nomination that is
  // refused never shows up, and is forgotten.
  const toVote = useRef(new Set<string>());
  const [adding, setAdding] = useState<readonly string[]>([]);
  useEffect(() => {
    for (const name of toVote.current) {
      const option = onBallot.get(name);
      if (!option) continue;
      toVote.current.delete(name);
      if (mine !== option.optionId)
        night.respond(prompt.prompt.id, option.optionId);
    }
    // `night` is new every render; the ballot is what this waits on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onBallot, mine, prompt.prompt.id]);
  const addAndVote = (place: NearbyPlace) => {
    toVote.current.add(place.name);
    setAdding((now) => [...now, place.name]);
    void night
      .send({ type: "nominate", promptId: DINNER, atlasId: place.atlasId })
      .finally(() =>
        setTimeout(() => {
          toVote.current.delete(place.name);
          setAdding((now) => now.filter((n) => n !== place.name));
        }, 3000),
      );
  };

  return (
    <section
      id={`vote-${DINNER}`}
      aria-labelledby={`vote-${DINNER}-title`}
      className="scroll-mt-20"
    >
      <VoteHead
        prompt={prompt}
        live={live}
        subtitle="Real places a short walk from the arena. Tap to vote, or add your own."
      />

      {real.length > 0 && (
        <ul className="flex flex-col gap-4" aria-label="On the vote">
          {real.map((option, i) => (
            <li key={option.optionId}>
              <BallotVenueCard
                label={option.label}
                detail={option.detail}
                emoji={option.emoji}
                place={placeFor(option.label, nearby.data?.places)}
                voters={option.voters}
                share={option.share}
                standing={standing(option)}
                chosen={mine === option.optionId}
                canVote={canVote}
                onVote={() => night.respond(prompt.prompt.id, option.optionId)}
                addedBy={option.addedBy ? person(option.addedBy) : undefined}
                priority={i < 2}
              />
            </li>
          ))}
        </ul>
      )}

      {live.me && prompt.open && (
        <PlacesExplorer
          nearby={nearby}
          onBallot={onBallot}
          mine={mine}
          adding={adding}
          onVote={(place) => {
            const existing = onBallot.get(place.name);
            if (existing) night.respond(prompt.prompt.id, existing.optionId);
            else addAndVote(place);
          }}
          venue={venue}
          lead={real.length === 0}
        />
      )}

      {easy.length > 0 && (
        <div className="mt-7">
          <p className="mb-2.5 text-[13px] font-semibold tracking-[0.08em] text-white/60 uppercase">
            Or keep it easy
          </p>
          <ul className="flex flex-col gap-2">
            {easy.map((option) => (
              <li key={option.optionId}>
                <BallotRow
                  label={option.label}
                  detail={option.detail}
                  emoji={option.emoji}
                  voters={option.voters}
                  share={option.share}
                  standing={standing(option)}
                  chosen={mine === option.optionId}
                  canVote={canVote}
                  onVote={() =>
                    night.respond(prompt.prompt.id, option.optionId)
                  }
                />
              </li>
            ))}
          </ul>
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

/** How many places show before "See all". */
const FIRST_LOOK = 3;

/**
 * **Places near the arena, sold rather than listed.** The three a group
 * should see first — not on the vote yet, not closed on game day by Atlas's
 * own hours, photographs first then the shortest walk (the server's order).
 * While nothing real is on the vote they lead, full width, so a new night
 * opens on photographs; once the vote has places, they are a shelf to swipe
 * under it. Everything else Passport and Atlas know is one tap further, with
 * the filters, and every card is one tap to put it on the vote and back it.
 */
function PlacesExplorer({
  nearby,
  onBallot,
  mine,
  adding,
  onVote,
  venue,
  lead,
}: {
  nearby: ReturnType<typeof useNearby>;
  onBallot: ReadonlyMap<
    string,
    { optionId: string; voters: readonly unknown[] }
  >;
  mine: unknown;
  adding: readonly string[];
  onVote: (place: NearbyPlace) => void;
  venue: string;
  /** Nothing real is on the vote yet: open with the best places, full width. */
  lead: boolean;
}) {
  const [all, setAll] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const everything = nearby.data?.places ?? [];
  const bets = everything
    .filter((p) => !onBallot.has(p.name) && p.gameDay?.reading !== "not-on")
    .slice(0, FIRST_LOOK);
  const places = all
    ? everything
        .filter((p) =>
          filter === "all" ? true : filter === "drink" ? drinks(p) : !drinks(p),
        )
        // What is already on the vote after what is not.
        .sort(
          (a, b) => Number(onBallot.has(a.name)) - Number(onBallot.has(b.name)),
        )
    : bets;
  const wide = lead && !all;
  const statusOf = (place: NearbyPlace) => {
    const option = onBallot.get(place.name);
    if (option) return mine === option.optionId ? "mine" : "on-ballot";
    return adding.includes(place.name) ? "pending" : "new";
  };

  return (
    <div
      aria-label={`Places near ${venue}`}
      role="region"
      className={lead ? "" : "mt-8"}
    >
      {/* Leading a fresh night, the vote's own head says it; the photographs start at once. */}
      {(!lead || all) && (
        <div className="flex items-end justify-between gap-3">
          <div>
            <h4
              className={`${styles.wide} text-[20px] leading-tight text-white`}
            >
              {lead ? `Near ${venue}` : `More near ${venue}`}
            </h4>
            <p className="mt-1 text-[14px] leading-snug text-white/65">
              {all
                ? `Everything within a short walk of ${venue}.`
                : bets.length > 0
                  ? "Good bets a short walk away. Add one and it's on the vote with yours."
                  : "Everything nearby is already on the vote."}
            </p>
          </div>
          {everything.length > 0 && (
            <span className="shrink-0 text-[13px] font-semibold text-white/60">
              {everything.length} places
            </span>
          )}
        </div>
      )}

      {nearby.state === "loading" && (
        <>
          <div
            className={`${styles.noScrollbar} -mx-4 mt-4 flex gap-3 overflow-hidden px-4`}
          >
            <VenueSkeleton />
            <VenueSkeleton />
          </div>
          <p className="mt-2 text-[14px] text-white/65" role="status">
            Asking Atlas what&apos;s near the arena — the first look can take a
            few seconds.
          </p>
        </>
      )}

      {(nearby.state === "failed" ||
        (nearby.data?.outage && everything.length === 0)) && (
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
      {nearby.data?.outage && everything.length > 0 && (
        <p className="mt-4 text-[14px] text-white/70">
          Passport&apos;s full map isn&apos;t answering, so this is the short
          list it keeps itself.
        </p>
      )}
      {nearby.data && !nearby.data.outage && everything.length === 0 && (
        <p className="mt-4 rounded-2xl bg-white/[0.06] px-4 py-3.5 text-[15px] text-white/80">
          Passport doesn&apos;t know anywhere within a short walk yet. Type one
          below — you know more than it does.
        </p>
      )}

      {all && (
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

      {places.length > 0 && (
        <ul
          className={
            wide
              ? "mt-4 flex flex-col gap-4"
              : `${styles.noScrollbar} -mx-4 mt-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2`
          }
        >
          {places.map((place, i) => (
            <li key={place.atlasId} className="flex">
              <NearbyVenueCard
                place={place}
                votes={onBallot.get(place.name)?.voters.length}
                wide={wide}
                priority={i === 0}
                actions={
                  <VoteButton
                    place={place}
                    status={statusOf(place)}
                    canVote
                    onVote={() => onVote(place)}
                  />
                }
              />
            </li>
          ))}
        </ul>
      )}
      {everything.length > (all ? 0 : bets.length) && (
        <button
          type="button"
          aria-expanded={all}
          onClick={() => setAll((now) => !now)}
          className="mt-2 inline-flex min-h-11 items-center text-[14.5px] font-semibold text-white underline underline-offset-4"
        >
          {all
            ? "Show just the good bets"
            : `See all ${everything.length} places`}
        </button>
      )}
      {everything.length > 0 && (
        <p className="mt-1 text-[12.5px] leading-snug text-white/55">
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
  bare = false,
}: {
  night: SharedNight;
  prompt: LivePrompt;
  /** Without its own heading: something above has already asked the question. */
  bare?: boolean;
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
      {!bare && <VoteHead prompt={prompt} live={live} />}
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
