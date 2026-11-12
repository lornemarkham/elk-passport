import { Suspense } from "react";
import { ExperienceLocation } from "@/components/location/ExperienceLocation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ThemeProvider } from "@/components/ghad/theme";
import { Planner, type PlanPick } from "@/components/christmas/Planner";
import styles from "@/components/christmas/christmas.module.css";
import { adventureSession } from "@/lib/adventures/server";
import { atlasStopsFor } from "@/lib/adventures/atlas-names";
import { todayIn } from "@/lib/adventures/overview";
import { ATLAS_REF } from "@/lib/adventures/rules";
import { loadSaved } from "@/lib/data/loadSaved";
import { readAsk, type Find } from "@/domain/christmas/discover";
import { sayFor, shapeById } from "@/domain/christmas/plans";
import { readChristmas, themeById } from "@/domain/christmas/themes";
import { readWhen } from "@/domain/christmas/when";
import { KIND_EMOJI } from "@/domain/christmas/lights/model";
import { christmasFinds } from "../_server/corpus";
import { lightsFor, viewer } from "../_server/lights";

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
  const lightIds = [
    ...new Set(
      (typeof params.lights === "string" ? params.lights : "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => /^(seed|pin)-[a-z0-9-]{1,80}$/.test(s)),
    ),
  ].slice(0, 12);
  const say = typeof params.say === "string" ? params.say.slice(0, 200) : "";
  const name = typeof params.name === "string" ? params.name.slice(0, 120) : "";
  const session = await adventureSession();
  const here = `/christmas/plan${Object.keys(params).length ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : ""}`;

  // The person's own sentence when they said one (it already holds the
  // shape and who is coming); otherwise the sentence the planner would send.
  const goParams = new URLSearchParams({
    say: say
      ? /christmas/i.test(say)
        ? say
        : `${say}, Christmas`
      : sayFor({
          shape,
          ...(ask.party ? { party: ask.party } : {}),
          ...(ask.ages[0] !== undefined ? { youngest: ask.ages[0] } : {}),
        }),
  });
  if (ask.at) goParams.set("at", ask.at);
  if (withIds.length) goParams.set("with", withIds.join(","));

  let picks: PlanPick[] = [];
  let saved: PlanPick[] = [];
  if (session && lightIds.length) {
    const { pins } = await lightsFor(await viewer());
    const byId = new Map(
      pins.filter((p) => p.status === "approved").map((p) => [p.id, p]),
    );
    for (const id of lightIds) {
      const pin = byId.get(id);
      if (pin)
        picks.push({
          id,
          title: pin.name,
          emoji: KIND_EMOJI[pin.kind],
          light: true,
        });
    }
  }
  if (session) {
    const [corpus, savedBoard, named] = await Promise.all([
      christmasFinds({ km: ask.km, ages: [] }, today),
      loadSaved().catch(() => null),
      withIds.length
        ? atlasStopsFor(withIds).catch(() => null)
        : Promise.resolve(null),
    ]);
    const byId = new Map(corpus.finds.map((f) => [f.experience.id, f]));
    picks = [
      ...picks,
      ...withIds.flatMap((id) => {
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
      }),
    ];
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
              <Suspense fallback={null}>
                <ExperienceLocation
                  scope="christmas"
                  experience="Christmas"
                  className="mt-2 text-white"
                />
              </Suspense>
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
                <p className="mt-6 text-sm text-[var(--gh-ink-soft)]">
                  Just want a day out of it?
                </p>
                <Link
                  href={`/go?${goParams.toString()}`}
                  className="mt-2 inline-flex min-h-12 items-center rounded-full px-6 font-bold text-[#b3242f] ring-2 ring-[#b3242f]"
                  data-testid="plan-no-account"
                >
                  Build it now — no account
                </Link>
                <p className="mx-auto mt-2 max-w-md text-xs text-[var(--gh-ink-soft)]">
                  Change it, keep it on this device, and send it as words or a
                  printed page. Sign in later to plan it with your people.
                </p>
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
                {...(say ? { initialExtra: say } : {})}
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
