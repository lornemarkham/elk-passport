import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Route, Sparkles } from "lucide-react";
import { ThemeProvider } from "@/components/ghad/theme";
import { Festive } from "@/components/christmas/Festive";
import { Explorer } from "@/components/christmas/lights/Explorer";
import { PinCard } from "@/components/christmas/lights/PinCard";
import christmas from "@/components/christmas/christmas.module.css";
import styles from "@/components/christmas/lights/lights.module.css";
import { todayIn } from "@/lib/adventures/overview";
import {
  TOWNS,
  favourites,
  type TownId,
} from "@/domain/christmas/lights/model";
import { lightsFor, viewer } from "../_server/lights";
import { festiveStops } from "../_server/lightsAtlas";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Christmas Lights Map — Go Have a Christmas",
  description:
    "Decorated homes, public displays, community trees and Christmas markets around Vernon, Coldstream, Lumby, Armstrong and Kelowna — pinned by locals, checked, and ready for your lights tour.",
};

/**
 * **The Christmas lights map** — Pin the Magic's front door. Anyone can
 * browse what is published; pinning, reacting and saving need an account.
 */
export default async function LightsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const at = typeof params.at === "string" ? params.at : null;
  const town = (TOWNS as readonly string[]).includes(at ?? "")
    ? (at as TownId)
    : null;
  const [v, festive] = await Promise.all([
    viewer(),
    festiveStops(todayIn()).catch(() => ({ stops: [], outage: true })),
  ]);
  const { pins, ready } = await lightsFor(v);
  const { favourites: loved, trending } = favourites(pins, 3);
  const published = pins.filter((p) => p.status === "approved");
  const lit = published.filter((p) => p.season === "lit").length;

  return (
    <>
      <ThemeProvider className="block">
        <main
          className={`${christmas.page} ${styles.scope} ${styles.dark} min-h-screen pb-32`}
        >
          <header className={christmas.night}>
            <div className="mx-auto max-w-6xl px-4 pt-10 pb-6 sm:px-6 sm:pt-14">
              <Link
                href="/christmas"
                className="text-sm font-bold tracking-[0.18em] text-[#ffd98a] uppercase hover:underline"
              >
                Go Have a Christmas
              </Link>
              <h1 className="ghad-display mt-3 max-w-3xl text-5xl leading-[0.92] font-extrabold tracking-[-0.04em] text-balance sm:text-7xl">
                The Christmas Lights Map
              </h1>
              <p className="mt-4 max-w-xl text-lg text-white/90">
                The best lights around Vernon, Coldstream, Lumby, Armstrong and
                Kelowna — pinned by families, checked by a person, and{" "}
                <strong className="text-[#ffd98a]">
                  {lit} confirmed lit this season
                </strong>
                .
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/christmas/lights/tour"
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#ffd98a] px-6 font-extrabold text-[#082319]"
                  data-testid="cta-tour"
                >
                  <Route className="h-5 w-5" aria-hidden /> Build my lights tour
                </Link>
                <Link
                  href="/christmas/lights/bingo"
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white/15 px-6 font-bold backdrop-blur hover:bg-white/25"
                >
                  <Sparkles className="h-5 w-5" aria-hidden /> Lights bingo
                </Link>
              </div>
              <Festive className="mt-4" />
            </div>
            <div className={christmas.lights} aria-hidden />
          </header>

          <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
            {!ready && (
              <p
                className="mb-4 rounded-2xl bg-[#f7e3e1] p-4 text-[#082319]"
                role="status"
                data-testid="not-ready"
              >
                Families&apos; pins aren&apos;t loading right now — you&apos;re
                seeing the public displays we checked ourselves. Try again in a
                little while.
              </p>
            )}
            <Explorer
              pins={pins}
              festive={festive.stops}
              signedIn={v.signedIn}
              initialTown={town}
            />

            {(trending.length > 0 || loved.length > 0) && (
              <section className="mt-12" data-testid="favourites">
                <h2 className="ghad-display text-2xl font-extrabold text-white">
                  {trending.length > 0
                    ? "Trending this week"
                    : "Community favourites"}
                </h2>
                <ul className="mt-4 grid gap-4 sm:grid-cols-3">
                  {(trending.length > 0 ? trending : loved).map((p) => (
                    <li key={p.id}>
                      <PinCard pin={p} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-12 rounded-[28px] bg-[#0f3b2b] p-6 text-white ring-1 ring-[#ffd98a]/20">
              <h2 className="ghad-display text-2xl font-extrabold">
                How the map stays honest
              </h2>
              <ul className="mt-3 space-y-2 text-white/85">
                <li>
                  🏠 A home is only shown with its owner&apos;s okay (or a
                  public listing). Until then it&apos;s private.
                </li>
                <li>
                  💡 Every pin says whether it&apos;s confirmed lit{" "}
                  <em>this</em> season. Last year&apos;s lights wait for someone
                  to say they&apos;re on.
                </li>
                <li>
                  🚩 Something wrong? Every display has a button. A home
                  owner&apos;s takedown hides it straight away.
                </li>
              </ul>
            </section>
          </div>

          <Link
            href="/christmas/lights/pin"
            className={`${styles.fab} fixed right-4 bottom-5 z-30 inline-flex min-h-14 items-center gap-2 rounded-full bg-[#b3242f] px-6 text-lg font-extrabold text-white sm:right-8 sm:bottom-8`}
            data-testid="pin-the-magic"
          >
            <MapPin className="h-6 w-6" aria-hidden /> PIN THE MAGIC!
          </Link>
        </main>
      </ThemeProvider>
    </>
  );
}
