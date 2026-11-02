import { describe, expect, it } from "vitest";
import { parseSpotify, whyNot } from "./spotify";
import { MOODS, recommend, songsFor } from "./moods";
import {
  decodeSoundtrack,
  encodeSoundtrack,
  isSoundtrackNote,
  replacedSoundtracks,
  soundtrackOf,
} from "./stored";

const ID = "37i9dQZF1DX9wC1KY45plY";

describe("parseSpotify", () => {
  it("reads the link the Spotify app copies, share tracking and all", () => {
    expect(
      parseSpotify(`https://open.spotify.com/playlist/${ID}?si=abc123`),
    ).toEqual({
      kind: "playlist",
      id: ID,
      url: `https://open.spotify.com/playlist/${ID}`,
      embed: `https://open.spotify.com/embed/playlist/${ID}`,
    });
  });

  it("reads intl, embed and user paths, URIs and a bare host", () => {
    for (const s of [
      `https://open.spotify.com/intl-fr/playlist/${ID}`,
      `https://open.spotify.com/embed/playlist/${ID}?utm_source=x`,
      `https://open.spotify.com/user/someone/playlist/${ID}`,
      `spotify:playlist:${ID}`,
      `open.spotify.com/playlist/${ID}`,
      `  https://open.spotify.com/playlist/${ID}  `,
    ])
      expect(parseSpotify(s)?.url).toBe(
        `https://open.spotify.com/playlist/${ID}`,
      );
    expect(parseSpotify(`https://open.spotify.com/album/${ID}`)?.kind).toBe(
      "album",
    );
    expect(parseSpotify(`spotify:track:${ID}`)?.kind).toBe("track");
  });

  it("keeps a short link as it is, with no preview", () => {
    const s = parseSpotify("https://spotify.link/AbC12xYz");
    expect(s).toEqual({ kind: "link", url: "https://spotify.link/AbC12xYz" });
  });

  it("refuses anything else", () => {
    for (const s of [
      "",
      "jazz",
      "https://example.com/playlist/" + ID,
      "https://open.spotify.com/playlist/short",
      "https://open.spotify.com/",
      "spotify:user:someone",
      "https://open.spotify.com.evil.test/playlist/" + ID,
      "javascript:alert(1)",
    ])
      expect(parseSpotify(s)).toBeNull();
  });

  it("says why a paste wasn't accepted", () => {
    expect(whyNot("")).toMatch(/Paste a Spotify link/);
    expect(whyNot("https://open.spotify.com/")).toMatch(/whole Spotify link/);
    expect(whyNot("https://music.apple.com/x")).toMatch(/isn't a Spotify link/);
    expect(whyNot(`spotify:playlist:${ID}`)).toBeNull();
  });
});

describe("moods", () => {
  it("only links Spotify playlists, by well-formed id", () => {
    for (const mood of Object.values(MOODS)) {
      expect(mood.playlists.length).toBeGreaterThan(0);
      for (const pl of mood.playlists) {
        expect(pl.id).toMatch(/^[A-Za-z0-9]{22}$/);
        expect(parseSpotify(pl.url)?.id).toBe(pl.id);
      }
    }
  });

  it("puts the road-trip classics first on a long drive", () => {
    const moods = ["romantic-drive", "sunset", "road-trip"] as const;
    expect(recommend(moods, 20).map((m) => m.mood)).toEqual([...moods]);
    expect(recommend(moods, 60)[0]!.mood).toBe("road-trip");
    expect(recommend(["sunset", "sunset"]).length).toBe(1);
  });

  it("counts songs for a drive", () => {
    expect(songsFor(null)).toBeNull();
    expect(songsFor(3)).toBeNull();
    expect(songsFor(40)).toBe(11);
    expect(songsFor(6)).toBe(2);
  });
});

describe("a stored soundtrack", () => {
  const url = `https://open.spotify.com/playlist/${ID}`;
  const item = (id: string, t: number, mine = true) => ({
    id,
    note: encodeSoundtrack({ url, t, title: "Ours" }),
    mine,
    addedBy: mine ? "me" : "them",
    canChange: mine,
  });

  it("round-trips and refuses what isn't one", () => {
    const note = encodeSoundtrack({ url, title: "Ours", t: 5 });
    expect(isSoundtrackNote(note)).toBe(true);
    expect(decodeSoundtrack(note)).toEqual({ url, title: "Ours", t: 5 });
    expect(decodeSoundtrack("♥play {}")).toBeNull();
    expect(decodeSoundtrack('♥music {"url":"https://evil.test"}')).toBeNull();
    expect(decodeSoundtrack("♥music not json")).toBeNull();
  });

  it("is the newest one, and the older ones are replaced", () => {
    const items = [
      item("a", 1),
      item("b", 3, false),
      item("c", 2),
      { id: "x", note: "♥play {}", mine: true, addedBy: "me", canChange: true },
    ];
    const now = soundtrackOf(items);
    expect(now?.itemId).toBe("b");
    expect(now?.mine).toBe(false);
    expect(now?.link.embed).toContain("/embed/playlist/");
    expect(replacedSoundtracks(items)).toEqual(["a", "c"]);
    expect(soundtrackOf([])).toBeNull();
  });
});
