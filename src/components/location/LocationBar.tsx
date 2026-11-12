"use client";

import { useState } from "react";
import { townById } from "@/domain/discovery/towns";
import { shortName } from "@/domain/location/prefs";
import { useLocation } from "@/lib/location/useLocation";
import { LocationPicker } from "./LocationPicker";

/**
 * **"📍 Vernon, BC · Change"** — the assumed place, said, with one control.
 *
 * Never a gate: it renders the place Passport is assuming (or nothing for the
 * instant before one is known), and everything on the page works whether or
 * not it is touched. An approximate place says so — *Around Vernon, BC ·
 * approximate* — because a regional guess is not a position.
 *
 * `scope` names the experience so it may carry a destination of its own
 * without moving the shared place or home.
 */
export function LocationBar({
  scope,
  experience,
  onChange,
  showing,
  anywhere = false,
  className = "",
}: {
  /** A town this page is using that may differ from the shared one (a sentence named Kelowna). */
  readonly showing?: string;
  /** The page is deliberately looking everywhere; say so rather than name a town. */
  readonly anywhere?: boolean;
  /** Told the town after the person picks one — for pages that keep their own copy (a URL). */
  readonly onChange?: (townId: string) => void;
  readonly scope?: string;
  readonly experience?: string;
  readonly className?: string;
}) {
  const base = useLocation(scope);
  const location = {
    ...base,
    choose: (id: string, options?: { onlyHere?: boolean }) => {
      base.choose(id, options);
      onChange?.(id);
    },
    locate: async (options?: { onlyHere?: boolean }) => {
      const result = await base.locate(options);
      if (result.ok) onChange?.(result.townId);
      return result;
    },
  };
  const [open, setOpen] = useState(false);
  const shown = showing ? townById(showing) : undefined;
  const town = shown ?? location.town;
  // A town the page was told is said, not guessed, so it is never "approximate".
  const approximate =
    location.approximate && (!shown || shown.id === location.townId);

  return (
    <>
      <p
        data-testid="location-bar"
        className={`flex min-h-11 flex-wrap items-center gap-x-2 text-[15px] font-semibold ${className}`}
      >
        <span aria-hidden>📍</span>
        {anywhere ? (
          <span data-testid="location-name">Anywhere in BC</span>
        ) : town ? (
          <>
            <span data-testid="location-name">
              {approximate ? "Around " : ""}
              {town.name}
            </span>
            {approximate && (
              <span className="text-[13px] font-normal opacity-70">
                approximate
              </span>
            )}
            {location.hasDestination && (
              <span className="text-[13px] font-normal opacity-70">
                · just for {experience ?? "here"}
              </span>
            )}
          </>
        ) : (
          <span className="opacity-60">Finding where to start…</span>
        )}
        <span aria-hidden>·</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="location-change"
          aria-label={
            town ? `Change location from ${shortName(town)}` : "Change location"
          }
          className="min-h-11 underline underline-offset-4"
        >
          Change
        </button>
      </p>
      {open && (
        <LocationPicker
          location={location}
          {...(experience ? { experience } : {})}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
