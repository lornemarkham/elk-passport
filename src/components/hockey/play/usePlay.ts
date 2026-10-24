"use client";

import { useMemo } from "react";
import {
  MARKET_PROMPT,
  chaosFor,
  gameOf,
  rivalryFor,
  settle,
  type Market,
  type Settled,
} from "@/domain/hockey/challenges";
import { cupStatus, dramaOf } from "@/domain/hockey/cup";
import { relativeTime } from "@/experience-lab/core/phase";
import { matchupOf } from "@/domain/hockey/teams";
import { modulesOf } from "@/domain/hockey/modules";
import type { SharedNight } from "../useSharedNight";

/**
 * **Everything PLAY shows, derived once from the shared night.** Challenges
 * are settled here with the same function the server's Cup uses
 * (`settle`), on the same rows, so a card never disagrees with the
 * standings; the clock is the page's own, so a jury closing at the horn
 * closes on screen without waiting for a poll.
 */
export function usePlay(night: SharedNight) {
  const { live, definition, play, chirp, modules } = night;
  const { home, away } = matchupOf(definition.subtitle);
  const game = useMemo(() => gameOf(home, away), [home, away]);
  const now = live.now;
  const startsAt = definition.anchorAt;
  const start = Date.parse(startsAt);
  const me = live.me?.id ?? null;
  const memberIds = useMemo(
    () => live.participants.map((p) => p.id),
    [live.participants],
  );

  const settled: Settled[] = useMemo(() => {
    const market = (m: Market) => {
      const p = live.prompts.find((x) => x.prompt.id === MARKET_PROMPT[m]);
      return { resolution: p?.prompt.resolution };
    };
    return play.challenges
      .filter(
        (c) =>
          memberIds.includes(c.challenger_id) &&
          memberIds.includes(c.target_id),
      )
      .map((c) =>
        settle(c, { memberIds, votes: play.votes, startsAt, now, market }),
      );
  }, [play, memberIds, startsAt, now, live.prompts]);

  const fans = chirp.fans;
  const games =
    modules.includes("games") || modulesOf({ modules }).has("games");
  const on = play.available && games;
  const beforeStart = now.getTime() < start;
  const beforeHorn = now.getTime() < start + 165 * 60_000;
  const day = now.toLocaleDateString("en-CA", {
    timeZone: "America/Vancouver",
  });

  const venue = definition.kicker.split(" · ")[0];
  const untilStart = beforeStart
    ? relativeTime(new Date(start), now).replace(/^in /, "")
    : null;
  const rivalry = me
    ? rivalryFor(me, live.participants, fans, game, { venue, untilStart })
    : null;
  const chaos =
    on && me
      ? chaosFor(me, live.participants, fans, game, play.challenges, {
          beforeStart,
          beforeHorn,
          day,
        })
      : [];
  const drama = dramaOf({
    people: live.participants,
    fans,
    game,
    settled,
    reactions: play.teamReactions,
    ledger: play.ledger,
    viewerId: me,
  });
  const status = cupStatus(live, settled);

  return {
    on,
    game,
    fans,
    me,
    settled,
    rivalry,
    chaos,
    drama,
    status,
    beforeStart,
    beforeHorn,
    venue,
    untilStart,
  };
}

export type Play = ReturnType<typeof usePlay>;
