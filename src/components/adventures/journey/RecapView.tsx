"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BookOpen,
  Check,
  Heart,
  Repeat,
  Share2,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { Experience } from "@/domain/experience/types";
import {
  recapLine,
  recapOf,
  shareText,
  type Memory,
} from "@/lib/adventures/companion";
import { Picture } from "../Picture";
import { Eyebrow, pillClass } from "../kit";
import { useDevice } from "./useDevice";

export interface RecapStopInput {
  readonly id: string;
  readonly name: string;
  readonly experience: Experience | undefined;
}

export interface SharedMoment {
  readonly id: string;
  readonly by: string;
  readonly text: string | null;
  readonly hasPhoto: boolean;
  readonly mine: boolean;
}

/**
 * **The recap: what the day actually was.** Built from what this person
 * marked and kept on their phone — done, skipped, favourites, notes, photos —
 * so it never claims a stop happened that nobody said happened. Personal
 * memories stay private; sharing one with the group is a button on that
 * memory, nothing else (ADR 014). Ends with the way to another adventure
 * (doctrine §2.9, §2.10).
 */
export function RecapView({
  adventureId,
  title,
  when,
  onDay,
  stops,
  againHref,
  members,
  shared,
  sharingOff,
}: {
  readonly adventureId: string;
  readonly title: string;
  readonly when: string | null;
  readonly onDay: string;
  readonly stops: readonly RecapStopInput[];
  readonly againHref: string;
  /** People on the adventure besides you; sharing is offered only if > 0. */
  readonly members: number;
  readonly shared: readonly SharedMoment[];
  /** The shared-moments tables aren't applied yet. */
  readonly sharingOff: boolean;
}) {
  const device = useDevice(adventureId, onDay);
  const [sent, setSent] = useState<readonly string[]>([]);
  const recap = recapOf(
    stops.map((s) => ({ id: s.id, name: s.name })),
    device.done,
    device.skipped,
    device.memories,
    Boolean(device.started),
  );
  const experienceOf = new Map(stops.map((s) => [s.id, s.experience]));
  const cover =
    recap.stops.find((s) => s.photos.length > 0)?.photos[0]?.photo ?? null;
  const canShare = members > 0 && !sharingOff;

  async function shareWithGroup(m: Memory) {
    const res = await fetch(`/api/adventures/${adventureId}/moments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "moment",
        text: m.text,
        photo: m.photo ? m.photo.slice(m.photo.indexOf(",") + 1) : null,
      }),
    });
    if (res.ok) {
      setSent((prev) => [...prev, m.id]);
      toast.success("Shared with the people on this adventure.");
    } else {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(json.error ?? "That didn't send. Try again in a moment.");
    }
  }

  async function shareRecap() {
    const text = [
      shareText(
        title,
        when,
        stops.map((s) => s.name),
      ),
      "",
      recapLine(recap, stops.length),
    ].join("\n");
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast.success("Copied. Paste it wherever your people are.");
    } catch {
      // Cancelled.
    }
  }

  const empty =
    device.ready &&
    recap.doneCount === 0 &&
    recap.skippedCount === 0 &&
    device.memories.length === 0;

  return (
    <div className="space-y-10" data-testid="recap">
      <section className="relative isolate overflow-hidden rounded-[28px] bg-[var(--gh-forest)] text-white">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element -- the person's own photo, on their device
          <img
            src={cover}
            alt="Your photo from the day"
            className="absolute inset-0 -z-10 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
        <div className="flex min-h-[18rem] flex-col justify-end gap-3 p-6 sm:p-10">
          <Eyebrow className="!text-white/85">The recap</Eyebrow>
          <h1 className="ghad-display text-4xl leading-[0.98] font-extrabold tracking-[-0.04em] text-balance sm:text-6xl">
            {title}
          </h1>
          {when && <p className="text-lg font-semibold">{when}</p>}
          <p data-testid="recap-line" className="text-lg font-semibold">
            {device.ready ? recapLine(recap, stops.length) : " "}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="share-recap"
              onClick={() => void shareRecap()}
              className={pillClass("light")}
            >
              <Share2 className="h-4 w-4" aria-hidden />
              Share the recap
            </button>
            <Link
              href={`/adventures/${encodeURIComponent(adventureId)}/guide#afterwards`}
              className={pillClass("light")}
            >
              <BookOpen className="h-4 w-4" aria-hidden />
              Printable guide
            </Link>
          </div>
        </div>
      </section>

      {empty && (
        <p
          data-testid="recap-empty"
          className="rounded-3xl bg-[var(--gh-cream)] p-5 text-base"
        >
          Nothing kept from this day yet. Photos and notes you keep while
          you&apos;re signed in follow you to your other devices, and stay yours
          alone. You can still write down what happened in the guide.
        </p>
      )}

      {recap.favourites.length > 0 && (
        <section aria-labelledby="loved" data-testid="recap-favourites">
          <h2
            id="loved"
            className="ghad-display flex items-center gap-2 text-3xl font-extrabold tracking-[-0.03em]"
          >
            <Heart
              className="h-6 w-6 fill-current text-[var(--gh-berry)]"
              aria-hidden
            />
            The favourites
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {recap.favourites.map((s) => (
              <li
                key={s.id}
                className="rounded-full bg-[var(--gh-sand)] px-4 py-2 text-base font-semibold"
              >
                {s.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ol className="space-y-6" aria-label="The day, stop by stop">
        {recap.stops.map((s, i) => (
          <li
            key={s.id}
            data-testid="recap-stop"
            className="overflow-hidden rounded-[28px] bg-[var(--gh-cream)]"
          >
            <div className="flex flex-col sm:flex-row">
              <Picture
                experience={experienceOf.get(s.id)}
                fallbackTitle={s.name}
                showLabel={false}
                className="aspect-[16/9] w-full shrink-0 sm:aspect-auto sm:w-56"
              />
              <div className="min-w-0 flex-1 space-y-3 p-5">
                <p className="text-xs font-bold tracking-[0.12em] text-[var(--gh-ink-soft)] uppercase">
                  Stop {i + 1} ·{" "}
                  {s.done ? "Done" : s.skipped ? "Skipped" : "Not marked"}
                </p>
                <h2 className="ghad-display flex items-center gap-2 text-2xl font-extrabold">
                  {s.name}
                  {s.favourite && (
                    <Heart
                      className="h-5 w-5 fill-current text-[var(--gh-berry)]"
                      aria-label="Favourite"
                    />
                  )}
                </h2>
                {s.notes.map((n) => (
                  <Entry
                    key={n.id}
                    memory={n}
                    onForget={device.forget}
                    onShare={canShare ? shareWithGroup : undefined}
                    sent={sent.includes(n.id)}
                  />
                ))}
                {s.photos.length > 0 && (
                  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {s.photos.map((p) => (
                      <li key={p.id} className="space-y-1">
                        {/* eslint-disable-next-line @next/next/no-img-element -- the person's own photo, on their device */}
                        <img
                          src={p.photo!}
                          alt={`Your photo at ${s.name}`}
                          className="aspect-square w-full rounded-2xl object-cover"
                        />
                        <MemoryButtons
                          memory={p}
                          onForget={device.forget}
                          onShare={canShare ? shareWithGroup : undefined}
                          sent={sent.includes(p.id)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      {recap.loose.length > 0 && (
        <section aria-labelledby="loose" className="space-y-3">
          <h2
            id="loose"
            className="ghad-display text-3xl font-extrabold tracking-[-0.03em]"
          >
            From the day
          </h2>
          {recap.loose.map((m) =>
            m.kind === "photo" ? (
              <div key={m.id} className="max-w-xs space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- the person's own photo, on their device */}
                <img
                  src={m.photo!}
                  alt="Your photo from the day"
                  className="w-full rounded-2xl"
                />
                <MemoryButtons
                  memory={m}
                  onForget={device.forget}
                  onShare={canShare ? shareWithGroup : undefined}
                  sent={sent.includes(m.id)}
                />
              </div>
            ) : (
              <Entry
                key={m.id}
                memory={m}
                onForget={device.forget}
                onShare={canShare ? shareWithGroup : undefined}
                sent={sent.includes(m.id)}
              />
            ),
          )}
        </section>
      )}

      {(shared.length > 0 || canShare) && (
        <section
          aria-labelledby="group"
          data-testid="recap-shared"
          className="rounded-[28px] bg-[var(--gh-sand)] p-5 sm:p-7"
        >
          <h2
            id="group"
            className="ghad-display flex items-center gap-2 text-2xl font-extrabold"
          >
            <Users className="h-6 w-6" aria-hidden />
            Shared with the group
          </h2>
          <p className="mt-1 text-base text-[var(--gh-ink-soft)]">
            Only what someone chose to share, and only people on this adventure
            see it. Your own memories above are private to you — on your phone
            and your account — until you share one.
          </p>
          {shared.length === 0 ? (
            <p className="mt-3 text-base">Nothing shared yet.</p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {shared.map((m) => (
                <li key={m.id} className="rounded-2xl bg-white p-3">
                  {m.hasPhoto && (
                    // eslint-disable-next-line @next/next/no-img-element -- served by our own route, membership-checked
                    <img
                      src={`/api/adventures/${encodeURIComponent(adventureId)}/moments/${encodeURIComponent(m.id)}/photo`}
                      alt={`Shared by ${m.by}`}
                      loading="lazy"
                      className="mb-2 w-full rounded-xl"
                    />
                  )}
                  {m.text && <p className="text-base">{m.text}</p>}
                  <p className="mt-1 text-xs font-semibold text-[var(--gh-ink-soft)]">
                    {m.mine ? "You" : m.by}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {sharingOff && members > 0 && (
        <p
          data-testid="sharing-off"
          className="rounded-3xl bg-[var(--gh-cream)] p-4 text-sm"
        >
          Sharing with the group isn&apos;t switched on yet, so memories stay on
          your phone.
        </p>
      )}

      <section
        data-testid="recap-next"
        className="rounded-[28px] bg-[var(--gh-ink)] p-6 text-white sm:p-10"
      >
        <p className="ghad-display text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
          One hell of a day? Go have another.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={againHref}
            data-testid="recap-again"
            className={pillClass("light")}
          >
            <Repeat className="h-4 w-4" aria-hidden />
            Do it again
          </Link>
          <Link
            href="/adventures/new"
            data-testid="recap-new"
            className={pillClass("light")}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Start a new adventure
          </Link>
          <Link href="/discovery" className={pillClass("light")}>
            Find something new
          </Link>
        </div>
      </section>

      {!device.saved && (
        <p role="status" className="text-sm font-semibold">
          This phone couldn&apos;t keep your last change.
        </p>
      )}
    </div>
  );
}

function MemoryButtons({
  memory,
  onForget,
  onShare,
  sent,
}: {
  readonly memory: Memory;
  readonly onForget: (id: string) => void;
  readonly onShare: ((m: Memory) => Promise<void>) | undefined;
  readonly sent: boolean;
}) {
  return (
    <span className="flex flex-wrap gap-1">
      {onShare && (
        <button
          type="button"
          data-testid="share-memory"
          disabled={sent}
          onClick={() => void onShare(memory)}
          className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold underline disabled:no-underline disabled:opacity-60"
        >
          {sent ? (
            <>
              <Check className="h-4 w-4" aria-hidden />
              Shared
            </>
          ) : (
            "Share with the group"
          )}
        </button>
      )}
      <button
        type="button"
        data-testid="forget-memory"
        onClick={() => onForget(memory.id)}
        className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-[var(--gh-ink-soft)]"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        Delete
      </button>
    </span>
  );
}

function Entry(props: {
  readonly memory: Memory;
  readonly onForget: (id: string) => void;
  readonly onShare: ((m: Memory) => Promise<void>) | undefined;
  readonly sent: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white p-3">
      <p className="text-base">{props.memory.text}</p>
      <MemoryButtons {...props} />
    </div>
  );
}
