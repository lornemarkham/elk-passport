import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin, Sparkles } from "lucide-react";
import { ThemeProvider } from "@/components/ghad/theme";
import { Explorer } from "@/components/christmas/lights/Explorer";
import { MyLights } from "@/components/christmas/lights/MyLights";
import { PinCard } from "@/components/christmas/lights/PinCard";
import { Stars } from "@/components/christmas/lights/Rate";
import christmas from "@/components/christmas/christmas.module.css";
import styles from "@/components/christmas/lights/lights.module.css";
import { DistancePicker } from "@/components/christmas/DistancePicker";
import { ExperienceLocation } from "@/components/location/ExperienceLocation";
import { todayIn } from "@/lib/adventures/overview";
import { townById } from "@/domain/discovery/towns";
import { readAsk } from "@/domain/christmas/discover";
import { metres } from "@/domain/christmas/lights/actions";
import {
  KIND_EMOJI,
  KIND_LABEL,
  TOWN_LABEL,
  isLightDisplay,
  type PinView,
} from "@/domain/christmas/lights/model";
import {
  areaById,
  pinInArea,
  placeLabel,
  type Area,
} from "@/domain/christmas/lights/areas";
import {
  bestOf,
  isFavourite,
  isHiddenGem,
  priorMean,
} from "@/domain/christmas/lights/rank";
import { lightUp } from "@/domain/christmas/lights/stats";
import { suggestedDrives } from "@/domain/christmas/lights/drives";
import { whenLabel } from "@/lib/adventures/present";
import { lightsFor, viewer } from "../_server/lights";
import { festiveStops } from "../_server/lightsAtlas";
import { rememberedKm, whereAreWe } from "../_server/where";

export const dynamic = "force-dynamic";

const SHARE_TITLE =
  "The Christmas Lights Map — Vernon, Coldstream & the Okanagan";
const SHARE_TEXT =
  "Find the best Christmas lights near Vernon, build a lights tour for the family, and pin a display you love.";

export const metadata: Metadata = {
  metadataBase: new URL("https://gohaveaday.com"),
  title: "The Christmas Lights Map — Go Have a Christmas",
  description:
    "Decorated homes, public displays, community trees and Christmas markets around Vernon, Coldstream, Lumby, Armstrong and Kelowna — pinned by locals, checked, and ready for your lights tour.",
  alternates: { canonical: "/christmas/lights" },
  openGraph: {
    type: "website",
    url: "/christmas/lights",
    siteName: "Go Have a Day",
    title: SHARE_TITLE,
    description: SHARE_TEXT,
  },
  twitter: {
    card: "summary_large_image",
    title: SHARE_TITLE,
    description: SHARE_TEXT,
  },
};

/**
 * **The Christmas Lights Map** (Lights Map 2.0, 2026-11-14). The map is the
 * page: on a phone it fills the screen, shows light displays only, and a
 * tap opens a compact card. Below it: your own lights, Light Up Vernon, the
 * community's best, and the other Christmas things — markets, shows, Santa —
 * that used to crowd the map. Anyone can browse what is published; adding
 * lights, rating and saving need an account.
 */
export default async function LightsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const at = typeof params.at === "string" ? params.at : null;
  const area = areaById(at)?.id ?? null;
  // "See my pin" lands here with the pin to show; only the asker's own or a published one is found.
  const pinParam = typeof params.pin === "string" ? params.pin : null;
  const [v, festive] = await Promise.all([
    viewer(),
    festiveStops(todayIn()).catch(() => ({ stops: [], outage: true })),
  ]);
  const everything = await lightsFor(v);
  const { ready } = everything;
  // **Where and how far apply here too.** The map holds the displays within
  // the chosen distance of the chosen town; a family's own pins always stay
  // (they are theirs). Choosing one of the map's own areas is a narrower
  // choice and stands in place of the radius.
  const remembered = await rememberedKm();
  const ask = readAsk(params, remembered ? { km: remembered } : {});
  const where = await whereAreWe(ask.at);
  const town = townById(where.at)!;
  const centre = { lat: town.latitude, lng: town.longitude };
  const near = (p: { at: { lat: number; lng: number } }) =>
    metres(centre, p.at) / 1000 <= ask.km;
  const pins = everything.pins.filter((p) => p.yours || area || near(p));
  const hidden = everything.pins.length - pins.length;
  festive.stops = festive.stops.filter((f) => area || near(f));
  const lights = pins.filter((p) => isLightDisplay(p.kind));
  const published = lights.filter((p) => p.status === "approved");
  const others = pins.filter(
    (p) => !isLightDisplay(p.kind) && p.status === "approved",
  );
  const mine = pins.filter((p) => p.yours);
  const prior = priorMean(published);
  const fav = (p: PinView) => isFavourite(p, prior);
  const community = lightUp(published, placeLabel, fav);
  const within = (id: string) => {
    const a = areaById(id);
    return a ? (p: PinView) => pinInArea(a as Area, p) : () => false;
  };
  const today = todayIn();
  const drives = suggestedDrives(published, today);
  const lists = [
    { id: "vernon", title: "Best in Vernon", keep: within("vernon") },
    {
      id: "coldstream",
      title: "Best in Coldstream",
      keep: within("coldstream"),
    },
    {
      id: "east-hill",
      title: "East Hill favourites",
      keep: within("east-hill"),
    },
    { id: "lumby", title: "Worth the drive to Lumby", keep: within("lumby") },
    { id: "gems", title: "Hidden gems", keep: isHiddenGem },
  ].map((l) => ({ ...l, pins: bestOf(published, l.keep, 4, prior) }));
  const rated = lists.filter((l) => l.pins.length > 0);

  return (
    <>
      <ThemeProvider className="block">
        <main
          className={`${christmas.page} ${styles.scope} ${styles.dark} min-h-screen pb-16`}
        >
          <header className="mx-auto flex min-h-[4.5rem] max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
            <div className="min-w-0">
              <Link
                href="/christmas"
                className="text-xs font-bold tracking-[0.16em] text-[#ffd98a] uppercase hover:underline"
              >
                Go Have a Christmas
              </Link>
              <h1 className="ghad-display text-xl leading-tight font-extrabold tracking-[-0.02em] sm:text-3xl">
                The Christmas Lights Map
              </h1>
              <a
                href="#lights-where"
                className="text-xs font-semibold text-white/85 underline underline-offset-2"
                data-testid="lights-where-summary"
              >
                {area
                  ? `Around ${areaById(area)!.label}`
                  : `Within ${ask.km} km of ${town.name.replace(/,\s*BC$/, "")}`}{" "}
                · change
              </a>
            </div>
            <p
              className="shrink-0 text-right text-sm text-white/85"
              data-testid="lit-count"
            >
              <strong className="text-[#ffd98a]">{community.confirmed}</strong>{" "}
              lit
              <br className="sm:hidden" /> this season
            </p>
          </header>

          {!ready && (
            <p
              className="mx-auto mb-2 max-w-6xl rounded-2xl bg-[#f7e3e1] p-3 text-sm text-[#082319]"
              role="status"
              data-testid="not-ready"
            >
              Families&apos; pins aren&apos;t loading right now — you&apos;re
              seeing the public displays we checked ourselves.
            </p>
          )}

          <div className="mx-auto max-w-6xl sm:px-6">
            <Explorer
              pins={lights}
              initialArea={area}
              initialSelected={
                lights.some((p) => p.id === pinParam) ? pinParam : null
              }
            />
          </div>

          <div
            className="mx-auto mt-4 max-w-6xl scroll-mt-4 space-y-1 px-4 text-white sm:px-6"
            id="lights-where"
            data-testid="lights-where"
          >
            <Suspense fallback={null}>
              <ExperienceLocation
                scope="christmas"
                experience="Christmas lights"
                at={where.at}
                className="text-white"
              />
            </Suspense>
            {!area && <DistancePicker ask={ask} path="/christmas/lights" />}
            {!area && hidden > 0 && published.length === 0 && (
              <p className="text-sm text-white/85" data-testid="lights-none">
                No lights are listed within {ask.km} km of{" "}
                {town.name.replace(/,\s*BC$/, "")} yet. This map covers the
                North Okanagan — try a wider distance or another town.
              </p>
            )}
          </div>

          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <section
              className="mt-8"
              data-testid="drives"
              aria-labelledby="drives-h"
            >
              <h2
                id="drives-h"
                className="ghad-display text-2xl font-extrabold"
              >
                Suggested drives
              </h2>
              {drives.length > 0 ? (
                <>
                  <p className="mt-1 max-w-xl text-sm text-white/80">
                    Built only from published places confirmed for this season,
                    on the first night they&apos;re all on. Times are estimates;
                    Maps does the real route from where you are.
                  </p>
                  <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {drives.map((d) => (
                      <li
                        key={d.id}
                        className="flex flex-col rounded-[22px] bg-white/10 p-4"
                        data-testid={`drive-${d.id}`}
                      >
                        <h3 className="ghad-display text-lg leading-tight font-extrabold">
                          {d.title}
                        </h3>
                        <p className="mt-0.5 text-sm text-[#ffd98a]">
                          {whenLabel(d.night, d.night)} · about {d.minutes} min
                          · {d.km} km
                        </p>
                        <ol className="mt-2 space-y-1 text-sm">
                          {d.stops.map((s, i) => (
                            <li key={s.id} className="flex gap-2">
                              <span className="font-bold text-white/60">
                                {i + 1}
                              </span>
                              <span>
                                {s.name}
                                <span className="text-white/65">
                                  {" "}
                                  ·{" "}
                                  {s.kind === "atlas"
                                    ? "From the event listings"
                                    : KIND_LABEL[s.kind]}
                                </span>
                              </span>
                            </li>
                          ))}
                        </ol>
                        <div className="mt-3 flex flex-wrap gap-2 pt-1">
                          <a
                            href={d.mapsHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-11 items-center rounded-full bg-[#ffd98a] px-4 text-sm font-extrabold text-[#082319]"
                            data-testid="drive-directions"
                          >
                            Directions
                          </a>
                          <Link
                            href={d.tourHref}
                            className="inline-flex min-h-11 items-center rounded-full bg-white/15 px-4 text-sm font-bold"
                          >
                            Open as a tour
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-2 max-w-xl text-sm text-white/80">
                  No drive yet: a drive needs two or more places confirmed for
                  this season on the same night, and we don&apos;t pad one with
                  places nobody has confirmed. Build your own below, or add what
                  you&apos;ve spotted.
                </p>
              )}
            </section>

            <MyLights pins={mine} />

            <section
              className="mt-10 rounded-[28px] bg-[#0f3b2b] p-5 ring-1 ring-[#ffd98a]/20"
              data-testid="light-up-vernon"
            >
              <h2 className="ghad-display text-2xl font-extrabold">
                Help us light up Vernon!
              </h2>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-white/10 p-3">
                  <dt className="text-xs text-white/75">
                    Confirmed this season
                  </dt>
                  <dd
                    className="text-3xl font-extrabold text-[#ffd98a]"
                    data-testid="lu-confirmed"
                  >
                    {community.confirmed}
                  </dd>
                </div>
                <div className="rounded-2xl bg-white/10 p-3">
                  <dt className="text-xs text-white/75">
                    Community favourites
                  </dt>
                  <dd className="text-3xl font-extrabold text-[#ffd98a]">
                    {community.favourites}
                  </dd>
                </div>
                <div className="rounded-2xl bg-white/10 p-3">
                  <dt className="text-xs text-white/75">Rated by families</dt>
                  <dd className="text-3xl font-extrabold text-[#ffd98a]">
                    {community.rated}
                  </dd>
                </div>
              </dl>
              {community.places.length > 0 ? (
                <p
                  className="mt-3 text-sm text-white/85"
                  data-testid="lu-places"
                >
                  Lit so far:{" "}
                  {community.places
                    .slice(0, 6)
                    .map((p) => `${p.label} ${p.n}`)
                    .join(" · ")}
                </p>
              ) : (
                <p
                  className="mt-3 text-sm text-white/85"
                  data-testid="lu-places"
                >
                  Nothing is confirmed lit yet this season — most displays
                  switch on in late November. Yours could be the first.
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/christmas/lights/pin"
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#b3242f] px-5 font-extrabold text-white"
                  data-testid="share-your-display"
                >
                  <MapPin className="h-5 w-5" aria-hidden /> Share your display
                </Link>
                <Link
                  href="/christmas/lights/bingo"
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white/15 px-5 font-bold"
                >
                  <Sparkles className="h-5 w-5" aria-hidden /> Lights bingo
                </Link>
              </div>
            </section>

            <section className="mt-10" data-testid="best-of">
              <h2 className="ghad-display text-2xl font-extrabold">
                The community&apos;s best
              </h2>
              {rated.length === 0 ? (
                <p
                  className="mt-2 max-w-xl text-white/85"
                  data-testid="no-ratings"
                >
                  No ratings yet this season. Seen a display? Tap it, then
                  &ldquo;How magical was it?&rdquo; — the best lists start with
                  you.
                </p>
              ) : (
                <div className="mt-3 grid gap-6 sm:grid-cols-2">
                  {rated.map((l) => (
                    <div key={l.id} data-testid={`best-${l.id}`}>
                      <h3 className="font-extrabold text-[#ffd98a]">
                        {l.title}
                      </h3>
                      <ol className="mt-2 space-y-2">
                        {l.pins.map((p, i) => (
                          <li key={p.id}>
                            <Link
                              href={`/christmas/lights/${p.id}`}
                              className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 hover:bg-white/15"
                            >
                              <span className="font-extrabold text-white/60">
                                {i + 1}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-bold">
                                  {p.name}
                                </span>
                                <span className="text-sm text-white/70">
                                  {placeLabel(p)}
                                </span>
                              </span>
                              <Stars rating={p.rating} light />
                            </Link>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-10">
              <h2 className="ghad-display text-2xl font-extrabold">
                {area
                  ? `Lights around ${areaById(area)!.label}`
                  : "Every display on the map"}
              </h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {published
                  .filter((p) => !area || pinInArea(areaById(area)!, p))
                  .map((p) => (
                    <li key={p.id}>
                      <PinCard pin={p} />
                    </li>
                  ))}
              </ul>
            </section>

            {(others.length > 0 || festive.stops.length > 0) && (
              <section className="mt-12" data-testid="other-christmas">
                <h2 className="ghad-display text-2xl font-extrabold">
                  Markets, shows &amp; Santa
                </h2>
                <p className="text-white/80">
                  Not light displays, so they&apos;re off the map — but good for
                  the same night.
                </p>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {others.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/christmas/lights/${p.id}`}
                        className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 hover:bg-white/15"
                        data-testid="other-item"
                      >
                        <span className="text-2xl" aria-hidden>
                          {KIND_EMOJI[p.kind]}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-bold">{p.name}</span>
                          <span className="text-sm text-white/70">
                            {KIND_LABEL[p.kind]} · {TOWN_LABEL[p.town]}
                            {p.hours ? ` · ${p.hours}` : ""}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                  {festive.stops.map((f) => (
                    <li key={f.id}>
                      <Link
                        href={f.href}
                        className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 hover:bg-white/15"
                        data-testid="other-item"
                      >
                        <span className="text-2xl" aria-hidden>
                          {f.emoji}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-bold">{f.name}</span>
                          <span className="text-sm text-white/70">
                            Event listing{f.line ? ` · ${f.line}` : ""}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/christmas/discover"
                  className="mt-3 inline-flex items-center gap-1 font-bold text-[#ffd98a] hover:underline"
                >
                  Everything Christmas near you{" "}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </section>
            )}

            <section className="mt-12 rounded-[28px] bg-[#0f3b2b] p-6 text-white ring-1 ring-[#ffd98a]/20">
              <h2 className="ghad-display text-2xl font-extrabold">
                How the map stays honest
              </h2>
              <ul className="mt-3 space-y-2 text-white/85">
                <li>
                  🏠 A home is only shown with its owner&apos;s okay. A
                  neighbour&apos;s suggestion stays private until then.
                </li>
                <li>
                  💡 Every display says whether it&apos;s confirmed{" "}
                  <em>this</em> season. Last year&apos;s lights wait for someone
                  to say they&apos;re on.
                </li>
                <li>
                  ⭐ Ratings are real families&apos; — one each, per display,
                  per season. Lists favour many good ratings over one perfect
                  one.
                </li>
                <li>
                  🚩 Something wrong? Every display has a button. A home
                  owner&apos;s takedown hides it straight away.
                </li>
              </ul>
            </section>
          </div>
        </main>
      </ThemeProvider>
    </>
  );
}
