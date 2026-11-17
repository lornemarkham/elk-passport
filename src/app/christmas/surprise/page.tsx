import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Dices } from "lucide-react";
import { ThemeProvider } from "@/components/ghad/theme";
import { PicksProvider } from "@/components/christmas/Picks";
import { FindCard } from "@/components/christmas/FindCard";
import { AtlasDown } from "@/components/christmas/parts";
import { IdeaCard } from "@/components/christmas/ways";
import styles from "@/components/christmas/christmas.module.css";
import { todayIn } from "@/lib/adventures/overview";
import { townById } from "@/domain/discovery/towns";
import { answer, readAsk, writeAsk } from "@/domain/christmas/discover";
import { TOWNS } from "@/domain/christmas/lights/model";
import {
  drawSeed,
  strongest,
  surprise,
  wayHref,
} from "@/domain/christmas/ways";
import { christmasFinds } from "../_server/corpus";
import { whereAreWe } from "../_server/where";

export const metadata: Metadata = {
  title: "Surprise me — Go Have a Christmas",
};

/** How many of the strongest local finds the surprise is drawn from. */
const POOL = 24;

/**
 * **Surprise me** — one Christmas thing to do. It is drawn from what Atlas
 * dates (or gives a window for) near here and from Passport's ideas, and the
 * card says which: a real listing with its evidence, or "an idea, not a
 * listing". _Another one_ draws again; the address keeps the draw, so a
 * surprise can be sent to someone as it is.
 */
export default async function SurprisePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const where = await whereAreWe(readAsk(params).at);
  const at = where.at;
  const here = writeAsk({ at });
  const seed = Number(typeof params.s === "string" ? params.s : NaN);
  // The draw lives in the address, so a surprise can be sent as it is.
  if (!Number.isInteger(seed) || seed < 0)
    redirect(`/christmas/surprise?${here}&s=${drawSeed()}`);
  const today = todayIn();
  const ask = { ...readAsk({}), at };
  const corpus = await christmasFinds(ask, today);
  const local = strongest(answer(corpus.finds, ask), POOL);
  const pick = surprise(local, seed);
  const town = townById(at);
  const townName = town?.name.replace(/,\s*BC$/, "") ?? "you";
  const lightsTown = (TOWNS as readonly string[]).includes(at);
  const planner = (say: string) =>
    `/christmas/itinerary?${new URLSearchParams({ say, at }).toString()}`;

  return (
    <ThemeProvider className="block">
      <PicksProvider planHref={`/christmas/plan?${here}`}>
        <main className={`${styles.page} min-h-screen pb-28`}>
          <header className={styles.night}>
            <div className="mx-auto max-w-3xl px-4 pt-4 pb-6 sm:px-6 sm:pt-8">
              <Link
                href={`/christmas?${here}`}
                className="-ml-1 inline-flex min-h-11 items-center gap-1.5 px-1 text-sm font-bold text-white/90 hover:text-white"
                data-testid="back-to-christmas"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                All of Christmas
              </Link>
              <h1 className="ghad-display mt-2 text-[2.4rem] leading-[0.95] font-extrabold tracking-[-0.04em] sm:text-6xl">
                Surprise!
              </h1>
              <p className="mt-2 text-base text-white/90">
                {pick.kind === "find"
                  ? `Something real, around ${townName}.`
                  : "One of our ideas — it works anywhere."}
              </p>
            </div>
            <div className={styles.lights} aria-hidden />
          </header>
          <div className="mx-auto max-w-3xl space-y-5 px-4 pt-6 sm:px-6">
            {corpus.outage && <AtlasDown />}
            <div data-testid="surprise" data-kind={pick.kind}>
              {pick.kind === "find" ? (
                <FindCard
                  find={pick.find}
                  {...(town
                    ? {
                        origin: {
                          latitude: town.latitude,
                          longitude: town.longitude,
                        },
                      }
                    : {})}
                />
              ) : (
                <IdeaCard
                  idea={pick.idea}
                  {...(pick.idea.plan
                    ? { planHref: planner(pick.idea.plan) }
                    : pick.idea.lights
                      ? { lightsHref: wayHref("lights", at, lightsTown) }
                      : {})}
                />
              )}
            </div>
            <Link
              href={`/christmas/surprise?${here}&s=${seed + 1}`}
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#b3242f] px-6 font-extrabold text-white hover:brightness-110"
              data-testid="surprise-again"
            >
              <Dices className="h-5 w-5" aria-hidden />
              Another one
            </Link>
          </div>
        </main>
      </PicksProvider>
    </ThemeProvider>
  );
}
