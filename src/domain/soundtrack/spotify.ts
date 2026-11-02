/**
 * **A Spotify link, read without Spotify.** No sign-in, no API: Passport
 * only needs to know that what someone pasted is a Spotify link, what kind
 * of thing it points at, and how to open or preview it.
 *
 * Accepted: `https://open.spotify.com/playlist/<id>` (with or without
 * `?si=…`, with or without an `intl-xx/` segment), the same for album, track,
 * artist, show and episode, `spotify:playlist:<id>` URIs, and the app's
 * short `https://spotify.link/<code>` links. A short link can't be read
 * without following it, so it is kept as it is and has no preview.
 *
 * Pure. No React, no network.
 */

export type SpotifyKind =
  "playlist" | "album" | "track" | "artist" | "show" | "episode" | "link";

export interface SpotifyLink {
  readonly kind: SpotifyKind;
  /** The Spotify id; absent for a short link. */
  readonly id?: string;
  /** Where "Open in Spotify" goes: the canonical web link. */
  readonly url: string;
  /** Spotify's own embeddable player; absent for a short link. */
  readonly embed?: string;
}

const KINDS = new Set<SpotifyKind>([
  "playlist",
  "album",
  "track",
  "artist",
  "show",
  "episode",
]);
const ID = /^[A-Za-z0-9]{22}$/;

const canonical = (kind: SpotifyKind, id: string): SpotifyLink => ({
  kind,
  id,
  url: `https://open.spotify.com/${kind}/${id}`,
  embed: `https://open.spotify.com/embed/${kind}/${id}`,
});

/** The link, or `null` when it isn't one Passport can open. */
export function parseSpotify(input: string): SpotifyLink | null {
  const text = input.trim();
  if (!text) return null;

  const uri = text.match(/^spotify:([a-z]+):([A-Za-z0-9]+)$/);
  if (uri) {
    const kind = uri[1] as SpotifyKind;
    return KINDS.has(kind) && ID.test(uri[2]!)
      ? canonical(kind, uri[2]!)
      : null;
  }

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (host === "spotify.link" || host === "spotify.app.link") {
    const code = url.pathname.replace(/^\/+|\/+$/g, "");
    return /^[A-Za-z0-9_-]{4,40}$/.test(code)
      ? { kind: "link", url: `https://${host}/${code}` }
      : null;
  }
  if (host !== "open.spotify.com") return null;
  // `/intl-fr/playlist/<id>`, `/embed/playlist/<id>`, `/user/x/playlist/<id>`
  const parts = url.pathname.split("/").filter(Boolean);
  for (let i = 0; i < parts.length - 1; i++) {
    const kind = parts[i] as SpotifyKind;
    if (KINDS.has(kind) && ID.test(parts[i + 1]!))
      return canonical(kind, parts[i + 1]!);
  }
  return null;
}

/** What it is, in a word a person would say. */
export const KIND_WORD: Record<SpotifyKind, string> = {
  playlist: "Playlist",
  album: "Album",
  track: "Song",
  artist: "Artist",
  show: "Podcast",
  episode: "Episode",
  link: "Spotify link",
};

/** Why a paste wasn't accepted, said so someone can fix it. */
export function whyNot(input: string): string | null {
  const text = input.trim();
  if (!text) return "Paste a Spotify link first.";
  if (parseSpotify(text)) return null;
  if (/spotify/i.test(text))
    return "That doesn't look like a whole Spotify link. In Spotify: ⋯ → Share → Copy link, then paste it here.";
  return "That isn't a Spotify link. In Spotify: ⋯ → Share → Copy link.";
}
