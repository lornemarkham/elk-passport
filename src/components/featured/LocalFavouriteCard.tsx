import Link from "next/link";
import { ArrowRight, Globe, MapPin, Navigation, Phone } from "lucide-react";
import {
  FAVOURITE_LABEL,
  directionsHref,
  phoneText,
  type FavouriteExperience,
  type LocalFavourite,
} from "@/domain/featured/locals";
import { sizedImage } from "@/lib/media/sizedImage";

/**
 * **A local favourite, as a destination card** (owner brief M1007). Pure
 * markup — no hooks — so it renders the same inside Discovery, Christmas,
 * Snow and Sesh Wars, light or dark. What it may say is decided in
 * `domain/featured/locals.ts`; this only lays it out.
 */

const HERO_WIDTHS = [640, 1280];
const HERO_SIZES = "(min-width: 1024px) 960px, 100vw";

/** Drawn when there is no photograph of the place: never a stock picture. */
function LakeLight({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 160"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id="lf-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d3b4f" />
          <stop offset="0.55" stopColor="#1d6f7a" />
          <stop offset="1" stopColor="#57b5a8" />
        </linearGradient>
      </defs>
      <rect width="400" height="160" fill="url(#lf-sky)" />
      <path
        d="M0 92 C60 70 110 78 160 66 C220 52 260 74 310 62 C350 54 380 60 400 56 L400 160 L0 160Z"
        fill="#0b2f3d"
        opacity="0.55"
      />
      <path
        d="M0 118 C70 108 130 124 200 114 C270 104 330 120 400 110 L400 160 L0 160Z"
        fill="#7fd1c3"
        opacity="0.35"
      />
      <path
        d="M0 134 C80 128 150 140 220 132 C290 124 340 136 400 130"
        stroke="#e8fff9"
        strokeOpacity="0.5"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}

function Actions({
  favourite: f,
  tone,
}: {
  favourite: LocalFavourite;
  tone: "light" | "dark";
}) {
  const primary =
    "inline-flex min-h-12 items-center gap-2 rounded-full px-5 text-base font-bold";
  const secondary =
    tone === "dark"
      ? "inline-flex min-h-12 items-center gap-2 rounded-full px-4 text-base font-semibold ring-1 ring-white/35 text-white"
      : "inline-flex min-h-12 items-center gap-2 rounded-full px-4 text-base font-semibold ring-1 ring-black/15 text-[var(--gh-ink,#111)] bg-white";
  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={directionsHref(f)}
        target="_blank"
        rel="noreferrer"
        data-testid="favourite-directions"
        className={`${primary} ${tone === "dark" ? "bg-white text-[#111]" : "bg-[var(--gh-ink,#111)] text-white"}`}
      >
        <Navigation className="h-4 w-4" aria-hidden />
        Directions
      </a>
      {f.phone && (
        <a
          href={`tel:${f.phone.value}`}
          data-testid="favourite-call"
          className={secondary}
        >
          <Phone className="h-4 w-4" aria-hidden />
          {phoneText(f.phone.value)}
        </a>
      )}
      {f.website && (
        <a
          href={f.website.value}
          target="_blank"
          rel="noreferrer"
          data-testid="favourite-website"
          className={secondary}
        >
          <Globe className="h-4 w-4" aria-hidden />
          Website
        </a>
      )}
    </div>
  );
}

/** What is known about opening, said honestly. */
export function HoursNote({
  favourite: f,
  className = "",
}: {
  favourite: LocalFavourite;
  className?: string;
}) {
  return (
    <p className={className} data-testid="favourite-hours">
      {f.hours.confirmed ? (
        <>Hours: {f.hours.value.value}</>
      ) : (
        <>{f.hours.why}</>
      )}
    </p>
  );
}

/**
 * **The full destination card**: the place's own photograph (or a drawn lake,
 * never someone else's), why it is worth the stop, and the three things a
 * person needs on the way — directions, the phone, the website.
 */
export function LocalFavouriteCard({
  favourite: f,
  headingLevel = "h2",
  linkToPage = true,
  priority = false,
}: {
  favourite: LocalFavourite;
  headingLevel?: "h1" | "h2" | "h3";
  /** Off on the favourite's own page. */
  linkToPage?: boolean;
  priority?: boolean;
}) {
  const Heading = headingLevel;
  const photo = f.photos[0];
  return (
    <article
      data-testid={`favourite-${f.slug}`}
      className="overflow-hidden rounded-[28px] bg-[#14110f] text-white shadow-[0_18px_50px_-24px_rgba(0,0,0,0.55)]"
    >
      <div className="relative aspect-[4/3] sm:aspect-[16/8]">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- the publisher's own host, resized by address (sizedImage)
          <img
            {...sizedImage(photo.url, HERO_WIDTHS)}
            sizes={HERO_SIZES}
            alt={photo.alt}
            decoding="async"
            loading={priority ? "eager" : "lazy"}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <LakeLight className="absolute inset-0 h-full w-full" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#14110f] via-[#14110f]/35 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
          <p className="text-[11px] font-bold tracking-[0.16em] text-[var(--gh-sun,#ffd166)] uppercase">
            {FAVOURITE_LABEL}
          </p>
          <Heading className="ghad-display mt-1 text-4xl leading-[0.95] font-extrabold tracking-[-0.03em] sm:text-6xl">
            {f.name}
          </Heading>
          <p className="mt-2 flex items-center gap-1.5 text-base text-white/85">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            {f.place}
          </p>
        </div>
        {photo && (
          <p className="absolute top-3 right-4 rounded-full bg-black/45 px-2.5 py-1 text-[11px] text-white/80">
            {photo.credit}
          </p>
        )}
      </div>
      <div className="space-y-4 p-5 pt-3 sm:p-8 sm:pt-4">
        <p className="max-w-2xl text-lg leading-snug text-white/90 sm:text-xl">
          {f.line}
        </p>
        <ul className="flex flex-wrap gap-2" aria-label="Good for">
          {f.goodFor.map((g) => (
            <li
              key={g}
              className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold"
            >
              {g}
            </li>
          ))}
        </ul>
        <Actions favourite={f} tone="dark" />
        <HoursNote favourite={f} className="text-sm text-white/65" />
        {linkToPage && (
          <Link
            href={`/favourites/${f.slug}`}
            data-testid="favourite-more"
            className="inline-flex min-h-11 items-center gap-1.5 text-base font-semibold text-[var(--gh-sun,#ffd166)] underline-offset-4 hover:underline"
          >
            More about {f.name}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </div>
    </article>
  );
}

/**
 * **An optional stop**, for an experience that is about something else
 * (Christmas lights, a snow day, a park sesh). Small on purpose: one line of
 * why, the distance when there is an origin, directions, and the way to the
 * full card. It is a side door, not a shelf.
 */
export function LocalFavouriteStop({
  favourite: f,
  experience,
  km,
}: {
  favourite: LocalFavourite;
  experience: FavouriteExperience;
  /** Straight-line distance from the experience's origin, when it has one. */
  km?: number;
}) {
  const photo = f.photos[0];
  return (
    <li
      data-testid={`favourite-stop-${f.slug}`}
      className="flex items-stretch gap-3 overflow-hidden rounded-2xl bg-white p-2.5 pr-3 text-[#111] shadow-[0_8px_24px_-16px_rgba(0,0,0,0.45)] ring-1 ring-black/5"
    >
      <Link
        href={`/favourites/${f.slug}`}
        className="relative block h-auto w-24 shrink-0 overflow-hidden rounded-xl sm:w-28"
        aria-label={`${f.name} — more`}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- the publisher's own host, resized by address (sizedImage)
          <img
            {...sizedImage(photo.url, [250, 500])}
            sizes="112px"
            alt=""
            decoding="async"
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <LakeLight className="absolute inset-0 h-full w-full" />
        )}
      </Link>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-[10px] font-bold tracking-[0.14em] text-black/50 uppercase">
          Optional stop · {FAVOURITE_LABEL.split(" · ")[0]}
        </p>
        <Link
          href={`/favourites/${f.slug}`}
          className="mt-0.5 block text-lg leading-tight font-extrabold tracking-tight"
        >
          {f.name}
        </Link>
        <p className="mt-0.5 text-sm leading-snug text-black/70">
          {f.in[experience]}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {km !== undefined && (
            <span className="text-black/55">
              {km < 1 ? "Under 1" : Math.round(km)} km (straight line)
            </span>
          )}
          <a
            href={directionsHref(f)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-9 items-center gap-1 font-bold underline underline-offset-4"
          >
            <Navigation className="h-3.5 w-3.5" aria-hidden />
            Directions
          </a>
          {f.phone && (
            <a
              href={`tel:${f.phone.value}`}
              className="inline-flex min-h-9 items-center gap-1 font-semibold underline underline-offset-4"
            >
              Call
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

/** A labelled list of optional stops; nothing when there are none. */
export function LocalFavouriteStops({
  stops,
  experience,
  title = "Worth a stop nearby",
  className = "",
}: {
  stops: readonly { favourite: LocalFavourite; km?: number }[];
  experience: FavouriteExperience;
  title?: string;
  className?: string;
}) {
  if (stops.length === 0) return null;
  return (
    <section
      aria-label={title}
      data-testid="favourite-stops"
      className={className}
    >
      <h2 className="mb-2 text-sm font-bold tracking-[0.12em] uppercase opacity-75">
        {title}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {stops.map((s) => (
          <LocalFavouriteStop
            key={s.favourite.slug}
            favourite={s.favourite}
            experience={experience}
            {...(s.km !== undefined ? { km: s.km } : {})}
          />
        ))}
      </ul>
    </section>
  );
}

/**
 * **Local favourites between Discovery's shelves**, beside the featured
 * hosts: the full cards, only for somebody looking from within `km` of them
 * (doctrine §7 — a Vernon pub is not a possibility for a Vancouver day).
 */
export function LocalFavourites({
  favourites,
}: {
  favourites: readonly LocalFavourite[];
}) {
  if (favourites.length === 0) return null;
  return (
    <section aria-label="Local favourites" data-testid="local-favourites">
      {/* A phone swipes between them, like the shelves around it. */}
      <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] gap-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:grid-cols-2 lg:gap-4 lg:overflow-visible lg:px-0">
        {favourites.map((f) => (
          <li
            key={f.slug}
            className={`shrink-0 snap-start lg:w-auto ${favourites.length > 1 ? "w-[86%]" : "w-full"}`}
          >
            <LocalFavouriteCard favourite={f} headingLevel="h3" />
          </li>
        ))}
      </ul>
    </section>
  );
}
