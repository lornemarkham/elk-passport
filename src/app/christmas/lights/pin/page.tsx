import type { Metadata } from "next";
import Link from "next/link";
import { ThemeProvider } from "@/components/ghad/theme";
import { PinForm } from "@/components/christmas/lights/PinForm";
import christmas from "@/components/christmas/christmas.module.css";
import styles from "@/components/christmas/lights/lights.module.css";
import { TOWNS, type TownId } from "@/domain/christmas/lights/model";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Add to the Christmas Map — Christmas Lights Map",
  description:
    "A display that made you gasp: a photo, a pin, under a minute. No account needed.",
};

export default async function PinPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const at = typeof params.at === "string" ? params.at : null;
  const town = (TOWNS as readonly string[]).includes(at ?? "")
    ? (at as TownId)
    : null;
  return (
    <>
      <ThemeProvider className="block">
        <main
          className={`${christmas.page} ${styles.scope} ${styles.dark} min-h-screen pb-24`}
        >
          <header className={christmas.night}>
            <div className="mx-auto max-w-2xl px-4 pt-10 pb-6 sm:px-6">
              <Link
                href="/christmas/lights"
                className="text-sm font-bold tracking-[0.18em] text-[#ffd98a] uppercase hover:underline"
              >
                ← The lights map
              </Link>
              <h1 className="ghad-display mt-3 text-5xl leading-[0.95] font-extrabold tracking-[-0.03em]">
                📍 Add to the Christmas Map
              </h1>
              <p className="mt-3 text-lg text-white/90">
                A display that made you gasp — a photo, a pin and a minute. We
                check every one before it appears on the map. No account needed.
              </p>
            </div>
            <div className={christmas.lights} aria-hidden />
          </header>
          <div className="mx-auto max-w-2xl px-4 pt-6 sm:px-6">
            <PinForm town={town} />
          </div>
        </main>
      </ThemeProvider>
    </>
  );
}
