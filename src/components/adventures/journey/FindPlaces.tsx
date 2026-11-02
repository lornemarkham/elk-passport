"use client";

import { useState } from "react";
import { MapPin, Navigation, Plus, Search } from "lucide-react";
import type { Experience } from "@/domain/experience/types";
import {
  ideaActivity,
  type IdeaAnswer,
  type PlaceOption,
} from "@/domain/occasion/ideas";
import { placeLabel } from "@/domain/discovery/compose";
import { weekdayLabel } from "@/lib/adventures/present";
import { Picture } from "../Picture";
import { pillClass } from "../kit";
import { directionsHref } from "./TodayPanel";

/** Whether Passport recognises an activity in what somebody typed. */
export const namesAnActivity = (said: string): boolean =>
  Boolean(ideaActivity(said));

/**
 * **"Great idea — here's where you could do it."**
 *
 * Asks `…/find` for the places Atlas's words put in the activity somebody
 * typed, and shows each with what a person needs to choose: a picture, how
 * far, the words Atlas lists, and the place's own hours, prices or
 * rentals. Choosing one adds it the ordinary way (`POST …/items`); the idea
 * it came from, if there was one, gives way to it.
 */
export function FindPlaces({
  said,
  days,
  isOwner,
  busy,
  act,
  call,
  replaces,
  onDone,
}: {
  readonly said: string;
  readonly days: readonly string[];
  readonly isOwner: boolean;
  readonly busy: boolean;
  readonly act: (
    work: () => Promise<unknown>,
    done?: string,
  ) => Promise<boolean>;
  readonly call: <T = unknown>(
    path: string,
    method: string,
    body?: unknown,
  ) => Promise<T>;
  /** The text-only idea a chosen place stands in for. */
  readonly replaces?: string;
  readonly onDone?: () => void;
}) {
  const [found, setFound] = useState<IdeaAnswer | null>(null);
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const look = async () => {
    setLooking(true);
    setError(null);
    try {
      setFound(
        await call<IdeaAnswer>(`/find?q=${encodeURIComponent(said)}`, "GET"),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLooking(false);
    }
  };

  const choose = (experience: Experience, onDay: string | null) =>
    act(
      async () => {
        await call("/items", "POST", {
          atlasRef: experience.id,
          onDay,
          note: said.slice(0, 1000),
          ...(isOwner && onDay ? { status: "confirmed" } : {}),
        });
        if (replaces) await call(`/items/${replaces}`, "DELETE");
      },
      onDay
        ? `${experience.title} is on ${weekdayLabel(onDay)}.`
        : `${experience.title} is in the ideas.`,
    ).then((ok) => {
      if (ok) {
        setFound(null);
        onDone?.();
      }
    });

  if (!found)
    return (
      <div className="mt-3">
        <button
          type="button"
          data-testid="find-places"
          disabled={looking || busy}
          onClick={() => void look()}
          className={pillClass("forest")}
        >
          <Search className="h-4 w-4" aria-hidden />
          {looking ? "Looking…" : "Find somewhere to do this"}
        </button>
        {error && (
          <p role="alert" className="mt-2 text-sm text-[var(--gh-berry)]">
            {error}
          </p>
        )}
      </div>
    );

  const shown = found.options.length > 0 ? found.options : found.further;
  return (
    <section
      data-testid="found-places"
      aria-label={`Places for ${found.activity?.label ?? said}`}
      className="mt-4 rounded-3xl bg-[var(--gh-cream)] p-4"
    >
      {!found.activity ? (
        <p className="text-base">
          Passport doesn&apos;t recognise an activity in “{said}”, so it stays
          your own idea.
        </p>
      ) : (
        <>
          <p className="ghad-display text-xl font-extrabold">
            {shown.length > 0
              ? found.options.length > 0
                ? `Great idea. Here's where you could go ${found.activity.label.toLowerCase()}.`
                : `Nothing close for ${found.activity.label.toLowerCase()} — the nearest Atlas knows:`
              : `${found.activity.label}: nowhere Atlas knows yet.`}
          </p>
          {found.season && (
            <p className="mt-1 text-sm text-[var(--gh-ink-soft)]">
              {found.season}
            </p>
          )}
          <ul className="mt-3 space-y-3">
            {shown.map((option) => (
              <li key={option.experience.id}>
                <PlaceChoice
                  option={option}
                  days={days}
                  busy={busy}
                  choose={choose}
                />
              </li>
            ))}
          </ul>
          {found.gap && (
            <p
              className="mt-3 text-sm text-[var(--gh-ink-soft)]"
              data-testid="found-gap"
            >
              {found.gap}
            </p>
          )}
        </>
      )}
      <button
        type="button"
        onClick={() => setFound(null)}
        className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold underline"
      >
        Close
      </button>
    </section>
  );
}

function PlaceChoice({
  option,
  days,
  busy,
  choose,
}: {
  readonly option: PlaceOption;
  readonly days: readonly string[];
  readonly busy: boolean;
  readonly choose: (e: Experience, onDay: string | null) => Promise<void>;
}) {
  const e = option.experience;
  const where = placeLabel(e);
  return (
    <article
      data-testid="place-choice"
      className="flex gap-3 rounded-3xl bg-white p-3"
    >
      <Picture
        experience={e}
        showLabel={false}
        fallbackTitle={e.title}
        className="aspect-square w-24 shrink-0 rounded-2xl"
      />
      <div className="min-w-0 flex-1">
        <p className="ghad-display text-lg leading-tight font-extrabold">
          {e.title}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-sm text-[var(--gh-ink-soft)]">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {[where, option.km !== undefined ? `${option.km} km away` : null]
            .filter(Boolean)
            .join(" · ") || "Atlas hasn't placed it on a map"}
        </p>
        <p className="mt-1 text-sm">
          Atlas lists <strong>{option.listed.slice(0, 2).join(", ")}</strong>
        </p>
        {option.onTheDay && (
          <p className="text-sm font-semibold">{option.onTheDay}</p>
        )}
        {option.facts.length > 0 && (
          <dl className="mt-1 space-y-0.5 text-sm text-[var(--gh-ink-soft)]">
            {option.facts.slice(0, 2).map((f) => (
              <div key={`${f.label}${f.value}`}>
                <dt className="inline font-semibold">{f.label}: </dt>
                <dd className="inline">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {days.slice(0, 3).map((d) => (
            <button
              key={d}
              type="button"
              disabled={busy}
              onClick={() => void choose(e, d)}
              aria-label={`Add ${e.title} to ${weekdayLabel(d)}`}
              className={pillClass("forest")}
            >
              <Plus className="h-4 w-4" aria-hidden />
              {days.length === 1 ? "Add to the day" : weekdayLabel(d)}
            </button>
          ))}
          {days.length === 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void choose(e, null)}
              className={pillClass("forest")}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Use this place
            </button>
          )}
          <a
            href={directionsHref(e, e.title)}
            target="_blank"
            rel="noreferrer"
            className={pillClass("quiet")}
          >
            <Navigation className="h-4 w-4" aria-hidden />
            Directions
          </a>
        </div>
      </div>
    </article>
  );
}
