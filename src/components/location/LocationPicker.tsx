"use client";

import { useEffect, useId, useRef, useState } from "react";
import { TOWN_GROUPS } from "@/domain/discovery/towns";
import { searchTowns, shortName } from "@/domain/location/prefs";
import type { PassportLocation } from "@/lib/location/useLocation";

/**
 * **A simple searchable place picker.** Type a city, or tap *Use my location*,
 * or tap somewhere you were recently or call home. No giant rows of pills: the
 * full list is behind one disclosure, not on the page.
 *
 * *Explore another destination* keeps the place on the bar to this experience
 * alone (`onlyHere`) and leaves the shared place and home as they were.
 */
export function LocationPicker({
  location,
  experience,
  onClose,
}: {
  readonly location: PassportLocation;
  /** The experience's name, for the one-experience toggle: "Christmas". */
  readonly experience?: string;
  readonly onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [onlyHere, setOnlyHere] = useState(false);
  const [note, setNote] = useState<string>();
  const [locating, setLocating] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useEffect(() => {
    input.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const matches = searchTowns(query);
  const pick = (id: string) => {
    location.choose(id, { onlyHere });
    onClose();
  };
  const locate = async () => {
    setLocating(true);
    setNote(undefined);
    const result = await location.locate({ onlyHere });
    setLocating(false);
    if (result.ok) return onClose();
    setNote(
      result.why === "denied"
        ? "Your browser said no to location. Search for a city instead."
        : result.why === "outside"
          ? "You're outside the places Passport covers yet. Search for a city to explore."
          : "Couldn't get your location. Search for a city instead.",
    );
  };

  const row =
    "flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[15px] font-semibold text-[#111] hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="location-picker"
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 text-[#111] shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-extrabold">
            Where are you looking?
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-h-11 min-w-11 rounded-full text-xl"
          >
            ×
          </button>
        </div>

        <input
          ref={input}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search for a city"
          aria-label="Search for a city"
          data-testid="location-search"
          className="mt-2 min-h-11 w-full rounded-lg px-3 text-[16px] ring-1 ring-black/20 ring-inset focus:ring-black/50"
        />

        {query.trim() !== "" && (
          <ul className="mt-2" data-testid="location-results">
            {matches.map((town) => (
              <li key={town.id}>
                <button
                  type="button"
                  className={row}
                  onClick={() => pick(town.id)}
                  data-testid={`location-option-${town.id}`}
                >
                  <span>{town.name}</span>
                  <span className="text-[13px] font-normal text-black/55">
                    {town.area}
                  </span>
                </button>
              </li>
            ))}
            {matches.length === 0 && (
              <li className="px-3 py-2 text-[14px] text-black/65">
                Passport doesn&apos;t know a place called &ldquo;{query.trim()}
                &rdquo; yet. Try a nearby city.
              </li>
            )}
          </ul>
        )}

        <button
          type="button"
          className={`${row} mt-1`}
          onClick={() => void locate()}
          disabled={locating}
          data-testid="location-use-mine"
        >
          <span>{locating ? "Finding you…" : "Use my location"}</span>
          <span aria-hidden>📍</span>
        </button>
        {note && (
          <p role="status" className="px-3 pb-1 text-[14px] text-black/70">
            {note}
          </p>
        )}

        {location.home && (
          <div className="mt-2">
            <p className="px-3 text-[12px] font-bold tracking-wide text-black/55 uppercase">
              Home
            </p>
            <button
              type="button"
              className={row}
              onClick={() => pick(location.home!.id)}
            >
              <span>{location.home.name}</span>
              <span aria-hidden>🏠</span>
            </button>
          </div>
        )}

        {location.recent.length > 0 && (
          <div className="mt-2" data-testid="location-recent">
            <p className="px-3 text-[12px] font-bold tracking-wide text-black/55 uppercase">
              Recently explored
            </p>
            {location.recent.map((town) => (
              <button
                key={town.id}
                type="button"
                className={row}
                onClick={() => pick(town.id)}
              >
                {town.name}
              </button>
            ))}
          </div>
        )}

        <div className="mt-2">
          <button
            type="button"
            className={`${row} font-normal`}
            aria-expanded={browsing}
            onClick={() => setBrowsing(!browsing)}
          >
            <span>Browse all places</span>
            <span aria-hidden>{browsing ? "−" : "+"}</span>
          </button>
          {browsing &&
            TOWN_GROUPS.map((group) => (
              <div key={group.area} className="mt-1">
                <p className="px-3 text-[12px] font-bold tracking-wide text-black/55 uppercase">
                  {group.area}
                </p>
                {group.towns.map((town) => (
                  <button
                    key={town.id}
                    type="button"
                    className={`${row} font-normal`}
                    onClick={() => pick(town.id)}
                  >
                    {town.name}
                  </button>
                ))}
              </div>
            ))}
        </div>

        <div className="mt-3 border-t border-black/10 pt-3">
          {experience && location.town && (
            <label className="flex min-h-11 items-center gap-3 px-3 text-[14px]">
              <input
                type="checkbox"
                checked={onlyHere}
                onChange={(event) => setOnlyHere(event.target.checked)}
                data-testid="location-only-here"
                className="size-5"
              />
              <span>
                Explore another destination — only for {experience}
                <span className="block text-[12px] text-black/55">
                  Everywhere else stays on {shortName(location.town)}.
                </span>
              </span>
            </label>
          )}
          {location.hasDestination && (
            <button
              type="button"
              className={`${row} font-normal`}
              onClick={() => {
                location.followShared();
                onClose();
              }}
            >
              Back to my usual place
            </button>
          )}
          {location.town &&
            (location.home?.id === location.town.id ? (
              <button
                type="button"
                className={`${row} font-normal`}
                onClick={() => {
                  location.forgetHome();
                  onClose();
                }}
              >
                Forget {shortName(location.town)} as home
              </button>
            ) : (
              <button
                type="button"
                className={`${row} font-normal`}
                data-testid="location-make-home"
                onClick={() => {
                  location.makeHome(location.town!.id);
                  onClose();
                }}
              >
                Make {shortName(location.town)} my home
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
