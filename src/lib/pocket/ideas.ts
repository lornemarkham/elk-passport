/**
 * **Ideas: every single thing a person saved, whichever board it is on.**
 *
 * The owner's brief (_Go Have a Day — the experience overhaul_, 2026-11-08):
 * saving must not require a collection, collections are optional, and the
 * Adventure Pocket and My Stuff must not become competing sources of truth.
 *
 * Nothing here is a new store. A save still lands on a board in Atlas, the
 * way it always has; the board a save goes to is the person's **ideas board**
 * (the one they were saving to before, or their first), and every other board
 * of theirs is a **collection**. Ideas is the union of all of them, so a
 * thing someone saved to a second board two months ago is still one of their
 * ideas and nothing is hidden by the change.
 *
 * Pure, so the arithmetic is tested without a browser.
 */

export interface IdeasBoard {
  readonly id: string;
  readonly name: string;
  /** Absent on an older response; treated as the person's own. */
  readonly role?: "owner" | "editor" | "viewer";
}

export interface IdeasItem {
  readonly experienceId: string;
  readonly addedAt: string;
}

export interface Idea {
  readonly experienceId: string;
  /** The most recent time it was saved anywhere. */
  readonly addedAt: string;
  /** Every board of this person's that holds it, ideas board first. */
  readonly boardIds: readonly string[];
}

/** Boards this person may change: their own, and ones they were made an editor of. */
export const editable = (board: IdeasBoard) =>
  (board.role ?? "owner") !== "viewer";

/**
 * **Which board a save goes to.** The one they were already saving to when
 * it is still theirs, otherwise their first own board. `null` means they have
 * none yet, and the first save makes one — the person is never asked to.
 */
export function ideasBoardOf<T extends IdeasBoard>(
  boards: readonly T[],
  remembered: string | null,
): T | null {
  const own = boards.filter((b) => (b.role ?? "owner") === "owner");
  return (
    (remembered ? own.find((b) => b.id === remembered) : undefined) ??
    own[0] ??
    null
  );
}

/**
 * **One list of ideas from every board the person owns**, newest first.
 * A board shared with them to look at is somebody else's collection, not
 * their ideas, so it is left out here and listed under Collections.
 */
export function ideasFrom(
  boards: readonly {
    readonly board: IdeasBoard;
    readonly items: readonly IdeasItem[];
  }[],
  ideasBoardId: string | null,
): Idea[] {
  const byId = new Map<string, { addedAt: string; boardIds: string[] }>();
  const ordered = [...boards]
    .filter(({ board }) => (board.role ?? "owner") === "owner")
    .sort((a, b) =>
      a.board.id === ideasBoardId ? -1 : b.board.id === ideasBoardId ? 1 : 0,
    );
  for (const { board, items } of ordered) {
    for (const item of items) {
      const known = byId.get(item.experienceId);
      if (!known) {
        byId.set(item.experienceId, {
          addedAt: item.addedAt,
          boardIds: [board.id],
        });
      } else {
        if (!known.boardIds.includes(board.id)) known.boardIds.push(board.id);
        if (item.addedAt > known.addedAt) known.addedAt = item.addedAt;
      }
    }
  }
  return [...byId.entries()]
    .map(([experienceId, v]) => ({ experienceId, ...v }))
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

/**
 * **The Pocket's order.** A person may put their ideas in the order they want
 * the day to go; that order is theirs and is kept on this device. It is only
 * an order — what is *in* the Pocket is always the ideas themselves, so an
 * id the order remembers that is no longer saved is simply skipped, and a new
 * save goes to the end.
 */
export function inPocketOrder<T extends { readonly experienceId: string }>(
  ideas: readonly T[],
  order: readonly string[],
): T[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  // Unordered ideas keep their place relative to each other (oldest first,
  // so a new save lands at the end of the Pocket rather than jumping in front).
  const unordered = ideas.filter((i) => !rank.has(i.experienceId)).reverse();
  const ordered = ideas
    .filter((i) => rank.has(i.experienceId))
    .sort((a, b) => rank.get(a.experienceId)! - rank.get(b.experienceId)!);
  return [...ordered, ...unordered];
}

/** `ids` with `id` moved one place up (`-1`) or down (`1`). */
export function moved(
  ids: readonly string[],
  id: string,
  by: -1 | 1,
): string[] {
  const at = ids.indexOf(id);
  const to = at + by;
  if (at < 0 || to < 0 || to >= ids.length) return [...ids];
  const next = [...ids];
  [next[at], next[to]] = [next[to]!, next[at]!];
  return next;
}

/** How many ideas a single day is built from (`MAX_SEED` in adventures/days). */
const DAY_SEEDS = 5;
/** How many a new adventure can start from (`/adventures/new`). */
const ADVENTURE_SEEDS = 12;

const list = (ids: readonly string[]) => ids.map(encodeURIComponent).join(",");

/** **Make a day**: the Day Builder, with these kept, in this order. */
export const dayFrom = (ids: readonly string[]) =>
  ids.length > 0 ? `/go?with=${list(ids.slice(0, DAY_SEEDS))}` : "/go";

/** **Make a weekend**: a new adventure, sketched around these. */
export const weekendFrom = (ids: readonly string[]) =>
  ids.length > 0
    ? `/adventures/new?with=${list(ids.slice(0, ADVENTURE_SEEDS))}`
    : "/adventures/new";

export { DAY_SEEDS };
