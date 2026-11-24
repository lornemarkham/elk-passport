import type { Metadata } from "next";
import Link from "next/link";
import { ThemeProvider } from "@/components/ghad/theme";
import { ListPicks } from "@/components/christmas/ListPicks";
import { MyAdventures } from "@/components/christmas/MyAdventures";
import { PicksProvider } from "@/components/christmas/Picks";
import { Section } from "@/components/christmas/parts";
import styles from "@/components/christmas/christmas.module.css";
import { adventureSession } from "@/lib/adventures/server";
import { adventuresOf } from "@/lib/adventures/store";
import { todayIn } from "@/lib/adventures/overview";
import { loadMyStuff } from "@/lib/data/loadMyStuff";
import { isChristmasPlan } from "@/domain/christmas/mine";
import { savedChristmas } from "@/domain/christmas/saved";

export const metadata: Metadata = {
  title: "My Christmas List — Passport",
  description: "Your own Christmas list and plans. Only you can see it.",
  robots: { index: false, follow: false },
};

/**
 * **My Christmas List** — the one private home of a person's Christmas: what
 * they have added on this device, what they have saved, and the Christmas
 * adventures they own or were invited to. Read with the visitor's own session,
 * so it only ever holds theirs; signed out, it holds nothing and says so.
 */
export default async function MyChristmasListPage() {
  const session = await adventureSession();
  const today = todayIn();
  // Both reads use the visitor's own session: what comes back is theirs (and
  // what they were invited to), never anybody else's.
  const [mine, stuff] = session
    ? await Promise.all([
        adventuresOf(session.db, session.user.id)
          .then((all) => all.filter(isChristmasPlan))
          .catch(() => []),
        loadMyStuff(),
      ])
    : [[], null];
  const saved =
    stuff?.status === "ok" ? savedChristmas(stuff.ideas, today) : [];
  return (
    <ThemeProvider className="block">
      <PicksProvider
        planHref="/christmas/plan"
        signedIn={Boolean(session)}
        tray={false}
      >
        <main className={`${styles.page} min-h-screen pb-28`}>
          <header className={styles.night}>
            <div className="mx-auto max-w-6xl px-4 pt-6 pb-8 sm:px-6">
              <h1 className="ghad-display text-[2.4rem] leading-[0.95] font-extrabold tracking-[-0.04em] sm:text-6xl">
                My Christmas List
              </h1>
              <p className="mt-2 text-lg text-white/85">
                Only you can see this page.
              </p>
            </div>
            <div className={styles.lights} aria-hidden />
          </header>
          <div className="mx-auto max-w-6xl space-y-10 px-4 pt-6 sm:px-6">
            <ListPicks
              planHref="/christmas/plan"
              saved={saved}
              signedIn={Boolean(session)}
              readFailed={stuff?.status === "error"}
            />
            <Section eyebrow="Private" title="My Christmas plans">
              {session ? (
                <MyAdventures adventures={mine} today={today} />
              ) : (
                <p
                  className="rounded-[22px] bg-white p-5 text-base ring-1 ring-black/5"
                  data-testid="list-signed-out"
                >
                  Sign in to see the Christmas plans you&apos;ve made and the
                  ones friends invited you to.{" "}
                  <Link
                    href="/auth?next=/christmas/list"
                    className="font-semibold underline underline-offset-4"
                  >
                    Sign in
                  </Link>
                </p>
              )}
            </Section>
            <Link
              href="/saved"
              className="inline-flex min-h-12 items-center rounded-full bg-white px-5 font-semibold ring-1 ring-black/10 hover:ring-black/30"
            >
              Everything I&apos;ve saved
            </Link>
          </div>
        </main>
      </PicksProvider>
    </ThemeProvider>
  );
}
