"use client";

import { MyLimit } from "@/experience-lab/ui/CuratorSetup";
import type { Participant } from "@/experience-lab/core/types";
import { crowdCounts, type Watching } from "@/domain/hockey/crowd";
import { FanAvatar as Avatar, FanTag, useFan } from "./FanTag";
import { WatchingPill, WatchingToggle } from "./Identity";
import { HostGame } from "./HostGame";
import { GuestList } from "./GuestList";
import { TonightSettings } from "./Modules";
import { YouTonight } from "./YouTonight";
import type { SharedNight } from "./useSharedNight";
import styles from "./hockey.module.css";

/**
 * **Group: who's coming, who you are tonight, and — for the host — the door.**
 *
 * Everything that is about the people rather than the night: the roster, your
 * name and vibe, how far you'll go, and the host's invitations and switches.
 * Moved out of the night's main column, where it read as account settings
 * at the bottom of a game.
 */
export function GroupTab({
  night,
  onPickTeam,
}: {
  night: SharedNight;
  /** Opens "Who do you bleed for?"; absent until teams are switched on. */
  onPickTeam?: () => void;
}) {
  const { live, state, role, definition } = night;
  const hostId = definition.hostId;
  const crowd = night.crowd;
  const counts = crowd?.available
    ? crowdCounts(
        live.participants.map((p) => p.id),
        crowd,
      )
    : null;
  const mine = live.me ? (crowd?.where[live.me.id] ?? null) : null;

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="whos-in">
        <h2
          id="whos-in"
          className={`${styles.wide} text-[28px] leading-none text-white`}
        >
          Who&apos;s in
        </h2>
        <p className="mt-2 text-[15px] text-white/70">
          {live.participants.length === 1
            ? role === "host"
              ? "Just you so far. A hockey night for one is a Tuesday. Invite somebody below."
              : "Just you so far."
            : counts && counts.couch > 0
              ? `${counts.arena} at the arena, ${counts.couch} in the peanut gallery. Everyone gets a say.`
              : `${live.participants.length} people. Everyone gets a say.`}
        </p>
        <ul className="mt-4 flex flex-col gap-2">
          {live.participants.map((person) => (
            <RosterCard
              key={person.id}
              person={person}
              me={person.id === live.me?.id}
              host={person.id === hostId}
              watching={crowd?.where[person.id]}
            />
          ))}
        </ul>
      </section>

      {live.me && crowd?.available && (
        <section aria-labelledby="watching-title">
          <h2
            id="watching-title"
            className={`${styles.wide} mb-2 text-[22px] leading-none text-white`}
          >
            Where you&apos;re watching
          </h2>
          <p className="mb-3 text-[15px] text-white/70">
            On the couch you still pick, chirp and compete for the Cup. You just
            skip the meeting point and the $19 beer.
          </p>
          <WatchingToggle value={mine} onChange={night.setWatching} />
        </section>
      )}

      <YouTonight night={night} onPickTeam={onPickTeam} />

      {live.me && (
        <section aria-labelledby="my-limit">
          <h2
            id="my-limit"
            className={`${styles.wide} mb-2 text-[22px] leading-none text-white`}
          >
            How far you&apos;ll go
          </h2>
          <p className="mb-3 text-[15px] text-white/70">
            Nobody sees your setting. You&apos;re never offered a dare above it.
          </p>
          <MyLimit
            nightEdge={state.brief?.edge ?? 1}
            mine={state.myEdge}
            onChange={night.setMyEdge}
          />
        </section>
      )}

      {role === "host" && <HostGame night={night} />}

      {role === "host" && <GuestList night={night} />}

      <TonightSettings night={night} />

      <p className="text-[13px] leading-relaxed text-white/50">
        Private to the people on this page. Points are bragging rights only — no
        money, no bets, nothing to settle but your dignity.
      </p>
    </div>
  );
}

/**
 * One person on the night as they'd introduce themselves: their face in
 * their team's ring, their team by name, where they're watching, their vibe.
 * Their team's colours wash in from the left, so the roster reads as a room
 * of rival fans rather than a list of accounts.
 */
function RosterCard({
  person,
  me,
  host,
  watching,
}: {
  person: Participant;
  me: boolean;
  host: boolean;
  watching?: Watching;
}) {
  const team = useFan(person.id);
  return (
    <li
      className={`relative flex items-center gap-3 overflow-hidden rounded-2xl bg-[#101826] px-3 py-3 ring-1 ${
        me ? "ring-[#ffd84d]/60" : "ring-white/10"
      }`}
      style={
        team
          ? {
              background: `linear-gradient(100deg, ${team.colours.primary}cc 0%, ${team.colours.primary}40 38%, #101826 72%)`,
            }
          : undefined
      }
    >
      <Avatar person={person} size={44} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5 text-[16px] font-bold text-white">
          <span className="truncate">{person.name}</span>
          {host && (
            <span className="shrink-0 rounded-full bg-[#ffd84d] px-1.5 py-0.5 text-[12px] font-bold tracking-wide text-[#0b1220] uppercase">
              host
            </span>
          )}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <FanTag personId={person.id} full />
          {watching && <WatchingPill where={watching} />}
        </span>
        {person.vibe && (
          <span className="mt-0.5 block truncate text-[13px] text-white/65">
            &ldquo;{person.vibe}&rdquo;
          </span>
        )}
      </span>
    </li>
  );
}
