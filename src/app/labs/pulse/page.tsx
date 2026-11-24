import type { Metadata } from "next";
import Link from "next/link";
import { BRAND, scopeLabel } from "@/lib/pulse/model";
import {
  questionOfTheDay,
  shelves,
  type Card,
  type Shelves,
} from "@/lib/pulse/service";
import { NotReady, pulseStore } from "@/lib/pulse/store";
import {
  CHECK_EXPERIENCE,
  EXPERIENCES,
  STARTERS,
  TEMPLATES,
  experience,
} from "@/lib/pulse/templates";
import { Disclaimer } from "./_ui/Disclaimer";

export const metadata: Metadata = {
  title: { absolute: `${BRAND.hub} — ${BRAND.name}` },
  description:
    "Ask everyone, ask your friends, or compare answers: decide, settle an argument, see what's normal, or rank things. No account. Powered by ELK.",
  openGraph: {
    title: BRAND.hub,
    description:
      "Ask everyone. Ask your friends. Compare answers. Powered by ELK.",
    type: "website",
  },
};

export const dynamic = "force-dynamic";

async function load(): Promise<
  (Shelves & { today: Card | null }) | "not-ready"
> {
  try {
    const store = pulseStore();
    const now = new Date();
    const [listed, today] = await Promise.all([
      store.list(120),
      // The day's pick needs its own migration; without it the page still works.
      questionOfTheDay(store, now).catch(() => null),
    ]);
    return { ...shelves(listed, now), today };
  } catch (e) {
    if (e instanceof NotReady) return "not-ready";
    throw e;
  }
}

const PRIMARY = [
  {
    href: "/labs/pulse/new",
    label: "Ask everyone",
    line: "A public question anyone can answer",
    testId: "pulse-create-cta",
    dark: true,
  },
  {
    href: "/labs/pulse/new?kind=decide",
    label: "Ask your friends",
    line: "Should I do it? A private link",
    testId: "labs-ask-friends",
    dark: false,
  },
  {
    href: "/labs/pulse/new?kind=normal",
    label: "Compare answers",
    line: "Is this normal? Anonymous ranges",
    testId: "labs-compare",
    dark: false,
  },
] as const;

const votes = (n: number) =>
  `${n.toLocaleString("en-CA")} vote${n === 1 ? "" : "s"}`;

function PulseCard({ c, note }: { c: Card; note?: string }) {
  return (
    <li>
      <Link
        href={`/labs/pulse/${c.id}`}
        data-testid="pulse-card"
        className="block rounded-2xl border border-[#e7e3da] bg-white p-4 transition hover:border-[#14161a]/40 focus-visible:ring-2 focus-visible:ring-[#14161a] focus-visible:outline-none"
      >
        <p className="text-[16px] leading-snug font-semibold">{c.question}</p>
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-[#5c6370]">
          {c.kind !== "pulse" ? (
            <span
              className="font-semibold text-[#14161a]"
              data-testid="pulse-card-kind"
            >
              {experience(c.kind).name}
            </span>
          ) : null}
          <span>{votes(c.total)}</span>
          <span>{scopeLabel(c.scope)}</span>
          {note ? <span className="text-[#c2410c]">{note}</span> : null}
          {c.open ? null : <span>Closed</span>}
          {c.hasClaim ? <span>Checks a published claim</span> : null}
        </p>
      </Link>
    </li>
  );
}

function Shelf({
  title,
  id,
  cards,
  note,
}: {
  title: string;
  id: string;
  cards: readonly Card[];
  note?: (c: Card) => string;
}) {
  // A shelf with nothing on it is not shown, rather than apologising.
  if (cards.length === 0) return null;
  return (
    <section aria-labelledby={id} className="mt-9">
      <h2
        id={id}
        className="text-[13px] font-semibold tracking-[0.14em] text-[#5c6370] uppercase"
      >
        {title}
      </h2>
      <ul className="mt-3 grid gap-3">
        {cards.map((c) => (
          <PulseCard key={c.id} c={c} note={note?.(c)} />
        ))}
      </ul>
    </section>
  );
}

export default async function PeoplesPulse() {
  const data = await load();
  return (
    <>
      <section className="pt-6 pb-2">
        <h1
          className="font-heading text-[40px] leading-[1.05] font-bold tracking-tight sm:text-[52px]"
          data-testid="labs-hub-title"
        >
          {BRAND.hub}
        </h1>
        <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-[#3f4550]">
          Ask a question, send the link, and see real answers come in. No
          account, about thirty seconds.
        </p>
        <nav aria-label="Start" className="mt-6 grid gap-2.5 sm:grid-cols-3">
          {PRIMARY.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              data-testid={a.testId}
              className={`flex min-h-[4.5rem] flex-col justify-center rounded-2xl px-5 py-3 transition focus-visible:ring-2 focus-visible:ring-[#14161a] focus-visible:ring-offset-2 focus-visible:outline-none ${
                a.dark
                  ? "bg-[#14161a] text-white hover:bg-black"
                  : "border-2 border-[#14161a] bg-white text-[#14161a] hover:bg-[#f3f1ec]"
              }`}
            >
              <span className="text-[15px] font-bold tracking-[0.08em] uppercase">
                {a.label}
              </span>
              <span
                className={`mt-0.5 text-[13px] ${a.dark ? "text-white/75" : "text-[#5c6370]"}`}
              >
                {a.line}
              </span>
            </Link>
          ))}
        </nav>
        <Link
          href="/check"
          data-testid="labs-pulse-check"
          className="mt-2.5 flex min-h-[4.5rem] items-center justify-between gap-4 rounded-2xl border-2 border-[#e5484d] bg-white px-5 py-3 transition hover:bg-[#fff5f4] focus-visible:ring-2 focus-visible:ring-[#e5484d] focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <span>
            <span className="block text-[15px] font-bold tracking-[0.08em] text-[#e5484d] uppercase">
              {CHECK_EXPERIENCE.name}
            </span>
            <span className="mt-0.5 block text-[13px] text-[#5c6370]">
              {CHECK_EXPERIENCE.line}
            </span>
          </span>
          <span aria-hidden className="text-[22px] text-[#e5484d]">
            →
          </span>
        </Link>
      </section>

      {data === "not-ready" ? (
        <p
          data-testid="pulse-not-ready"
          className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-[14px] text-amber-900"
        >
          People&apos;s Pulse is still being set up here. Its database
          isn&apos;t ready yet, so Pulses can&apos;t be created or answered for
          the moment.
        </p>
      ) : (
        <>
          {data.today ? (
            <section
              aria-labelledby="pulse-today"
              data-testid="pulse-today"
              className="mt-8"
            >
              <h2
                id="pulse-today"
                className="text-[13px] font-semibold tracking-[0.14em] text-[#e5484d] uppercase"
              >
                Question of the day
              </h2>
              <Link
                href={`/labs/pulse/${data.today.id}`}
                data-testid="pulse-today-link"
                className="mt-3 block rounded-3xl bg-[#14161a] p-5 text-white transition hover:bg-black focus-visible:ring-2 focus-visible:ring-[#14161a] focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <span className="font-heading block text-[26px] leading-[1.15] font-bold">
                  {data.today.question}
                </span>
                <span className="mt-3 flex flex-wrap items-center gap-x-3 text-[14px] text-white/75">
                  <span>{votes(data.today.total)}</span>
                  <span>{scopeLabel(data.today.scope)}</span>
                  <span className="ml-auto rounded-full bg-white px-4 py-2 text-[14px] font-semibold text-[#14161a]">
                    Answer
                  </span>
                </span>
              </Link>
            </section>
          ) : null}
          <Shelf
            id="pulse-trending"
            title="Trending"
            cards={data.trending}
            note={(c) => `${c.lastDay} in the last day`}
          />
          <Shelf
            id="pulse-worth"
            title="Worth sharing"
            cards={data.worthSharing.filter(
              (c) => !data.trending.some((t) => t.id === c.id),
            )}
          />
          <Shelf id="pulse-local" title="Local questions" cards={data.local} />
          <Shelf
            id="pulse-recent"
            title="Recent"
            cards={data.recent.filter(
              (c) => !data.trending.some((t) => t.id === c.id),
            )}
          />
          {data.recent.length < 3 ? (
            <section
              aria-labelledby="pulse-starters"
              data-testid="pulse-starters"
              className="mt-9"
            >
              <h2
                id="pulse-starters"
                className="text-[13px] font-semibold tracking-[0.14em] text-[#5c6370] uppercase"
              >
                Questions worth asking
              </h2>
              <p className="mt-2 text-[14px] text-[#5c6370]">
                Nobody has answered these yet. Tap one, change the words if you
                like, and send it to your people.
              </p>
              <ul className="mt-3 grid gap-2">
                {STARTERS.map((q) => (
                  <li key={q}>
                    <Link
                      href={`/labs/pulse/new?q=${encodeURIComponent(q)}`}
                      data-testid="pulse-starter"
                      className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-[#e7e3da] bg-white px-4 py-3 text-[15px] font-semibold transition hover:border-[#14161a]/40 focus-visible:ring-2 focus-visible:ring-[#14161a] focus-visible:outline-none"
                    >
                      <span>{q}</span>
                      <span aria-hidden className="text-[#5c6370]">
                        Ask →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <section aria-labelledby="labs-experiences" className="mt-10">
        <h2
          id="labs-experiences"
          className="text-[13px] font-semibold tracking-[0.14em] text-[#5c6370] uppercase"
        >
          Pick a way to ask
        </h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {EXPERIENCES.map((e) => (
            <li key={e.kind}>
              <Link
                href={`/labs/pulse/new?kind=${e.kind}`}
                data-testid={`labs-exp-${e.kind}`}
                className="flex h-full flex-col rounded-2xl border border-[#e7e3da] bg-white p-4 transition hover:border-[#14161a]/50 focus-visible:ring-2 focus-visible:ring-[#14161a] focus-visible:outline-none"
              >
                <span className="font-heading text-[20px] leading-tight font-bold">
                  {e.name}
                </span>
                <span className="mt-1 text-[14px] leading-snug text-[#3f4550]">
                  {e.line}
                </span>
                <span className="mt-3 text-[13px] text-[#5c6370] italic">
                  “{e.example}”
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="labs-templates" className="mt-8">
        <h2
          id="labs-templates"
          className="text-[13px] font-semibold tracking-[0.14em] text-[#5c6370] uppercase"
        >
          Or start from a template
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <li key={t.id}>
              <Link
                href={`/labs/pulse/new?t=${t.id}`}
                title={t.line}
                data-testid={`labs-template-${t.id}`}
                className="inline-flex min-h-11 items-center rounded-full border border-[#d9d4c8] bg-white px-4 text-[14px] font-medium text-[#14161a] transition hover:border-[#14161a]"
              >
                {t.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-[13px] font-semibold tracking-[0.14em] text-[#5c6370] uppercase">
          How it works
        </h2>
        <ol className="mt-3 grid gap-2 text-[15px] text-[#3f4550]">
          <li>1. Pick a way to ask, and write your question.</li>
          <li>2. Send your link by text, email or anywhere you talk.</li>
          <li>
            3. People answer — no sign-up — and see the results right away.
          </li>
          <li>
            4. Compare your circle with everyone. Small groups stay hidden.
          </li>
        </ol>
      </section>
      <div className="mt-8">
        <Disclaimer />
      </div>
    </>
  );
}
