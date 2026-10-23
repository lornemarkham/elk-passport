"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Beer,
  Check,
  Clock,
  Footprints,
  MapPin,
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

const isMeeting = (subtype?: string) => subtype === "Meeting place";

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
  const Icon = isMeeting(place?.subtype)
    ? MapPin
    : isDrink(place?.subtype)
      ? Beer
      : UtensilsCrossed;

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
            // A business's site may refuse a picture whose page is not its own
            // (hotlink protection reads the Referer); ask without one.
            referrerPolicy="no-referrer"
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
              className="absolute top-2.5 right-2.5 max-w-[60%] truncate rounded-full bg-black/70 px-2.5 py-1 text-[12px] font-semibold tracking-wide text-white uppercase"
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
            <span className="absolute top-4 right-3.5 max-w-[55%] text-right text-[12px] leading-tight font-semibold tracking-[0.1em] text-white/60 uppercase">
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
  className = "h-11 w-11 rounded-full",
}: {
  url?: string;
  fallback: React.ReactNode;
  /** Size and shape; a round 44 px by default. */
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  if (!url || broken) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Atlas-held, as the venue card
    <img
      src={url}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      onLoad={(event) => {
        const { naturalWidth: w, naturalHeight: h } = event.currentTarget;
        if (!photoUsable(w, h)) setBroken(true);
      }}
      className={`${className} shrink-0 object-cover`}
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
 * One option on the "where are we eating" vote, as the photograph it is: the
 * place's own picture, who put it there, who's backing it and a race bar. The
 * vote is the card, so the argument looks like a night out rather than a
 * form. `place` is the Atlas place the option was nominated as, when Passport
 * could match it by name; without it (somebody typed a name) the card still
 * votes. (Release 1 turned these into rows; the recovery brings them back.)
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
      data-option={label}
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
            <span className="rounded-full bg-[#ffd84d] px-2.5 py-0.5 text-[12px] font-bold tracking-wide text-[#0b1220] uppercase">
              {standing === "tied" ? "Tied for the lead" : "Leading"}
            </span>
          )}
          {kind && (
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[12px] font-semibold tracking-wide text-white uppercase backdrop-blur-sm">
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

/**
 * One option on the "where are we eating" vote, as one compact row: the
 * place's own photograph small (or the option's emoji), what it is and how
 * far, who's for it, and the whole row is the vote. `place` is the Atlas place
 * the option was nominated as, when Passport could match it by name; without
 * it (somebody typed a name, or it's the concourse) the row still votes.
 */
export function BallotRow({
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
}) {
  const kind = kindLabel(place?.subtype);
  const href =
    place && place.source !== "curated" && place.kind
      ? subjectHref(place.kind, place.atlasId)
      : undefined;
  const Icon = isDrink(place?.subtype) ? Beer : UtensilsCrossed;
  const sub = place
    ? [`${place.walkMinutes}+ min walk`, kind].filter(Boolean).join(" · ")
    : detail;
  return (
    <div
      data-option={label}
      className={`relative overflow-hidden rounded-2xl transition ${
        chosen
          ? "bg-[#1a2234] ring-2 ring-[#ffd84d]"
          : "bg-[#101826] ring-1 ring-white/10"
      }`}
    >
      {share > 0 && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 bg-white/[0.06] transition-[width] duration-500"
          style={{ width: `${Math.round(share * 100)}%` }}
        />
      )}
      <div className="relative flex items-center gap-2 py-2 pr-2 pl-2">
        <button
          type="button"
          disabled={!canVote}
          aria-pressed={chosen}
          aria-label={`Vote for ${label}`}
          onClick={onVote}
          className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl text-left transition active:scale-[0.99] disabled:cursor-default"
        >
          <PlanPhoto
            url={place?.image?.url}
            className="h-14 w-14 rounded-xl"
            fallback={
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-[24px] text-white/90">
                {emoji ? (
                  <span aria-hidden>{emoji}</span>
                ) : (
                  <Icon className="h-6 w-6" aria-hidden />
                )}
              </span>
            }
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[16px] leading-snug font-bold [overflow-wrap:anywhere] text-white">
              {label}
              {chosen && (
                <Check
                  className="h-4 w-4 shrink-0 text-[#ffd84d]"
                  strokeWidth={3}
                  aria-label="your vote"
                />
              )}
            </span>
            {sub && (
              <span className="block text-[13px] leading-snug text-white/65">
                {sub}
              </span>
            )}
            {(standing || addedBy) && (
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-white/55">
                {standing && (
                  <span className="rounded-full bg-[#ffd84d] px-2 py-px text-[12px] font-bold tracking-wide text-[#0b1220] uppercase">
                    {standing === "tied" ? "Tied" : "Leading"}
                  </span>
                )}
                {addedBy && <span>Added by {addedBy}</span>}
              </span>
            )}
          </span>
        </button>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="flex -space-x-1.5">
            {voters.slice(0, 3).map((p) => (
              <Avatar key={p.id} person={p} size={24} />
            ))}
          </span>
          <span className="text-[13px] font-semibold text-white/80 tabular-nums">
            {voters.length} {voters.length === 1 ? "vote" : "votes"}
          </span>
        </span>
        {href && (
          <Link
            href={href}
            aria-label={`More about ${label} in Passport`}
            className="inline-flex min-h-11 min-w-9 shrink-0 items-center justify-center rounded-full text-white/70 hover:text-white"
          >
            <ArrowUpRight className="h-5 w-5" />
          </Link>
        )}
      </div>
    </div>
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

/** The pill a card's action sits in: one tap, one thing. */
export function CardButton({
  children,
  onClick,
  disabled = false,
  pressed,
  label,
  tone = "light",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  label: string;
  tone?: "light" | "gold";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={pressed}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[14px] font-bold text-[#0b1220] transition active:scale-[0.97] disabled:bg-white/10 disabled:text-white/60 ${
        tone === "gold" ? "bg-[#ffd84d]" : "bg-white"
      }`}
    >
      {children}
    </button>
  );
}

/** "Add & vote", "Vote", "Your vote": what a place's card offers this person. */
export function VoteButton({
  place,
  status,
  canVote,
  onVote,
}: {
  place: Pick<NearbyPlace, "name">;
  status: "new" | "on-ballot" | "mine" | "pending";
  canVote: boolean;
  onVote: () => void;
}) {
  const label =
    status === "new" ? `Add ${place.name} and vote` : `Back ${place.name}`;
  if (status === "mine")
    return (
      <CardButton
        label={`${place.name} is your vote`}
        pressed
        disabled
        onClick={onVote}
      >
        <Check className="h-4 w-4" /> Your vote
      </CardButton>
    );
  if (status === "pending")
    return (
      <CardButton label={label} disabled onClick={onVote}>
        Adding…
      </CardButton>
    );
  return (
    <CardButton label={label} tone="gold" disabled={!canVote} onClick={onVote}>
      <Plus className="h-4 w-4" />
      {status === "new" ? "Add & vote" : "Vote"}
    </CardButton>
  );
}

/**
 * **A place near the arena, as a card worth a look.** The photograph leads,
 * then the name, what Atlas says it is, the walk, what is distinctive about
 * it for a group, and one action (`actions`) — a vote, or the host's pick.
 */
export function NearbyVenueCard({
  place,
  actions,
  badge,
  votes,
  wide = false,
  priority = false,
}: {
  place: NearbyPlace;
  actions?: React.ReactNode;
  /** A quiet pill under the name: "Host's pick". */
  badge?: string;
  /** Votes it has so far; shown only when there are some. */
  votes?: number;
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
        <span className="flex flex-wrap items-center gap-1.5">
          {kind && (
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[12px] font-semibold tracking-wide text-white uppercase backdrop-blur-sm">
              {kind}
            </span>
          )}
          {badge && (
            <span className="rounded-full bg-[#ffd84d] px-2.5 py-0.5 text-[12px] font-bold tracking-wide text-[#0b1220] uppercase">
              {badge}
            </span>
          )}
        </span>
        <h4
          className={`${styles.wide} mt-1 line-clamp-2 text-[19px] leading-[1.05] text-white`}
        >
          {place.name}
        </h4>
      </Photo>
      <div className="flex flex-1 flex-col gap-2 p-3">
        {place.blurb && (
          <p className="line-clamp-3 text-[14px] leading-snug text-white/85">
            {place.blurb}
          </p>
        )}
        <WalkLine place={place} className="text-[13.5px] text-white/90" />
        {place.source === "curated" && place.address && (
          <p className="text-[13px] text-white/65">{place.address}</p>
        )}
        <GameDay place={place} />
        {place.facts?.[0] && (
          <p className="text-[13px] text-white/70">{place.facts[0]}</p>
        )}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-1">
          <span className="flex items-center gap-3">
            {place.source !== "curated" && place.kind && (
              <Link
                href={subjectHref(place.kind, place.atlasId)}
                aria-label={`More about ${place.name} in Passport`}
                className="inline-flex min-h-11 items-center gap-1 text-[13.5px] font-semibold text-white/80 hover:text-white"
              >
                Details
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            )}
            {votes ? (
              <span className="text-[13px] font-semibold whitespace-nowrap text-white/80 tabular-nums">
                {votes} {votes === 1 ? "vote" : "votes"}
              </span>
            ) : null}
          </span>
          {actions}
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
