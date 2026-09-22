"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AccountControl } from "@/components/auth/AccountControl";
import { destinationFor } from "@/domain/experience/destination";
import { formatEventWhen } from "@/domain/experience/eventTime";
import type { Experience } from "@/domain/experience/types";
import { didThis, forget } from "@/lib/october/october-repo";
import type { OctoberThing } from "@/lib/october/types";

/**
 * **An October waiting to be lived, and then the one that was.**
 *
 * Not a saved-items manager and not a dashboard. There are no counts in the
 * headings, no percentage, no checkbox. Two lists: what is Ahead and what has
 * been Lived, and one honest act between them — "Did this" — which is the only
 * way anything moves. Nothing here is ever inferred.
 *
 * A lived Thing is shown as the beginning of a memory: its name, the day, and
 * room for nothing else yet. Reactions and photos are the next layer and are
 * deliberately not here.
 */
interface MyOctoberProps {
  displayName: string;
  things: OctoberThing[];
  experiences: Experience[];
}

/** Ahead: dated things by date, undated after, newest intention first. */
function aheadOrder(a: OctoberThing, b: OctoberThing): number {
  if (a.startsAt && b.startsAt) return a.startsAt.localeCompare(b.startsAt);
  if (a.startsAt) return -1;
  if (b.startsAt) return 1;
  return b.wantedAt.localeCompare(a.wantedAt);
}

/** Lived: by the day it happened — the event's day, else the day they said so. */
const livedOn = (t: OctoberThing): string =>
  t.startsAt ?? t.livedAt ?? t.wantedAt;
const livedOrder = (a: OctoberThing, b: OctoberThing) =>
  livedOn(b).localeCompare(livedOn(a));

function dayOf(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function MyOctober({
  displayName,
  things: initial,
  experiences,
}: MyOctoberProps) {
  const [things, setThings] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  const byId = useMemo(
    () => new Map(experiences.map((e) => [e.id, e] as const)),
    [experiences],
  );

  const ahead = useMemo(
    () => things.filter((t) => t.state === "ahead").sort(aheadOrder),
    [things],
  );
  const lived = useMemo(
    () => things.filter((t) => t.state === "lived").sort(livedOrder),
    [things],
  );

  async function handleDid(thing: OctoberThing) {
    setBusy(thing.entityId);
    try {
      const updated = await didThis(thing.entityId);
      setThings((prev) =>
        prev.map((t) => (t.entityId === updated.entityId ? updated : t)),
      );
    } catch {
      toast.error("Couldn't record that. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleForget(thing: OctoberThing) {
    setBusy(thing.entityId);
    try {
      await forget(thing.entityId);
      setThings((prev) => prev.filter((t) => t.entityId !== thing.entityId));
    } catch {
      toast.error("Couldn't remove that. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const empty = things.length === 0;

  return (
    <main
      className="min-h-screen bg-[#ecdfc4]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 12% 8%, rgba(181,101,29,0.12), transparent 45%), radial-gradient(circle at 88% 92%, rgba(120,72,26,0.10), transparent 50%)",
      }}
    >
      <div className="mx-auto max-w-3xl px-6 py-14">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1" />
          <AccountControl displayName={displayName} returnTo="/october" />
        </div>

        <header className="mt-8">
          <p className="text-sm font-medium text-[#8a5a24]">October 2026</p>
          <h1 className="font-heading mt-1 text-4xl font-semibold tracking-tight text-[#2b2015] sm:text-5xl">
            My October
          </h1>
        </header>

        {empty ? (
          <section className="mt-12 max-w-md" data-testid="october-empty">
            <p className="font-heading text-2xl text-[#2b2015]">
              Nothing yet. That&apos;s the good part.
            </p>
            <p className="mt-3 text-[#2b2015]/65">
              Everything you decide to do this month will wait here, and
              everything you actually do will stay. Start with something you
              already want.
            </p>
            <Link
              href="/discovery"
              className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[#2b2015] px-5 text-sm font-medium text-[#f7ecd3]"
            >
              Find something
            </Link>
          </section>
        ) : (
          <>
            {/* ---------------------------------------------------- AHEAD */}
            <section
              className="mt-12"
              aria-labelledby="ahead"
              data-testid="october-ahead"
            >
              <h2 id="ahead" className="font-heading text-2xl text-[#2b2015]">
                Ahead
              </h2>
              {ahead.length === 0 ? (
                <p className="mt-3 text-sm text-[#2b2015]/55">
                  Nothing planned right now.{" "}
                  <Link
                    href="/discovery"
                    className="underline underline-offset-4"
                  >
                    Find something
                  </Link>
                  .
                </p>
              ) : (
                <ul className="mt-4 flex flex-col gap-3">
                  {ahead.map((thing) => (
                    <ThingRow
                      key={thing.entityId}
                      thing={thing}
                      experience={byId.get(thing.entityId)}
                      busy={busy === thing.entityId}
                      onDid={() => handleDid(thing)}
                      onForget={() => handleForget(thing)}
                    />
                  ))}
                </ul>
              )}
            </section>

            {/* ---------------------------------------------------- LIVED */}
            <section
              className="mt-14"
              aria-labelledby="lived"
              data-testid="october-lived"
            >
              <h2 id="lived" className="font-heading text-2xl text-[#2b2015]">
                Lived
              </h2>
              {lived.length === 0 ? (
                <p className="mt-3 text-sm text-[#2b2015]/55">
                  Not yet. When you do one of those, say so, and it stays here.
                </p>
              ) : (
                <ol className="mt-4 flex flex-col gap-4 border-l border-[#8a5a24]/25 pl-5">
                  {lived.map((thing) => (
                    <LivedRow
                      key={thing.entityId}
                      thing={thing}
                      experience={byId.get(thing.entityId)}
                      busy={busy === thing.entityId}
                      onForget={() => handleForget(thing)}
                    />
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function ThingRow({
  thing,
  experience,
  busy,
  onDid,
  onForget,
}: {
  thing: OctoberThing;
  experience?: Experience;
  busy: boolean;
  onDid: () => void;
  onForget: () => void;
}) {
  const destination = experience ? destinationFor(experience) : undefined;
  const when =
    thing.entityKind === "Event" && thing.startsAt
      ? formatEventWhen(thing.startsAt, experience?.endTime)
      : undefined;
  const where = experience?.context?.name;

  return (
    <li
      className="flex items-center gap-4 rounded-xl border border-[#8a5a24]/20 bg-white/60 p-3"
      data-testid="ahead-thing"
    >
      {experience?.heroMedia ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={experience.heroMedia.src}
          alt=""
          className="h-16 w-16 shrink-0 rounded-lg object-cover"
          loading="lazy"
        />
      ) : (
        <div
          className="h-16 w-16 shrink-0 rounded-lg bg-[#efe7d8]"
          aria-hidden
        />
      )}

      <div className="min-w-0 flex-1">
        {destination ? (
          <Link
            href={destination}
            className="font-medium text-[#2b2015] hover:underline"
          >
            {thing.name}
          </Link>
        ) : (
          <p className="font-medium text-[#2b2015]">{thing.name}</p>
        )}
        {when && (
          <p className="mt-0.5 text-xs font-medium text-[#8a5a24]">{when}</p>
        )}
        {where && <p className="mt-0.5 text-xs text-[#8a5a24]">at {where}</p>}
        {!when && !where && experience?.subtype && (
          <p className="mt-0.5 text-[11px] tracking-wide text-[#8a5a24] uppercase">
            {experience.subtype}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onDid}
          disabled={busy}
          className="min-h-9 rounded-full bg-[#2b2015] px-3.5 text-xs font-medium text-[#f7ecd3] hover:bg-[#3a2a1c] disabled:opacity-50"
          data-testid="did-this"
        >
          Did this
        </button>
        <button
          type="button"
          onClick={onForget}
          disabled={busy}
          aria-label={`Remove ${thing.name} from your October`}
          className="min-h-9 rounded-full px-2.5 text-xs text-[#2b2015]/50 hover:bg-[#2b2015]/5 disabled:opacity-50"
          data-testid="forget"
        >
          not this one
        </button>
      </div>
    </li>
  );
}

function LivedRow({
  thing,
  experience,
  busy,
  onForget,
}: {
  thing: OctoberThing;
  experience?: Experience;
  busy: boolean;
  onForget: () => void;
}) {
  const destination = experience ? destinationFor(experience) : undefined;
  return (
    <li className="relative" data-testid="lived-thing">
      <span
        aria-hidden
        className="absolute top-2 -left-[1.55rem] h-2.5 w-2.5 rounded-full bg-[#8a5a24]"
      />
      <p className="text-xs font-medium text-[#8a5a24]">
        {dayOf(livedOn(thing))}
      </p>
      {destination ? (
        <Link
          href={destination}
          className="font-heading text-xl text-[#2b2015] hover:underline"
        >
          {thing.name}
        </Link>
      ) : (
        <p className="font-heading text-xl text-[#2b2015]">{thing.name}</p>
      )}
      {experience?.context?.name && (
        <p className="text-sm text-[#2b2015]/60">{experience.context.name}</p>
      )}
      <button
        type="button"
        onClick={onForget}
        disabled={busy}
        className="mt-1 text-[11px] text-[#2b2015]/40 underline-offset-4 hover:underline disabled:opacity-50"
      >
        that didn&apos;t happen
      </button>
    </li>
  );
}
