import type { Metadata } from "next";
import Link from "next/link";
import { PassportNav } from "@/components/shell/PassportNav";
import { ThemeProvider } from "@/components/ghad/theme";
import { TourBuilder } from "@/components/christmas/lights/TourBuilder";
import christmas from "@/components/christmas/christmas.module.css";
import styles from "@/components/christmas/lights/lights.module.css";
import { adventureSession } from "@/lib/adventures/server";
import { localDay } from "@/domain/christmas/lights/model";
import { readTourQuery } from "@/domain/christmas/lights/tour";
import { lightsFor, viewer } from "../../_server/lights";
import { festiveStops } from "../../_server/lightsAtlas";
import { todayIn } from "@/lib/adventures/overview";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Build My Christmas Lights Tour — Go Have a Christmas",
  description:
    "A practical evening through the best lit displays near you, in the time you have.",
};

export default async function TourPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const link = readTourQuery((await searchParams) ?? {});
  const [session, v, festive] = await Promise.all([
    adventureSession(),
    viewer(),
    festiveStops(todayIn()).catch(() => ({ stops: [], outage: true })),
  ]);
  const { pins } = await lightsFor(v);
  return (
    <>
      <PassportNav displayName={session?.user.displayName ?? null} />
      <ThemeProvider className="block">
        <main
          className={`${christmas.page} ${styles.scope} min-h-screen bg-[#082319] pb-24 print:bg-white`}
        >
          <header className={`${christmas.night} print:hidden`}>
            <div className="mx-auto max-w-3xl px-4 pt-10 pb-6 sm:px-6">
              <Link
                href="/christmas/lights"
                className="text-sm font-bold tracking-[0.18em] text-[#ffd98a] uppercase hover:underline"
              >
                ← The lights map
              </Link>
              <h1 className="ghad-display mt-3 text-5xl leading-[0.95] font-extrabold tracking-[-0.03em]">
                {link
                  ? "A Christmas lights tour for you"
                  : "Build my Christmas lights tour"}
              </h1>
              <p className="mt-3 text-lg text-white/90">
                {link
                  ? "Someone shared this tour. Open the directions and go — or change it to suit your night."
                  : "Tell us how you're getting about and how long you've got. We'll string the lit displays together."}
              </p>
            </div>
            <div className={christmas.lights} aria-hidden />
          </header>
          <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-6">
            <TourBuilder
              pins={pins}
              festive={festive.stops}
              today={localDay(new Date())}
              link={link}
              signedIn={v.signedIn}
            />
          </div>
        </main>
      </ThemeProvider>
    </>
  );
}
