import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PassportNav } from "@/components/shell/PassportNav";
import { ThemeProvider } from "@/components/ghad/theme";
import { CreateAdventure } from "@/components/adventures/CreateAdventure";
import { Eyebrow, PillLink } from "@/components/adventures/kit";
import { adventureSession } from "@/lib/adventures/server";
import { atlasStopsFor } from "@/lib/adventures/atlas-names";
import { todayIn } from "@/lib/adventures/overview";
import { ATLAS_REF } from "@/lib/adventures/rules";

export const metadata: Metadata = {
  title: "Create an adventure — Passport",
  robots: { index: false },
};

/**
 * **Create an adventure** — the guided start (ADR 012 §1). `?with=` carries
 * saved places chosen on Saved; they are kept on the days first.
 */
export default async function NewAdventurePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const raw = typeof query?.["with"] === "string" ? query["with"] : "";
  const seeds = [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => ATLAS_REF.test(s)),
    ),
  ].slice(0, 12);
  const [session, named] = await Promise.all([
    adventureSession(),
    seeds.length > 0
      ? atlasStopsFor(seeds).catch(() => ({
          names: {} as Record<string, string>,
        }))
      : Promise.resolve({ names: {} as Record<string, string> }),
  ]);
  // "Do it again" brings the town and a name with the places.
  const at = typeof query?.["at"] === "string" ? query["at"] : "";
  const name =
    typeof query?.["name"] === "string" ? query["name"].slice(0, 120) : "";
  const here = `/adventures/new${raw || at || name ? `?${new URLSearchParams({ ...(raw ? { with: raw } : {}), ...(at ? { at } : {}), ...(name ? { name } : {}) }).toString()}` : ""}`;

  return (
    <>
      <PassportNav displayName={session?.user.displayName ?? null} />
      <ThemeProvider className="block">
        <main className="min-h-screen bg-white">
          <div className="mx-auto max-w-4xl px-4 pt-5 pb-20 sm:px-6 sm:pt-10">
            <Link
              href="/saved"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--gh-ink-soft)] hover:text-[var(--gh-ink)]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Saved
            </Link>
            <header className="mt-3 mb-10">
              <Eyebrow>New adventure</Eyebrow>
              <h1 className="ghad-display mt-2 text-[2.6rem] leading-[0.95] font-extrabold tracking-[-0.04em] text-[var(--gh-ink)] sm:text-7xl">
                Let&apos;s plan something good.
              </h1>
              <p className="mt-3 max-w-xl text-lg text-[var(--gh-ink-soft)]">
                Five quick questions. Passport sketches the days from real
                places — you keep, swap and change whatever you like.
              </p>
            </header>
            {!session ? (
              <div className="rounded-[28px] bg-[var(--gh-cream)] px-6 py-12 text-center">
                <p className="ghad-display text-2xl font-extrabold">
                  Sign in to start an adventure
                </p>
                <p className="mx-auto mt-2 max-w-md text-base text-[var(--gh-ink-soft)]">
                  It stays with your account, and you can send it to the people
                  coming.
                </p>
                <PillLink
                  href={`/auth?next=${encodeURIComponent(here)}`}
                  variant="primary"
                  className="mt-6"
                >
                  Sign in
                </PillLink>
              </div>
            ) : (
              <CreateAdventure
                today={todayIn()}
                initialTown={at}
                initialTitle={name}
                seeds={seeds}
                seedTitles={seeds.flatMap((s) =>
                  named.names[s] ? [named.names[s]!] : [],
                )}
              />
            )}
            <p className="mt-10 text-base text-[var(--gh-ink-soft)]">
              Planning a Hockey Night, a birthday or a conference?{" "}
              <Link
                href="/adventures#something-else"
                className="font-semibold text-[var(--gh-ink)] underline underline-offset-4"
              >
                Start one of those instead
              </Link>
              .
            </p>
          </div>
        </main>
      </ThemeProvider>
    </>
  );
}
