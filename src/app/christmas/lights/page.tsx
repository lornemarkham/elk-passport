import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { ThemeProvider } from "@/components/ghad/theme";
import { Explorer } from "@/components/christmas/lights/Explorer";
import { MyLights } from "@/components/christmas/lights/MyLights";
import christmas from "@/components/christmas/christmas.module.css";
import styles from "@/components/christmas/lights/lights.module.css";
import { DistancePicker } from "@/components/christmas/DistancePicker";
import { ExperienceLocation } from "@/components/location/ExperienceLocation";
import { townById } from "@/domain/discovery/towns";
import { readAsk } from "@/domain/christmas/discover";
import { metres } from "@/domain/christmas/lights/actions";
import { isLightDisplay, type PinView } from "@/domain/christmas/lights/model";
import { areaById, placeLabel } from "@/domain/christmas/lights/areas";
import { isFavourite, priorMean } from "@/domain/christmas/lights/rank";
import { lightUp } from "@/domain/christmas/lights/stats";
import { lightsFor, viewer } from "../_server/lights";
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
  const v = await viewer();
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
  const lights = pins.filter((p) => isLightDisplay(p.kind));
  const published = lights.filter((p) => p.status === "approved");
  const mine = pins.filter((p) => p.yours);
  const prior = priorMean(published);
  const community = lightUp(published, placeLabel, (p: PinView) =>
    isFavourite(p, prior),
  );
  // Only the administrator is sent other people's pending pins.
  const waitingForReview = v.reviewer
    ? everything.pins.filter((p) => p.status === "pending").length
    : 0;

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

          <nav
            className="mx-auto mt-3 flex max-w-6xl flex-wrap gap-2 px-4 sm:px-6"
            aria-label="Lights map actions"
            data-testid="lights-actions"
          >
            {v.reviewer && (
              <Link
                href="/christmas/lights/review"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#ffd98a] px-4 text-sm font-extrabold text-[#082319]"
                data-testid="admin-link"
              >
                <ShieldCheck className="h-4 w-4" aria-hidden /> Administration
                {waitingForReview > 0 && ` · ${waitingForReview} waiting`}
              </Link>
            )}
            <Link
              href="/christmas/discover"
              className="inline-flex min-h-11 items-center gap-1 rounded-full bg-white/15 px-4 text-sm font-bold"
              data-testid="to-discover"
            >
              Markets, shows &amp; Santa{" "}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/christmas/lights/privacy"
              className="inline-flex min-h-11 items-center rounded-full px-3 text-sm text-white/75 underline"
            >
              How the map stays honest
            </Link>
          </nav>

          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <MyLights pins={mine} />
          </div>

          <details
            className="mx-auto mt-2 max-w-6xl px-4 text-white sm:px-6"
            id="lights-where"
            data-testid="lights-where"
          >
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-white/85">
              {area
                ? `Around ${areaById(area)!.label}`
                : `Within ${ask.km} km of ${town.name.replace(/,\s*BC$/, "")}`}{" "}
              · change
            </summary>
            <div className="space-y-1 pb-3">
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
          </details>
        </main>
      </ThemeProvider>
    </>
  );
}
