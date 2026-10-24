"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Compass, MapPin, Navigation } from "lucide-react";
import { FanAvatar as Avatar } from "./FanTag";
import type { LivePrompt } from "@/experience-lab/core/engine";
import type { Participant } from "@/experience-lab/core/types";
import { sameName } from "@/domain/collections/places";
import { clockAt } from "@/domain/hockey/countdown";
import {
  FIRST_LOOK,
  postgameBets,
  pregameBets,
  splitBallot,
} from "@/domain/hockey/candidates";
import { gateById, ROGERS_ARENA_GATES } from "@/domain/hockey/arena";
import {
  preferredOrder,
  walkingLinks,
  type MapLink,
} from "@/domain/hockey/directions";
import { voteSettled, type MeetingPoint } from "@/domain/hockey/gameplan";
import type { NearbyPlace } from "@/domain/hockey/nearby";
import { PLANS_OPTIONS } from "@/domain/hockey/night";
import type { PlanItem } from "@/domain/hockey/plan";
import {
  reasonToVisit,
  walkExtremes,
  type Moment,
} from "@/domain/hockey/reasons";
import type { Meetup } from "@/domain/hockey/seats";
import { BallotRow, BallotVenueCard } from "./VenueCard";
import {
  AddYourOwn,
  placeFor,
  type Ballot,
  type NearbyState,
} from "./PlanShared";
import type { SeatsState } from "./OurSeats";
import type { SharedNight } from "./useSharedNight";
import styles from "./hockey.module.css";

const CONCOURSE = "concourse";

const listJoin = (names: readonly string[]) =>
  names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/** Who has put a vote on this question at all, once each. */
function votersOf(prompt: LivePrompt): Participant[] {
  const seen = new Map<string, Participant>();
  for (const o of prompt.tally) for (const p of o.voters) seen.set(p.id, p);
  return [...seen.values()];
}

// ------------------------------------------------------------ the venue board

const COPY: Record<
  Moment,
  {
    ask: string;
    open: string;
    waiting: string;
    cards: string;
    others: string;
  }
> = {
  pregame: {
    ask: "Back the place you want. The winner is where we all meet.",
    open: "Closes at warm-up",
    waiting: "Waiting on",
    cards: "Places near the arena to start the night",
    others: "Other places on the vote",
  },
  postgame: {
    ask: "Pick the after-party now, so nobody stands outside the doors arguing. Hours are Atlas's own: check them against the final horn.",
    open: "",
    waiting: "Waiting on",
    cards: "Places near the arena for after the game",
    others: "Other ideas on the vote",
  },
};

/**
 * **The pregame (and the after-party) as the main event.**
 *
 * Three places as Passport's own venue cards — photograph, name, the walk,
 * what Atlas holds that a group cares about, a reason to go made only of
 * those facts, who is backing it, and a one-tap vote — all on the page, none
 * behind a dropdown. They change with the vote:
 *
 *   before anyone votes  three good bets, and "back one";
 *   while it is moving   the leader, who has voted and who is still dithering;
 *   once it is settled   the winner, big, with the others one tap away.
 *
 * "Settled" is the group's: voting closed with one leader, or everyone going
 * has voted and one place leads (`voteSettled`). Nothing here decides for the
 * group, and every vote, nomination and photo is the same data as before.
 */
export function VenueBoard({
  night,
  prompt,
  item,
  nearby,
  ballot,
  moment,
  venue,
  away,
  onExplore,
  children,
}: {
  night: SharedNight;
  prompt: LivePrompt;
  item?: PlanItem;
  nearby: NearbyState;
  /** The question's ballot, kept by the plan so it outlives this board. */
  ballot: Ballot;
  moment: Moment;
  venue: string;
  /** People on the couch: they don't vote on where we meet, nor are waited on. */
  away: ReadonlySet<string>;
  onExplore: () => void;
  /** Rendered under the cards, inside the board (the pregame's "who's coming"). */
  children?: ReactNode;
}) {
  const { live } = night;
  const copy = COPY[moment];
  const canVote = Boolean(live.me) && prompt.open;
  const places = nearby.data?.places ?? [];
  const going = live.participants.filter((p) => !away.has(p.id));
  const person = (id?: string) =>
    live.participants.find((p) => p.id === id)?.name;
  // The others fold away behind the winner, and open by themselves when
  // *you* add one: a place you throw in must show up, not vanish under it.
  const addedByMe = prompt.tally.filter(
    (o) => o.addedBy && o.addedBy === live.me?.id,
  ).length;
  const [othersOpen, setOthersOpen] = useState(false);
  const [foldedAt, setFoldedAt] = useState(addedByMe);
  const showOthers = othersOpen || addedByMe > foldedAt;
  const toggleOthers = () => {
    if (showOthers) {
      setOthersOpen(false);
      setFoldedAt(addedByMe);
    } else setOthersOpen(true);
  };

  const placeOf = (label: string) => placeFor(label, places);
  const options = prompt.tally;
  const { cards, rows } = splitBallot(
    options.filter((o) => o.optionId !== CONCOURSE),
    (o) => Boolean(placeOf(o.label)),
  );
  const rowOptions = [
    ...rows,
    ...options.filter((o) => o.optionId === CONCOURSE),
  ];
  const onBallot = new Set(options.map((o) => o.label));
  const bets = canVote
    ? (moment === "pregame" ? pregameBets : postgameBets)(
        places,
        onBallot,
        Math.max(0, FIRST_LOOK - cards.length),
      )
    : [];

  const shown: { place?: NearbyPlace; option?: (typeof options)[number] }[] = [
    ...cards.map((option) => ({ option, place: placeOf(option.label) })),
    ...bets.map((place) => ({ place })),
  ];
  const extremes = walkExtremes(
    shown.flatMap((s) => (s.place ? [s.place] : [])),
  );
  const reasonFor = (place: NearbyPlace) => {
    const index = shown
      .flatMap((s) => (s.place ? [s.place] : []))
      .indexOf(place);
    return reasonToVisit(place, {
      moment,
      venue,
      shortest: index === extremes.shortest,
      longest: index === extremes.longest,
    });
  };

  const voted = votersOf(prompt);
  const waiting = going.filter((p) => !voted.some((v) => v.id === p.id));
  const leaderOption =
    item?.leaders.length === 1
      ? options.find((o) => o.label === item.leaders[0])
      : undefined;
  const winnerPlace = leaderOption ? placeOf(leaderOption.label) : undefined;
  const settled =
    Boolean(leaderOption) && voteSettled(item, going.length) && winnerPlace;
  const lock = live.definition.phases.find(
    (p) => p.id === prompt.prompt.locksAtPhaseId,
  );

  const card = (
    entry: (typeof shown)[number],
    i: number,
    extra: { hero?: boolean; badge?: string } = {},
  ) => {
    const { option, place } = entry;
    if (option) {
      return (
        <BallotVenueCard
          key={option.optionId}
          label={option.label}
          detail={option.detail}
          emoji={option.emoji}
          place={place}
          voters={option.voters}
          share={option.share}
          standing={ballot.standing(option)}
          chosen={ballot.mine === option.optionId}
          canVote={canVote}
          onVote={() => night.respond(prompt.prompt.id, option.optionId)}
          addedBy={option.addedBy ? person(option.addedBy) : undefined}
          priority={i === 0}
          reason={place ? reasonFor(place) : undefined}
          {...extra}
        />
      );
    }
    const p = place as NearbyPlace;
    const status = ballot.statusOf(p);
    return (
      <BallotVenueCard
        key={p.atlasId}
        label={p.name}
        place={p}
        voters={[]}
        share={0}
        chosen={false}
        canVote={canVote}
        newToBallot
        adding={status === "pending"}
        onVote={() => ballot.vote(p)}
        priority={i === 0}
        reason={reasonFor(p)}
      />
    );
  };

  // What the group is doing right now, in a sentence.
  const status = (() => {
    if (prompt.locked && !leaderOption && item && item.leaders.length > 1)
      return `Tied between ${listJoin(item.leaders)}. Voting's closed, so somebody has to give.`;
    if (!item || item.voters === 0)
      return canVote ? copy.ask : "Voting's closed with no votes.";
    if (item.leaders.length > 1)
      return `Dead level: ${listJoin(item.leaders)}. Somebody is about to be lobbied.`;
    return `${item.leaders[0]} leads with ${item.votes} ${item.votes === 1 ? "vote" : "votes"}.`;
  })();

  const heading =
    moment === "pregame" ? prompt.prompt.question : "After the game: where to?";

  return (
    <section
      id={`vote-${prompt.prompt.id}`}
      aria-label={prompt.prompt.question}
      className="scroll-mt-20"
    >
      {settled && leaderOption ? (
        <>
          <p
            className={`${styles.wide} mb-1 text-[20px] leading-tight text-white`}
            role="status"
          >
            {moment === "pregame"
              ? `We're meeting at ${leaderOption.label}`
              : `After: ${leaderOption.label}`}
          </p>
          <p className="mb-3 text-[14px] leading-snug text-white/70">
            {prompt.locked
              ? "Voting's closed. This is what the group decided."
              : "Everyone's voted. It's still open until the group says it isn't."}
          </p>
          {card({ option: leaderOption, place: winnerPlace }, 0, {
            hero: true,
            badge: prompt.locked ? "Locked in" : "The plan",
          })}
          <button
            type="button"
            aria-expanded={showOthers}
            onClick={toggleOthers}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white/[0.07] px-4 text-[15px] font-bold text-white ring-1 ring-white/15 transition hover:bg-white/[0.12]"
          >
            {showOthers
              ? "Hide the other options"
              : `Still on the table · ${Math.max(0, options.length - 1)} other ${options.length - 1 === 1 ? "option" : "options"}`}
          </button>
        </>
      ) : (
        <>
          <h3 className={`${styles.wide} text-[20px] leading-tight text-white`}>
            {heading}
          </h3>
          <p
            className="mt-1 mb-3 text-[14px] leading-snug text-white/75"
            role="status"
          >
            {status}
            {canVote && lock && moment === "pregame" && (
              <span className="text-white/55">
                {" "}
                {copy.open}{" "}
                {clockAt(
                  new Date(live.definition.anchorAt),
                  lock.offsetMinutes,
                )}
                .
              </span>
            )}
          </p>
          {voted.length > 0 && !prompt.locked && (
            <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-white/70">
              <span className="flex -space-x-1.5">
                {voted.slice(0, 5).map((p) => (
                  <Avatar key={p.id} person={p} size={24} />
                ))}
              </span>
              <span>
                {voted.length} of {going.length} have voted
                {waiting.length > 0 && waiting.length <= 4
                  ? `. ${copy.waiting} ${listJoin(waiting.map((p) => p.name))}.`
                  : "."}
              </span>
            </p>
          )}
        </>
      )}

      {(!settled || showOthers) && (
        <>
          {nearby.state === "loading" && canVote && shown.length === 0 && (
            <p className="mb-3 text-[13.5px] text-white/60" role="status">
              Asking Atlas what&apos;s near the arena…
            </p>
          )}
          <ul className="flex flex-col gap-4" aria-label={copy.cards}>
            {shown
              .filter((s) => !(settled && s.option === leaderOption))
              .map((entry, i) => (
                <li key={entry.option?.optionId ?? entry.place?.atlasId}>
                  {card(entry, i)}
                </li>
              ))}
          </ul>
          {rowOptions.filter((o) => !(settled && o === leaderOption)).length >
            0 && (
            <>
              <p className="mt-5 mb-2 text-[12px] font-bold tracking-[0.12em] text-white/55 uppercase">
                {copy.others}
              </p>
              <ul className="flex flex-col gap-2" aria-label="On the vote">
                {rowOptions
                  .filter((o) => !(settled && o === leaderOption))
                  .map((option) => (
                    <li key={option.optionId}>
                      <BallotRow
                        label={option.label}
                        detail={option.detail}
                        emoji={option.emoji}
                        place={placeOf(option.label)}
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
                      />
                    </li>
                  ))}
              </ul>
            </>
          )}
          {(nearby.state === "failed" ||
            (nearby.data?.outage && places.length === 0)) &&
            canVote && (
              <p className="mt-3 rounded-2xl bg-white/[0.06] px-4 py-3 text-[14.5px] text-white/80">
                Passport can&apos;t reach its map of the city right now. Type a
                place below instead; it counts just the same.{" "}
                <button
                  type="button"
                  onClick={nearby.retry}
                  className="inline-flex min-h-11 items-center font-bold text-white underline underline-offset-4"
                >
                  Try again
                </button>
              </p>
            )}
        </>
      )}

      {canVote && (
        <div className="mt-4 rounded-[20px] bg-white/[0.05] p-4 ring-1 ring-white/12">
          <p className="text-[16px] leading-snug font-bold text-white">
            Think you know somewhere better?
          </p>
          <p className="text-[14.5px] text-white/75">Throw it into the mix.</p>
          <button
            type="button"
            onClick={onExplore}
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-[15px] font-bold text-[#0b1220] transition active:scale-[0.99]"
          >
            <Compass className="h-4 w-4" aria-hidden />
            {places.length > 0
              ? `Find one in Passport · ${places.length} places near the arena`
              : "Find one in Passport"}
          </button>
          {prompt.prompt.openToSuggestions && (
            <AddYourOwn
              label="Somewhere else? Type a name"
              placeholder="Or type a name"
              onAdd={(label) => night.addOption(prompt.prompt.id, label)}
            />
          )}
        </div>
      )}
      {children}
    </section>
  );
}

// ---------------------------------------------------------- who's coming

const CHOICES = [
  { id: "join", label: PLANS_OPTIONS.join, emoji: "🍻" },
  { id: "arena", label: PLANS_OPTIONS.arena, emoji: "🏟️" },
  { id: "unsure", label: PLANS_OPTIONS.unsure, emoji: "🤷" },
] as const;

/**
 * **Who's coming to the pregame?** Three answers, one tap, visible to the
 * group: joining the pregame (and meeting at the winner), meeting at the
 * arena instead, or not sure yet. Changeable until puck drop.
 */
export function Attendance({
  night,
  prompt,
  away,
}: {
  night: SharedNight;
  prompt: LivePrompt;
  away: ReadonlySet<string>;
}) {
  const { live } = night;
  const canAnswer = Boolean(live.me) && prompt.open && !away.has(live.me!.id);
  const mine = prompt.myResponse?.value;
  return (
    <div
      role="group"
      aria-label={prompt.prompt.question}
      className="mt-4 rounded-[20px] bg-[#101826] p-4 ring-1 ring-white/10"
    >
      <p className="text-[16px] leading-snug font-bold text-white">
        {prompt.prompt.question}
      </p>
      <p className="mb-3 text-[13.5px] text-white/65">
        {prompt.prompt.hint} You can change it until puck drop.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {CHOICES.map((choice) => {
          const option = prompt.tally.find((o) => o.optionId === choice.id);
          const chosen = mine === choice.id;
          return (
            <div key={choice.id} className="flex flex-col gap-1.5">
              <button
                type="button"
                disabled={!canAnswer}
                aria-pressed={chosen}
                onClick={() => night.respond(prompt.prompt.id, choice.id)}
                className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-3 text-[15px] font-bold transition active:scale-[0.98] disabled:cursor-default ${
                  chosen
                    ? "bg-[#ffd84d] text-[#0b1220]"
                    : "bg-white/[0.08] text-white ring-1 ring-white/20 hover:bg-white/[0.14] disabled:opacity-60"
                }`}
              >
                <span aria-hidden>{choice.emoji}</span>
                {choice.label}
              </button>
              <p className="flex min-h-6 items-center gap-1.5 text-[13px] text-white/70">
                <span className="flex -space-x-1.5">
                  {(option?.voters ?? []).slice(0, 4).map((p) => (
                    <Avatar key={p.id} person={p} size={22} />
                  ))}
                </span>
                <span className="tabular-nums">
                  {option?.voters.length ?? 0}
                </span>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- meet up

const noSubscription = () => () => {};

function useMapLinks(links: MapLink[]): MapLink[] {
  const agent = useSyncExternalStore(
    noSubscription,
    () => navigator.userAgent,
    () => "",
  );
  return preferredOrder(links, agent);
}

function WalkTo({
  name,
  at,
  label,
}: {
  name: string;
  at: readonly [number, number];
  label: string;
}) {
  const links = useMapLinks(
    walkingLinks({ name, at: { latitude: at[0], longitude: at[1] } }),
  );
  return (
    <div
      role="group"
      aria-label={label}
      className="mt-2.5 flex flex-wrap gap-2"
    >
      {links.map((link, i) => (
        <a
          key={link.app}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[14px] font-bold ${
            i === 0
              ? "bg-white text-[#0b1220]"
              : "bg-white/[0.1] text-white hover:bg-white/[0.16]"
          }`}
        >
          <Navigation className="h-4 w-4" aria-hidden /> {link.label}
        </a>
      ))}
    </div>
  );
}

function Crew({
  title,
  where,
  detail,
  people,
  children,
  testId,
}: {
  title: string;
  where: string;
  detail?: string;
  people: readonly Participant[];
  children?: ReactNode;
  testId: string;
}) {
  return (
    <div
      data-crew={testId}
      className="rounded-[20px] bg-[#101826] p-4 ring-1 ring-white/10"
    >
      <p className="flex items-center justify-between gap-2 text-[12px] font-bold tracking-[0.12em] text-white/55 uppercase">
        <span>{title}</span>
        <span className="tabular-nums">{people.length}</span>
      </p>
      <p className="mt-1 text-[18px] leading-snug font-extrabold [overflow-wrap:anywhere] text-white">
        {where}
      </p>
      {detail && (
        <p className="mt-0.5 text-[13.5px] leading-snug text-white/65">
          {detail}
        </p>
      )}
      {people.length > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-white/75">
          <span className="flex -space-x-1.5">
            {people.slice(0, 5).map((p) => (
              <Avatar key={p.id} person={p} size={22} />
            ))}
          </span>
          {listJoin(people.map((p) => p.name))}
        </p>
      )}
      {children}
    </div>
  );
}

/**
 * **Where we meet — one answer, told to each crew.**
 *
 * The pregame winner is where the pregame crew meets; whoever is skipping the
 * pregame meets at the arena, with directions; the host can override either.
 * No second vote: the group already chose.
 */
export function MeetPlan({
  night,
  plans,
  point,
  winner,
  arena,
  venue,
  venueAt,
  seats,
  nearby,
  away,
}: {
  night: SharedNight;
  plans?: LivePrompt;
  point: MeetingPoint;
  /** The pregame place the group is behind, as a place, when Passport knows it. */
  winner?: NearbyPlace;
  arena: { value: string; detail: string };
  /** The arena's name, and where it is once Passport knows (no link before). */
  venue: string;
  venueAt?: readonly [number, number];
  seats: SeatsState;
  nearby: NearbyState;
  away: ReadonlySet<string>;
}) {
  const { live } = night;
  const going = live.participants.filter((p) => !away.has(p.id));
  const answered = (id: string) =>
    plans?.tally.find((o) => o.optionId === id)?.voters ?? [];
  const joining = answered("join");
  const atArena = answered("arena");
  const unsure = [
    ...answered("unsure"),
    ...(plans
      ? going.filter(
          (p) => !plans.tally.some((o) => o.voters.some((v) => v.id === p.id)),
        )
      : []),
  ];
  const host = seats.view?.role === "host";
  const meetup = seats.view?.meetup;
  const placesKnown = [
    ...(nearby.data?.places ?? []),
    ...(nearby.data?.meeting ?? []),
  ];
  const official = point.source === "host";
  const overridePlace = official
    ? placesKnown.find((p) => meetup?.spot && sameName(p.name, meetup.spot))
    : undefined;
  const pregameWhere =
    point.source === "pregame" || point.source === "host"
      ? point.value
      : undefined;
  const pregameAt = official ? overridePlace?.at : winner?.at;

  return (
    <div className="flex flex-col gap-3">
      {official && meetup && (
        <div
          data-crew="host"
          className="rounded-[20px] bg-[#ffd84d] p-4 text-[#0b1220]"
        >
          <p className="text-[12px] font-bold tracking-[0.12em] uppercase">
            The host&apos;s call
          </p>
          <p className="mt-1 text-[19px] leading-snug font-extrabold">
            {[
              meetup.gate ? gateById(meetup.gate)?.name : undefined,
              meetup.spot,
            ]
              .filter(Boolean)
              .join(" · ")}
            {meetup.time ? ` · ${clockLabel(meetup.time)}` : ""}
          </p>
          <p className="text-[13.5px] opacity-80">
            This replaces the pregame plan for everyone.
            {!overridePlace &&
              ` Directions below go to ${venue}; the host's spot is in their words.`}
          </p>
        </div>
      )}

      <Crew
        testId="pregame"
        title="Joining the pregame"
        where={
          pregameWhere ??
          (point.tied
            ? `Tied: ${point.tied.join(" / ")}`
            : "Waiting on the pregame vote")
        }
        detail={
          official
            ? "Wherever the host says."
            : point.decided
              ? "The pregame winner: the group's pick."
              : pregameWhere
                ? "Leading the vote. This changes if the vote does."
                : "Once one place wins, that's where this crew meets."
        }
        people={joining}
      >
        {pregameAt && pregameWhere && (
          <WalkTo
            name={pregameWhere}
            at={pregameAt}
            label={`Walking directions to ${pregameWhere}`}
          />
        )}
      </Crew>

      <Crew
        testId="arena"
        title="Meeting at the arena"
        where={official ? arenaWhere(meetup) : arena.value}
        detail={
          official
            ? "Same as the host's call, for those skipping the pregame."
            : arena.detail
        }
        people={atArena}
      >
        {venueAt && (
          <WalkTo
            name={venue}
            at={venueAt}
            label={`Walking directions to ${venue}`}
          />
        )}
        <p className="mt-2 text-[12.5px] leading-snug text-white/55">
          Opens your map app. Passport hands over the arena, not a gate: it
          holds no verified point for any entrance.
        </p>
      </Crew>

      {(unsure.length > 0 || !plans) && plans && (
        <Crew
          testId="unsure"
          title="Not sure yet"
          where="Make up your mind by puck drop"
          people={unsure}
        />
      )}

      {host && (
        <OverrideForm
          seats={seats}
          venue={{ name: venue }}
          pregame={point.source === "pregame" ? point.value : undefined}
          options={placesKnown}
        />
      )}
    </div>
  );
}

const arenaWhere = (meetup?: Meetup) =>
  meetup?.gate ? (gateById(meetup.gate)?.name ?? "The arena") : "The arena";

function clockLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${h < 12 ? "a.m." : "p.m."}`;
}

const ARENA_CHOICE = "__arena";
const ELSEWHERE = "__elsewhere";

/**
 * **The host's override.** The default is the pregame winner; when plans
 * change (the place is full, the group split, someone's late), the host
 * names where we meet instead, and when. It is the same `meetup` the host
 * always set (`PUT /meetup`, host-only in the database), so existing
 * meeting points still show and a guest still cannot change one.
 */
function OverrideForm({
  seats,
  venue,
  pregame,
  options,
}: {
  seats: SeatsState;
  venue: { name: string };
  pregame?: string;
  options: readonly NearbyPlace[];
}) {
  const meetup = seats.view?.meetup;
  const [editing, setEditing] = useState(false);
  const [choice, setChoice] = useState<string>(ARENA_CHOICE);
  const [custom, setCustom] = useState("");
  const [gate, setGate] = useState("");
  const [time, setTime] = useState("");
  const rogers = /rogers arena/i.test(venue.name);

  const atArena = `Outside ${venue.name}`;
  const begin = () => {
    const spot = meetup?.spot ?? "";
    const known = options.find((p) => sameName(p.name, spot));
    const arena = !spot || spot === atArena || spot.startsWith(`${atArena} `);
    setChoice(known ? known.name : arena ? ARENA_CHOICE : ELSEWHERE);
    setCustom(known || spot === atArena ? "" : spot);
    setGate(meetup?.gate ?? "");
    setTime(meetup?.time ?? "");
    setEditing(true);
  };

  const field =
    "mt-1 block min-h-11 w-full rounded-xl bg-white/[0.07] px-3 text-[16px] text-white ring-1 ring-white/20 focus:ring-white/50 focus:outline-none";
  const spot =
    choice === ELSEWHERE
      ? custom.trim()
      : choice === ARENA_CHOICE
        ? custom.trim() || atArena
        : choice;
  const valid = spot !== "";

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={begin}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/[0.1] px-4 text-[14.5px] font-bold text-white hover:bg-white/[0.16]"
        >
          <MapPin className="h-4 w-4" aria-hidden />
          {meetup ? "Change the meeting point" : "Override the meeting point"}
        </button>
        {meetup && (
          <button
            type="button"
            onClick={() => void seats.clearMeetup()}
            className="inline-flex min-h-11 items-center rounded-full px-4 text-[14.5px] font-bold text-[#ffb08a] hover:bg-white/[0.08]"
          >
            Back to the pregame plan
          </button>
        )}
        {seats.error && (
          <p role="alert" className="w-full text-[13.5px] text-[#ff9d9d]">
            {seats.error}
          </p>
        )}
      </div>
    );
  }
  return (
    <form
      aria-label="Override the meeting point"
      className="rounded-[20px] bg-[#101826] p-4 ring-1 ring-white/15"
      onSubmit={(e) => {
        e.preventDefault();
        void seats
          .saveMeetup({
            gate: choice === ARENA_CHOICE && rogers ? gate : "",
            spot,
            time,
          })
          .then((ok) => ok && setEditing(false));
      }}
    >
      <p className="text-[12px] font-bold tracking-[0.12em] text-[#ffd84d] uppercase">
        Host: where do we meet instead?
      </p>
      <p className="mt-1 text-[13.5px] text-white/65">
        {pregame
          ? `The default is ${pregame}, the pregame winner. This replaces it for everyone.`
          : "This is what everyone is told, instead of the default."}
      </p>
      <label className="mt-3 block text-[13px] font-bold text-white/80">
        Meet at
        <select
          aria-label="Meet at"
          className={field}
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
        >
          <option value={ARENA_CHOICE}>At the arena ({venue.name})</option>
          {options.slice(0, 40).map((p) => (
            <option key={p.atlasId} value={p.name}>
              {p.name}
            </option>
          ))}
          <option value={ELSEWHERE}>Somewhere else…</option>
        </select>
      </label>
      {choice === ELSEWHERE && (
        <label className="mt-3 block text-[13px] font-bold text-white/80">
          Where exactly
          <input
            className={field}
            value={custom}
            maxLength={120}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Outside the north doors"
          />
        </label>
      )}
      {choice === ARENA_CHOICE && rogers && (
        <label className="mt-3 block text-[13px] font-bold text-white/80">
          Gate
          <select
            aria-label="Gate"
            className={field}
            value={gate}
            onChange={(e) => setGate(e.target.value)}
          >
            <option value="">No gate</option>
            {ROGERS_ARENA_GATES.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} — {g.where}
              </option>
            ))}
          </select>
        </label>
      )}
      {choice === ARENA_CHOICE && (
        <label className="mt-3 block text-[13px] font-bold text-white/80">
          Where exactly (optional)
          <input
            className={field}
            value={custom}
            maxLength={120}
            onChange={(e) => setCustom(e.target.value)}
            placeholder={`By the main doors of ${venue.name}`}
          />
        </label>
      )}
      <label className="mt-3 block text-[13px] font-bold text-white/80">
        Time
        <input
          type="time"
          className={field}
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
      </label>
      {seats.error && (
        <p role="alert" className="mt-2 text-[13.5px] text-[#ff9d9d]">
          {seats.error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={!valid}
          className="inline-flex min-h-11 items-center rounded-full bg-[#ffd84d] px-5 text-[14.5px] font-bold text-[#0b1220] disabled:opacity-40"
        >
          Make it official
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="inline-flex min-h-11 items-center rounded-full bg-white/[0.1] px-5 text-[14.5px] font-bold text-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
