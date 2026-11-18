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
import { Disclaimer } from "./_ui/Disclaimer";

export const metadata: Metadata = {
  title: { absolute: `${BRAND.name} — ${BRAND.tagline}` },
  description:
    "Ask a question, share the link, and see what people really think — everyone, your circle, and by province.",
  openGraph: {
    title: BRAND.name,
    description: BRAND.tagline,
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
  empty,
  note,
}: {
  title: string;
  id: string;
  cards: readonly Card[];
  empty: string;
  note?: (c: Card) => string;
}) {
  return (
    <section aria-labelledby={id} className="mt-9">
      <h2
        id={id}
        className="text-[13px] font-semibold tracking-[0.14em] text-[#5c6370] uppercase"
      >
        {title}
      </h2>
      {cards.length === 0 ? (
        <p className="mt-3 text-[14px] text-[#5c6370]">{empty}</p>
      ) : (
        <ul className="mt-3 grid gap-3">
          {cards.map((c) => (
            <PulseCard key={c.id} c={c} note={note?.(c)} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function PeoplesPulse() {
  const data = await load();
  return (
    <>
      <section className="pt-6 pb-2">
        <h1 className="font-heading text-[40px] leading-[1.05] font-bold tracking-tight sm:text-[52px]">
          {BRAND.tagline}
        </h1>
        <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-[#3f4550]">
          Ask a question. Share the link. Watch the answers come in — from
          everyone, from the people your link reached, and province by province.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/labs/pulse/new"
            data-testid="pulse-create-cta"
            className="inline-flex min-h-12 items-center rounded-full bg-[#14161a] px-6 text-[16px] font-semibold text-white transition hover:bg-black focus-visible:ring-2 focus-visible:ring-[#14161a] focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Create a Pulse
          </Link>
          <span className="text-[14px] text-[#5c6370]">
            No account. About 30 seconds.
          </span>
        </div>
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
            empty="Nothing is moving fast right now."
            note={(c) => `${c.lastDay} in the last day`}
          />
          <Shelf
            id="pulse-popular"
            title="Popular"
            cards={data.popular}
            empty="No votes yet — be the first to ask."
          />
          <Shelf
            id="pulse-recent"
            title="Recent"
            cards={data.recent}
            empty="No Pulses yet. Ask the first one."
          />
        </>
      )}

      <section className="mt-12">
        <h2 className="text-[13px] font-semibold tracking-[0.14em] text-[#5c6370] uppercase">
          How it works
        </h2>
        <ol className="mt-3 grid gap-2 text-[15px] text-[#3f4550]">
          <li>1. Ask a clear question with two or more answers.</li>
          <li>2. Share your link by text, email or anywhere you talk.</li>
          <li>
            3. Friends vote — no sign-up — and see the results right away.
          </li>
          <li>4. Compare your circle with everyone, live.</li>
        </ol>
      </section>
      <div className="mt-8">
        <Disclaimer />
      </div>
    </>
  );
}
