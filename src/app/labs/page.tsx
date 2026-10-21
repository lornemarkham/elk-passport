import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PassportNav } from "@/components/shell/PassportNav";
import { currentUser } from "@/lib/auth/currentUser";
import { labExperiments, type LabExperiment } from "./experiments";

export const metadata: Metadata = {
  title: "Labs — Passport",
  robots: { index: false, follow: false },
};

// What is open depends on the environment this process runs in, so it is
// asked per request rather than frozen at build time.
export const dynamic = "force-dynamic";

const BADGE = {
  playable: "border-emerald-400/40 text-emerald-300",
  blocked: "border-white/20 text-white/50",
} as const;

function Door({ e }: { e: LabExperiment }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11.5px] font-medium tracking-[0.14em] text-white/60 uppercase">
          {e.emoji} {e.kicker}
        </p>
        <span
          data-testid={`labs-status-${e.id}`}
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold tracking-[0.12em] uppercase ${BADGE[e.status]}`}
        >
          {e.status === "playable" ? "Playable" : "Blocked"}
        </span>
      </div>
      <p className="font-heading mt-1.5 flex items-center gap-2 text-2xl font-bold tracking-tight">
        {e.title}
        {e.href ? (
          <ArrowUpRight className="h-4 w-4 opacity-0 transition group-hover:opacity-70" />
        ) : null}
      </p>
      <p className="mt-1 text-[14px] text-white/55">{e.note}</p>
    </>
  );
  return e.href ? (
    <Link
      href={e.href}
      data-testid={`labs-door-${e.id}`}
      className="group block rounded-2xl border border-white/10 px-5 py-5 transition hover:border-white/35"
    >
      {body}
    </Link>
  ) : (
    <div
      data-testid={`labs-door-${e.id}`}
      aria-disabled="true"
      className="rounded-2xl border border-dashed border-white/10 px-5 py-5 opacity-70"
    >
      {body}
    </div>
  );
}

/** Things that work, that we're playing with, and an honest list of what doesn't yet. */
export default async function LabsIndex() {
  const user = await currentUser();
  const all = labExperiments();
  const open = all.filter((e) => e.status === "playable");
  const closed = all.filter((e) => e.status === "blocked");
  return (
    <>
      <PassportNav displayName={user?.displayName ?? null} />
      <main className="min-h-dvh bg-[oklch(0.14_0.015_260)] px-5 py-14 text-white">
        <div className="mx-auto max-w-2xl">
          <p className="text-[12.5px] font-medium tracking-[0.14em] text-white/45 uppercase">
            Passport · Labs
          </p>
          <h1 className="font-heading mt-3 text-[clamp(2rem,7vw,3rem)] leading-tight font-bold tracking-tight">
            Things we&apos;re playing with.
          </h1>
          <p className="mt-3 text-[14px] text-white/55">
            Experiments, not products. They can change or disappear, and each
            one says plainly what is real about it.
          </p>
          <ul className="mt-10 flex flex-col gap-3">
            {open.map((e) => (
              <li key={e.id}>
                <Door e={e} />
              </li>
            ))}
          </ul>
          {closed.length ? (
            <>
              <h2 className="mt-12 text-[12.5px] font-medium tracking-[0.14em] text-white/45 uppercase">
                Not open here
              </h2>
              <ul className="mt-4 flex flex-col gap-3">
                {closed.map((e) => (
                  <li key={e.id}>
                    <Door e={e} />
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <p className="mt-12 text-[14px] text-white/55">
            Everything older — the first experiments, every design round, the
            founding documents — is kept in the{" "}
            <Link
              href="/creative"
              data-testid="labs-creative-archive"
              className="text-white/85 underline underline-offset-4"
            >
              ELK Creative Archive
            </Link>
            .
          </p>
        </div>
      </main>
    </>
  );
}
