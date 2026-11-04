/**
 * **Music for the mood.** A short list of Spotify's own public playlists,
 * grouped by the kind of trip they suit. Every id here was opened on
 * open.spotify.com on 2 November 2026 and came back with the title written
 * beside it (an unknown id answers "Page not available"); nothing is
 * invented. `moods.test.ts` keeps the list honest in shape; if Spotify
 * retires one, its link says so and it should be replaced the same way.
 *
 * Any Passport experience picks the moods that fit it (Date Night: a
 * romantic drive, the backroads, the sunset; Hockey Night: the game; Snow
 * Day: the mountain) and `recommend` orders them.
 *
 * Pure.
 */

export type Mood =
  | "romantic-drive"
  | "country-backroads"
  | "mountain"
  | "sunset"
  | "road-trip"
  | "game-night"
  | "christmas";

export interface Playlist {
  readonly title: string;
  readonly id: string;
  readonly url: string;
}

export interface MoodPick {
  readonly mood: Mood;
  readonly title: string;
  readonly line: string;
  readonly playlists: readonly Playlist[];
}

const p = (title: string, id: string): Playlist => ({
  title,
  id,
  url: `https://open.spotify.com/playlist/${id}`,
});

export const MOODS: Record<Mood, Omit<MoodPick, "mood">> = {
  "romantic-drive": {
    title: "Romantic drive",
    line: "Windows down a little, hand on the console.",
    playlists: [
      p("Timeless Love Songs", "37i9dQZF1DX7rOY2tZUw1k"),
      p("Love Pop", "37i9dQZF1DX50QitC6Oqtn"),
    ],
  },
  "country-backroads": {
    title: "Country backroads",
    line: "Gravel, dust and a chorus you both know.",
    playlists: [
      p("Country Favourites", "37i9dQZF1DX13ZzXoot6Jc"),
      p("90s Country", "37i9dQZF1DWVpjAJGB70vU"),
      p("Hot Country", "37i9dQZF1DX1lVhptIYRda"),
    ],
  },
  mountain: {
    title: "Mountain adventure",
    line: "Folk and acoustic for the climb.",
    playlists: [
      p("Happy Folk", "37i9dQZF1DWSkMjlBZAZ07"),
      p("Afternoon Acoustic", "37i9dQZF1DX4E3UdUs7fUx"),
    ],
  },
  sunset: {
    title: "Sunset",
    line: "Slow and warm, for the last of the light.",
    playlists: [
      p("Chill Hits", "37i9dQZF1DX4WYpdgoIcn6"),
      p("Your Favorite Coffeehouse", "37i9dQZF1DX6ziVCJnEm59"),
    ],
  },
  "road-trip": {
    title: "Road-trip classics",
    line: "Loud. Badly sung. Perfect.",
    playlists: [
      p("Classic Road Trip Songs", "37i9dQZF1DX9wC1KY45plY"),
      p("Songs to Sing in the Car", "37i9dQZF1DWWMOmoXKqHTD"),
      p("Rock Classics", "37i9dQZF1DWXRqgorJj26U"),
    ],
  },
  "game-night": {
    title: "Game night",
    line: "Warm-up noise before puck drop.",
    playlists: [
      p("Rock Party", "37i9dQZF1DX8FwnYE6PRvL"),
      p("Party Hits", "37i9dQZF1DXa2PvUpywmrr"),
    ],
  },
  christmas: {
    title: "Christmas",
    line: "The ones everybody knows the words to.",
    playlists: [
      p("Christmas Classics", "37i9dQZF1DX6R7QUWePReA"),
      p("Christmas Hits", "37i9dQZF1DX0Yxoavh5qJV"),
    ],
  },
};

/** About how many songs fill a drive (3½ minutes a song), or null. */
export function songsFor(
  driveMinutes: number | null | undefined,
): number | null {
  if (!driveMinutes || driveMinutes < 5) return null;
  return Math.max(2, Math.round(driveMinutes / 3.5));
}

/**
 * The moods an experience asked for, in its order, with a long drive
 * putting the road-trip classics first (there's time to sing).
 */
export function recommend(
  moods: readonly Mood[],
  driveMinutes?: number | null,
): MoodPick[] {
  const order = [...new Set(moods)];
  if ((driveMinutes ?? 0) >= 45 && order.includes("road-trip"))
    order.sort((a, b) => (a === "road-trip" ? -1 : b === "road-trip" ? 1 : 0));
  return order.map((mood) => ({ mood, ...MOODS[mood] }));
}
