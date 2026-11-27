import { CalendarDays, MapPin, Navigation, Ticket } from "lucide-react";
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
          On tonight · starts {e.timeLabel.split("–")[0]} PM
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

function Plain({
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
      className="rounded-[24px] border border-[#0f3b2b]/15 bg-white p-5 text-[var(--gh-ink)] shadow-sm"
    >
      <p className="text-xs font-bold tracking-[0.14em] text-[#b3242f] uppercase">
        {eyebrow}
      </p>
      <h3 className="ghad-display mt-1 text-2xl leading-tight font-extrabold tracking-tight">
        {e.title}
      </h3>
      <p className="mt-2 text-[0.95rem] text-[var(--gh-ink-soft)]">{e.blurb}</p>
      <div className="mt-3">
        <Facts e={e} />
      </div>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--gh-ink-soft)]">
        {e.details.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
      <Links e={e} />
    </article>
  );
}

/**
 * **Today in Vernon** (M1152): the headline event, what else is on tonight,
 * and what is coming soon. All of it is decided by the clock
 * (`featuredAt`), so an evening that has ended is gone on its own. Renders
 * nothing when nothing is featured.
 */
export function FeaturedToday({ now }: { readonly now: Date }) {
  const { tonight, soon } = featuredAt(now);
  if (tonight.length === 0 && soon.length === 0) return null;
  const [head, ...rest] = tonight;
  return (
    <section
      aria-labelledby="featured-title"
      id="tonight"
      data-testid="featured-today"
      className="scroll-mt-16 space-y-6"
    >
      {head && (
        <div data-testid="featured-tonight" className="space-y-4">
          <h2
            id="featured-title"
            className="ghad-display text-[1.75rem] leading-tight font-extrabold tracking-[-0.02em] sm:text-4xl"
          >
            Tonight in Vernon
          </h2>
          <Headline e={head} />
          {rest.length > 0 && (
            <div
              className={`grid gap-4 ${rest.length > 1 ? "md:grid-cols-2" : ""}`}
            >
              {rest.map((e) => (
                <Plain
                  key={e.id}
                  e={e}
                  eyebrow={`Also tonight · ${e.timeLabel}`}
                  testId="featured-also-tonight"
                />
              ))}
            </div>
          )}
        </div>
      )}
      {soon.length > 0 && (
        <div data-testid="featured-soon" className="space-y-3">
          <h2
            id={head ? undefined : "featured-title"}
            className="ghad-display text-2xl leading-tight font-extrabold tracking-tight sm:text-3xl"
          >
            Coming soon
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {soon.map((e) => (
              <Plain
                key={e.id}
                e={e}
                eyebrow={
                  isOnNow(e, now) ? `On now · ${e.dayLabel}` : e.dayLabel
                }
                testId="featured-soon-card"
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * **The one-line banner at the very top** (M1152): today's headline event,
 * above the hero, so it is on screen before anyone scrolls. It links to the
 * full "Tonight" section. Nothing when nothing is on today.
 */
export function TonightBanner({ now }: { readonly now: Date }) {
  const head = featuredAt(now).tonight[0];
  if (!head) return null;
  return (
    <a
      href="#tonight"
      data-testid="tonight-banner"
      className="block bg-[#b3242f] px-4 py-3 text-center text-sm font-semibold text-white sm:text-base"
    >
      Tonight in Vernon: <strong>{head.title}</strong> · {head.timeLabel} ·{" "}
      {head.cost.toLowerCase().startsWith("free") ? "Free" : head.cost} — see
      what&apos;s on tonight ↓
    </a>
  );
}
