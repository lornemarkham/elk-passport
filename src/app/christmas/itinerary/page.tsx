import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ThemeProvider } from "@/components/ghad/theme";
import { ExperienceLocation } from "@/components/location/ExperienceLocation";
import { PendingContent, PendingProvider } from "@/components/loading/Pending";
import { ItineraryView } from "@/components/christmas/itinerary/ItineraryView";
import { AtlasDown } from "@/components/christmas/parts";
import styles from "@/components/christmas/christmas.module.css";
import { adventureSession } from "@/lib/adventures/server";
import { planFor } from "../_server/itinerary";

export const metadata: Metadata = {
  title: "Your Christmas plan — Go Have a Christmas",
  robots: { index: false },
};

/**
 * **Your Christmas plan** — screen two of the planner (owner brief,
 * Christmas Experience 2.0). The sentence is read into parts
 * (`readRequest`), every part is satisfied from Atlas or the community lights
 * map or shown unresolved (`planItinerary`), and everything changed here —
 * the day, a time, a replaced or removed stop — lives in the address, so the
 * same link opens the same plan on anybody's phone. No account to see it;
 * one to plan it with your people (an adventure of kind `christmas`).
 */
export default async function ChristmasItineraryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const [plan, session] = await Promise.all([
    planFor(params),
    adventureSession(),
  ]);
  if (!plan) redirect("/christmas#plan");
  const { itinerary, request, say, town } = plan;
  const pool = { outage: plan.outage };
  const query = Object.fromEntries(
    Object.entries(params).flatMap(([k, v]) =>
      typeof v === "string" ? [[k, v]] : [],
    ),
  );

  return (
    <ThemeProvider className="block">
      <main className={`${styles.page} min-h-screen pb-32`}>
        <PendingProvider>
          <header className={styles.night}>
            <div className="mx-auto max-w-2xl px-4 pt-5 pb-6">
              <Suspense fallback={null}>
                <ExperienceLocation
                  scope="christmas"
                  experience="Christmas"
                  at={town.id}
                  className="text-white"
                />
              </Suspense>
            </div>
            <div className={styles.lights} aria-hidden />
          </header>
          <PendingContent>
            <div className="mx-auto max-w-2xl px-4">
              {pool.outage && (
                <div className="mt-4">
                  <AtlasDown />
                </div>
              )}
              <ItineraryView
                itinerary={itinerary}
                say={say}
                query={query}
                signedIn={Boolean(session)}
                party={request.party ?? null}
                romantic={request.romantic}
              />
            </div>
          </PendingContent>
        </PendingProvider>
      </main>
    </ThemeProvider>
  );
}
