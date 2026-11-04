/**
 * **A soundtrack kept on an adventure.** Like Date Night's plays, it is an
 * ordinary adventure item with no day: `label` says what it is to anyone
 * reading the row, `note` holds the link, tagged `♥music `. Both people may
 * add items and withdraw their own under the adventure core's RLS, so
 * there's nothing to migrate. The newest one is the soundtrack.
 *
 * Pure.
 */

import { parseSpotify, type SpotifyLink } from "./spotify";

const MUSIC = "♥music ";

export interface StoredSoundtrack {
  readonly url: string;
  /** What the person called it, if they did. */
  readonly title?: string;
  /** When it was saved, ms. */
  readonly t: number;
}

export const isSoundtrackNote = (note: string | null | undefined): boolean =>
  Boolean(note?.startsWith(MUSIC));

export const encodeSoundtrack = (s: StoredSoundtrack): string =>
  MUSIC + JSON.stringify(s);

export function decodeSoundtrack(
  note: string | null | undefined,
): StoredSoundtrack | null {
  if (!note?.startsWith(MUSIC)) return null;
  try {
    const v = JSON.parse(note.slice(MUSIC.length)) as Record<string, unknown>;
    if (typeof v.url !== "string" || !parseSpotify(v.url)) return null;
    const title =
      typeof v.title === "string" && v.title.trim() && v.title.length <= 80
        ? v.title.trim()
        : undefined;
    return {
      url: v.url,
      ...(title ? { title } : {}),
      t: typeof v.t === "number" ? v.t : 0,
    };
  } catch {
    return null;
  }
}

export interface SoundtrackItem {
  readonly id: string;
  readonly note: string | null;
  readonly mine: boolean;
  readonly addedBy: string | null;
  readonly canChange: boolean;
}

export interface SoundtrackView extends StoredSoundtrack {
  readonly itemId: string;
  readonly link: SpotifyLink;
  readonly mine: boolean;
  readonly addedBy: string | null;
  readonly canChange: boolean;
}

/** The newest soundtrack among an adventure's items, or null. */
export function soundtrackOf(
  items: readonly SoundtrackItem[],
): SoundtrackView | null {
  let best: SoundtrackView | null = null;
  for (const item of items) {
    const s = decodeSoundtrack(item.note);
    const link = s ? parseSpotify(s.url) : null;
    if (!s || !link) continue;
    if (best && best.t > s.t) continue;
    best = {
      ...s,
      itemId: item.id,
      link,
      mine: item.mine,
      addedBy: item.addedBy,
      canChange: item.canChange,
    };
  }
  return best;
}

/** Every soundtrack item but the newest: replaced, safe to clear. */
export function replacedSoundtracks(
  items: readonly SoundtrackItem[],
): string[] {
  const now = soundtrackOf(items);
  return items
    .filter((i) => isSoundtrackNote(i.note) && i.id !== now?.itemId)
    .map((i) => i.id);
}
