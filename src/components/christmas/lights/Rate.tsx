"use client";

import { useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import {
  RATING_TAGS,
  type PinView,
  type RatingTagId,
} from "@/domain/christmas/lights/model";
import { send, signInHref } from "./api";

/** A display's community rating as it stands: real stars, how many, or "not rated yet". */
export function Stars({
  rating,
  light = false,
}: {
  readonly rating: PinView["rating"];
  readonly light?: boolean;
}) {
  if (!rating)
    return (
      <span
        className={`text-sm ${light ? "text-white/70" : "text-[#5b4a2e]"}`}
        data-testid="stars"
      >
        Not rated yet
      </span>
    );
  return (
    <span
      className={`inline-flex items-center gap-1 text-sm font-bold ${light ? "text-white" : "text-[#082319]"}`}
      data-testid="stars"
      aria-label={`Rated ${rating.mean} out of 5 by ${rating.count} ${rating.count === 1 ? "person" : "people"}`}
    >
      <Star className="h-4 w-4 fill-[#e3a83b] text-[#e3a83b]" aria-hidden />
      {rating.mean.toFixed(1)}
      <span className={light ? "text-white/70" : "text-[#5b4a2e]"}>
        ({rating.count})
      </span>
    </span>
  );
}

/**
 * **"How magical was it?"** One to five stars and, if they like, a tag or
 * two. One rating per account per display each season; rating again changes
 * it. Signed in, so one person can't be a crowd.
 */
export function Rate({
  pin,
  signedIn,
  onRated,
  next,
}: {
  readonly pin: PinView;
  readonly signedIn: boolean;
  readonly onRated?: (pin: PinView) => void;
  /** Where sign-in should bring them back to. */
  readonly next?: string;
}) {
  const [stars, setStars] = useState(pin.myRating?.stars ?? 0);
  const [tags, setTags] = useState<RatingTagId[]>([
    ...(pin.myRating?.tags ?? []),
  ]);
  const [say, setSay] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(!!pin.myRating);

  if (pin.status !== "approved") return null;
  if (pin.yours)
    return (
      <p className="text-sm text-[#5b4a2e]" data-testid="rate-own">
        These are your lights — other families rate them.
      </p>
    );

  async function sendIt(n: number, t: RatingTagId[]) {
    if (!signedIn) {
      setSay("signin");
      return;
    }
    setBusy(true);
    const r = await send(`/christmas/api/lights/${pin.id}`, {
      action: "rate",
      stars: n,
      tags: t,
    });
    setBusy(false);
    if (r.ok && r.pin) {
      setDone(true);
      setSay(null);
      onRated?.(r.pin);
    } else
      setSay(
        r.signIn ? "signin" : (r.error ?? "That didn't send — try again."),
      );
  }

  return (
    <div data-testid="rate" className="text-[#082319]">
      <p className="font-extrabold">How magical was it?</p>
      <div
        className="mt-1 flex gap-1"
        role="radiogroup"
        aria-label="How magical was it?"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={stars === n}
            aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
            disabled={busy}
            onClick={() => {
              setStars(n);
              setDone(false);
              void sendIt(n, tags);
            }}
            className="rounded-full p-1.5 active:scale-90 motion-reduce:transition-none"
            data-testid={`star-${n}`}
          >
            <Star
              className={`h-8 w-8 ${n <= stars ? "fill-[#e3a83b] text-[#e3a83b]" : "text-[#0f3b2b]/30"}`}
              aria-hidden
            />
          </button>
        ))}
      </div>
      {stars > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Tags">
          {RATING_TAGS.map((t) => {
            const on = tags.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                disabled={busy}
                onClick={() => {
                  const next = on
                    ? tags.filter((x) => x !== t.id)
                    : [...tags, t.id];
                  setTags(next);
                  void sendIt(stars, next);
                }}
                className={`min-h-9 rounded-full px-3 text-xs font-bold ${on ? "bg-[#0f3b2b] text-white" : "ring-1 ring-[#0f3b2b]/20"}`}
                data-testid={`tag-${t.id}`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}
      {done && !say && (
        <p className="mt-2 text-sm font-bold text-[#0f3b2b]" role="status">
          Thanks — your {stars}★ is counted.
        </p>
      )}
      {say === "signin" ? (
        <p className="mt-2 text-sm text-[#5b4a2e]" role="status">
          Ratings need an account, so one person can&apos;t be a crowd.{" "}
          <Link
            className="font-bold underline"
            href={signInHref(next ?? `/christmas/lights/${pin.id}`)}
          >
            Sign in to rate
          </Link>
        </p>
      ) : say ? (
        <p className="mt-2 text-sm text-[#b3242f]" role="status">
          {say}
        </p>
      ) : null}
    </div>
  );
}
