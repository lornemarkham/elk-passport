"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  MapPin,
  Moon,
  Search,
  Sofa,
  Ticket,
  Utensils,
  X,
} from "lucide-react";
import { FanAvatar as Avatar } from "./FanTag";
import type { LiveExperience, LivePrompt } from "@/experience-lab/core/engine";
import type { Block } from "@/experience-lab/core/types";
import { clockAt } from "@/domain/hockey/countdown";
import {
  arenaMeetingSpot,
  currentStop,
  meetOffsetMinutes,
  meetingPoint,
  meetingSourceLine,
  type StopId,
} from "@/domain/hockey/gameplan";
import type { NearbyPlace } from "@/domain/hockey/nearby";
import { PLANS_PROMPT_ID } from "@/domain/hockey/night";
import {
  decisionVote,
  needsMyVote,
  planItems,
  voteValue,
  type PlanItem,
} from "@/domain/hockey/plan";
import { gateById } from "@/domain/hockey/arena";
import type { Moment } from "@/domain/hockey/reasons";
import { nextGameAfter } from "@/domain/hockey/schedule";
import { Directions, SeatsEditor, seatsSummary, useSeats } from "./OurSeats";
import { ArenaDoor, isRogersArena } from "./arena/ArenaDoor";
import { RunItBack } from "./RunItBack";
import {
  BallotVenueCard,
  NearbyVenueCard,
  PlanPhoto,
  VenueSkeleton,
  VoteButton,
  VoteCount,
} from "./VenueCard";
import {
  AddYourOwn,
  placeFor,
  useBallot,
  useNearby,
  type Ballot,
  type NearbyState,
} from "./PlanShared";
import { Attendance, MeetPlan, VenueBoard } from "./PlanBoards";
import type { SharedNight } from "./useSharedNight";
import styles from "./hockey.module.css";

const DINNER = "pregame-spot";
const MEET = "meet-spot";
const POSTGAME = "postgame";
const CONCOURSE = "concourse";

/** Phases after the night is over, when Run it back leads Plan. */
const AFTER_THE_NIGHT = new Set(["morning", "again"]);

const ICON: Record<StopId, typeof MapPin> = {
  pregame: Utensils,
  meet: MapPin,
  game: Ticket,
  after: Moon,
};

/**
 * **Plan: our game plan, one itinerary.**
 *
 * Four stops in the order the evening happens — pregame, meet up, game time,
 * after — each one line: when, where, how it stands, and the one thing you
 * can do about it. A stop opens in place for the detail (the vote, the
 * meeting point, your seat and directions) and only one is open at a time.
 * Passport's photographic venue cards are one tap away in Explore, where the
 * group browses, adds a place to the vote and backs it.
 *
 * Every vote, nomination, seat and meeting point goes through the same
 * endpoints as before (`docs/product/hockey/ALIVE.md` says what moved where).
 */
export function PlanTab({
  night,
  blocks,
  couch = false,
  onImGoing,
}: {
  night: SharedNight;
  blocks: readonly Block[];
  /** This person is watching from the couch: no meetup, seats or walk. */
  couch?: boolean;
  onImGoing?: () => void;
}) {
  const { live } = night;
  const morning = AFTER_THE_NIGHT.has(live.phase.id);
  const runItBack = blocks.map((block) =>
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
          suggestion={nextGameAfter(live.definition.anchorAt, live.now)}
          modules={night.modules}
        />
      </section>
    ) : null,
  );

  return (
    <div className="flex flex-col gap-8">
      {/* The morning after, the next night leads and the plan is history. */}
      {morning && runItBack}
      <GamePlan
        night={night}
        blocks={blocks}
        couch={couch}
        onImGoing={onImGoing}
      />
      {!morning && runItBack}
    </div>
  );
}

/** The plan on its own, for the periods, when the page is otherwise asleep. */
export function PlanSummary({
  night,
  couch = false,
}: {
  night: SharedNight;
  couch?: boolean;
}) {
  return <GamePlan night={night} blocks={[]} couch={couch} readOnly />;
}

function gameIsOver(live: LiveExperience): boolean {
  const after = live.definition.phases.findIndex((p) => p.id === "after");
  return after >= 0 && live.phaseNumber >= after;
}

// ------------------------------------------------------------ the plan

interface Stop {
  readonly id: StopId;
  readonly label: string;
  readonly time: string;
  readonly value: string;
  readonly muted: boolean;
  readonly sub?: string;
  readonly photo?: string;
  /** Something here is waiting on this person: the button lights up. */
  readonly needs?: boolean;
  /** …and, where the button doesn't already say it, what. */
  readonly nudge?: string;
  /** The stop's one button, and what it does. */
  readonly action?: { label: string; open?: boolean; onClick?: () => void };
  /** A second, quieter button. */
  readonly extra?: { label: string; onClick: () => void; icon?: ReactNode };
  /** A second line under `sub`, for the other crew. */
  readonly sub2?: string;
  readonly body?: ReactNode;
  /** The body is the point of this stop: on the page, not behind a button. */
  readonly featured?: boolean;
}

function GamePlan({
  night,
  blocks,
  couch,
  onImGoing,
  readOnly = false,
}: {
  night: SharedNight;
  blocks: readonly Block[];
  couch: boolean;
  onImGoing?: () => void;
  readOnly?: boolean;
}) {
  const { live } = night;
  const me = Boolean(live.me);
  const over = gameIsOver(live);
  const morning = AFTER_THE_NIGHT.has(live.phase.id);
  const ahead = me && !morning;
  // Photographs and walks for the votes come from these places.
  const nearby = useNearby(night.state.slug, me && !readOnly);
  const seats = useSeats(night.state.slug, ahead && !couch);
  const items = planItems(live.prompts);
  const dinner = items.find((i) => i.id === DINNER);
  const meetItem = items.find((i) => i.id === MEET);
  const postItem = items.find((i) => i.id === POSTGAME);
  const afterItem = decisionVote("after", items, over);
  const dinnerBallot = useBallot(
    night,
    live.prompts.find((p) => p.prompt.id === DINNER),
  );
  const postBallot = useBallot(
    night,
    live.prompts.find((p) => p.prompt.id === POSTGAME),
  );
  const [open, setOpen] = useState<StopId | null>(null);
  const [exploring, setExploring] = useState<Moment | null>(null);
  const toggle = (id: StopId) => setOpen((now) => (now === id ? null : id));

  // Only the questions this phase puts on the page take votes.
  const onPage = new Set(
    blocks.flatMap((b) =>
      b.kind === "promptGroup" ? (b.promptIds ?? []) : [],
    ),
  );
  const votable = (id: string) =>
    !readOnly && onPage.has(id)
      ? live.prompts.find((p) => p.prompt.id === id)
      : undefined;
  const dinnerPrompt = votable(DINNER);
  const plansPrompt = votable(PLANS_PROMPT_ID);
  const postPrompt = votable(POSTGAME);
  const leavingPrompt = votable("hard-out");

  const anchorAt = live.definition.anchorAt;
  const anchor = new Date(anchorAt);
  const warmup = live.definition.phases.find((p) => p.id === "warmup");
  const venue = live.definition.kicker.split(" · ")[0];
  const meetup = seats.view?.meetup;
  const concourseLabel = live.prompts
    .find((p) => p.prompt.id === DINNER)
    ?.tally.find((o) => o.optionId === CONCOURSE)?.label;
  const couchIds = new Set(
    Object.entries(night.crowd?.where ?? {})
      .filter(([, where]) => where === "couch")
      .map(([id]) => id),
  );
  const members = live.participants.filter((p) => !couchIds.has(p.id)).length;
  const arena = arenaMeetingSpot(venue, nearby.data?.meeting);
  const point = meetingPoint({
    official: meetup
      ? ((meetup.spot || gateById(meetup.gate)?.name) ?? undefined)
      : undefined,
    dinner,
    concourseLabel,
    vote: meetItem,
    arena: arena.value,
    // Everybody going settles it; the couch isn't meeting anyone.
    members,
  });
  const dinnerLeader =
    dinner?.leaders.length === 1 ? dinner.leaders[0] : undefined;
  const dinnerPlace = dinnerLeader
    ? placeFor(dinnerLeader, nearby.data?.places)
    : undefined;
  const postLeader =
    postItem?.leaders.length === 1 ? postItem.leaders[0] : undefined;
  const postPlace = postLeader
    ? placeFor(postLeader, nearby.data?.places)
    : undefined;
  const seat = seatsSummary(seats.view);
  const door = ahead && !couch && isRogersArena(live.definition.kicker);
  // Where the arena is: from the seats read or the places read, whichever has
  // answered. Neither yet means no map link, never a link to nowhere.
  const venuePoint = seats.view?.venue ?? nearby.data?.venue;

  const stops: Stop[] = [];

  if (dinner) {
    stops.push({
      id: "pregame",
      label: "Pregame",
      time: clockAt(anchor, warmup?.offsetMinutes ?? -90),
      value: voteValue(dinner),
      muted: dinner.leaders.length === 0,
      sub:
        dinner.voters === 0
          ? undefined
          : [
              votesLine(dinner),
              dinnerPlace && `${dinnerPlace.walkMinutes}+ min walk`,
            ]
              .filter(Boolean)
              .join(" · "),
      photo: dinnerPlace?.image?.url,
      needs: Boolean(dinnerPrompt && needsMyVote(dinner)),
      featured: Boolean(dinnerPrompt),
      body: dinnerPrompt ? (
        <VenueBoard
          night={night}
          prompt={dinnerPrompt}
          item={dinner}
          nearby={nearby}
          ballot={dinnerBallot}
          moment="pregame"
          venue={venue}
          away={couchIds}
          onExplore={() => setExploring("pregame")}
        >
          {plansPrompt && !couch && (
            <Attendance night={night} prompt={plansPrompt} away={couchIds} />
          )}
        </VenueBoard>
      ) : undefined,
    });
  }

  if (!couch) {
    const offset = meetOffsetMinutes(anchorAt, meetup?.time);
    stops.push({
      id: "meet",
      label: "Meet up",
      // The pregame crew meets at the pregame; the default time is theirs.
      time:
        point.source === "pregame" && !meetup?.time
          ? clockAt(anchor, warmup?.offsetMinutes ?? -90)
          : clockAt(anchor, offset),
      value: point.value,
      muted: !point.decided && point.source === "arena",
      sub: meetingSourceLine(point),
      sub2:
        point.source === "arena" || point.source === "host"
          ? undefined
          : `Skipping the pregame? ${arena.value}.`,
      action:
        ahead && !readOnly
          ? {
              label:
                seats.view?.role === "host"
                  ? "Directions & host controls"
                  : "Who goes where & directions",
              open: open === "meet",
              onClick: () => toggle("meet"),
            }
          : undefined,
      body: (
        <MeetPlan
          night={night}
          plans={live.prompts.find((p) => p.prompt.id === PLANS_PROMPT_ID)}
          point={point}
          winner={dinnerPlace}
          arena={arena}
          venue={venue}
          venueAt={venuePoint?.at}
          seats={seats}
          nearby={nearby}
          away={couchIds}
        />
      ),
    });
  }

  stops.push(
    couch
      ? {
          id: "game",
          label: "Game time",
          time: clockAt(anchor, 0),
          value: "From the couch",
          muted: false,
          sub: `${live.definition.subtitle}, puck drop ${clockAt(anchor, 0)} — picks, chat and the Cup all count from home`,
          action:
            onImGoing && !readOnly && ahead
              ? { label: "I'm going after all", onClick: onImGoing }
              : undefined,
        }
      : {
          id: "game",
          label: "Game time",
          time: clockAt(anchor, 0),
          value: venue,
          muted: false,
          sub: seats.view?.available
            ? seat.value === "No seats yet"
              ? "Seats not added yet"
              : seat.value
            : undefined,
          needs: Boolean(!readOnly && seat.needsMe && seats.view?.available),
          nudge:
            !readOnly && seat.needsMe && seats.view?.available
              ? "Add your seat"
              : undefined,
          action:
            !readOnly && ahead
              ? {
                  label: "Seats & directions",
                  open: open === "game",
                  onClick: () => toggle("game"),
                }
              : undefined,
          body: (
            <div className="flex flex-col gap-4">
              {seats.view?.available && (
                <LightPanel>
                  <SeatsEditor seats={seats} say={night.say} away={couchIds} />
                </LightPanel>
              )}
              <LightPanel>
                <Directions
                  seats={seats}
                  nearby={nearby.data}
                  from={dinnerLeader}
                />
              </LightPanel>
              {door && <ArenaDoor slug={night.state.slug} />}
            </div>
          ),
        },
  );

  if (afterItem) {
    const afterBody =
      postPrompt || leavingPrompt ? (
        <div className="flex flex-col gap-8">
          {postPrompt && (
            <VenueBoard
              night={night}
              prompt={postPrompt}
              item={postItem}
              nearby={nearby}
              ballot={postBallot}
              moment="postgame"
              venue={venue}
              away={couchIds}
              onExplore={() => setExploring("postgame")}
            />
          )}
          {leavingPrompt && <ChoiceVote night={night} prompt={leavingPrompt} />}
        </div>
      ) : undefined;
    stops.push({
      id: "after",
      label: over ? "What's next" : "After",
      time: "After the horn",
      value: voteValue(postItem?.leaders.length ? postItem : afterItem),
      muted:
        (postItem?.leaders.length ? postItem : afterItem).leaders.length === 0,
      sub:
        (postItem?.voters ? postItem : afterItem).voters > 0
          ? votesLine(postItem?.voters ? postItem : afterItem)
          : "Where do we go after? Real places, hours from Atlas.",
      photo: postPlace?.image?.url,
      needs: Boolean(
        (postPrompt && postItem && needsMyVote(postItem)) ||
        (leavingPrompt && needsMyVote(afterItem)),
      ),
      featured: Boolean(afterBody) && over,
      action: afterBody
        ? {
            label: over ? "Vote on the next stop" : "Plan the after",
            open: open === "after",
            onClick: () => toggle("after"),
          }
        : undefined,
      body: afterBody,
    });
  }

  const now = currentStop(live.phase.id);
  const next = whatsNext(live, anchor);
  const exploringPrompt =
    exploring === "pregame"
      ? dinnerPrompt
      : exploring === "postgame"
        ? postPrompt
        : undefined;

  return (
    <>
      <section
        aria-labelledby="game-plan-title"
        className="overflow-hidden rounded-[26px] bg-[#0e1626] shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)] ring-1 ring-white/10"
      >
        <div className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-1">
          <h2
            id="game-plan-title"
            className={`${styles.wide} text-[26px] leading-none text-white`}
          >
            {morning ? "How the night went" : "Our game plan"}
          </h2>
          <span className="text-[13px] font-semibold text-white/55">
            {anchor.toLocaleDateString("en-CA", {
              weekday: "short",
              month: "short",
              day: "numeric",
              timeZone: "America/Vancouver",
            })}
          </span>
        </div>
        <ol className="px-3 pt-2 pb-3">
          {stops.map((stop, i) => (
            <StopRow
              key={stop.id}
              stop={stop}
              now={!morning && stop.id === now}
              last={i === stops.length - 1}
            />
          ))}
        </ol>
        {next && (
          <p className="border-t border-white/10 bg-black/20 px-5 py-3 text-[14px] leading-snug text-white/80">
            <span className="font-bold text-[#ffd84d]">Next: </span>
            {next}
          </p>
        )}
      </section>

      {exploring && exploringPrompt && (
        <ExploreSheet
          night={night}
          prompt={exploringPrompt}
          nearby={nearby}
          ballot={exploring === "pregame" ? dinnerBallot : postBallot}
          venue={venue}
          moment={exploring}
          onClose={() => setExploring(null)}
        />
      )}
    </>
  );
}

function votesLine(item: PlanItem): string | undefined {
  if (item.voters === 0) return "No votes yet";
  return `${item.voters} ${item.voters === 1 ? "vote" : "votes"}${
    item.mine && !item.locked ? ` · you: ${item.mine}` : ""
  }${item.locked ? " · locked in" : ""}`;
}

/**
 * One stop of the evening: its time on the rail, what and where, and its one
 * action. Opening it shows its detail right under it.
 */
function StopRow({
  stop,
  now,
  last,
}: {
  stop: Stop;
  now: boolean;
  last: boolean;
}) {
  const Icon = stop.value === "From the couch" ? Sofa : ICON[stop.id];
  const open = stop.featured ? true : (stop.action?.open ?? false);
  const bodyId = `stop-${stop.id}-detail`;
  return (
    <li className="relative">
      <section
        id={`stop-${stop.id}`}
        aria-label={stop.label}
        className="scroll-mt-20"
      >
        <div className="flex gap-3 px-2 pt-3">
          {/* The rail: a dot per stop, gold where the night is now. */}
          <div className="flex w-[54px] shrink-0 flex-col items-center">
            <span
              className={`text-[12.5px] leading-tight font-bold tabular-nums ${
                now ? "text-[#ffd84d]" : "text-white/70"
              } text-center`}
            >
              {stop.time}
            </span>
            <span
              aria-hidden
              className={`mt-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                now
                  ? `${styles.nowDot} bg-[#ffd84d] text-[#0b1220]`
                  : "bg-white/[0.08] text-white/80"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
            </span>
            {!last && (
              <span aria-hidden className="mt-1 w-px flex-1 bg-white/15" />
            )}
          </div>

          <div className="min-w-0 flex-1 pb-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[12px] font-bold tracking-[0.14em] text-white/55 uppercase">
                  {stop.label}
                  {now && (
                    <span className="rounded-full bg-[#ffd84d] px-1.5 py-px text-[12px] tracking-[0.08em] text-[#0b1220]">
                      Now
                    </span>
                  )}
                </p>
                <p
                  className={`mt-0.5 text-[18px] leading-snug font-extrabold [overflow-wrap:anywhere] ${
                    stop.muted ? "text-white/50" : "text-white"
                  }`}
                >
                  {stop.value}
                </p>
                {stop.sub && (
                  <p className="mt-0.5 text-[13.5px] leading-snug text-white/60">
                    {stop.sub}
                  </p>
                )}
                {stop.sub2 && (
                  <p className="mt-0.5 text-[13.5px] leading-snug text-white/60">
                    {stop.sub2}
                  </p>
                )}
              </div>
              {stop.photo && (
                <PlanPhoto
                  url={stop.photo}
                  className="h-14 w-14 rounded-xl"
                  fallback={null}
                />
              )}
            </div>

            {(stop.action || stop.extra) && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {stop.action && (
                  <button
                    type="button"
                    onClick={stop.action.onClick}
                    aria-expanded={stop.body ? open : undefined}
                    aria-controls={stop.body ? bodyId : undefined}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[14.5px] font-bold transition active:scale-[0.97] ${
                      stop.needs && !open
                        ? "bg-[#ffd84d] text-[#0b1220]"
                        : "bg-white/[0.1] text-white hover:bg-white/[0.16]"
                    }`}
                  >
                    {stop.action.label}
                    {stop.body && (
                      <ChevronDown
                        aria-hidden
                        className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                      />
                    )}
                  </button>
                )}
                {stop.extra && (
                  <button
                    type="button"
                    onClick={stop.extra.onClick}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[14.5px] font-bold text-white ring-1 ring-white/20 transition hover:bg-white/[0.08] active:scale-[0.97]"
                  >
                    {stop.extra.icon}
                    {stop.extra.label}
                  </button>
                )}
                {stop.nudge && !open && (
                  <span className="text-[13px] font-bold text-[#ffd84d]">
                    {stop.nudge}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        {/* The detail takes the card's whole width: a vote needs the room. */}
        {open && stop.body && (
          <div id={bodyId} className={`${styles.unfold} px-1 pb-5`}>
            {stop.body}
          </div>
        )}
      </section>
    </li>
  );
}

function LightPanel({
  children,
  title,
  icon: Icon,
}: {
  children: ReactNode;
  title?: string;
  icon?: typeof MapPin;
}) {
  return (
    <div className="overflow-hidden rounded-[20px] bg-[#f4f8fc] pt-4 pb-2 text-[#0b1220]">
      {title && (
        <p className="flex items-center gap-2 px-5 text-[12px] font-bold tracking-[0.12em] text-[#0b1220]/55 uppercase">
          {Icon && <Icon className="h-4 w-4" aria-hidden />}
          {title}
        </p>
      )}
      {children}
    </div>
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
      return "The receipts are in Play. Run it back is above.";
    default:
      return null;
  }
}

// ------------------------------------------------------------ the votes

const FILTERS = [
  { id: "all", label: "All" },
  { id: "eat", label: "Restaurants" },
  { id: "drink", label: "Bars & pubs" },
] as const;

const drinks = (p: NearbyPlace) =>
  /bar|pub|lounge|brew|tap|tavern|saloon|wine|cocktail/i.test(p.subtype ?? "");

/**
 * **Explore: the places near the arena, as Passport shows a place.** Full
 * photographic cards, what's already on the vote first, then everything else
 * a short walk away, with a filter. Every card is one tap to vote, or to add
 * it to the vote and back it — the same vote as the plan, not a second one.
 */
function ExploreSheet({
  night,
  prompt,
  nearby,
  ballot,
  venue,
  moment,
  onClose,
}: {
  night: SharedNight;
  prompt: LivePrompt;
  nearby: NearbyState;
  ballot: Ballot;
  venue: string;
  moment: Moment;
  onClose: () => void;
}) {
  const { live } = night;
  const canVote = Boolean(live.me) && prompt.open;
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [query, setQuery] = useState("");
  const close = useRef<HTMLButtonElement>(null);
  const everything = nearby.data?.places ?? [];
  // After the game the ballot also holds ideas that are not places ("Keep
  // going", "We're cooked"): they live on the plan, not in a place browser.
  const real = prompt.tally.filter(
    (o) =>
      o.optionId !== CONCOURSE &&
      (moment === "pregame" || placeFor(o.label, everything)),
  );
  const needle = query.trim().toLowerCase();
  const rest = everything
    .filter((p) => !ballot.onBallot.has(p.name))
    .filter((p) =>
      filter === "all" ? true : filter === "drink" ? drinks(p) : !drinks(p),
    )
    .filter(
      (p) =>
        !needle ||
        `${p.name} ${p.subtype ?? ""} ${p.blurb ?? ""}`
          .toLowerCase()
          .includes(needle),
    );
  const person = (id?: string) =>
    live.participants.find((p) => p.id === id)?.name;

  // The page re-renders every few seconds; the sheet must not take focus
  // back each time, so the effect runs once and reads the latest `onClose`.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    close.current?.focus();
    const was = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = was;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="explore-title"
      className={`${styles.sheet} fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-[#070d18] text-white`}
    >
      <div className="sticky top-0 z-10 border-b border-white/10 bg-[#070d18]/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
          <div className="min-w-0 flex-1">
            <h2
              id="explore-title"
              className={`${styles.wide} text-[22px] leading-tight`}
            >
              Near {venue}
              {moment === "postgame" ? " · after the game" : ""}
            </h2>
            <p className="text-[13px] text-white/60">
              {everything.length > 0
                ? `${everything.length} places a short walk away · via Passport Discovery & Atlas`
                : "What Passport knows a short walk away"}
            </p>
          </div>
          <button
            ref={close}
            type="button"
            onClick={onClose}
            aria-label="Close explore"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-4 text-[14.5px] font-bold text-[#0b1220]"
          >
            <X className="h-4 w-4" aria-hidden />
            Done
          </button>
        </div>
        <div
          className="mx-auto flex max-w-2xl gap-2 px-4 pb-3"
          role="group"
          aria-label="Show"
        >
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`min-h-10 rounded-full px-3.5 text-[14px] font-semibold whitespace-nowrap transition ${
                filter === f.id
                  ? "bg-[#ffd84d] text-[#0b1220]"
                  : "bg-white/[0.08] text-white/85 hover:bg-white/[0.14]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="mx-auto max-w-2xl px-4 pb-3">
          <label className="flex min-h-11 items-center gap-2 rounded-full bg-white/[0.08] px-4 ring-1 ring-white/15 focus-within:ring-white/40">
            <Search className="h-4 w-4 shrink-0 text-white/60" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search places near the arena"
              placeholder="Search by name or kind of place"
              className="min-w-0 flex-1 bg-transparent text-[16px] text-white outline-none placeholder:text-white/45"
            />
          </label>
        </div>
      </div>

      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 pt-5 pb-16">
        {real.length > 0 && (
          <section aria-labelledby="explore-ballot">
            <h3
              id="explore-ballot"
              className="mb-3 text-[12px] font-bold tracking-[0.14em] text-[#ffd84d] uppercase"
            >
              On the vote
            </h3>
            <ul className="flex flex-col gap-4">
              {real.map((option, i) => (
                <li key={option.optionId}>
                  <BallotVenueCard
                    label={option.label}
                    detail={option.detail}
                    emoji={option.emoji}
                    place={placeFor(option.label, nearby.data?.places)}
                    voters={option.voters}
                    share={option.share}
                    standing={ballot.standing(option)}
                    chosen={ballot.mine === option.optionId}
                    canVote={canVote}
                    onVote={() =>
                      night.respond(prompt.prompt.id, option.optionId)
                    }
                    addedBy={
                      option.addedBy ? person(option.addedBy) : undefined
                    }
                    priority={i < 1}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="explore-near" role="region">
          <h3
            id="explore-near"
            className="mb-3 text-[12px] font-bold tracking-[0.14em] text-[#ffd84d] uppercase"
          >
            {real.length > 0 ? "Add one to the vote" : "Good bets nearby"}
          </h3>
          {nearby.state === "loading" && (
            <div className="flex flex-col gap-4">
              <VenueSkeleton wide />
              <p className="text-[14px] text-white/65" role="status">
                Asking Atlas what&apos;s near the arena — the first look can
                take a few seconds.
              </p>
            </div>
          )}
          {(nearby.state === "failed" ||
            (nearby.data?.outage && everything.length === 0)) && (
            <p className="rounded-2xl bg-white/[0.06] px-4 py-3.5 text-[15px] text-white/80">
              Passport can&apos;t reach its map of the city right now. Type a
              place on the plan instead — it counts just the same.{" "}
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
            <p className="mb-3 text-[14px] text-white/70">
              Passport&apos;s full map isn&apos;t answering, so this is the
              short list it keeps itself.
            </p>
          )}
          {nearby.data && everything.length > 0 && rest.length === 0 && (
            <p className="text-[14.5px] text-white/70">
              {needle || filter !== "all"
                ? "Nothing near the arena matches that. Try another word, or type the place on the plan."
                : "Everything here is already on the vote."}
            </p>
          )}
          <ul className="flex flex-col gap-4">
            {rest.map((place, i) => (
              <li key={place.atlasId} className="flex">
                <NearbyVenueCard
                  place={place}
                  wide
                  priority={i === 0 && real.length === 0}
                  actions={
                    <VoteButton
                      place={place}
                      status={ballot.statusOf(place)}
                      canVote={canVote}
                      onVote={() => ballot.vote(place)}
                    />
                  }
                />
              </li>
            ))}
          </ul>
          {everything.length > 0 && (
            <p className="mt-4 text-[12.5px] leading-snug text-white/55">
              Walks are straight lines at a walking pace, so the real one is
              longer. Photos are the places&apos; own, via Atlas.
            </p>
          )}
        </section>
      </div>
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
  // and the group's — the plan line already says how it's going.
  const [expanded, setExpanded] = useState(false);
  const top = Math.max(0, ...prompt.tally.map((o) => o.voters.length));
  const folded = (mine !== undefined || prompt.locked) && !expanded;
  const shown = folded
    ? prompt.tally.filter(
        (o) => o.optionId === mine || (top > 0 && o.voters.length === top),
      )
    : prompt.tally;
  const hidden = prompt.tally.length - shown.length;
  const lock = live.definition.phases.find(
    (p) => p.id === prompt.prompt.locksAtPhaseId,
  );

  return (
    <section
      id={`vote-${prompt.prompt.id}`}
      aria-labelledby={bare ? undefined : `vote-${prompt.prompt.id}-title`}
      aria-label={bare ? prompt.prompt.question : undefined}
      className="scroll-mt-4"
    >
      {!bare && (
        <div className="mb-3">
          <h3
            id={`vote-${prompt.prompt.id}-title`}
            className="text-[17px] leading-snug font-extrabold text-white"
          >
            {prompt.prompt.question}
          </h3>
          <p className="mt-0.5 text-[13.5px] leading-snug text-white/65">
            {prompt.locked
              ? "Voting's closed. This is what the group decided."
              : prompt.prompt.hint}
            {!prompt.locked && lock && (
              <span className="text-white/50">
                {" "}
                Closes{" "}
                {clockAt(
                  new Date(live.definition.anchorAt),
                  lock.offsetMinutes,
                )}
              </span>
            )}
          </p>
        </div>
      )}
      <ul className="flex flex-col gap-2">
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
                className={`relative w-full overflow-hidden rounded-2xl px-3.5 py-3 text-left transition active:scale-[0.99] disabled:cursor-default ${
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
                <span className="relative flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[20px]"
                    aria-hidden
                  >
                    {option.emoji ?? "📍"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[16px] leading-snug font-semibold text-white">
                      {option.label}
                      {chosen && <span className="sr-only"> (your vote)</span>}
                    </span>
                    {option.detail && (
                      <span className="mt-0.5 block text-[13px] leading-snug text-white/60">
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
                        <Avatar key={p.id} person={p} size={24} />
                      ))}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex items-center justify-between gap-3">
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
