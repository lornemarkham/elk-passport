"use client";

import Link from "next/link";
import { Check, MapPin, Plus } from "lucide-react";
import {
  KIND_EMOJI,
  KIND_LABEL,
  REACTIONS,
  SEASON_LABEL,
  TOWN_LABEL,
  photoSrc,
  type PinView,
} from "@/domain/christmas/lights/model";
import { toggleStash, useStash } from "./stash";

export function SeasonBadge({ pin }: { readonly pin: PinView }) {
  const tone =
    pin.season === "lit"
      ? "bg-[#ffd98a] text-[#082319]"
      : pin.season === "dark"
        ? "bg-[#3a3a3a] text-white"
        : "bg-white/85 text-[#5b4a2e] ring-1 ring-[#e3a83b]";
  const text =
    pin.status === "pending"
      ? "Waiting for a reviewer — only you can see it"
      : pin.status === "hidden"
        ? "Hidden after a privacy report"
        : pin.status === "declined"
          ? "Not published"
          : pin.season === "lit" && pin.running === "soon" && pin.dates
            ? `Confirmed for ${pin.dates.from.slice(0, 4)} · starts ${new Date(`${pin.dates.from}T12:00:00Z`).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" })}`
            : pin.season === "lit" && pin.running === "over"
              ? "Finished for this year"
              : pin.season === "unconfirmed" && pin.lastConfirmed
                ? `Last confirmed ${pin.lastConfirmed} — not yet this year`
                : SEASON_LABEL[pin.season];
  return (
    <span
      data-testid="season-badge"
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${pin.status === "pending" ? "bg-[#f7e3e1] text-[#b3242f]" : tone}`}
    >
      {pin.season === "lit" && pin.status === "approved" ? "💡 " : ""}
      {text}
    </span>
  );
}

/** A pin as a card: photo, name, how sure we are it's lit, love, add to tour. */
export function PinCard({
  pin,
  onFocus,
}: {
  readonly pin: PinView;
  readonly onFocus?: () => void;
}) {
  const stash = useStash();
  const inTour = stash.includes(pin.id);
  const src = photoSrc(pin);
  const top = REACTIONS.filter((r) => pin.reactions[r.id] > 0)
    .sort((a, b) => pin.reactions[b.id] - pin.reactions[a.id])
    .slice(0, 3);
  return (
    <article
      data-testid="pin-card"
      data-id={pin.id}
      className="group flex h-full flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_6px_24px_rgba(8,35,25,0.12)]"
    >
      <Link
        href={`/christmas/lights/${pin.id}`}
        className="relative block aspect-[4/3] overflow-hidden bg-[#0f3b2b]"
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={`${pin.name}, photographed by a local`}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
            loading="lazy"
          />
        ) : (
          <span
            className="xm-glow flex h-full w-full items-center justify-center text-6xl"
            aria-hidden
          >
            {KIND_EMOJI[pin.kind]}
          </span>
        )}
        <span className="absolute top-3 left-3">
          <SeasonBadge pin={pin} />
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-bold tracking-[0.12em] text-[#b3242f] uppercase">
          {KIND_LABEL[pin.kind]} · {TOWN_LABEL[pin.town]}
        </p>
        <h3 className="ghad-display text-xl leading-tight font-extrabold text-[#082319]">
          <Link
            href={`/christmas/lights/${pin.id}`}
            className="hover:underline"
          >
            {pin.name}
          </Link>
        </h3>
        {pin.hours && <p className="text-sm text-[#3d4a43]">🕯️ {pin.hours}</p>}
        {top.length > 0 && (
          <p
            className="text-sm font-bold text-[#082319]"
            aria-label={`${pin.total} reactions`}
          >
            {top.map((r) => `${r.emoji} ${pin.reactions[r.id]}`).join("  ")}
          </p>
        )}
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          {pin.status === "approved" && (
            <button
              type="button"
              onClick={() => toggleStash(pin.id)}
              aria-pressed={inTour}
              data-testid="add-to-tour"
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-bold ${inTour ? "bg-[#0f3b2b] text-white" : "bg-[#ffd98a] text-[#082319]"}`}
            >
              {inTour ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Plus className="h-4 w-4" aria-hidden />
              )}
              {inTour ? "On my tour" : "Add to my tour"}
            </button>
          )}
          {onFocus && (
            <button
              type="button"
              onClick={onFocus}
              className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-bold text-[#0f3b2b] ring-1 ring-[#0f3b2b]/20"
            >
              <MapPin className="h-4 w-4" aria-hidden /> On the map
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
