"use client";

import type { ReactNode } from "react";
import { Check, MapPin } from "lucide-react";
import type { LivePrompt } from "@/experience-lab/core/engine";
import type { NearbyPlace } from "@/domain/hockey/nearby";
import type { SeatsView } from "./OurSeats";
import {
  CardButton,
  NearbyVenueCard,
  VenueSkeleton,
  VoteButton,
} from "./VenueCard";
import type { SharedNight } from "./useSharedNight";
import styles from "./hockey.module.css";

/**
 * **Where are we meeting: places to look at, not a list to read.**
 *
 * Plan's "Meeting point" opened. Each place near the arena that the group can
 * meet at is a card — Atlas's photograph where it holds one, what the place
 * is, the walk — and the same vote as ever sits on it (`meet-spot`: every
 * member, one vote each, until it locks). The host can also make one the
 * meeting spot outright, which writes the same `spot` the "Meet at the arena"
 * form under Getting there writes, through the same host-only endpoint, and
 * keeps the gate and time already set. Nothing here is a new kind of data.
 *
 * `children` is the ballot as it was (typed suggestions, "just meet at our
 * seats") so nothing a group could do before is lost.
 */
export function MeetingSpots({
  night,
  prompt,
  places,
  loading,
  meetup,
  saveMeetup,
  head,
  children,
}: {
  night: SharedNight;
  prompt: LivePrompt;
  /** Near-arena meeting places; absent until Passport has asked. */
  places: readonly NearbyPlace[] | undefined;
  loading: boolean;
  /** The seats view when seats are switched on: who the host is, what is set. */
  meetup: SeatsView | null;
  saveMeetup: (m: {
    gate: string;
    spot: string;
    time: string;
  }) => Promise<boolean>;
  head: ReactNode;
  children: ReactNode;
}) {
  const canVote = Boolean(night.live.me) && prompt.open;
  const mine = prompt.myResponse?.value;
  const host = meetup?.role === "host";
  const set = meetup?.meetup;
  const who = meetup?.people.find((p) => p.id === set?.setBy)?.name;

  return (
    <div id={`vote-${prompt.prompt.id}-spots`}>
      {head}

      {set?.spot && (
        <p
          className="mb-3 flex items-start gap-2 rounded-2xl bg-white/[0.07] px-4 py-3 text-[14.5px] leading-snug text-white"
          role="status"
        >
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#ffd84d]" />
          <span>
            <strong className="font-bold">Host&apos;s pick: {set.spot}</strong>
            {who ? ` · set by ${who}` : ""}
          </span>
        </p>
      )}

      {loading && !places && (
        <div
          className={`${styles.noScrollbar} -mx-4 mb-2 flex gap-3 overflow-hidden px-4`}
          aria-hidden
        >
          <VenueSkeleton />
          <VenueSkeleton />
        </div>
      )}

      {places && places.length > 0 && (
        <ul
          aria-label="Places to meet near the arena"
          className={`${styles.noScrollbar} -mx-4 mb-2 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2`}
        >
          {places.map((place, i) => {
            const option = prompt.tally.find((o) => o.label === place.name);
            const picked = set?.spot === place.name;
            return (
              <li key={place.atlasId} className="flex">
                <NearbyVenueCard
                  place={place}
                  priority={i === 0}
                  badge={picked ? "Host's pick" : undefined}
                  votes={option?.voters.length}
                  actions={
                    <span className="ml-auto flex flex-wrap items-center justify-end gap-2">
                      {option && (
                        <VoteButton
                          place={place}
                          status={
                            mine === option.optionId ? "mine" : "on-ballot"
                          }
                          canVote={canVote}
                          onVote={() =>
                            night.respond(prompt.prompt.id, option.optionId)
                          }
                        />
                      )}
                      {host && (
                        <CardButton
                          label={`Make ${place.name} the meeting spot`}
                          tone="light"
                          disabled={picked}
                          pressed={picked}
                          onClick={() =>
                            void saveMeetup({
                              gate: set?.gate ?? "",
                              spot: place.name,
                              time: set?.time ?? "",
                            })
                          }
                        >
                          {picked ? (
                            <>
                              <Check className="h-4 w-4" /> Meeting here
                            </>
                          ) : (
                            <>
                              <MapPin className="h-4 w-4" /> Meet here
                            </>
                          )}
                        </CardButton>
                      )}
                    </span>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
      {places && places.length > 0 && (
        <p className="mb-3 text-[12.5px] leading-snug text-white/55">
          Walks are straight lines at a walking pace, so the real one is longer.
          {host
            ? " Everyone votes; “Meet here” sets the host’s pick, with the gate and time you already chose."
            : ""}
        </p>
      )}

      {children}
    </div>
  );
}
