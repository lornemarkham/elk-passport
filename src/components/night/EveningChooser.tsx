"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Car, Check, Dices, Heart } from "lucide-react";
import type { NightDay } from "@/domain/date-night/adventures";
import {
  composeDay,
  DEFAULT_ANSWERS,
  type DayAnswers,
} from "@/domain/date-night/adventures/compose";
import {
  eveningQuery,
  type Evening,
} from "@/domain/date-night/adventures/evenings";
import type { Mood } from "@/domain/date-night/adventures";
import { cn } from "@/lib/utils";

async function send(url: string, method: string, body: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(String(response.status));
}

const MOODS: readonly Mood[] = ["romantic", "adventurous", "cozy", "playful"];

/** Two moods and a coin toss on the plunge; the composer does the rest. */
function surpriseAnswers(random: () => number = Math.random): DayAnswers {
  const first = MOODS[Math.floor(random() * MOODS.length)]!;
  const rest = MOODS.filter((m) => m !== first);
  return {
    ...DEFAULT_ANSWERS,
    when: "evening",
    moods: [first, rest[Math.floor(random() * rest.length)]!],
    plunge: random() < 0.5,
  };
}

/**
 * **Pick your trouble.** The evenings as big photographs you swipe through,
 * each with the drive, a few highlights and one button. The owner's tap
 * makes it the plan (the shared adventure's own `PATCH` and day); anyone
 * else's sends it to the owner as a suggestion, because the day is theirs to
 * change (RLS).
 */
export function EveningChooser({
  adventureId,
  isOwner,
  day,
  evenings,
  chosen,
  hasDay,
  ownerName,
}: {
  readonly adventureId: string;
  readonly isOwner: boolean;
  readonly day: NightDay;
  readonly evenings: readonly Evening[];
  readonly chosen: Evening | undefined;
  /** The adventure already has places on the day. */
  readonly hasDay: boolean;
  readonly ownerName: string | null;
}) {
  const router = useRouter();
  const strip = useRef<HTMLOListElement>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function show(index: number) {
    const card = strip.current?.children[index] as HTMLElement | undefined;
    card?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }

  async function choose(evening: Evening) {
    setBusy(evening.id);
    try {
      if (!isOwner) {
        await send(`/api/adventures/${adventureId}/items`, "POST", {
          label: `Let's do ${evening.title}`,
        });
        toast.success(
          `Suggested. ${ownerName ?? "The planner"} will see it with the other ideas.`,
        );
        router.refresh();
        return;
      }
      const query =
        evening.id === "surprise"
          ? `${composeDay(day, surpriseAnswers()).query}&evening=surprise`
          : eveningQuery(evening, day);
      await send(`/api/adventures/${adventureId}`, "PATCH", {
        startsOn: day.on,
        timeZone: day.timeZone,
        destinationTownId: day.townId,
        destinationLabel: evening.title,
      });
      if (query)
        await send(`/api/adventures/${adventureId}/days`, "POST", {
          query,
          mode: "propose",
        });
      else if (hasDay)
        await send(`/api/adventures/${adventureId}/days`, "POST", {
          clear: day.on,
        });
      router.refresh();
      document
        .getElementById("plan")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      toast.error("That didn't save. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="The evenings"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-4 sm:hidden"
      >
        {evenings.map((e, i) => (
          <button
            key={e.id}
            role="tab"
            aria-selected={chosen?.id === e.id}
            onClick={() => show(i)}
            className={cn(
              "min-h-10 shrink-0 rounded-full px-4 text-sm font-bold ring-1 transition",
              chosen?.id === e.id
                ? "bg-[var(--n-forest)] text-[var(--n-cream)] ring-[var(--n-forest)]"
                : "bg-white/60 ring-black/10",
            )}
          >
            {e.pick ? `${e.title} ♥` : e.title}
          </button>
        ))}
      </div>
      <ol
        ref={strip}
        data-testid="evenings"
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4"
      >
        {evenings.map((e, i) => {
          const on = chosen?.id === e.id;
          const surprise = e.id === "surprise";
          return (
            <li
              key={e.id}
              data-testid="evening"
              aria-label={e.title}
              className={cn(
                "flex w-[84vw] max-w-[360px] shrink-0 snap-center flex-col overflow-hidden rounded-[28px] bg-[var(--n-paper)] shadow-[0_24px_60px_-30px_rgba(20,30,20,0.7)] ring-1 sm:w-auto sm:max-w-none",
                on ? "ring-2 ring-[var(--n-ember)]" : "ring-black/5",
              )}
            >
              <div className="relative aspect-[5/4] w-full overflow-hidden">
                <Image
                  src={e.photo.src}
                  alt={e.photo.alt}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 84vw"
                  priority={i === 0}
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/10" />
                {e.pick && (
                  <p className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--n-amber)] px-3 py-1 text-xs font-extrabold tracking-[0.14em] text-[var(--n-ink)] uppercase">
                    <Heart className="h-3.5 w-3.5 fill-current" aria-hidden />
                    {e.pick}
                  </p>
                )}
                {on && (
                  <p className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-[var(--n-ember)] px-3 py-1 text-xs font-extrabold tracking-wide text-white uppercase">
                    <Check className="h-3.5 w-3.5" aria-hidden /> The plan
                  </p>
                )}
                <div className="absolute inset-x-5 bottom-4 text-white">
                  <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/85">
                    {surprise ? (
                      <Dices className="h-4 w-4" aria-hidden />
                    ) : (
                      <Car className="h-4 w-4" aria-hidden />
                    )}
                    {e.drive}
                  </p>
                  <h3 className="ghad-display mt-1 text-[30px] leading-[0.95] font-extrabold tracking-tight uppercase">
                    {e.title}
                  </h3>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <p className="text-[16px] leading-snug text-[var(--n-ink)]">
                  {e.line}
                </p>
                <ul className="mt-4 flex flex-wrap gap-1.5">
                  {e.highlights.map((h) => (
                    <li
                      key={h}
                      className="rounded-full bg-[var(--n-forest)]/[0.08] px-3 py-1 text-[13px] font-semibold text-[var(--n-forest)]"
                    >
                      {h}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => choose(e)}
                  disabled={busy !== null || (on && isOwner && !surprise)}
                  data-testid="choose-evening"
                  className={cn(
                    "mt-5 min-h-12 rounded-full px-6 text-base font-bold transition disabled:opacity-60",
                    on
                      ? "bg-[var(--n-forest)]/10 text-[var(--n-forest)]"
                      : "bg-[var(--n-ember)] text-white shadow-[0_10px_24px_-12px_rgba(194,87,26,0.9)]",
                  )}
                >
                  {busy === e.id
                    ? "Packing the truck…"
                    : on && surprise && isOwner
                      ? "Surprise us again"
                      : on
                        ? "This is the plan"
                        : !isOwner
                          ? "Suggest this one"
                          : surprise
                            ? "Surprise us"
                            : "Let's do this"}
                </button>
                <p className="mt-3 text-[11px] text-[var(--n-ink)]/50">
                  Photo: {e.photo.where} ·{" "}
                  <a
                    href={e.photo.page}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {e.photo.credit}, {e.photo.license}
                  </a>
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
