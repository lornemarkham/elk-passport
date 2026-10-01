"use client";

import { Play } from "lucide-react";
import { useState } from "react";
import type { Film } from "@/lib/movies/catalogue";

/**
 * **The trailer, which is the whole argument for not opening a detail page.**
 *
 * A line of authored text tells you what a film is. Ninety seconds of it tells
 * you whether you want it, and no amount of writing about *House* (1977) does
 * what four seconds of watching it does. So the trailer sits on the card, and
 * the detail page becomes optional rather than the funnel.
 *
 * ## No API, no licensing, no hosted video
 *
 * Exactly the architecture `/about/vision` already uses for music: a
 * **verified** YouTube id renders a real `youtube-nocookie` embed; no id
 * renders a search link. The ids in the catalogue were each confirmed through
 * YouTube's public oEmbed endpoint — the video exists and is titled as a
 * trailer for that film — rather than recalled or guessed. A wrong embed is
 * worse than no embed, so an unverified film simply does not get one.
 *
 * ## Click to play, not autoplay
 *
 * The iframe is not in the document until somebody asks for it. Forty-four
 * cards each holding a YouTube player would load megabytes of third-party
 * script for a page nobody asked to play anything on, and it would hand
 * YouTube a record of every film a person scrolled past. The poster frame is
 * YouTube's own thumbnail, served from `img.youtube.com`, which costs one
 * image request and sets no cookie.
 */
export function Trailer({
  film,
  className = "",
}: {
  readonly film: Film;
  readonly className?: string;
}) {
  const [playing, setPlaying] = useState(false);

  if (!film.trailerId) {
    // Honest gap. One film in the catalogue has no verified trailer, and it
    // gets a search rather than a guess.
    return (
      <a
        href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
          `${film.title} ${film.year} trailer`,
        )}`}
        target="_blank"
        rel="noreferrer"
        data-testid="trailer-search"
        onClick={(event) => event.stopPropagation()}
        className={`relative z-10 flex aspect-video items-center justify-center rounded-lg border border-[#e9e6da]/10 bg-[#e9e6da]/[0.03] text-sm text-[#e9e6da]/45 transition-colors hover:border-[#d09a4e]/40 hover:text-[#e9e6da]/70 ${className}`}
      >
        Find the trailer
      </a>
    );
  }

  if (!playing) {
    return (
      <button
        type="button"
        data-testid="trailer-poster"
        aria-label={`Play the trailer for ${film.title}`}
        onClick={(event) => {
          // The card underneath is a link. This press is not for it.
          event.preventDefault();
          event.stopPropagation();
          setPlaying(true);
        }}
        className={`group/trailer relative z-10 block aspect-video w-full overflow-hidden rounded-lg border border-[#e9e6da]/10 bg-black ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://img.youtube.com/vi/${film.trailerId}/hqdefault.jpg`}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover opacity-70 transition-all duration-300 group-hover/trailer:scale-[1.03] group-hover/trailer:opacity-90"
        />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0c0a0c]/70 text-[#e9e6da] ring-1 ring-[#e9e6da]/25 transition-colors group-hover/trailer:bg-[#d09a4e] group-hover/trailer:text-[#0c0a0c]">
            <Play className="ml-0.5 h-4 w-4 fill-current" />
          </span>
        </span>
        <span className="absolute bottom-1.5 left-2 text-[10px] tracking-wider text-[#e9e6da]/60 uppercase">
          Trailer
        </span>
      </button>
    );
  }

  return (
    <div
      className={`relative z-10 aspect-video overflow-hidden rounded-lg border border-[#e9e6da]/10 bg-black ${className}`}
      onClick={(event) => event.stopPropagation()}
    >
      <iframe
        data-testid="trailer-embed"
        src={`https://www.youtube-nocookie.com/embed/${film.trailerId}?autoplay=1&rel=0`}
        title={`${film.title} — trailer`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="h-full w-full"
      />
    </div>
  );
}
