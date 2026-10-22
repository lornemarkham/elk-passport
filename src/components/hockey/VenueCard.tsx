"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Beer,
  Check,
  Clock,
  Footprints,
  Plus,
  UtensilsCrossed,
} from "lucide-react";
import { Avatar } from "@/experience-lab/ui/atoms";
import type { Participant } from "@/experience-lab/core/types";
import { subjectHref } from "@/domain/experience/destination";
import { photoUsable, type NearbyPlace } from "@/domain/hockey/nearby";
import styles from "./hockey.module.css";

/**
 * **A place you could go before the game, sold rather than listed.**
 *
 * Passport's picture rule, unchanged (`nearby.ts`, `PossibilityCard`): the
 * place's own photograph shown plainly; a photograph from its own site or its
 * venue said to be that; and no stock picture of "a restaurant" standing in
 * for this one. With no photograph Passport can vouch for, the card leads
 * with what the place is, on the home side's colours — a designed treatment,
 * not a grey hole.
 *
 * Every fact on it is Atlas's or arithmetic on Atlas's coordinates: the kind
 * of place, the straight-line walk (an estimate, and said to be), the hours
 * Atlas holds for game day (quoted), and whatever it holds that a group
 * would care about. No ratings, no prices, nothing "popular".
 */

const isDrink = (subtype?: string) =>
  /bar|pub|lounge|brew|tap|tavern|saloon|wine|cocktail/i.test(subtype ?? "");

const kindLabel = (subtype?: string) =>
  subtype && subtype.toLowerCase() !== "unknown"
    ? subtype.charAt(0).toUpperCase() + subtype.slice(1)
    : undefined;

function distance(km: number): string {
  return km < 1
    ? `${Math.round((km * 1000) / 50) * 50} m`
    : `${km.toFixed(1)} km`;
}

/** The walk, honestly: a floor from a straight line, never a route. */
export function WalkLine({
  place,
  className = "",
}: {
  place: Pick<NearbyPlace, "km" | "walkMinutes">;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`}
      title="Straight-line distance at a walking pace. The real walk is longer."
    >
      <Footprints className="h-4 w-4 shrink-0" aria-hidden />
      <span>
        <strong className="font-semibold">{place.walkMinutes}+ min walk</strong>
        <span className="opacity-75">
          {" "}
          · {distance(place.km)} straight line (estimate)
        </span>
      </span>
    </span>
  );
}

function Photo({
  place,
  emoji,
  aspect,
  priority = false,
  children,
}: {
  place?: NearbyPlace;
  emoji?: string;
  aspect: string;
  priority?: boolean;
  children?: React.ReactNode;
}) {
  const [broken, setBroken] = useState(false);
  const image = place?.image && !broken ? place.image : undefined;
  const Icon = isDrink(place?.subtype) ? Beer : UtensilsCrossed;

  return (
    <div
      className={`relative w-full overflow-hidden ${aspect}`}
      data-photo={image ? image.relationship : "none"}
    >
      {image ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- Atlas-held, from the place's own site, outside the Next image pipeline (as PossibilityCard) */}
          <img
            src={image.url}
            alt={
              image.relationship === "exact" ? "" : (image.attribution ?? "")
            }
            title={image.attribution}
            loading={priority ? "eager" : "lazy"}
            onError={() => setBroken(true)}
            onLoad={(event) => {
              const { naturalWidth: w, naturalHeight: h } = event.currentTarget;
              if (!photoUsable(w, h)) setBroken(true);
            }}
            className="absolute inset-0 h-full w-full object-cover"
          />
          {image.label && (
            <span
              title={image.attribution}
              className="absolute top-2.5 right-2.5 max-w-[60%] truncate rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white uppercase"
            >
              {image.label}
            </span>
          )}
        </>
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background:
              "radial-gradient(120% 120% at 15% 0%, color-mix(in srgb, var(--home) 70%, #1b2436) 0%, #121a2a 60%, #0b111d 100%)",
          }}
        >
          <span
            aria-hidden
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, #fff 0 2px, transparent 2px 14px)",
            }}
          />
          <span className="absolute top-3 left-3.5 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white/90">
            {emoji ? (
              <span className="text-[26px] leading-none" aria-hidden>
                {emoji}
              </span>
            ) : (
              <Icon className="h-6 w-6" aria-hidden />
            )}
          </span>
          {place && (
            <span className="absolute top-4 right-3.5 max-w-[55%] text-right text-[11px] leading-tight font-semibold tracking-[0.1em] text-white/60 uppercase">
              No photo Passport can vouch for yet
            </span>
          )}
        </div>
      )}
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/40 to-transparent"
      />
      <div className="absolute inset-x-0 bottom-0 p-3.5">{children}</div>
    </div>
  );
}

/**
 * The round picture on a plan row: the leading place's photograph, or the
 * row's own icon when it will not load or is not a photograph (a logo, an
 * icon — `photoUsable`). Same rule as the card's, so a place never has a
 * picture here that its card refused.
 */
export function PlanPhoto({
  url,
  fallback,
}: {
  url?: string;
  fallback: React.ReactNode;
}) {
  const [broken, setBroken] = useState(false);
  if (!url || broken) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Atlas-held, as the venue card
    <img
      src={url}
      alt=""
      onError={() => setBroken(true)}
      onLoad={(event) => {
        const { naturalWidth: w, naturalHeight: h } = event.currentTarget;
        if (!photoUsable(w, h)) setBroken(true);
      }}
      className="h-11 w-11 shrink-0 rounded-full object-cover"
    />
  );
}

function GameDay({ place }: { place: NearbyPlace }) {
  const day = place.gameDay;
  if (!day) return null;
  if (day.reading === "not-on") {
    return (
      <p className="flex items-start gap-1.5 text-[14px] font-semibold text-[#ff8a8a]">
        <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        Atlas says its stated hours don&apos;t cover game day
        {day.said ? ` — “${day.said}”` : ""}
      </p>
    );
  }
  return day.said ? (
    <p
      className="flex items-start gap-1.5 text-[14px] text-white/85"
      title="As the place published it, via Atlas"
    >
      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-white/60" aria-hidden />
      <span>
        <span className="text-white/60">Game day: </span>
        {day.said}
      </span>
    </p>
  ) : null;
}

function Details({ place }: { place: NearbyPlace }) {
  const href =
    place.source !== "curated" && place.kind
      ? subjectHref(place.kind, place.atlasId)
      : undefined;
  return (
    <div className="flex flex-col gap-2">
      <GameDay place={place} />
      {place.facts && place.facts.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {place.facts.map((fact) => (
            <li
              key={fact}
              className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[12.5px] font-medium text-white/85"
            >
              {fact}
            </li>
          ))}
        </ul>
      )}
      {place.blurb && (
        <p className="line-clamp-2 text-[14px] leading-snug text-white/70">
          {place.blurb}
        </p>
      )}
      {!place.blurb && place.address && (
        <p className="text-[14px] text-white/70">{place.address}</p>
      )}
      {href && (
        <Link
          href={href}
          className="inline-flex min-h-10 w-fit items-center gap-1 text-[14px] font-semibold text-white underline-offset-4 hover:underline"
        >
          More about {place.name} in Passport
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

/**
 * One option on the "where are we eating" vote. `place` is the Atlas place
 * the option was nominated as, when Passport could match it by name; without
 * it (somebody typed a name, or it's the concourse) the card still votes.
 */
export function BallotVenueCard({
  label,
  detail,
  emoji,
  place,
  voters,
  share,
  standing,
  chosen,
  canVote,
  onVote,
  addedBy,
  priority,
}: {
  label: string;
  detail?: string;
  emoji?: string;
  place?: NearbyPlace;
  voters: readonly Participant[];
  share: number;
  /** Out in front of the vote, or level with somebody else. */
  standing?: "leading" | "tied";
  chosen: boolean;
  canVote: boolean;
  onVote: () => void;
  addedBy?: string;
  priority?: boolean;
}) {
  const kind = kindLabel(place?.subtype);
  return (
    <article
      aria-label={label}
      className={`overflow-hidden rounded-[22px] bg-[#101826] ring-1 transition ${
        chosen ? "ring-2 ring-[#ffd84d]" : "ring-white/10"
      }`}
    >
      <Photo
        place={place}
        emoji={place ? undefined : (emoji ?? "🍽️")}
        aspect={place?.image ? "aspect-[16/10]" : "aspect-[16/7]"}
        priority={priority}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {standing && (
            <span className="rounded-full bg-[#ffd84d] px-2.5 py-0.5 text-[11.5px] font-bold tracking-wide text-[#0b1220] uppercase">
              {standing === "tied" ? "Tied for the lead" : "Leading"}
            </span>
          )}
          {kind && (
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11.5px] font-semibold tracking-wide text-white uppercase backdrop-blur-sm">
              {kind}
            </span>
          )}
        </div>
        <h4
          className={`${styles.wide} mt-1.5 text-[24px] leading-[1.05] [overflow-wrap:anywhere] text-white`}
        >
          {label}
        </h4>
        {place ? (
          <WalkLine place={place} className="mt-1 text-[14px] text-white" />
        ) : (
          detail && <p className="mt-1 text-[14px] text-white/85">{detail}</p>
        )}
      </Photo>

      <div className="flex flex-col gap-3 p-3.5">
        {place && <Details place={place} />}
        {addedBy && (
          <p className="text-[12.5px] text-white/55">
            {addedBy} put this on the vote
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!canVote}
            aria-pressed={chosen}
            aria-label={`Vote for ${label}`}
            onClick={onVote}
            className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-[16px] font-bold transition active:scale-[0.98] disabled:cursor-default ${
              chosen
                ? "bg-[#ffd84d] text-[#0b1220]"
                : "bg-white/[0.08] text-white ring-1 ring-white/20 hover:bg-white/[0.14] disabled:opacity-60"
            }`}
          >
            {chosen ? (
              <>
                <Check className="h-5 w-5" strokeWidth={3} />
                Your vote
              </>
            ) : canVote ? (
              `Vote for ${label.length > 18 ? "this" : label}`
            ) : (
              "Voting's closed"
            )}
          </button>
          <VoteCount voters={voters} />
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-white/10"
          aria-hidden
        >
          <div
            className="h-full rounded-full bg-[#ffd84d] transition-[width] duration-500"
            style={{ width: `${Math.round(share * 100)}%` }}
          />
        </div>
      </div>
    </article>
  );
}

export function VoteCount({ voters }: { voters: readonly Participant[] }) {
  return (
    <span className="flex shrink-0 items-center gap-2">
      <span className="flex -space-x-1.5">
        {voters.slice(0, 4).map((p) => (
          <Avatar key={p.id} person={p} size={26} />
        ))}
      </span>
      <span className="text-[14px] font-semibold text-white/85 tabular-nums">
        {voters.length} {voters.length === 1 ? "vote" : "votes"}
      </span>
    </span>
  );
}

/** A place near the arena that is not on the vote yet. */
export function NearbyVenueCard({
  place,
  onBallot,
  canAdd,
  onAdd,
  wide = false,
  priority = false,
}: {
  place: NearbyPlace;
  onBallot: boolean;
  canAdd: boolean;
  onAdd: () => void;
  /** Full width, for the places a group should see first. */
  wide?: boolean;
  priority?: boolean;
}) {
  const kind = kindLabel(place.subtype);
  return (
    <article
      aria-label={place.name}
      className={`flex shrink-0 snap-start flex-col overflow-hidden rounded-[20px] bg-[#101826] ring-1 ring-white/10 ${
        wide ? "w-full" : "w-[78vw] max-w-[290px]"
      }`}
    >
      <Photo
        place={place}
        aspect={wide ? "aspect-[16/10]" : "aspect-[4/3]"}
        priority={priority}
      >
        {kind && (
          <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11.5px] font-semibold tracking-wide text-white uppercase backdrop-blur-sm">
            {kind}
          </span>
        )}
        <h4
          className={`${styles.wide} mt-1 line-clamp-2 text-[19px] leading-[1.05] text-white`}
        >
          {place.name}
        </h4>
      </Photo>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <WalkLine place={place} className="text-[13.5px] text-white/90" />
        {place.source === "curated" && place.address && (
          <p className="text-[13px] text-white/65">{place.address}</p>
        )}
        <GameDay place={place} />
        {place.facts?.[0] && (
          <p className="text-[13px] text-white/70">{place.facts[0]}</p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          {place.source !== "curated" && place.kind ? (
            <Link
              href={subjectHref(place.kind, place.atlasId)}
              aria-label={`More about ${place.name} in Passport`}
              className="inline-flex min-h-11 items-center gap-1 text-[13.5px] font-semibold text-white/80 hover:text-white"
            >
              Details
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          ) : (
            <span />
          )}
          <button
            type="button"
            disabled={onBallot || !canAdd}
            onClick={onAdd}
            aria-label={
              onBallot
                ? `${place.name} is on the ballot`
                : `Nominate ${place.name}`
            }
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-4 text-[14px] font-bold text-[#0b1220] transition active:scale-[0.97] disabled:bg-white/10 disabled:text-white/60"
          >
            {onBallot ? (
              <>
                <Check className="h-4 w-4" /> On the vote
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Add to vote
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

/** What a card looks like while Passport is still asking Atlas. */
export function VenueSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div
      aria-hidden
      className={`${styles.shimmer} shrink-0 rounded-[20px] ${
        wide ? "h-[300px] w-full" : "h-[300px] w-[78vw] max-w-[290px]"
      }`}
    />
  );
}
