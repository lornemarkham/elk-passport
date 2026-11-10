import Link from "next/link";
import type { Metadata } from "next";
import { demoScenarios } from "@/lib/courtqueue/demo";
import { LESSONS } from "@/lib/courtqueue/learn";
import { Diagram } from "../_ui/LearnDiagrams";

export const metadata: Metadata = {
  title: "CourtQueue — See a night",
  robots: { index: false, follow: false },
};

/**
 * **See a night.** Three club nights with made-up players, run through the
 * same engine that runs the real thing. Nothing here is stored and no one is
 * a real member. It also shows what each player has told the app — which, in
 * the app itself, only that player ever sees.
 */
export default function DemoPage() {
  const scenarios = demoScenarios();
  return (
    <main className="mx-auto max-w-xl space-y-8 px-4 pt-8 pb-16">
      <header className="space-y-2 text-center">
        <p className="text-5xl" aria-hidden>
          🏸
        </p>
        <h1 className="text-3xl font-black">CourtQueue</h1>
        <p className="text-lg font-semibold text-lime-300">
          Play. Learn. Grow. Together.
        </p>
        <p className="text-sm text-white/70">
          Three example nights with made-up players. The courts below are chosen
          by the same rules the club app uses. Turns, minutes and waiting always
          come first; experience and mood are only a gentle nudge, and the
          organizer can always change a game.
        </p>
        <nav className="flex flex-wrap justify-center gap-2 pt-2 text-sm">
          {scenarios.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full bg-white/10 px-3 py-1.5"
            >
              {s.title}
            </a>
          ))}
          <a href="#learn" className="rounded-full bg-white/10 px-3 py-1.5">
            Learn
          </a>
        </nav>
      </header>

      {scenarios.map((s, i) => (
        <section key={s.id} id={s.id} className="scroll-mt-4 space-y-3">
          <h2 className="text-2xl font-black">
            <span className="text-lime-300">{i + 1}.</span> {s.title}
          </h2>
          <p className="text-white/80">{s.story}</p>
          <details className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
            <summary className="cursor-pointer font-bold">
              Who&apos;s here ({s.players.length} made-up players)
            </summary>
            <p className="mt-2 text-xs text-white/50">
              Shown only for this demonstration. In the app, nobody sees anyone
              else&apos;s level or mood.
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {s.players.map((p) => (
                <li key={p.name}>
                  <b>{p.name}</b>
                  <span className="text-white/60">
                    {" "}
                    · {p.level ?? "no level chosen"}
                    {p.mood ? ` · ${p.mood}` : ""} — {p.note}
                  </span>
                </li>
              ))}
            </ul>
          </details>
          {s.frames.map((f, k) => (
            <div key={k} className="space-y-2">
              <p className="font-semibold text-lime-200">{f.caption}</p>
              <div className="grid gap-2">
                {f.courts.map((c) => (
                  <div
                    key={c.court}
                    className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10"
                  >
                    <p className="text-xs font-bold tracking-widest text-lime-300 uppercase">
                      Court {c.court}
                      {c.source === "challenge" ? " · invited game" : ""}
                    </p>
                    <p className="mt-1 text-lg font-bold">
                      {c.teams[0].join(" & ")}
                      <span className="mx-2 text-white/40">vs</span>
                      {c.teams[1].join(" & ")}
                    </p>
                    <p className="mt-1 text-sm text-white/60">
                      {c.why.join(" · ")}
                    </p>
                  </div>
                ))}
              </div>
              {f.line.length > 0 && (
                <p className="text-sm text-white/60">
                  Waiting: {f.line.join(", ")}
                </p>
              )}
            </div>
          ))}
        </section>
      ))}

      <section id="learn" className="scroll-mt-4 space-y-3">
        <h2 className="text-2xl font-black">Learn, in the app</h2>
        <p className="text-white/80">
          Inside CourtQueue, <b>Grow</b> has <b>My Journey</b> (goals,
          techniques to practise, optional challenges and encouraging progress,
          all private) and <b>Learn</b>:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-white/80">
          {LESSONS.map((l) => (
            <li key={l.id}>
              <b>{l.title}</b> — {l.gist}
            </li>
          ))}
        </ul>
        <Diagram id="doubles" />
      </section>

      <footer className="text-center">
        <Link
          href="/badminton"
          className="inline-block rounded-xl bg-lime-400 px-6 py-4 text-lg font-black text-slate-950"
        >
          Open CourtQueue
        </Link>
        <p className="mt-3 text-sm text-white/60">
          More playing. More learning. More friendships. More fun.
        </p>
      </footer>
    </main>
  );
}
