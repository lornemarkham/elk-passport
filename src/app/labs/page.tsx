import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { currentUser } from "@/lib/auth/currentUser";
import {
  LABS_NOW,
  SEASONAL_ARCHIVE,
  type LabStatusLabel,
  type LabsExperience,
} from "@/lib/experiences";
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

// One colour per honest status, so a glance tells which is which.
const STATUS_STYLE: Record<LabStatusLabel, string> = {
  Experimental: "border-amber-300/50 bg-amber-300/10 text-amber-200",
  "Coming Soon": "border-sky-300/50 bg-sky-300/10 text-sky-200",
  "In Development": "border-violet-300/50 bg-violet-300/10 text-violet-200",
  Archived: "border-white/25 bg-white/5 text-white/60",
  "Out of Season": "border-rose-300/40 bg-rose-300/10 text-rose-200",
};

/** A whole experience, kept in Labs: real page, real URL, honest status. */
function ExperienceCard({ e }: { e: LabsExperience }) {
  return (
    <article
      data-testid={`labs-experience-${e.testId}`}
      className="flex w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-white/30"
    >
      {/* Real captures of the live page; the top of each is cropped past the
          shared bar so the experience itself is what is previewed. */}
      <div className="relative aspect-[16/9] overflow-hidden bg-black/40">
        {/* eslint-disable-next-line @next/next/no-img-element -- static capture, already compressed */}
        <img
          src={e.preview}
          alt={`Preview of ${e.label}`}
          loading="lazy"
          className="absolute inset-x-0 top-0 h-[112%] w-full -translate-y-[10%] object-cover object-top"
        />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-heading text-xl font-bold tracking-tight">
            {e.label}
          </h3>
          <span
            data-testid={`labs-experience-status-${e.testId}`}
            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold tracking-[0.12em] uppercase ${STATUS_STYLE[e.status]}`}
          >
            {e.status}
          </span>
        </div>
        <p className="mt-2 text-[14px] text-white/75">{e.description}</p>
        <p className="mt-2 text-[13px] text-white/50">{e.statusNote}</p>
        <Link
          href={e.href}
          data-testid={`labs-experience-open-${e.testId}`}
          className="mt-5 inline-flex min-h-11 items-center justify-center gap-1.5 self-start rounded-full bg-white px-5 text-[14px] font-semibold text-[#111] transition hover:bg-white/85"
        >
          Open Experience
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

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
      <main className="min-h-dvh bg-[oklch(0.14_0.015_260)] px-5 py-14 text-white">
        <div className="mx-auto max-w-5xl">
          <p className="text-[12.5px] font-medium tracking-[0.14em] text-white/45 uppercase">
            Passport · Labs
          </p>
          <h1 className="font-heading mt-3 text-[clamp(2rem,7vw,3rem)] leading-tight font-bold tracking-tight">
            Things we&apos;re playing with.
          </h1>
          <p className="mt-3 max-w-2xl text-[14px] text-white/55">
            A preview of what we&apos;re building. These can change or
            disappear, and each one says plainly what is real about it.
          </p>

          <h2 className="mt-10 text-[12.5px] font-medium tracking-[0.14em] text-white/45 uppercase">
            Experiences
          </h2>
          <ul
            data-testid="labs-experiences"
            className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {LABS_NOW.map((e) => (
              <li key={e.testId} className="flex">
                <ExperienceCard e={e} />
              </li>
            ))}
          </ul>

          {SEASONAL_ARCHIVE.length ? (
            <>
              <h2 className="mt-14 text-[12.5px] font-medium tracking-[0.14em] text-white/45 uppercase">
                Seasonal Archive
              </h2>
              <p className="mt-2 max-w-2xl text-[14px] text-white/55">
                Out of season, never gone. Everything here still opens; it is
                kept for looking around until its season comes round again.
              </p>
              <ul
                data-testid="labs-seasonal-archive"
                className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                {SEASONAL_ARCHIVE.map((e) => (
                  <li key={e.testId} className="flex">
                    <ExperienceCard e={e} />
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <h2 className="mt-14 text-[12.5px] font-medium tracking-[0.14em] text-white/45 uppercase">
            Prototypes
          </h2>
          <ul className="mt-4 flex max-w-2xl flex-col gap-3">
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
              <ul className="mt-4 flex max-w-2xl flex-col gap-3">
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
