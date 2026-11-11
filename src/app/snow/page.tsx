import type { Metadata } from "next";
import Link from "next/link";
import { MountainScene } from "@/components/snow/MountainScene";
import { GoButton, SnowPage, SoftLink, Card } from "@/components/snow/kit";
import { MyDays } from "@/components/snow/MyDays";

export const metadata: Metadata = {
  title: "Go Have A Snow Day — Passport",
  description:
    "Plan a day on the mountain with your crew: pick the hill, get hyped, take on safe challenges, keep the memories, go again.",
};

const JOURNEY = [
  ["Discover", "Find the mountain that fits your crew."],
  ["Save", "Keep the ones you want."],
  ["Plan", "Date, ride, lunch, après — voted, not argued."],
  ["Share", "Send the plan to the crew."],
  ["Ride", "Meet up, play safe challenges, find each other."],
  ["Remember", "A recap worth sending."],
  ["Go again", "Next one starts from this one."],
] as const;

/** The Snow Experience's front door. Static: nothing here needs a account. */
export default function SnowHome() {
  return (
    <>
      <SnowPage>
        <main>
          <section className="relative isolate min-h-[78dvh]">
            <MountainScene className="absolute inset-0 -z-10" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#07121f]/70 via-transparent to-[#07121f]" />
            <div className="mx-auto flex min-h-[78dvh] max-w-5xl flex-col justify-end gap-5 px-5 pt-24 pb-14">
              <p className="text-sm font-bold tracking-[0.2em] text-[var(--sn-aurora)] uppercase">
                Skiing · Snowboarding · Winter
              </p>
              <h1 className="text-5xl leading-[0.95] font-black tracking-tight sm:text-7xl">
                The mountain&apos;s
                <br />
                calling.{" "}
                <span className="text-[var(--sn-glow)]">Bring everyone.</span>
              </h1>
              <p className="max-w-xl text-lg text-[var(--sn-ice)]/85">
                Plan the day, vote on the details, hype each other up, and take
                on friendly challenges at your own level. Then keep the story.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <GoButton href="/snow/new">Go have a snow day</GoButton>
                <SoftLink href="/snow/mountains">Find a mountain</SoftLink>
                <SoftLink href="/snow/sesh-wars">⚔️ Sesh Wars</SoftLink>
              </div>
            </div>
          </section>

          <div className="mx-auto max-w-5xl space-y-10 px-5 pb-24">
            <MyDays />

            <Link
              href="/snow/sesh-wars"
              aria-label="Sesh Wars — every feature has a champion"
              className="flex flex-wrap items-center gap-5 rounded-[20px] border-[3px] border-[#2b2a27] bg-[#4b5320] p-5 text-[#efe6cf] shadow-[6px_6px_0_#2b2a27] transition hover:-translate-y-0.5"
            >
              <span aria-hidden="true" className="text-5xl">
                ⚔️
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold tracking-[0.2em] text-[#f3c969] uppercase">
                  New · park competitions
                </span>
                <span className="block text-3xl font-black tracking-tight uppercase">
                  Sesh Wars
                </span>
                <span className="block text-sm opacity-90">
                  Film a lap on a park feature, get challenged from the
                  chairlift, let the mountain vote. Every feature has a
                  champion. Every rider has a shot.
                </span>
              </span>
              <span className="rounded-full border-2 border-[#2b2a27] bg-[#c8641e] px-5 py-3 text-sm font-extrabold uppercase">
                Enter
              </span>
            </Link>

            <section aria-labelledby="journey">
              <h2 id="journey" className="mb-4 text-2xl font-extrabold">
                One day, start to story
              </h2>
              <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {JOURNEY.map(([name, line], i) => (
                  <li key={name}>
                    <Card className="h-full">
                      <p className="text-xs font-bold text-[var(--sn-glow)]">
                        0{i + 1}
                      </p>
                      <p className="text-lg font-bold">{name}</p>
                      <p className="text-sm text-[var(--sn-ice)]/75">{line}</p>
                    </Card>
                  </li>
                ))}
              </ol>
            </section>

            <section
              className="grid gap-4 sm:grid-cols-3"
              aria-label="What makes it Snow"
            >
              <Card>
                <h3 className="font-bold">Safe by design</h3>
                <p className="mt-1 text-sm text-[var(--sn-ice)]/75">
                  Challenges are about photos, moments and runs at your own
                  level. Nothing rewards speed, risk or breaking mountain rules.
                  The crew rides at its most careful member&apos;s level.
                </p>
              </Card>
              <Card>
                <h3 className="font-bold">Honest about conditions</h3>
                <p className="mt-1 text-sm text-[var(--sn-ice)]/75">
                  Passport never makes up snow, lifts, trails or ticket prices.
                  Every fact is marked live or static, and the resort&apos;s own
                  report is one tap away.
                </p>
              </Card>
              <Card>
                <h3 className="font-bold">Works on the mountain</h3>
                <p className="mt-1 text-sm text-[var(--sn-ice)]/75">
                  Your day is kept on your phone, so the plan, the gear list and
                  the meeting points still open and update with no signal.
                </p>
              </Card>
            </section>
          </div>
        </main>
      </SnowPage>
    </>
  );
}
