"use client";

import { useState } from "react";
import { CalendarPlus, Navigation, Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { Experience } from "@/domain/experience/types";
import type { ItemView } from "@/lib/adventures/store";
import type { DayDetail } from "@/lib/adventures/propose";
import {
  calendarFile,
  countdown,
  preparations,
  shareText,
} from "@/lib/adventures/companion";
import { clockLabel, whenLabel, weekdayLabel } from "@/lib/adventures/present";
import { Picture } from "../Picture";
import { Eyebrow, pillClass } from "../kit";
import { directionsHref } from "./TodayPanel";

/**
 * **Before the day: something to look forward to.** How long to go, the
 * stops worth getting excited about (in the builder's own words for why
 * they're there), what to sort out first — taken only from what was recorded
 * for each stop — directions to the first one, and an easy way to tell a
 * friend. Nothing here claims a booking, a forecast or an opening time that
 * Passport doesn't have.
 */
export function Anticipation({
  adventureTitle,
  firstDay,
  today,
  stops,
  names,
  experiences,
  detail,
  adventureId,
}: {
  readonly adventureTitle: string;
  readonly firstDay: string;
  readonly today: string;
  readonly stops: readonly ItemView[];
  readonly names: Readonly<Record<string, string>>;
  readonly experiences: Readonly<Record<string, Experience>>;
  readonly detail: DayDetail | undefined;
  readonly adventureId: string;
}) {
  const [copied, setCopied] = useState(false);
  const left = countdown(firstDay, today);
  const nameOf = (item: ItemView) =>
    item.label ??
    (item.atlasRef
      ? (experiences[item.atlasRef]?.title ?? names[item.atlasRef])
      : undefined) ??
    "A stop";
  if (!left || stops.length === 0) return null;

  const stopDetail = (item: ItemView) =>
    item.atlasRef ? detail?.stops[item.atlasRef] : undefined;
  // Highlights: stops with a picture first, then the rest, in plan order.
  const withPicture = (item: ItemView) =>
    Boolean(
      item.atlasRef &&
      experiences[item.atlasRef] &&
      (experiences[item.atlasRef]!.heroMedia ||
        experiences[item.atlasRef]!.presentationImage ||
        experiences[item.atlasRef]!.contextualMedia),
    );
  const highlights = [
    ...stops.filter(withPicture),
    ...stops.filter((s) => !withPicture(s)),
  ].slice(0, 3);
  const preps = preparations(
    stops.map((s) => ({ name: nameOf(s), detail: stopDetail(s) })),
  );
  const first = stops[0]!;
  const firstArrive = stopDetail(first)?.arrive;

  async function share() {
    const text = shareText(
      adventureTitle,
      whenLabel(firstDay, null),
      stops.map(nameOf),
    );
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: adventureTitle, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied. Paste it wherever your people are.");
    } catch {
      // Cancelled the share sheet, or the clipboard is not allowed.
    }
  }

  function download() {
    const blob = new Blob(
      [calendarFile(adventureTitle, firstDay, adventureId)],
      {
        type: "text/calendar",
      },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "adventure.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section
      aria-labelledby="anticipation-heading"
      data-testid="anticipation"
      className="overflow-hidden rounded-[28px] bg-[var(--gh-forest)] text-white"
    >
      <div className="grid gap-6 p-5 sm:p-8 md:grid-cols-[auto_1fr] md:gap-10">
        <div className="text-center md:text-left">
          <Eyebrow className="!text-white/80">
            {weekdayLabel(firstDay)} · {whenLabel(firstDay, null)}
          </Eyebrow>
          <p
            data-testid="countdown"
            className="ghad-display mt-1 text-7xl leading-none font-extrabold tracking-[-0.05em] sm:text-8xl"
          >
            {left.big}
          </p>
          <p className="mt-1 text-lg font-semibold">{left.small}</p>
        </div>

        <div className="min-w-0 space-y-5">
          <h2
            id="anticipation-heading"
            className="ghad-display text-2xl leading-tight font-extrabold tracking-[-0.02em] sm:text-3xl"
          >
            Here&apos;s what you&apos;re looking forward to
          </h2>
          <ul
            className="grid gap-3 sm:grid-cols-3"
            data-testid="highlights"
            aria-label="Highlights"
          >
            {highlights.map((item) => (
              <li
                key={item.id}
                className="overflow-hidden rounded-2xl bg-white text-[var(--gh-ink)]"
              >
                <Picture
                  experience={
                    item.atlasRef ? experiences[item.atlasRef] : undefined
                  }
                  fallbackTitle={nameOf(item)}
                  showLabel={false}
                  className="aspect-[4/3] w-full"
                />
                <div className="p-3">
                  <p className="ghad-display leading-tight font-extrabold">
                    {nameOf(item)}
                  </p>
                  {stopDetail(item)?.because && (
                    <p className="mt-1 line-clamp-3 text-sm text-[var(--gh-ink-soft)]">
                      {stopDetail(item)!.because}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {preps.length > 0 && (
            <div data-testid="preparations">
              <p className="flex items-center gap-2 text-sm font-bold tracking-[0.12em] uppercase">
                <Sparkles className="h-4 w-4" aria-hidden />
                Before you go
              </p>
              <ul className="mt-2 space-y-1.5 text-base">
                {preps.map((p, i) => (
                  <li key={`${p.stop}-${i}`}>
                    <span className="font-semibold">{p.stop}:</span> {p.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-sm text-white/85" data-testid="booking-note">
            Passport hasn&apos;t booked or reserved anything, and can&apos;t see
            availability. If a place needs a booking, that&apos;s with them.
          </p>

          <div className="flex flex-wrap gap-2">
            <a
              href={directionsHref(
                first.atlasRef ? experiences[first.atlasRef] : undefined,
                nameOf(first),
              )}
              target="_blank"
              rel="noreferrer"
              data-testid="first-directions"
              className={pillClass("light")}
            >
              <Navigation className="h-4 w-4" aria-hidden />
              Directions to {nameOf(first)}
              {firstArrive !== undefined ? ` · ${clockLabel(firstArrive)}` : ""}
            </a>
            <button
              type="button"
              data-testid="share-adventure"
              onClick={() => void share()}
              className={pillClass("light")}
            >
              <Share2 className="h-4 w-4" aria-hidden />
              {copied ? "Copied" : "Tell someone"}
            </button>
            <button
              type="button"
              data-testid="add-to-calendar"
              onClick={download}
              className={pillClass("light")}
            >
              <CalendarPlus className="h-4 w-4" aria-hidden />
              Add to calendar
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
