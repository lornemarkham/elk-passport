"use client";

import Link from "next/link";
import type { Possibility } from "@/lib/labs/october/possibility";
import { CardWhen, Shot, When } from "../atoms";
import { LabKeep } from "../LabKeep";

/**
 * **Three weights of the same card, and the rule about pictures.**
 *
 * Experiment A needed a hero, D needed a scannable row, and both needed the
 * same thing from an un-photographed possibility: a deliberate compact
 * treatment rather than an empty frame. So the weights live together, and the
 * rule — *good image, use it; no image, shrink it; wrong image, never* — is
 * written once.
 */

/**
 * Where a sign-in comes back to, and where a detail page returns to.
 *
 * The production route, because that is the one people are on — the lab route
 * renders the same surface and a visitor who signs in from it lands on the
 * real Discover, which is where they wanted to be anyway.
 */
export const HERE = "/october/discover";

const WORDS = {
  idle: "Choose",
  done: "Chosen",
  signIn: "Sign in to choose",
} as const;

export interface CardProps {
  readonly p: Possibility;
  readonly saved: boolean;
  readonly signedIn: boolean;
  readonly because?: string;
}

/** The one thing at the top. It must have a photograph; the page enforces it. */
export function Lead({ p, saved, signedIn, because }: CardProps) {
  return (
    <article
      data-testid="lead"
      data-source={p.source}
      className="overflow-hidden rounded-2xl border border-[#e9e6da]/10"
    >
      <Link href={p.href} className="block">
        <Shot p={p} className="aspect-[16/9] w-full sm:aspect-[21/9]" />
      </Link>
      <div className="p-5 sm:p-6">
        <When p={p} />
        <h2 className="font-heading mt-2 text-3xl leading-tight text-balance text-[#f3efe4] sm:text-4xl">
          <Link href={p.href} className="hover:text-white">
            {p.title}
          </Link>
        </h2>
        {p.line ? (
          <p className="mt-2 max-w-xl leading-relaxed text-[#e9e6da]/60">
            {clip(p.line, 180)}
          </p>
        ) : null}
        {because ? (
          <p className="mt-2 text-sm text-[#d09a4e]/85">{because}</p>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <LabKeep
            p={p}
            saved={saved}
            signedIn={signedIn}
            returnTo={HERE}
            big
            words={WORDS}
          />
          <Link
            href={p.href}
            className="inline-flex min-h-11 items-center text-sm text-[#e9e6da]/50 underline-offset-4 hover:text-[#e9e6da] hover:underline"
          >
            Tell me more →
          </Link>
        </div>
      </div>
    </article>
  );
}

/**
 * A tile in an editorial section.
 *
 * **Without a photograph it does not get a picture-shaped box.** The earlier
 * version put the date, large, in the slot a photograph would have filled, and
 * in use that read as a broken image rather than as a treatment — "THU · 8 PM"
 * centred in a tinted rectangle looks like something failed to load. A tile
 * with no photograph is now simply a text tile: the time as an eyebrow, the
 * title at the size the picture is not there to carry.
 */
export function Tile({ p, saved, signedIn, because }: CardProps) {
  const has = Boolean(p.image);
  return (
    <article
      data-testid="tile"
      data-source={p.source}
      data-has-image={has ? "true" : "false"}
      className="flex flex-col overflow-hidden rounded-xl border border-[#e9e6da]/10 transition-colors hover:border-[#d09a4e]/35"
    >
      {has ? (
        <Link href={p.href}>
          <Shot p={p} className="aspect-[4/3] w-full" />
        </Link>
      ) : null}
      <div
        className={`flex flex-1 flex-col p-4 ${has ? "" : "justify-center"}`}
      >
        {has ? (
          <CardWhen p={p} />
        ) : (
          <p className="text-[10px] tracking-[0.18em] text-[#d09a4e] uppercase tabular-nums">
            {p.availability.label}
          </p>
        )}
        <h3
          className={`font-heading mt-1.5 leading-tight text-[#f3efe4] ${has ? "text-lg" : "text-xl"}`}
        >
          <Link href={p.href} className="hover:text-white">
            {p.title}
          </Link>
        </h3>
        {p.line ? (
          <p className="mt-1.5 text-sm leading-snug text-[#e9e6da]/55">
            {clip(p.line, 96)}
          </p>
        ) : null}
        {because ? (
          <p className="mt-2 text-sm leading-snug text-[#d09a4e]/85">
            {because}
          </p>
        ) : null}
        <div className="mt-auto pt-4">
          <LabKeep
            p={p}
            saved={saved}
            signedIn={signedIn}
            returnTo={HERE}
            words={WORDS}
          />
        </div>
      </div>
    </article>
  );
}

/**
 * The scannable row — what a list of results is made of.
 *
 * With a photograph it gets 200px of one. Without, it gets an ember rule and
 * more room for its sentence: smaller, never broken, never excluded.
 */
export function Row({
  p,
  saved,
  signedIn,
  because,
  note,
}: CardProps & {
  readonly note?: string;
}) {
  const has = Boolean(p.image);
  return (
    <article
      data-testid="row"
      data-source={p.source}
      data-has-image={has ? "true" : "false"}
      className="flex gap-4 rounded-lg border border-[#e9e6da]/10 p-3 transition-colors hover:border-[#d09a4e]/35"
    >
      {has ? (
        <Link href={p.href} className="shrink-0">
          <Shot p={p} className="h-24 w-32 rounded-md sm:h-28 sm:w-48" />
        </Link>
      ) : (
        <span
          aria-hidden
          className="w-1 shrink-0 rounded-full bg-[#d09a4e]/25"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-[10px] tracking-[0.18em] text-[#d09a4e] uppercase tabular-nums">
          {p.availability.label}
          {p.locality ? (
            <span className="text-[#e9e6da]/30"> · {p.locality}</span>
          ) : null}
        </p>
        <h3 className="font-heading mt-1 text-lg leading-tight text-[#f3efe4]">
          <Link href={p.href} className="hover:text-white">
            {p.title}
          </Link>
        </h3>
        {note ? (
          <p className="mt-1 text-sm text-[#d09a4e]/85">{note}</p>
        ) : p.line ? (
          <p className="mt-1 text-sm leading-snug text-[#e9e6da]/50">
            {clip(p.line, has ? 120 : 170)}
          </p>
        ) : null}
        {because ? (
          <p className="mt-1 text-sm text-[#d09a4e]/85">{because}</p>
        ) : null}
        <div className="mt-2.5">
          <LabKeep
            p={p}
            saved={saved}
            signedIn={signedIn}
            returnTo={HERE}
            words={WORDS}
          />
        </div>
      </div>
    </article>
  );
}

export function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(" "));
  return `${cut.slice(0, stop > max * 0.5 ? stop : max).trim()}…`;
}
