import Link from "next/link";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import type { PublicListing } from "@/domain/insiders/model";
import { checkedLine, kindLabel, outLink, whenLine } from "./words";

/**
 * **One local listing.** Says what it is, when (only as far as was checked),
 * where, who runs it, how sure we are, and links out to the organizer.
 */
export function InsiderCard({ listing }: { readonly listing: PublicListing }) {
  const out = outLink(listing);
  const upcoming = listing.when.state === "upcoming";
  return (
    <li
      data-testid={`insider-${listing.id}`}
      className="flex flex-col gap-3 rounded-[24px] border border-black/10 bg-white p-5"
    >
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold tracking-[0.14em] uppercase">
        <span className="rounded-full bg-black px-2.5 py-1 text-white">
          {kindLabel(listing)}
        </span>
        {listing.interests.slice(0, 3).map((i) => (
          <span
            key={i}
            className="rounded-full bg-black/5 px-2.5 py-1 text-black/70"
          >
            {i}
          </span>
        ))}
      </div>
      <h3 className="ghad-display text-xl leading-tight font-extrabold tracking-[-0.02em]">
        <Link href={`/local/${listing.id}`} className="hover:underline">
          {listing.title}
        </Link>
      </h3>
      <p className="text-sm text-black/70">{listing.description}</p>
      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex items-start gap-2">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <dt className="sr-only">When</dt>
          <dd
            data-testid="insider-when"
            className={upcoming ? "font-semibold" : "text-black/70"}
          >
            {whenLine(listing.when)}
          </dd>
        </div>
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <dt className="sr-only">Where</dt>
          <dd className="text-black/70">
            {[listing.place.name, listing.place.town]
              .filter(Boolean)
              .join(", ")}
          </dd>
        </div>
      </dl>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
        <p className="text-xs text-black/50" data-testid="insider-checked">
          {checkedLine(listing)}
        </p>
        {out && (
          <a
            href={out.href}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="insider-out"
            className="inline-flex min-h-10 items-center gap-1 rounded-full bg-black px-4 text-sm font-semibold text-white"
          >
            {out.label}
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </a>
        )}
      </div>
    </li>
  );
}
