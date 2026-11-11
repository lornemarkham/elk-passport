import type { Metadata } from "next";
import Link from "next/link";
import { PassportNav } from "@/components/shell/PassportNav";
import { ThemeProvider } from "@/components/ghad/theme";
import { PinForm } from "@/components/christmas/lights/PinForm";
import christmas from "@/components/christmas/christmas.module.css";
import styles from "@/components/christmas/lights/lights.module.css";
import { adventureSession } from "@/lib/adventures/server";
import { TOWNS, type TownId } from "@/domain/christmas/lights/model";
import { viewer } from "../../_server/lights";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PIN THE MAGIC! — Christmas Lights Map",
  description:
    "Seen an amazing Christmas display? Pin it so other families can find it.",
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
  const [session, v] = await Promise.all([adventureSession(), viewer()]);
  return (
    <>
      <PassportNav displayName={session?.user.displayName ?? null} />
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
                📍 PIN THE MAGIC!
              </h1>
              <p className="mt-3 text-lg text-white/90">
                Seen a display that made you gasp? Pin it, and other families
                can add it to their Christmas tour.
              </p>
            </div>
            <div className={christmas.lights} aria-hidden />
          </header>
          <div className="mx-auto max-w-2xl px-4 pt-6 sm:px-6">
            {v.key ? (
              <PinForm town={town} />
            ) : (
              <section
                className="rounded-[28px] bg-white p-6 text-[#082319]"
                data-testid="pin-sign-in"
              >
                <h2 className="ghad-display text-2xl font-extrabold">
                  First, sign in
                </h2>
                <p className="mt-2">
                  Pins come from real people, so every one needs an account. It
                  takes a minute — then you&apos;re back here with the map
                  ready.
                </p>
                <Link
                  href={`/auth?next=${encodeURIComponent("/christmas/lights/pin")}`}
                  className="mt-4 inline-flex min-h-12 items-center rounded-full bg-[#b3242f] px-6 font-extrabold text-white"
                >
                  Sign in to pin the magic
                </Link>
                {v.signedIn && (
                  <p className="mt-3 text-sm text-[#5b4a2e]">
                    Your account&apos;s email isn&apos;t confirmed yet — check
                    your inbox, then come back.
                  </p>
                )}
              </section>
            )}
          </div>
        </main>
      </ThemeProvider>
    </>
  );
}
