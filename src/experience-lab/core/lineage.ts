import { liveExperience } from "./engine";
import { grantAwards } from "./scoring";
import type { ExperienceDefinition, ExperienceState, Lineage } from "./types";

/**
 * **Where a night stops being a night and starts being a tradition.**
 *
 * Round 1 shipped a "Run it back" button that did nothing, and called it the
 * highest-value unbuilt thing. This is the cheap version of building it, and
 * the cheapness is the point: a next edition is *the same definition with a
 * later anchor and a memory of the last one*. No new fixture, no new route
 * template, no creation flow.
 *
 * The memory — the receipts — is derived from what actually happened in the
 * previous edition rather than authored. That is what makes it feel like a
 * callback instead of a slogan: nobody wrote "Nathan's 7–1 remains
 * indefensible", it is simply the worst surviving prediction, found.
 */

export const EDITION_SUFFIX = "--again";

export function nextEditionSlug(slug: string): string {
  return slug.endsWith(EDITION_SUFFIX) ? slug : `${slug}${EDITION_SUFFIX}`;
}

export function baseSlugOf(slug: string): string {
  return slug.endsWith(EDITION_SUFFIX)
    ? slug.slice(0, -EDITION_SUFFIX.length)
    : slug;
}

/** A fortnight later, same people, nothing yet decided. */
export function nextEdition(base: ExperienceDefinition): ExperienceDefinition {
  const anchor = new Date(
    new Date(base.anchorAt).getTime() + 14 * 86_400_000,
  ).toISOString();

  return {
    ...base,
    slug: nextEditionSlug(base.slug),
    kicker: `${base.kicker} · the next one`,
    anchorAt: anchor,
    nextEditionOf: base.slug,
    // Everything the last edition decided is gone. Only the people remain,
    // and even they have to turn up again.
    seedResponses: [],
    seedMoments: [],
    participants: base.participants.map((p) => ({ ...p, present: false })),
    lineage: undefined,
    labNote: `The second edition. Tests whether an experience can inherit a memory without inheriting a scoreboard.`,
  };
}

/**
 * What the last one left lying around.
 *
 * Deliberately *not* points. Carrying a score forward would make the second
 * night a continuation of the first, and the thing worth carrying is the
 * story, not the standings — a defending champion is funny, a head start is
 * not. `standing` is shown; nothing consumes it as points.
 */
export function receiptsFrom(
  base: ExperienceDefinition,
  previous: ExperienceState,
  now: Date,
): Lineage | null {
  /**
   * The previous edition is read *at its own end*, not at whatever time it is
   * now. A second edition opening a fortnight early was otherwise asking the
   * first one for its results before, from its own point of view, it had
   * finished — so the receipts silently never appeared.
   */
  const lastPhase = base.phases[base.phases.length - 1];
  const concluded = new Date(
    new Date(base.anchorAt).getTime() + (lastPhase.offsetMinutes + 60) * 60_000,
  );
  const readAt = concluded.getTime() > now.getTime() ? concluded : now;

  const live = liveExperience(base, { ...previous, nowOverride: null }, readAt);
  if (!live.settled || live.standings.length === 0) return null;

  const champion = live.standings[0];
  if (champion.points === 0) return null;

  const receipts: string[] = [];

  // The worst surviving prediction, found rather than written.
  const worst = live.prompts
    .filter((p) => p.prompt.scoring && p.prompt.resolution !== undefined)
    .flatMap((p) =>
      p.responses
        .filter(
          (r) =>
            JSON.stringify(r.value) !== JSON.stringify(p.prompt.resolution),
        )
        .map((r) => ({ live: p, response: r })),
    )
    .find((entry) => entry.live.prompt.kind === "pair");
  if (worst) {
    const who = live.participants.find(
      (p) => p.id === worst.response.participantId,
    );
    const value = worst.response.value as readonly number[];
    if (who)
      receipts.push(
        `${who.name} called ${value[0]}–${value[1]} and has not been allowed to forget it.`,
      );
  }

  // Anything anybody still owes.
  for (const obligation of live.obligations.slice(0, 2)) {
    receipts.push(
      `${obligation.participant.name} still owes: ${obligation.text}`,
    );
  }

  // Whatever the group decided was the best thing anyone submitted.
  const vaultWinner = live.prompts
    .filter((p) => p.prompt.family === "vault" && p.prompt.optionsFrom)
    .map(
      (p) => [...p.tally].sort((a, b) => b.voters.length - a.voters.length)[0],
    )
    .find((top) => top && top.voters.length > 0);
  if (vaultWinner) {
    const who = live.participants.find((p) => p.id === vaultWinner.optionId);
    if (who)
      receipts.push(`${who.name} won the vault with "${vaultWinner.label}".`);
  }

  const awards = grantAwards(
    base.awards,
    live.standings,
    live.prompts.flatMap((p) => p.responses),
  );
  const potato = awards.find((a) => a.award.basis === "bottom");
  if (potato)
    receipts.push(
      `${potato.participant.name} finished last and would like that noted as unrepresentative.`,
    );

  return {
    previousLabel: `${base.title} · last time`,
    defendingChampionId: champion.participant.id,
    standing: live.standings.map((row) => ({
      participantId: row.participant.id,
      points: row.points,
    })),
    callback: `${champion.participant.name} won it and has mentioned this since.`,
    receipts,
  };
}
