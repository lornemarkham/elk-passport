"use client";

import Link from "next/link";
import { Check, MapPin } from "lucide-react";
import type { Experience } from "@/domain/experience/types";
import { destinationFor } from "@/domain/experience/destination";
import { formatEventWhen } from "@/domain/experience/eventTime";
import {
  areaLabel,
  unresolvedPlace,
  whenLine,
  whereLine,
} from "@/domain/discovery/compose";
import { distanceLabel, distanceTo } from "@/domain/discovery/proximity";
import type { Point } from "@/domain/discovery/situation";

/**
 * **One possibility, sold rather than listed.**
 *
 * The row this sits beside (`ExperienceListRow`) is for *finding* — a dense,
 * scannable line for somebody who already knows what they are looking for.
 * This is for *browsing*: it answers **why would I care?** and **can I
 * actually do this?** in one glance, which a 64-pixel thumbnail beside two
 * lines of grey text could not.
 *
 * ## What it shows, and what it refuses to
 *
 * Every line is a fact Atlas states. The picture when there is one; what kind
 * of thing it is; when, for something dated; where, when Atlas named a venue
 * or a locality; and the subject's own sentence. Nothing is computed, scored
 * or inferred — no distance (only 11% of the corpus has coordinates), no
 * "popular", no "perfect for you".
 *
 * ## Hierarchy depends on what kind of possibility it is
 *
 * A dated Event leads with **when**, in Passport's accent colour, because an
 * event without its date cannot be attended and is indistinguishable from one
 * that already happened. A timeless Place leads with **where**. The brief is
 * explicit that these should not share one hierarchy, and they do not.
 *
 * ## No picture is a treatment, not a hole
 *
 * Four subjects in five have no lead image Atlas will vouch for. A grey
 * rectangle repeated down a page reads as broken, so a card with no photograph
 * drops the picture slot entirely and gives its title the room instead — the
 * same decision October's cards reached, for the same reason.
 */
export function PossibilityCard({
  experience,
  today,
  home,
  origin,
  saved,
  saving,
  onSave,
  wanted = false,
  onWant,
}: {
  readonly experience: Experience;
  /** Today where the subjects are, `YYYY-MM-DD`. Makes the when-line relative. */
  readonly today?: string;
  /**
   * The area this page is mostly about, as Atlas names it — e.g. `Okanagan`.
   * A card in a different one says so. Never computed here.
   */
  readonly home?: string;
  /**
   * Where the reader is, once they have said. Only ever used to compute a
   * distance against coordinates Atlas states; a card Atlas has not placed
   * says nothing rather than guessing.
   */
  readonly origin?: Point;
  readonly saved: boolean;
  readonly saving: boolean;
  readonly onSave: () => void;
  readonly wanted?: boolean;
  readonly onWant?: () => void;
}) {
  const destination = destinationFor(experience);
  // Relative where the page knows what day it is — "Last day", "On until Oct
  // 25" — and the full stated interval otherwise, which is what a subject's
  // own page always shows.
  const when = today
    ? whenLine(experience, today)
    : formatEventWhen(
        experience.startTime,
        experience.endTime,
        experience.timePrecision,
      );
  const where = whereLine(experience);
  // **The area, when it is not the one this page is mostly about.**
  //
  // Canyon Frights led *Happening today* with no town at all, beside Okanagan
  // cards that said "· Kelowna" — so the bare card read as local by omission,
  // and it is 273 km away at Capilano Suspension Bridge Park. Naming the area
  // is what stops that: `Metro Vancouver` on the card cannot be mistaken for
  // down the road.
  //
  // `home` is passed in by the surface, which knows what the page is mostly
  // about. Passport does not decide that here and does not compute distance:
  // it has no reliable idea where the reader is, so it states where the thing
  // is and lets them judge.
  const area = areaLabel(experience);
  const away = distanceLabel(distanceTo(experience, origin));
  // **"Elsewhere" is measured from the corpus; a distance is measured from the
  // person.** Shown together they contradict each other — a Vancouver venue
  // carried "UNDER 1 KM AWAY" beside "METRO VANCOUVER" for somebody standing
  // outside it, because the page is mostly about the Okanagan. Once Passport
  // knows where the reader is, the badge about the corpus has nothing to add.
  const elsewhere = Boolean(area && home && area !== home && !away);
  const unresolved = unresolvedPlace(experience);
  const tag = experience.subtype ?? experience.activities[0];
  // `unknown` is Atlas saying it has not classified this yet. True, and not
  // worth printing at somebody.
  const showTag = tag && tag.toLowerCase() !== "unknown";
  const picture = experience.heroMedia?.src;

  return (
    <li
      data-testid="possibility"
      data-has-image={picture ? "true" : "false"}
      className={`relative flex flex-col overflow-hidden rounded-xl border border-[#8a5a24]/15 bg-[#f7ecd3] ${
        destination ? "transition-colors hover:border-[#8a5a24]/45" : ""
      }`}
    >
      {destination && (
        <Link
          href={destination}
          className="absolute inset-0 rounded-xl"
          aria-label={experience.title}
        />
      )}

      {picture && (
        <div className="aspect-[16/10] w-full overflow-hidden bg-[#2b2015]/[0.06]">
          {/* eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted, outside the Next image pipeline */}
          <img
            src={picture}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col p-4">
        {/* The one line that changes by kind: a dated thing says when, a
            timeless thing says where. Never both in this slot — that is the
            eyebrow, and an eyebrow with two jobs has none. */}
        {/* Said first and said loudly, because "this is not where you are" is
            the one fact that changes whether the rest of the card matters.
            A distance appears **only** where Atlas states coordinates and the
            reader has shared their own — two stated positions and arithmetic,
            never an inference from a name, an area or a venue string. Most
            cards will carry neither, and carry nothing. */}
        {(away || elsewhere) && (
          <div className="mb-1 flex flex-wrap items-center gap-1">
            {away && (
              <p
                data-testid="possibility-distance"
                className="inline-flex w-fit items-center gap-1 rounded-full bg-[#8a5a24]/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#8a5a24] uppercase"
              >
                <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                {away}
              </p>
            )}
            {elsewhere && (
              <p
                data-testid="possibility-area"
                className="inline-flex w-fit items-center gap-1 rounded-full bg-[#2b2015]/[0.07] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#2b2015]/70 uppercase"
              >
                <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                {area}
              </p>
            )}
          </div>
        )}

        {when ? (
          <p
            data-testid="possibility-when"
            className="truncate text-xs font-semibold tracking-wide text-[#8a5a24]"
          >
            {when}
          </p>
        ) : where ? (
          <p
            data-testid="possibility-where"
            className="flex items-center gap-1 truncate text-xs font-medium text-[#8a5a24]"
          >
            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
            {where}
          </p>
        ) : showTag ? (
          <p className="truncate text-[10px] font-medium tracking-wide text-[#8a5a24]/70 uppercase">
            {tag}
          </p>
        ) : null}

        <h3
          className={`font-heading mt-1 leading-tight text-[#2b2015] ${
            picture ? "text-base" : "text-lg"
          }`}
        >
          {experience.title}
        </h3>

        {experience.shortDescription && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[#2b2015]/60">
            {experience.shortDescription}
          </p>
        )}

        {/* Said second where the eyebrow was already spent on the date. A
            dated event still has to say where it is. */}
        {when && where && (
          <p className="mt-1.5 flex items-center gap-1 truncate text-xs text-[#2b2015]/50">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
            {where}
          </p>
        )}

        {/* Atlas found two towns and refused to pick one. Saying so beats
            silently showing the first, and beats saying nothing — which on a
            page of labelled cards reads as "local". */}
        {unresolved && (
          <p
            data-testid="possibility-unresolved"
            className="mt-1.5 flex items-center gap-1 text-xs text-[#2b2015]/45"
          >
            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
            {unresolved}
          </p>
        )}

        <div className="relative z-10 mt-auto flex flex-wrap items-center gap-2 pt-4">
          {saved ? (
            <span className="inline-flex min-h-11 items-center gap-1 rounded-full bg-[#b5651d]/10 px-3 text-xs font-medium text-[#8a5a24]">
              <Check className="h-3.5 w-3.5" aria-hidden />
              Saved
            </span>
          ) : (
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="inline-flex min-h-11 items-center rounded-full bg-[#2b2015] px-4 text-xs font-medium text-[#f7ecd3] transition-colors hover:bg-[#3a2a1c] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          )}
          {onWant &&
            (wanted ? (
              <span
                className="text-xs font-medium text-[#8a5a24]"
                data-testid="wanted"
              >
                In my October
              </span>
            ) : (
              <button
                type="button"
                onClick={onWant}
                data-testid="want-to-do"
                className="inline-flex min-h-11 items-center rounded-full px-2.5 text-xs font-medium text-[#8a5a24] transition-colors hover:bg-[#8a5a24]/10"
              >
                Want to do
              </button>
            ))}
        </div>
      </div>
    </li>
  );
}
