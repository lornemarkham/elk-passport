import type { NightRows } from "./night";

/**
 * **Sealed until puck drop — for everybody.**
 *
 * A pick whose prompt reveals `onLock` is the author's alone until that
 * prompt locks. Sealing your own does not open anybody else's: the lab's
 * engine opens a deck to whoever has answered it (a date-night rule, where
 * answering first is the price of seeing), and the database once mirrored
 * that. For Hockey Night that let the first person to seal read every pick
 * that came after and copy the room (2026-10-23).
 *
 * The database rule is fixed by `night-migration.sql`. This is the same
 * rule applied to every row the server reads, so the night stays sealed on a
 * database that has not had the migration yet, and so nothing the server
 * renders (the page, Chirp Bot's lines, the Cup) can be built from a pick the
 * viewer should not have.
 */

/** Has this (possibly derived, `id::…`) prompt locked? The SQL's `passport_occasion_prompt_locked`. */
export function promptLocked(
  rows: Pick<NightRows, "occasion" | "prompts">,
  promptId: string,
  now: Date,
): boolean {
  const base = promptId.split("::")[0];
  const rule = rows.prompts.find((p) => p.prompt_id === base);
  if (!rule || rule.lock_offset_minutes === null) return false;
  const lockAt =
    new Date(rows.occasion.starts_at).getTime() +
    rule.lock_offset_minutes * 60_000;
  return now.getTime() >= lockAt;
}

/** `rows` with every unlocked `onLock` answer that is not `viewer`'s own removed. */
export function sealedFor<R extends NightRows>(
  rows: R,
  viewer: string,
  now = new Date(),
): R {
  const reveal = new Map(rows.prompts.map((p) => [p.prompt_id, p.reveal]));
  const responses = rows.responses.filter((r) => {
    if (r.user_id === viewer) return true;
    if (reveal.get(r.prompt_id.split("::")[0]) !== "onLock") return true;
    return promptLocked(rows, r.prompt_id, now);
  });
  return responses.length === rows.responses.length
    ? rows
    : { ...rows, responses };
}
