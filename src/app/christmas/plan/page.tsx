import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PassportNav } from "@/components/shell/PassportNav";
import { ThemeProvider } from "@/components/ghad/theme";
import { Planner, type PlanPick } from "@/components/christmas/Planner";
import styles from "@/components/christmas/christmas.module.css";
import { adventureSession } from "@/lib/adventures/server";
import { atlasStopsFor } from "@/lib/adventures/atlas-names";
import { todayIn } from "@/lib/adventures/overview";
import { ATLAS_REF } from "@/lib/adventures/rules";
import { loadSaved } from "@/lib/data/loadSaved";
import { readAsk, type Find } from "@/domain/christmas/discover";
import { shapeById } from "@/domain/christmas/plans";
import { readChristmas, themeById } from "@/domain/christmas/themes";
import { readWhen } from "@/domain/christmas/when";
import { christmasFinds } from "../_server/corpus";

export const metadata: Metadata = {
  title: "Plan a Christmas adventure — Passport",
  robots: { index: false },
};

const pickOf = (f: Find, fromSaved = false): PlanPick => ({
  id: f.experience.id,
  title: f.experience.title,
  emoji: f.reading.themes[0] ? themeById(f.reading.themes[0]).emoji : "🎄",
  when: f.when,
  ...(fromSaved ? { fromSaved } : {}),
});

/**
 * **Plan a Christmas adventure.** `?with=` carries what was picked on the
 * Christmas pages; Christmas things already on Saved are offered beside
 * them (the adventure is the place a person asked for that — ADR 012 §3).
 */
export default async function ChristmasPlanPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const ask = readAsk(params);
  const today = todayIn();
  const shape = shapeById(
    typeof params.shape === "string" ? params.shape : undefined,
  );
  const raw = typeof params.with === "string" ? params.with : "";
  const withIds = [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => ATLAS_REF.test(s)),
    ),
  ].slice(0, 12);
  const name = typeof params.name === "string" ? params.name.slice(0, 120) : "";
  const session = await adventureSession();
  const here = `/christmas/plan${Object.keys(params).length ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : ""}`;

  let picks: PlanPick[] = [];
  let saved: PlanPick[] = [];
  if (session) {
    const [corpus, savedBoard, named] = await Promise.all([
      christmasFinds({ km: ask.km, ages: [] }, today),
      loadSaved().catch(() => null),
      withIds.length
        ? atlasStopsFor(withIds).catch(() => null)
        : Promise.resolve(null),
    ]);
    const byId = new Map(corpus.finds.map((f) => [f.experience.id, f]));
    picks = withIds.flatMap((id) => {
      const f = byId.get(id);
      if (f) return [pickOf(f)];
      // Not a Christmas find (a "Do it again" stop, say): still Atlas's,
      // named by Atlas, with whatever dates it holds.
      const e = named?.experiences[id];
      const title = named?.names[id] ?? e?.title;
      return title
        ? [
            {
              id,
              title,
              emoji: "📍",
              ...(e ? { when: readWhen(e, today) } : {}),
            },
          ]
        : [];
    });
    if (savedBoard?.status === "ok") {
      saved = savedBoard.experiences
        .filter((e) => !withIds.includes(e.id))
        .flatMap((e) => {
          const reading = readChristmas(e);
          if (!reading?.christmas) return [];
          return [
            pickOf(
              { experience: e, reading, when: readWhen(e, today), free: false },
              true,
            ),
          ];
        })
        .slice(0, 12);
    }
  }

  return (
    <>
      <PassportNav displayName={session?.user.displayName ?? null} />
      <ThemeProvider className="block">
        <main className={`${styles.page} min-h-screen pb-16`}>
          <header className={styles.night}>
            <div className="mx-auto max-w-4xl px-4 pt-5 pb-8 sm:px-6">
              <Link
                href={`/christmas${ask.at ? `?at=${ask.at}` : ""}`}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/10 px-4 text-sm font-semibold hover:bg-white/20"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Christmas
              </Link>
              <h1 className="ghad-display mt-4 text-[2.4rem] leading-[0.95] font-extrabold tracking-[-0.04em] text-balance sm:text-6xl">
                Let&apos;s plan a Christmas worth remembering.
              </h1>
              <p className="mt-3 max-w-xl text-lg text-white/85">
                Five quick answers. Passport sketches it from real places,
                around the Christmas things you picked — then your people vote,
                and you change anything.
              </p>
            </div>
            <div className={styles.lights} aria-hidden />
          </header>
          <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6">
            {!session ? (
              <div className="rounded-[28px] bg-white px-6 py-12 text-center ring-1 ring-black/5">
                <p className="text-4xl" aria-hidden>
                  🎄
                </p>
                <p className="ghad-display mt-2 text-2xl font-extrabold">
                  Sign in to start a Christmas adventure
                </p>
                <p className="mx-auto mt-2 max-w-md text-base text-[var(--gh-ink-soft)]">
                  It stays with your account, and you can send it to everyone
                  coming.
                </p>
                <Link
                  href={`/auth?next=${encodeURIComponent(here)}`}
                  className="mt-6 inline-flex min-h-12 items-center rounded-full bg-[#b3242f] px-6 font-bold text-white"
                  data-testid="plan-sign-in"
                >
                  Sign in
                </Link>
              </div>
            ) : (
              <Planner
                today={today}
                initialShape={shape.id}
                {...(ask.at ? { initialTown: ask.at } : {})}
                {...(ask.from ? { initialFrom: ask.from } : {})}
                {...(ask.party ? { initialParty: ask.party } : {})}
                initialAges={ask.ages}
                {...(ask.people ? { initialPeople: ask.people } : {})}
                {...(name ? { initialTitle: name } : {})}
                picks={picks}
                saved={saved}
              />
            )}
          </div>
        </main>
      </ThemeProvider>
    </>
  );
}
