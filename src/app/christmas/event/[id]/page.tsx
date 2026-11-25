import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  MapPin,
  Navigation,
  Tag,
  Users,
} from "lucide-react";
import { ThemeProvider } from "@/components/ghad/theme";
import { CardPhoto } from "@/components/christmas/CardPhoto";
import { FindCard } from "@/components/christmas/FindCard";
import { EventSave } from "@/components/christmas/EventSave";
import { PicksProvider } from "@/components/christmas/Picks";
import { AtlasDown } from "@/components/christmas/parts";
import styles from "@/components/christmas/christmas.module.css";
import { adventureSession } from "@/lib/adventures/server";
import { todayIn } from "@/lib/adventures/overview";
import { getSubjectDetail } from "@/lib/data/atlas-repo";
import { subjectPageView } from "@/lib/passport/subjectPage";
import { COMPOSED_READS } from "@/domain/experience/destination";
import { whereLine } from "@/domain/discovery/compose";
import { distanceText } from "@/domain/discovery/proximity";
import { ageLine } from "@/domain/discovery/suitability";
import { townById } from "@/domain/discovery/towns";
import { formatEventWhen } from "@/domain/experience/eventTime";
import {
  directionsOf,
  findsIn,
  priceOf,
  readAsk,
  statedPlace,
  type Ask,
} from "@/domain/christmas/discover";
import { expectLines } from "@/domain/christmas/eventPage";
import { hasChristmasPicture } from "@/domain/christmas/pictures";
import { distinctWhere, tidyWhere } from "@/domain/christmas/tidy";
import {
  evidenceLine,
  readChristmas,
  themeById,
} from "@/domain/christmas/themes";
import {
  CONFIDENCE_LABEL,
  PHASE_LABEL,
  readWhen,
} from "@/domain/christmas/when";
import { cn } from "@/lib/utils";
import { christmasPool } from "../../_server/corpus";
import { rememberedKm, whereAreWe } from "../../_server/where";

type Props = { params: Promise<{ id: string }> };

const KINDS = Object.values(COMPOSED_READS);

/** Atlas's composed read for this id, whichever kind answers; null if none does. */
const composed = cache(async (id: string) => {
  const reads = await Promise.all(
    KINDS.map((kind) => getSubjectDetail(kind, id).catch(() => null)),
  );
  const found = reads.find((c) => c);
  return found ? subjectPageView(found) : null;
});

const pool = cache(async () => {
  const today = todayIn();
  const remembered = await rememberedKm();
  const asked = readAsk(
    {},
    { today, ...(remembered ? { km: remembered } : {}) },
  );
  const where = await whereAreWe(undefined);
  const ask: Ask = { ...asked, at: where.at };
  return { today, ask, ...(await christmasPool(ask)) };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const [{ experiences }, view] = await Promise.all([pool(), composed(id)]);
  const name =
    experiences.find((e) => e.id === id)?.title ?? view?.subject.name;
  return {
    title: name ? `${name} — Christmas` : "Christmas event",
    robots: { index: false, follow: false },
  };
}

const host = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/**
 * **A Christmas event's own page** — one layout for every find: the picture
 * and the name first, then when, where and what it costs, what Atlas says
 * about it, how to get there, the organiser's page, Save, and more like it.
 *
 * Only what Atlas supports is printed; a line with nothing behind it is left
 * out, never filled in. How Passport knows it — sources, how sure the date is
 * and why it counts as Christmas — is one folded section at the bottom.
 * Atlas owns the facts and the pictures; this page only arranges them.
 */
export default async function ChristmasEventPage({ params }: Props) {
  const { id } = await params;
  const [{ today, ask, experiences, outage }, view, session] =
    await Promise.all([
      pool(),
      composed(id),
      adventureSession().catch(() => null),
    ]);
  const e = experiences.find((x) => x.id === id);
  if (!e && !view) {
    if (outage)
      return (
        <main className={`${styles.page} min-h-screen p-4`}>
          <AtlasDown />
        </main>
      );
    notFound();
  }

  const town = townById(ask.at ?? "");
  const origin = town
    ? { latitude: town.latitude, longitude: town.longitude }
    : undefined;
  const subject = view?.subject;
  const title = e?.title ?? subject?.name ?? "Christmas event";
  const reading = e ? readChristmas(e) : null;
  const theme = reading?.themes[0] ? themeById(reading.themes[0]) : undefined;
  const when = e ? readWhen(e, today) : undefined;
  const dateLine =
    when?.line ??
    formatEventWhen(subject?.startTime, subject?.endTime) ??
    undefined;
  const venue = view?.venue;
  const placeLine = e
    ? distinctWhere(tidyWhere(whereLine(e) ?? ""))
    : undefined;
  const address = subject?.address ?? venue?.address;
  const where = [placeLine, e && !placeLine ? statedPlace(e) : undefined]
    .filter(Boolean)
    .join(" · ");
  const far = e ? distanceText(e, origin) : undefined;
  const { price, free } = e ? priceOf(e) : { price: undefined, free: false };
  const point = subject?.coordinates ?? venue?.coordinates;
  const directions =
    (e ? directionsOf(e) : undefined) ??
    (point
      ? `https://www.google.com/maps/dir/?api=1&destination=${point[1]},${point[0]}`
      : undefined);
  const age = e ? ageLine(e, undefined) : undefined;
  const expects = e ? expectLines(e) : [];
  const features = e?.knowledge?.features?.slice(0, 8) ?? [];
  const conditions = e?.knowledge?.conditions?.slice(0, 6) ?? [];
  const minutes = e?.visitDuration?.minutes;
  const adds = e?.knowledge?.descriptionAddsKnowledge !== false;
  const description = [subject?.description, e?.description]
    .map((t) => t?.trim() ?? "")
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0];
  const sources = view?.sources ?? [];
  const official = sources.find((s) => s.describesSubject) ?? undefined;

  // More like it: the same kind of Christmas thing, inside the radius, not over.
  const related = e
    ? findsIn(experiences, today)
        .filter(
          (f) =>
            f.experience.id !== id &&
            f.experience.title !== e.title &&
            f.when.phase !== "finished" &&
            f.when.confidence !== "past" &&
            reading?.themes[0] &&
            f.reading.themes.includes(reading.themes[0]) &&
            f.experience.distance?.state === "measured" &&
            f.experience.distance.km <= ask.km,
        )
        .sort(
          (a, b) =>
            (a.experience.distance?.state === "measured"
              ? a.experience.distance.km
              : 1e9) -
            (b.experience.distance?.state === "measured"
              ? b.experience.distance.km
              : 1e9),
        )
        .slice(0, 6)
    : [];

  const hasPicture = e ? hasChristmasPicture(e) : false;
  const fact = "flex gap-3 text-base";
  const icon = "mt-1 h-5 w-5 shrink-0 text-[#b3242f]";

  return (
    <ThemeProvider className="block">
      <PicksProvider planHref="/christmas/plan" signedIn={Boolean(session)}>
        <main className={`${styles.page} min-h-screen pb-28`}>
          <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6 sm:pt-6">
            <Link
              href={`/christmas/discover?at=${ask.at}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/80 px-4 text-sm font-semibold ring-1 ring-black/10 hover:bg-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to Christmas
            </Link>

            <article className="mt-3" data-testid="event-page">
              <header
                className={cn(
                  "relative overflow-hidden rounded-[28px] bg-[#0f3b2b] text-white shadow-[0_12px_40px_rgba(8,35,25,0.25)]",
                  hasPicture ? "min-h-[17rem] sm:min-h-[24rem]" : "",
                )}
              >
                {e && hasPicture && (
                  <CardPhoto experience={e} fill priority showLabel={false} />
                )}
                <div
                  className={cn(
                    "relative flex flex-col justify-end gap-2 p-5 sm:p-8",
                    hasPicture
                      ? "min-h-[17rem] bg-gradient-to-t from-black/80 via-black/30 to-transparent pt-24 sm:min-h-[24rem]"
                      : "",
                  )}
                >
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                    {when && (
                      <span
                        className="rounded-full bg-[#ffd98a] px-3 py-0.5 text-xs font-bold text-[#082319]"
                        data-testid="event-confidence"
                      >
                        {when.confidence === "dated" && when.phase
                          ? `${PHASE_LABEL[when.phase]} · dates confirmed`
                          : CONFIDENCE_LABEL[when.confidence]}
                      </span>
                    )}
                    {theme && (
                      <span>
                        <span aria-hidden>{theme.emoji}</span> {theme.label}
                      </span>
                    )}
                  </p>
                  <h1 className="ghad-display text-3xl leading-tight font-extrabold tracking-tight text-balance sm:text-5xl">
                    {title}
                  </h1>
                </div>
              </header>

              <div className="mt-4 rounded-[24px] bg-white p-5 ring-1 ring-black/5 sm:p-7">
                <ul className="space-y-3" data-testid="event-facts">
                  {dateLine && (
                    <li className={fact}>
                      <CalendarDays className={icon} aria-hidden />
                      <span>
                        <strong>{dateLine}</strong>
                        {when && when.confidence !== "dated" && (
                          <span className="block text-sm text-[var(--gh-ink-soft)]">
                            {when.because}
                          </span>
                        )}
                      </span>
                    </li>
                  )}
                  {(where || far || address) && (
                    <li className={fact}>
                      <MapPin className={icon} aria-hidden />
                      <span data-testid="event-where">
                        <strong>{where || address}</strong>
                        {far && (
                          <span className="block text-sm text-[var(--gh-ink-soft)]">
                            {far}
                            {town
                              ? ` from ${town.name.replace(/,\s*BC$/, "")}`
                              : ""}
                          </span>
                        )}
                        {where && address && !where.includes(address) && (
                          <span className="block text-sm text-[var(--gh-ink-soft)]">
                            {address}
                          </span>
                        )}
                      </span>
                    </li>
                  )}
                  {(price || free) && (
                    <li className={fact}>
                      <Tag className={icon} aria-hidden />
                      <span data-testid="event-cost">
                        <strong>{free && !price ? "Free" : price}</strong>
                        <span className="block text-sm text-[var(--gh-ink-soft)]">
                          In the organiser&apos;s words.
                        </span>
                      </span>
                    </li>
                  )}
                  {age && (
                    <li className={fact}>
                      <Users className={icon} aria-hidden />
                      <span>{age}</span>
                    </li>
                  )}
                </ul>

                <div className="mt-5 flex flex-wrap gap-2">
                  <EventSave
                    id={id}
                    title={title}
                    className="flex-1 sm:flex-none"
                  />
                  {directions && (
                    <a
                      href={directions}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#b3242f] px-6 text-base font-bold text-white hover:brightness-110 sm:flex-none"
                      data-testid="event-directions"
                    >
                      <Navigation className="h-5 w-5" aria-hidden />
                      Directions
                    </a>
                  )}
                  {official && (
                    <a
                      href={official.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#ffd98a] px-6 text-base font-bold text-[#082319] hover:brightness-105 sm:flex-none"
                      data-testid="event-official"
                    >
                      <ExternalLink className="h-5 w-5" aria-hidden />
                      Event page · {host(official.url)}
                    </a>
                  )}
                </div>
              </div>

              {description && adds && (
                <section className="mt-4 rounded-[24px] bg-white p-5 ring-1 ring-black/5 sm:p-7">
                  <h2 className="ghad-display text-xl font-extrabold">
                    About this
                  </h2>
                  <p
                    className="mt-2 text-base leading-relaxed whitespace-pre-line"
                    data-testid="event-description"
                  >
                    {description}
                  </p>
                </section>
              )}

              {(expects.length > 0 ||
                features.length > 0 ||
                conditions.length > 0 ||
                minutes) && (
                <section className="mt-4 rounded-[24px] bg-white p-5 ring-1 ring-black/5 sm:p-7">
                  <h2 className="ghad-display text-xl font-extrabold">
                    What to expect
                  </h2>
                  <ul className="mt-2 space-y-2 text-base">
                    {minutes && (
                      <li>
                        <strong>A visit usually takes</strong>{" "}
                        {minutes[0] === minutes[1]
                          ? `${minutes[0]} minutes`
                          : `${minutes[0]}–${minutes[1]} minutes`}
                        .
                      </li>
                    )}
                    {expects.map((x) => (
                      <li key={`${x.label}${x.value}`}>
                        <strong>{x.label}:</strong> {x.value}
                      </li>
                    ))}
                    {features.length > 0 && (
                      <li>
                        <strong>There:</strong> {features.join(", ")}
                      </li>
                    )}
                    {conditions.length > 0 && (
                      <li>
                        <strong>Good to know:</strong> {conditions.join("; ")}
                      </li>
                    )}
                  </ul>
                </section>
              )}

              {related.length > 0 && (
                <section className="mt-6" data-testid="event-related">
                  <h2 className="ghad-display text-xl font-extrabold">
                    More {theme ? theme.label.toLowerCase() : "like this"}{" "}
                    nearby
                  </h2>
                  <div className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
                    {related.map((f) => (
                      <FindCard
                        key={f.experience.id}
                        find={f}
                        compact
                        {...(origin ? { origin } : {})}
                        {...(reading?.themes[0]
                          ? { theme: reading.themes[0] }
                          : {})}
                      />
                    ))}
                  </div>
                </section>
              )}

              <details
                className="mt-4 rounded-[20px] bg-white/70 p-4 text-sm ring-1 ring-black/5"
                data-testid="event-provenance"
              >
                <summary className="min-h-11 cursor-pointer py-2 font-semibold">
                  Where this comes from
                </summary>
                <div className="space-y-2 pb-2 text-[var(--gh-ink-soft)]">
                  {when && <p>Date: {when.because}</p>}
                  {reading?.evidence[0] && (
                    <p>Why it is here: {evidenceLine(reading.evidence[0])}</p>
                  )}
                  {sources.length > 0 ? (
                    <ul className="list-disc space-y-1 pl-5">
                      {sources.map((s) => (
                        <li key={s.id}>
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline underline-offset-2"
                          >
                            {host(s.url)}
                          </a>
                          {s.sourceType ? ` · ${s.sourceType}` : ""}
                          {s.retrievedAt
                            ? ` · read ${s.retrievedAt.slice(0, 10)}`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>Atlas has no source page for this one.</p>
                  )}
                  <p>
                    Details come from Atlas and the organiser. Confirm times and
                    prices with the organiser before you go.{" "}
                    <Link
                      href={`/passport/${id}`}
                      className="font-semibold underline underline-offset-2"
                    >
                      Full record
                    </Link>
                  </p>
                </div>
              </details>
            </article>
          </div>
        </main>
      </PicksProvider>
    </ThemeProvider>
  );
}
