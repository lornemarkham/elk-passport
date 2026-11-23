import { sizedImage } from "@/lib/media/sizedImage";
import type { PlacePhoto } from "@/domain/place-details/model";

/**
 * **The hero: the place's own photographs, large.** One photograph runs the
 * width of the page; three or more become a lead and two beside it on a wide
 * screen, the way a person flicks through before deciding. Every photograph
 * is the place's own — Atlas's lead image or one a source published with
 * credit — never a stock picture of the kind of thing (doctrine §12, _Never an
 * unrelated stock photo_).
 *
 * With none, the page still opens on something made for it: a drawn
 * landscape in one of a few palettes, chosen by the name so a place always
 * gets the same one, with the name set large. It says plainly that there is
 * no photo yet rather than borrowing one.
 */
export function PlaceHeroPhotos({
  name,
  photos,
  kind,
}: {
  readonly name: string;
  readonly photos: readonly PlacePhoto[];
  readonly kind?: string;
}) {
  if (photos.length === 0) return <NoPhoto name={name} kind={kind} />;
  const [lead, ...rest] = photos;
  const side = rest.slice(0, 2);
  const grid = side.length === 2;
  return (
    <div
      data-testid="place-hero"
      className={`relative mt-2 overflow-hidden rounded-3xl bg-black/5 ${
        grid
          ? "aspect-[4/3] sm:aspect-[16/9] lg:grid lg:aspect-auto lg:h-[480px] lg:grid-cols-3 lg:grid-rows-2 lg:gap-2 lg:bg-transparent"
          : "aspect-[4/3] sm:aspect-[16/9] lg:aspect-[21/9]"
      }`}
    >
      <Photo
        photo={lead!}
        className={
          grid
            ? "absolute inset-0 lg:relative lg:col-span-2 lg:row-span-2"
            : "absolute inset-0"
        }
        priority
      />
      {grid &&
        side.map((p) => (
          <Photo key={p.url} photo={p} className="relative hidden lg:block" />
        ))}
      {photos.length > 1 && (
        <a
          href="#place-gallery"
          className="absolute top-3 right-3 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white backdrop-blur lg:hidden"
        >
          {photos.length} photos
        </a>
      )}
    </div>
  );
}

function Photo({
  photo,
  className,
  priority = false,
}: {
  readonly photo: PlacePhoto;
  readonly className: string;
  readonly priority?: boolean;
}) {
  return (
    <figure className={`overflow-hidden lg:rounded-2xl ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- publisher and Atlas media hosts, resized by address (sizedImage) */}
      <img
        {...sizedImage(photo.url, [640, 1280, 1920])}
        sizes="(min-width: 1152px) 1100px, 100vw"
        alt={photo.alt}
        decoding="async"
        // Above the fold, all of them: a lazy side photo is a grey box on
        // the one screen that has to sell the place.
        {...(priority ? { fetchPriority: "high" as const } : {})}
        className="h-full w-full object-cover"
      />
      {photo.credit && (
        <figcaption className="absolute right-3 bottom-3 rounded-full bg-black/50 px-2.5 py-0.5 text-[11px] text-white/90">
          {photo.credit}
        </figcaption>
      )}
    </figure>
  );
}

const PALETTES = [
  // Lake at dusk
  { sky: ["#0d3b4f", "#1d6f7a", "#57b5a8"], land: "#0b2f3d", glow: "#7fd1c3" },
  // Forest and snow
  { sky: ["#1b2a3a", "#3b5a6e", "#a9c3cf"], land: "#1f4a35", glow: "#e8f1ee" },
  // Okanagan sunset
  { sky: ["#3a1c32", "#b04e28", "#f2b25c"], land: "#2b1a22", glow: "#ffd9a0" },
  // Orchard morning
  { sky: ["#244a3a", "#6c9a5b", "#e9d79b"], land: "#1d3a2c", glow: "#fff3c4" },
] as const;

function paletteFor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTES[h % PALETTES.length]!;
}

function NoPhoto({
  name,
  kind,
}: {
  readonly name: string;
  readonly kind?: string;
}) {
  const p = paletteFor(name);
  const id = `ph-${name.replace(/[^a-z0-9]/gi, "").slice(0, 16)}`;
  return (
    <div
      data-testid="place-hero-drawn"
      className="relative mt-2 aspect-[16/9] overflow-hidden rounded-3xl sm:aspect-[21/9] lg:aspect-[3/1]"
    >
      <svg
        viewBox="0 0 400 160"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={p.sky[0]} />
            <stop offset="0.55" stopColor={p.sky[1]} />
            <stop offset="1" stopColor={p.sky[2]} />
          </linearGradient>
        </defs>
        <rect width="400" height="160" fill={`url(#${id})`} />
        <circle cx="300" cy="58" r="16" fill={p.glow} opacity="0.35" />
        <path
          d="M0 92 C60 70 110 78 160 66 C220 52 260 74 310 62 C350 54 380 60 400 56 L400 160 L0 160Z"
          fill={p.land}
          opacity="0.6"
        />
        <path
          d="M0 118 C70 108 130 124 200 114 C270 104 330 120 400 110 L400 160 L0 160Z"
          fill={p.glow}
          opacity="0.25"
        />
        <path
          d="M0 134 C80 128 150 140 220 132 C290 124 340 136 400 130"
          stroke="#ffffff"
          strokeOpacity="0.45"
          strokeWidth="1.2"
          fill="none"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/40 via-transparent to-transparent p-5 sm:p-7">
        {kind && (
          <p className="text-[12px] font-semibold tracking-widest text-white/85 uppercase">
            {kind}
          </p>
        )}
        <p className="mt-1 text-xs text-white/80">
          No photo of {name} yet — we never use a stock picture instead.
        </p>
      </div>
    </div>
  );
}
