"use client";

import Link from "next/link";
import { Check, ChevronRight, MapPin } from "lucide-react";
import type { Experience } from "@/domain/experience/types";
import { destinationFor } from "@/domain/experience/destination";
import { formatEventWhen } from "@/domain/experience/eventTime";

interface ExperienceListRowProps {
  experience: Experience;
  saved: boolean;
  saving: boolean;
  onSave: () => void;
}

/** One row: image if the experience has one, title, short description, a
 * category/mood tag if the data has one, and Save/Saved. No motion, no
 * card physics — the whole point of List mode is that this is a plain,
 * scannable row.
 *
 * Phase 7.0's only required Discovery change: the whole row now navigates
 * to the real Place Detail page. Built as a "stretched link" — an
 * invisible `<Link>` absolutely positioned to cover the full `<li>`
 * rather than wrapping everything in an `<a>`, which would nest the Save
 * `<button>` inside an anchor (invalid HTML, and ambiguous which one a
 * click actually means).
 *
 * The image and text blocks are deliberately *not* given their own
 * `relative`/`z-*` — the first version of this did, which was backwards:
 * a `position: absolute` element paints above plain static siblings
 * regardless of z-index or source order, so giving the image/text an
 * elevated z-index put them *above* the link and made them dead click
 * targets — only the row's padding and flex gaps (wherever nothing sat
 * above the link) were actually clickable. The link needs no explicit
 * z-index of its own to sit above plain content; the Save button is the
 * one real exception, and it's the one element that gets `relative
 * z-10` here, so it alone stays clickable above the link overlay. */
export function ExperienceListRow({
  experience,
  saved,
  saving,
  onSave,
}: ExperienceListRowProps) {
  const tag =
    experience.subtype ?? experience.activities[0] ?? experience.moods[0];
  const destination = destinationFor(experience);
  // Events only, and the single most important thing on the card: an event
  // without its date cannot be attended, and is indistinguishable from one
  // that already happened.
  const when = formatEventWhen(experience.startTime, experience.endTime);
  // `UNKNOWN` is Atlas saying it has not classified this yet — true, and not
  // worth shouting at a traveller in a badge.
  const showTag = tag && tag.toLowerCase() !== "unknown";

  return (
    <li
      className={`relative flex items-center gap-4 rounded-xl border border-[#8a5a24]/15 bg-[#f7ecd3] p-4 ${
        destination ? "transition-colors hover:border-[#8a5a24]/45" : ""
      }`}
      data-navigates={destination ? "true" : "false"}
    >
      {/* A card with nowhere truthful to go is still a card. Sending an
          Organization to `/places/{organizationId}` would be a 404 dressed up
          as a link — see `destinationFor`. */}
      {destination && (
        <Link
          href={destination}
          className="absolute inset-0 rounded-xl"
          aria-label={experience.title}
        />
      )}

      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#2b2015]/[0.06]">
        {experience.heroMedia?.src ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Atlas-hosted images, not part of the Next image pipeline
          <img
            src={experience.heroMedia.src}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <MapPin className="h-6 w-6 text-[#8a5a24]/40" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-[#2b2015]">
            {experience.title}
          </p>
          {showTag && (
            <span className="shrink-0 rounded-full bg-[#2b2015]/[0.06] px-2 py-0.5 text-[10px] font-medium tracking-wide text-[#8a5a24] uppercase">
              {tag}
            </span>
          )}
        </div>
        {/* Rendered only when Atlas holds a containment edge for it — never
            inferred from a name, and never from region membership. It is also
            what explains the destination: BullWheel opens Big White's page
            because BullWheel is at Big White. */}
        {when && (
          <p className="mt-0.5 truncate text-xs font-medium text-[#8a5a24]">
            {when}
          </p>
        )}
        {experience.context && (
          <p className="mt-0.5 truncate text-xs font-medium text-[#8a5a24]">
            at {experience.context.name}
          </p>
        )}
        <p className="mt-0.5 line-clamp-2 text-xs text-[#2b2015]/60">
          {experience.shortDescription}
        </p>
      </div>

      {/* The only difference a card without a destination shows: no chevron,
          no hover. It still reads as a real discovery — most Organizations and
          Activities have no page yet, and a missing page is not a missing
          thing. What it must never do is look clickable and do nothing. */}
      {destination && (
        <ChevronRight className="h-4 w-4 shrink-0 text-[#8a5a24]/40" />
      )}

      <div className="relative z-10 shrink-0">
        {saved ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#b5651d]/10 px-3 py-1.5 text-xs font-medium text-[#8a5a24]">
            <Check className="h-3.5 w-3.5" />
            Saved
          </span>
        ) : (
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-full border border-[#2b2015]/10 bg-[#2b2015] px-4 py-1.5 text-xs font-medium text-[#f7ecd3] transition-colors hover:bg-[#3a2a1c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        )}
      </div>
    </li>
  );
}
