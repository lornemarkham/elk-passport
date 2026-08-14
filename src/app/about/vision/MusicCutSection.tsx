import { ExternalLink } from "lucide-react";
import { Reveal } from "../components";
import { TrackRating } from "./TrackRating";
import type { MusicCut } from "./content";

function youtubeSearchUrl(artist: string, song: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${artist} ${song}`)}`;
}

/**
 * One five-act cut. `trackId` (used for rating persistence) is derived
 * from the cut's own slug plus act number — stable across reloads,
 * unique across all six cuts, and never needs to be threaded in from
 * outside. No hosted audio, ever: a track either gets a real, verified
 * `youtubeId` (an actual embed) or a search link — never a guessed id.
 */
export function MusicCutSection({ cut }: { cut: MusicCut }) {
  return (
    <div>
      <Reveal>
        <p className="font-heading text-2xl md:text-3xl">{cut.title}</p>
      </Reveal>
      <div className="mt-6 flex flex-col divide-y divide-current/10">
        {cut.tracks.map((track, i) => {
          const trackId = `${cut.slug}-act-${track.act}`;
          return (
            <Reveal key={trackId} delay={Math.min(i * 0.05, 0.3)}>
              <div className="flex flex-col gap-3 py-5 md:flex-row md:items-start md:justify-between md:gap-6">
                <div className="min-w-0">
                  <p className="text-xs font-medium tracking-[0.15em] uppercase opacity-40">
                    Act {track.act} — {track.actLabel}
                  </p>
                  <p className="font-heading mt-1 text-xl">
                    {track.artist} <span className="opacity-50">—</span>{" "}
                    {track.song}
                  </p>
                  <p className="mt-1 text-sm italic opacity-60">{track.note}</p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  {track.youtubeId ? (
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${track.youtubeId}`}
                      title={`${track.artist} — ${track.song}`}
                      className="h-24 w-40 rounded border border-current/15"
                      loading="lazy"
                      allowFullScreen
                    />
                  ) : (
                    <a
                      href={youtubeSearchUrl(track.artist, track.song)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-sm underline-offset-2 opacity-70 hover:underline"
                    >
                      Find it
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <TrackRating trackId={trackId} />
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
