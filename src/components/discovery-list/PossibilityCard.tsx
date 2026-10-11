"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Leaf, MapPin } from "lucide-react";
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
import { recurrenceLine } from "@/domain/discovery/recurrence";
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
  className = "",
  carry,
  priority = false,
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
  /** Layout from the surface — a shelf sets its own card width. */
  readonly className?: string;
  /**
   * **What the exploration carries with it**, as a query string — the day
   * somebody picked, the age they named, the way back.
   *
   * Without it, opening a card threw away the Sunday and the five-year-old on
   * the way to the page where they matter most, and "Let's do this" then
   * planned a different day from the one in the person's head.
   */
  readonly carry?: string;
  /**
   * **Whether this card's photograph is worth fetching before the others.**
   *
   * Measured on a local production build at 1280px: the Largest Contentful
   * Paint was a shelf photograph arriving **8.5 seconds** after navigation,
   * while the server answered in 10ms. Twenty-one Atlas-hosted originals were
   * being requested at once and every one of them was `loading="lazy"` —
   * including the one in the first viewport, which is the classic way to
   * deprioritise the exact image the measurement is about.
   *
   * Set by the surface for the handful of cards that open the page. Everything
   * below the fold stays lazy, which is what lazy is for.
   */
  readonly priority?: boolean;
  readonly saved: boolean;
  readonly saving: boolean;
  readonly onSave: () => void;
  readonly wanted?: boolean;
  readonly onWant?: () => void;
}) {
  const base = destinationFor(experience);
  const destination = base && carry ? `${base}?${carry}` : base;
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
  const recurs = recurrenceLine(experience);
  const tag = experience.subtype ?? experience.activities[0];
  // `unknown` is Atlas saying it has not classified this yet. True, and not
  // worth printing at somebody.
  const showTag = tag && tag.toLowerCase() !== "unknown";
  /**
   * **A photograph that does not arrive is the same as not having one.**
   *
   * Atlas's images are served from dozens of publishers' own hosts, and one
   * of them being down, moved or hotlink-protected is an ordinary Tuesday —
   * measured on the live page, one card in fifty rendered the browser's
   * broken-image glyph. The card falls back to the same text-first treatment
   * a subject with no photograph gets, so the shelf never shows a torn icon.
   */
  const [failed, setFailed] = useState(false);
  const picture = failed ? undefined : experience.heroMedia?.src;

  return (
    <li
      data-testid="possibility"
      data-has-image={picture ? "true" : "false"}
      // **White, no border, no shadow, no card.** The photograph is the
      // object; the text sits under it on the page's own ground.
      className={`group relative flex h-full flex-col bg-white ${className}`}
    >
      {destination && (
        <Link
          href={destination}
          className="absolute inset-0 rounded-xl"
          aria-label={experience.title}
        />
      )}

      {/* **A card with no photograph is a different card, not a broken one.**
          Atlas publishes a lead image for 536 of 2,680 subjects, so this is
          not an edge case — it is a fifth of what anybody sees, and it was an
          empty 4:3 rectangle with the words "No photograph" in the corner.
          Four of those in a row read as a page that had failed to load.

          So the slot keeps its proportions, and the type fills it: the
          subject's own name, large, on a tinted field with a rule in the
          reader's accent. Nothing is invented, nothing is borrowed from
          another place, and the shelf's rhythm is unchanged. */}
      {!picture && (
        <div
          data-testid="possibility-untitled"
          className="relative flex aspect-[4/3] w-full flex-col justify-end overflow-hidden bg-[#111]/[0.04] p-4"
        >
          <span
            aria-hidden
            className="absolute top-4 left-4 block h-[3px] w-8"
            style={{ backgroundColor: "var(--ghad-accent)" }}
          />
          {/* **The kind of thing it is, not its name.** The name is the `h3`
              six pixels below; printing it twice made the card read as a
              stutter and put the same string in the accessibility tree twice.
              What Atlas states instead — `park`, `seasonal event`, `farmers
              market` — is real, is not repeated anywhere else on a card
              without a photograph, and gives the slot something to be. */}
          <span className="ghad-display line-clamp-3 text-[26px] leading-[1.02] font-extrabold tracking-[-0.03em] text-balance text-[#111]/35 uppercase sm:text-[30px]">
            {showTag ? tag : experience.kind}
          </span>
        </div>
      )}
      {picture && (
        <div className="aspect-[4/3] w-full overflow-hidden bg-black/[0.04]">
          {/* eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted, outside the Next image pipeline */}
          <img
            src={picture}
            alt=""
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            onError={() => setFailed(true)}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col pt-3">
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
                className="ghad-accent-text inline-flex w-fit items-center gap-1 rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase"
              >
                <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                {away}
              </p>
            )}
            {elsewhere && (
              <p
                data-testid="possibility-area"
                className="inline-flex w-fit items-center gap-1 rounded-full bg-[#111]/[0.07] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-black/70 uppercase"
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
            className="ghad-accent-text truncate text-xs font-semibold tracking-wide"
          >
            {when}
          </p>
        ) : where ? (
          <p
            data-testid="possibility-where"
            className="ghad-accent-text flex items-center gap-1 truncate text-xs font-medium"
          >
            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
            {where}
          </p>
        ) : showTag && picture ? (
          // Without a photograph the kind is already set large in the slot
          // above, so printing it again here is the stutter that was.
          <p className="truncate text-[10px] font-medium tracking-wide text-black/70 uppercase">
            {tag}
          </p>
        ) : null}

        <h3
          className={`ghad-display mt-1 leading-[1.1] font-extrabold tracking-[-0.03em] text-balance text-[#111] ${
            picture ? "text-[18px]" : "text-[20px]"
          }`}
        >
          {experience.title}
        </h3>

        {/* **Atlas now says when its own sentence is not worth printing.**
            `descriptionAddsKnowledge: false` on 255 candidates, with a
            `descriptionCaveat` on 29 saying why — `narrates-mention` is a
            sentence about something that merely mentions this place in
            passing, `dated-occasion` describes one evening rather than the
            venue. Passport built a detector for this once and deleted it for
            catching 12 of 2,681; the source answers it properly now.

            Not hidden — demoted. The line is still the only thing some cards
            have, so it drops to the smallest, quietest type rather than
            leaving a hole. */}
        {experience.shortDescription &&
          (experience.knowledge?.descriptionAddsKnowledge === false ? (
            <p
              data-testid="possibility-weak-description"
              className="mt-1.5 line-clamp-1 text-[11px] leading-relaxed text-black/40"
            >
              {experience.shortDescription}
            </p>
          ) : (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-black/60">
              {experience.shortDescription}
            </p>
          ))}

        {/* When it recurs, in Atlas's own weekday names. A long interval is
            not a season until Atlas says it is. */}
        {recurs && (
          <p
            data-testid="possibility-recurs"
            className="ghad-accent-text mt-1.5 text-[11px] font-medium"
          >
            {recurs}
          </p>
        )}

        {/* Said second where the eyebrow was already spent on the date. A
            dated event still has to say where it is. */}
        {when && where && (
          <p className="mt-1.5 flex items-center gap-1 truncate text-xs text-black/50">
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
            className="mt-1.5 flex items-center gap-1 text-xs text-black/45"
          >
            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
            {unresolved}
          </p>
        )}

        <div className="relative z-10 mt-auto flex flex-wrap items-center gap-2 pt-4">
          {saved ? (
            <span className="ghad-accent-text inline-flex min-h-11 items-center gap-1 rounded-full bg-[#b5651d]/10 px-3 text-xs font-medium">
              <Check className="h-3.5 w-3.5" aria-hidden />
              Saved
            </span>
          ) : (
            /* **The two actions go to two different places**, and saying so
               only after the fact is what made them feel interchangeable: a
               person pressed *Want to do*, opened *Review board*, and could
               not find it — because it had gone to their October instead.
               Both buttons now name their destination before the press. */
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              title="Keep this to look at later"
              className="inline-flex min-h-11 items-center rounded-full bg-[#111] px-4 text-xs font-medium text-white transition-colors hover:bg-[#3a2a1c] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          )}
          {onWant &&
            (wanted ? (
              <span
                className="ghad-accent-text text-xs font-medium"
                data-testid="wanted"
              >
                In my October
              </span>
            ) : (
              <button
                type="button"
                onClick={onWant}
                data-testid="want-to-do"
                title="Keep this in My October"
                className="ghad-accent-text inline-flex min-h-11 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition-colors hover:bg-black/10"
              >
                <Leaf className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Want to do
              </button>
            ))}
        </div>
      </div>
    </li>
  );
}
