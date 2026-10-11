/**
 * **"I'm interested" — a mark a board member puts on a board item.**
 *
 * Stated, never inferred: a row exists because somebody pressed the button,
 * and disappears when they press it again. It is a REACT signal in the
 * doctrine's sense (§2.2) and deliberately *not* a commitment — "interested
 * in the hockey game" is not "playing in the hockey game", and nothing here
 * pretends otherwise.
 *
 * ## Who sees what
 *
 * ```
 * the person          their own marks, always
 * fellow members      a count per item, plus the name of anybody who chose
 *                     to show it on that item
 * everybody else      nothing — the store refuses, and so does the route
 * ```
 *
 * A name is shown only when the person asked for it on that row (`shownAs`),
 * so being named on the hockey game says nothing about anything else they
 * marked. User ids never leave the server: a summary carries names a person
 * chose to show and counts, and nothing a browser could correlate.
 *
 * Members only. A row whose author has since left the board counts for
 * nobody — the board's current members are the audience, and somebody who
 * left is not still raising their hand in it.
 */

export interface InterestRow {
  readonly itemId: string;
  readonly userId: string;
  /** The name they chose to show on this item, or `null` to be counted only. */
  readonly shownAs: string | null;
}

export interface InterestSummary {
  /** Everybody interested, including the viewer. */
  readonly count: number;
  readonly youAreIn: boolean;
  readonly youShowName: boolean;
  /** Other members who chose to be named here. */
  readonly names: readonly string[];
  /** Other members interested without a name. */
  readonly unnamed: number;
}

export const NO_INTEREST: InterestSummary = {
  count: 0,
  youAreIn: false,
  youShowName: false,
  names: [],
  unnamed: 0,
};

const shown = (row: InterestRow): string | null =>
  row.shownAs?.trim() ? row.shownAs.trim() : null;

function current(
  rows: readonly InterestRow[],
  memberIds: ReadonlySet<string>,
): InterestRow[] {
  return rows.filter((row) => memberIds.has(row.userId));
}

/** One summary per item that anybody on the board is interested in. */
export function summariseInterest(
  rows: readonly InterestRow[],
  viewerId: string,
  memberIds: ReadonlySet<string>,
): Record<string, InterestSummary> {
  const byItem = new Map<string, InterestRow[]>();
  for (const row of current(rows, memberIds)) {
    const list = byItem.get(row.itemId) ?? [];
    list.push(row);
    byItem.set(row.itemId, list);
  }

  const summaries: Record<string, InterestSummary> = {};
  for (const [itemId, list] of byItem) {
    const mine = list.find((r) => r.userId === viewerId);
    const others = list.filter((r) => r.userId !== viewerId);
    const names = others
      .map(shown)
      .filter((n): n is string => n !== null)
      .sort((a, b) => a.localeCompare(b));
    summaries[itemId] = {
      count: list.length,
      youAreIn: Boolean(mine),
      youShowName: Boolean(mine && shown(mine)),
      names,
      unnamed: others.length - names.length,
    };
  }
  return summaries;
}

/**
 * **Colleagues into the same things you are.**
 *
 * Only items the viewer is interested in, and only rows where the other
 * person chose to be named. Somebody named on the hockey game and anonymous on
 * the Grouse Grind is listed for the hockey game alone — their anonymity on
 * one item is never undone by their name on another.
 */
export interface Kindred {
  readonly name: string;
  readonly shared: readonly string[];
}

export function kindredColleagues(
  rows: readonly InterestRow[],
  viewerId: string,
  memberIds: ReadonlySet<string>,
): readonly Kindred[] {
  const live = current(rows, memberIds);
  const mine = new Set(
    live.filter((r) => r.userId === viewerId).map((r) => r.itemId),
  );

  // Keyed by user id here and never past here; the result carries names only.
  const byUser = new Map<string, { name: string; shared: string[] }>();
  for (const row of live) {
    if (row.userId === viewerId || !mine.has(row.itemId)) continue;
    const name = shown(row);
    if (!name) continue;
    const entry = byUser.get(row.userId) ?? { name, shared: [] };
    entry.shared.push(row.itemId);
    byUser.set(row.userId, entry);
  }

  return [...byUser.values()]
    .map(({ name, shared }) => ({ name, shared }))
    .sort(
      (a, b) =>
        b.shared.length - a.shared.length || a.name.localeCompare(b.name),
    );
}

/** What the browser may send. Anything else is a 400. */
export interface InterestRequest {
  readonly itemId: string;
  readonly showName: boolean;
}

export function parseInterestRequest(body: unknown): InterestRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { itemId, showName } = body as Record<string, unknown>;
  if (typeof itemId !== "string") return null;
  const id = itemId.trim();
  if (!id || id.length > 200) return null;
  return { itemId: id, showName: showName === true };
}

/** The longest name a row will carry — a display name, not a biography. */
export const SHOWN_AS_MAX = 60;

export function shownAsFor(
  displayName: string,
  showName: boolean,
): string | null {
  if (!showName) return null;
  const name = displayName.trim().slice(0, SHOWN_AS_MAX);
  return name || null;
}
