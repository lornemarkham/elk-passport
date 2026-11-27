import { CalendarDays, MapPin, Navigation, Phone } from "lucide-react";
import { featuredAt } from "@/domain/christmas/featured";

const DAYS: readonly (readonly [string, string])[] = [
  ["Friday, December 4", "5:30–7:30 PM"],
  ["Saturday, December 5", "2–7 PM"],
  ["Sunday, December 6", "3–7 PM"],
];

/**
 * **Emmanuel Baptist Church's Bethlehem Star — its own feature** (owner
 * requests M1109/M1116: a prominent showcase, not a line in an event list).
 * The church's own 2026 poster carries the picture; the dates, hours, address
 * and contact were read from the church's site (emmanuelvernon.ca) on
 * 2026-11-27. The showcase ends with its last evening.
 */
export function BethlehemStar({ now }: { readonly now: Date }) {
  const { star } = featuredAt(now);
  if (!star?.image) return null;
  return (
    <article
      aria-labelledby="star-title"
      data-testid="bethlehem-star"
      className="relative overflow-hidden rounded-[32px] bg-[#071a3d] text-white shadow-[0_18px_50px_rgba(7,26,61,0.45)]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 80% 0%, rgba(120,170,255,0.35), transparent 55%), radial-gradient(circle at 10% 100%, rgba(255,217,138,0.18), transparent 50%)",
      }}
    >
      <div className="grid gap-0 lg:grid-cols-[1.15fr_1fr]">
        <figure className="relative bg-[#0a2a6b]">
          {/* eslint-disable-next-line @next/next/no-img-element -- the church's own poster, outside the Next image pipeline */}
          <img
            src={star.image.src}
            alt={star.image.alt}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <figcaption className="absolute right-2 bottom-2 rounded bg-black/55 px-2 py-0.5 text-xs">
            Poster: {star.image.credit}
          </figcaption>
        </figure>
        <div className="p-5 sm:p-8">
          <p className="text-sm font-bold tracking-[0.14em] text-[#ffd98a] uppercase">
            ✦ A journey to first-century Bethlehem · Free
          </p>
          <h3
            id="star-title"
            className="ghad-display mt-1 text-[2rem] leading-[1] font-extrabold tracking-[-0.03em] sm:text-5xl"
          >
            Bethlehem Star
          </h3>
          <p className="mt-1 text-lg text-[#ffd98a]">
            at Emmanuel Baptist Church, Vernon
          </p>
          <p className="mt-3 max-w-xl text-base text-white/90">{star.blurb}</p>
          <ul className="mt-4 space-y-1.5 text-[0.95rem]">
            {DAYS.map(([d, t]) => (
              <li key={d} className="flex gap-2">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  {d} · <strong>{t}</strong>
                </span>
              </li>
            ))}
            <li className="flex gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{star.place}</span>
            </li>
            <li className="flex gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>250-545-5941 · Mon–Fri, 9 AM–4 PM</span>
            </li>
          </ul>
          <p className="mt-3 text-sm text-white/75">
            Hours are from the church&apos;s 2026 poster; its calendar lists
            5:30–7 PM, so check with the church if you are cutting it fine.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(star.directionsQuery)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[#ffd98a] px-5 font-bold text-[#071a3d]"
            >
              <Navigation className="h-4 w-4" aria-hidden /> Directions
            </a>
            <a
              href={star.source.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center underline underline-offset-4"
            >
              Details: {star.source.label}
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
