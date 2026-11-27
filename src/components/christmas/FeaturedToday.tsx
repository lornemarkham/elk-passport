import type { ReactNode } from "react";
import { CalendarDays, MapPin, Navigation, Ticket } from "lucide-react";
import { BethlehemStar } from "./BethlehemStar";
import {
  featuredAt,
  isOnNow,
  type FeaturedEvent,
} from "@/domain/christmas/featured";

const maps = (q: string) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;

function Facts({ e }: { readonly e: FeaturedEvent }) {
  return (
    <ul className="space-y-1.5 text-[0.95rem]">
      <li className="flex gap-2">
        <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          {e.dayLabel} · <strong>{e.timeLabel}</strong>
        </span>
      </li>
      <li className="flex gap-2">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>{e.place}</span>
      </li>
      <li className="flex gap-2">
        <Ticket className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>{e.cost}</span>
      </li>
    </ul>
  );
}

function Links({ e }: { readonly e: FeaturedEvent }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
      <a
        href={maps(e.directionsQuery)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center gap-1.5 font-semibold underline underline-offset-4"
      >
        <Navigation className="h-4 w-4" aria-hidden /> Directions
      </a>
      <a
        href={e.source.href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 opacity-80"
      >
        Details: {e.source.label}
      </a>
    </div>
  );
}

/** The big one: today's headline event, photo beside the facts. */
function Headline({ e }: { readonly e: FeaturedEvent }) {
  return (
    <article
      data-testid="featured-headline"
      className="overflow-hidden rounded-[28px] bg-[#0f3b2b] text-white shadow-[0_14px_40px_rgba(15,59,43,0.35)] lg:grid lg:grid-cols-[1.1fr_1fr]"
    >
      {e.image && (
        <figure className="relative aspect-[16/9] lg:aspect-auto lg:min-h-[22rem]">
          {/* eslint-disable-next-line @next/next/no-img-element -- organiser's own picture, outside the Next image pipeline */}
          <img
            src={e.image.src}
            alt={e.image.alt}
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
          />
          <figcaption className="absolute right-2 bottom-2 rounded bg-black/55 px-2 py-0.5 text-xs">
            Photo: {e.image.credit}
          </figcaption>
        </figure>
      )}
      <div className="p-5 sm:p-7">
        <p className="text-sm font-bold tracking-[0.14em] text-[#ffd98a] uppercase">
          On today · starts {e.timeLabel.split("–")[0]} PM
        </p>
        <h3 className="ghad-display mt-1 text-[2rem] leading-[1] font-extrabold tracking-[-0.03em] sm:text-5xl">
          {e.title}
        </h3>
        <p className="mt-3 max-w-xl text-base text-white/90">{e.blurb}</p>
        <div className="mt-4">
          <Facts e={e} />
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-white/85">
          {e.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
        <div className="[&_a]:text-white">
          <Links e={e} />
        </div>
      </div>
    </article>
  );
}

/**
 * A featured event that is not the headline: its own picture on top when the
 * organiser has one, otherwise a warm card that says so in words alone —
 * never somebody else's photograph (doctrine, 2026-11-13).
 */
function Card({
  e,
  eyebrow,
  testId,
}: {
  readonly e: FeaturedEvent;
  readonly eyebrow: string;
  readonly testId: string;
}) {
  return (
    <article
      data-testid={testId}
      className="flex flex-col overflow-hidden rounded-[24px] bg-white text-[var(--gh-ink)] shadow-[0_10px_30px_rgba(8,35,25,0.10)] ring-1 ring-black/5"
    >
      {e.image ? (
        <figure className="relative aspect-[16/9] bg-[#0f3b2b]">
          {/* eslint-disable-next-line @next/next/no-img-element -- organiser's own picture, outside the Next image pipeline */}
          <img
            src={e.image.src}
            alt={e.image.alt}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
          <figcaption className="absolute right-2 bottom-2 rounded bg-black/55 px-2 py-0.5 text-xs text-white">
            Photo: {e.image.credit}
          </figcaption>
        </figure>
      ) : (
        <div
          aria-hidden
          className="flex h-20 items-center justify-center bg-[#8e1d26] text-3xl tracking-[0.5em] text-[#ffd98a]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, rgba(255,217,138,0.35), transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.18), transparent 35%)",
          }}
        >
          ✦✦✦
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-bold tracking-[0.14em] text-[#b3242f] uppercase">
          {eyebrow}
        </p>
        <h3 className="ghad-display mt-1 text-2xl leading-tight font-extrabold tracking-tight">
          {e.title}
        </h3>
        <p className="mt-2 text-[0.95rem] text-[var(--gh-ink-soft)]">
          {e.blurb}
        </p>
        <div className="mt-3">
          <Facts e={e} />
        </div>
        <details className="mt-2 text-sm text-[var(--gh-ink-soft)]">
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold underline underline-offset-4">
            Good to know
          </summary>
          <ul className="list-disc space-y-1 pl-5">
            {e.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </details>
        <div className="mt-auto">
          <Links e={e} />
        </div>
      </div>
    </article>
  );
}

/**
 * **Happening today** (owner brief M1154, the page's second band): today's
 * headline event large, with its photograph, then what else is on today.
 * Decided by the clock (`featuredAt`), so an evening that has ended is gone
 * on its own. `also` is Atlas's own events confirmed for today, streamed in
 * by the page. Renders nothing when there is nothing to say.
 */
export function HappeningToday({
  now,
  townName,
  local = true,
  also,
}: {
  readonly now: Date;
  readonly townName: string;
  /** Whether the featured events are near this town at all. */
  readonly local?: boolean;
  readonly also?: ReactNode;
}) {
  const [head, ...rest] = local ? featuredAt(now).tonight : [];
  if (!head && !also) return null;
  return (
    <section
      {...(head ? { "aria-labelledby": "today-title" } : {})}
      id="tonight"
      data-testid="happening-today"
      className="scroll-mt-16 space-y-4"
    >
      {head && (
        <div data-testid="featured-today" className="space-y-4">
          <h2 id="today-title" className={TODAY_H2}>
            Happening today
          </h2>
          <div data-testid="featured-tonight" className="space-y-4">
            <Headline e={head} />
            {rest.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {rest.map((e) => (
                  <Card
                    key={e.id}
                    e={e}
                    eyebrow={`Also today in ${townName} · ${e.timeLabel}`}
                    testId="featured-also-tonight"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {also}
    </section>
  );
}

/** Happening today's heading — `AlsoToday` says it when nothing is featured. */
export const TODAY_H2 =
  "ghad-display text-[1.75rem] leading-tight font-extrabold tracking-[-0.02em] sm:text-4xl";

/**
 * **Don't miss this Christmas** (owner brief M1154, the third band): the
 * Bethlehem Star's own showcase, then the season's other big local dates —
 * SilverStar's Light Up, the NONA light tour — each with the organiser's
 * picture where there is one. Ended events leave on their own.
 */
export function DontMiss({ now }: { readonly now: Date }) {
  const { soon, star } = featuredAt(now);
  if (soon.length === 0 && !star) return null;
  return (
    <section
      aria-labelledby="dont-miss-title"
      data-testid="dont-miss"
      className="space-y-4"
    >
      <h2
        id="dont-miss-title"
        className="ghad-display text-[1.75rem] leading-tight font-extrabold tracking-[-0.02em] sm:text-4xl"
      >
        Don&apos;t miss this Christmas
      </h2>
      <BethlehemStar now={now} />
      {soon.length > 0 && (
        <div data-testid="featured-soon" className="grid gap-4 md:grid-cols-2">
          {soon.map((e) => (
            <Card
              key={e.id}
              e={e}
              eyebrow={isOnNow(e, now) ? `On now · ${e.dayLabel}` : e.dayLabel}
              testId="featured-soon-card"
            />
          ))}
        </div>
      )}
    </section>
  );
}
