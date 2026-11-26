import Link from "next/link";
import { MapPin, Star, UtensilsCrossed } from "lucide-react";
import { subjectHref } from "@/domain/experience/destination";
import { KIND_LABEL, SEASON_LABEL } from "@/domain/christmas/lights/model";
import type { OpenEvening, PinNear } from "@/domain/christmas/nearby";

const card =
  "flex flex-col gap-1.5 rounded-[22px] bg-white p-4 shadow-[0_8px_30px_rgba(8,35,25,0.08)] ring-1 ring-black/5";
const km = (n: number) => `≈ ${n < 10 ? n.toFixed(1) : Math.round(n)} km`;

/**
 * **A display from the community lights map**, as Discover lists it: its
 * name, what kind, how far, and the stars families gave it — the real mean
 * and how many, never a made-up score. No address: the map decides what of a
 * home may be shown, and the card links there.
 */
export function PinNearCard({ near }: { readonly near: PinNear }) {
  const { pin } = near;
  return (
    <Link
      href={`/christmas/lights/${pin.id}`}
      className={`${card} hover:ring-black/20`}
      data-testid="pin-card"
    >
      <span className="text-sm font-semibold text-[#b3242f]">
        ✨ {KIND_LABEL[pin.kind]}
      </span>
      <span className="ghad-display text-lg leading-tight font-extrabold">
        {pin.name}
      </span>
      <span className="flex items-center gap-1.5 text-sm text-[var(--gh-ink-soft)]">
        <MapPin className="h-4 w-4 shrink-0" aria-hidden />
        {km(near.km)} · {SEASON_LABEL[pin.season]}
      </span>
      <span className="flex items-center gap-1.5 text-sm text-[var(--gh-ink-soft)]">
        <Star className="h-4 w-4 shrink-0" aria-hidden />
        {pin.rating
          ? `${pin.rating.mean.toFixed(1)} from ${pin.rating.count} ${pin.rating.count === 1 ? "rating" : "ratings"}`
          : "Not rated yet"}
      </span>
    </Link>
  );
}

/** A restaurant open this evening, by its own published hours. */
export function EveningCard({ open }: { readonly open: OpenEvening }) {
  const e = open.experience;
  return (
    <Link
      href={subjectHref(e.kind, e.id)}
      className={`${card} hover:ring-black/20`}
      data-testid="evening-card"
    >
      <span className="flex items-center gap-1.5 text-sm font-semibold text-[#b3242f]">
        <UtensilsCrossed className="h-4 w-4" aria-hidden /> Dinner
      </span>
      <span className="ghad-display text-lg leading-tight font-extrabold">
        {e.title}
      </span>
      <span className="text-sm text-[var(--gh-ink-soft)]">{open.hours}</span>
      <span className="flex items-center gap-1.5 text-sm text-[var(--gh-ink-soft)]">
        <MapPin className="h-4 w-4 shrink-0" aria-hidden />
        {km(open.km)}
      </span>
    </Link>
  );
}
