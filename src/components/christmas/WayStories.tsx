import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Way, WayId } from "@/domain/christmas/ways";
import { WAY_PHOTOS } from "./photos";
import { WayPhoto } from "./WayPhoto";
import { cn } from "@/lib/utils";

/**
 * What each way promises, in a host's words — the picture says the rest.
 * Presentation only: the way itself (`ways.ts`) is unchanged.
 */
const STORY: Readonly<Record<WayId, string>> = {
  lights: "Go and see the lights",
  date: "Dinner, then the lights",
  family: "Santa, skates and sledding",
  friends: "Out together on a winter night",
  cozy: "Fire on, film on, cocoa in hand",
  events: "Markets, shows and festivals",
};

/** Where each sits in the editorial grid (desktop): one lead, five beside it. */
const PLACE: Readonly<Record<WayId, string>> = {
  lights:
    "col-span-2 aspect-[4/5] sm:aspect-[16/10] lg:col-span-4 lg:row-span-2 lg:aspect-auto",
  date: "lg:col-span-2",
  family: "lg:col-span-2",
  friends: "lg:col-span-2",
  cozy: "lg:col-span-2",
  events:
    "col-span-2 aspect-[16/9] sm:col-span-1 sm:aspect-[3/4] lg:col-span-2",
};

/**
 * **Six ways to have a Christmas, as pictures** (owner brief M1128: "the six
 * coloured emoji cards feel like application menu buttons"). One lead
 * picture and five beside it, each a photograph of the feeling — a street
 * glowing with lights, a candlelit evening, a fire and a blanket — with a
 * line that starts the sentence. They are **inspiration, not listings**:
 * none is a photograph of a place Passport recommends, each carries its
 * photographer's credit, and the real places, with their own pictures, are
 * in the discovery below. A way with no photograph keeps its designed
 * artwork rather than borrowing a picture of something else.
 */
export function WayStories({
  ways,
  hrefFor,
  compact = false,
  cta = "Explore",
}: {
  readonly ways: readonly Way[];
  readonly hrefFor: (way: Way) => string;
  /**
   * Six equal tiles in one band (owner brief M1154: the moods are secondary
   * to the featured events) rather than one lead picture and five beside it.
   */
  readonly compact?: boolean;
  /** What a tile says it does ("Explore", "Show me"). */
  readonly cta?: string;
}) {
  return (
    <ul
      className={
        compact
          ? "grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-6"
          : "grid grid-cols-2 gap-2.5 sm:gap-4 lg:auto-rows-[15rem] lg:grid-cols-6"
      }
      data-testid="way-stories"
    >
      {ways.map((way, n) => {
        const photo = WAY_PHOTOS[way.id];
        // A compact band has no lead picture.
        const i = compact ? n + 1 : n;
        return (
          <li
            key={way.id}
            className={cn(
              compact
                ? "relative aspect-[4/5] sm:aspect-[4/3] lg:aspect-[4/5]"
                : "relative aspect-[3/4] sm:aspect-[4/3] lg:aspect-auto",
              !compact && PLACE[way.id],
            )}
          >
            <Link
              href={hrefFor(way)}
              className="group absolute inset-0 flex flex-col justify-end overflow-hidden rounded-[18px] text-white shadow-[0_12px_34px_rgba(8,35,25,0.18)] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#ffd98a] sm:rounded-[28px]"
              style={
                photo
                  ? { background: "#0b1d16" }
                  : {
                      background: `radial-gradient(120% 90% at 85% 10%, color-mix(in srgb, ${way.art.glow} 28%, transparent), transparent 55%), linear-gradient(150deg, ${way.art.from}, ${way.art.to})`,
                    }
              }
              data-testid={`way-${way.id}`}
              {...(way.id === "lights" ? { "data-cta": "lights" } : {})}
            >
              {photo && (
                <WayPhoto
                  image={photo.image}
                  alt={photo.alt}
                  sizes={
                    i === 0
                      ? "(min-width: 1024px) 66vw, 100vw"
                      : "(min-width: 1024px) 33vw, 50vw"
                  }
                  focus={photo.focus}
                  className="object-cover transition-transform duration-[1600ms] ease-out group-hover:scale-[1.045] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                />
              )}
              <span
                aria-hidden
                className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,16,12,0)_35%,rgba(6,16,12,0.55)_65%,rgba(6,16,12,0.86))]"
              />
              <span
                className={cn(
                  "relative p-3.5 sm:p-5",
                  compact && "p-2.5 sm:p-4",
                  i === 0 && "sm:p-7 lg:p-9",
                )}
              >
                <span
                  className={cn(
                    "block text-[11px] font-bold tracking-[0.16em] text-[#ffd98a] uppercase sm:text-xs",
                    compact && "hidden sm:block",
                  )}
                >
                  {way.label}
                </span>
                <span
                  className={cn(
                    "ghad-display mt-1 block leading-[1.02] font-extrabold tracking-[-0.02em] text-balance",
                    i === 0
                      ? "text-[1.7rem] sm:text-4xl lg:text-5xl"
                      : compact
                        ? "text-[0.95rem] sm:text-xl"
                        : "text-[1.15rem] sm:text-2xl",
                  )}
                >
                  {STORY[way.id]}
                </span>
                {i === 0 && (
                  <span className="mt-2 hidden max-w-md text-base text-white/85 sm:block">
                    {way.line}
                  </span>
                )}
                <span
                  className={cn(
                    "mt-2 inline-flex items-center gap-1 text-sm font-bold text-white/90 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none",
                    i !== 0 && "hidden sm:inline-flex",
                  )}
                >
                  {way.id === "lights" && !compact ? "Open the lights" : cta}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </span>
              </span>
              {photo && (
                <span
                  className={cn(
                    "absolute top-2 right-3 max-w-[70%] truncate text-[10px] text-white/55 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]",
                    // Small tiles: the credits are in full below the page.
                    compact && "hidden sm:block",
                  )}
                  data-testid="photo-credit"
                >
                  Photo: {photo.author}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The credits in full, with their licences — inspiration is labelled as
 * inspiration, and each photographer is named where the licence asks.
 */
export function PhotoCredits() {
  const credited = Object.entries(WAY_PHOTOS).filter(([, p]) => p);
  if (credited.length === 0) return null;
  return (
    <details
      className="text-xs text-[var(--gh-ink-soft)]"
      data-testid="photo-credits"
    >
      <summary className="inline-flex min-h-11 cursor-pointer items-center underline underline-offset-4">
        About the photographs above
      </summary>
      <p className="mt-1 max-w-3xl">
        The six pictures of ways to spend Christmas are inspiration, not
        photographs of places we recommend. Every event and place below shows
        its own picture, or none.
      </p>
      <ul className="mt-2 space-y-1">
        {credited.map(([id, p]) => (
          <li key={id}>
            <a
              href={p!.page}
              className="underline underline-offset-2"
              rel="noopener noreferrer"
              target="_blank"
            >
              {p!.title}
            </a>{" "}
            — {p!.author},{" "}
            <a
              href={p!.licenseUrl}
              className="underline underline-offset-2"
              rel="noopener noreferrer license"
              target="_blank"
            >
              {p!.license}
            </a>
            {p!.cropped ? ", cropped" : ""}
          </li>
        ))}
      </ul>
    </details>
  );
}
