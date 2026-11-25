import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Better Together. Better Local. — Go Have a Day",
  description:
    "A concept for helping local businesses help visitors discover the best experiences their communities have to offer.",
};

/**
 * **The /partners page: the local business recommendation network, as an idea.**
 *
 * A page to show a restaurant owner, a hotel manager or a paddleboard
 * operator on a phone. It is a concept introduction: everything under "How it
 * could work" is proposed, and says so. No partner is named, no testimonial or
 * commitment is invented, and the one call to action is the working
 * `/contribute` form (no account needed) rather than a form of its own.
 */

const PRINCIPLES = [
  "The visitor always comes first.",
  "Recommendations must be relevant and useful.",
  "No pay-to-win rankings.",
  "No referral competitions or leaderboards.",
  "No guaranteed placement for participating businesses.",
  "Local businesses should benefit from helping each other.",
  "Community knowledge makes discovery better.",
];

const IDEAS = [
  "Participating businesses receive their own unique QR code.",
  "Restaurants can display table cards.",
  "Servers and bartenders can share small cards.",
  "Rental companies and hotels can share recommendations.",
  "Visitors scan and discover relevant local experiences.",
  "Businesses can contribute local knowledge.",
  "Basic aggregate analytics help us understand the impact.",
];

function Proposed() {
  return (
    <span className="rounded-full bg-[var(--gh-sun)] px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-[var(--gh-ink)] uppercase">
      Proposed
    </span>
  );
}

function Example({ from, ask, to }: { from: string; ask: string; to: string }) {
  return (
    <div className="rounded-[28px] bg-white p-5 ring-1 ring-black/10">
      <p className="text-[11px] font-bold tracking-[0.16em] text-black/55 uppercase">
        {from}
      </p>
      <p className="ghad-display mt-2 text-xl font-extrabold">{ask}</p>
      <p className="mt-3 text-[var(--gh-ink-soft)]">{to}</p>
    </div>
  );
}

export default function PartnersPage() {
  return (
    <main className="bg-[var(--gh-cream)] text-[var(--gh-ink)]">
      <section className="bg-[var(--gh-forest)] px-5 pt-12 pb-14 text-white sm:px-8 sm:pt-20 sm:pb-20">
        <div className="mx-auto max-w-2xl">
          <p className="text-[11px] font-bold tracking-[0.16em] text-white/75 uppercase">
            Go Have a Day · For local businesses
          </p>
          <h1 className="ghad-display mt-3 text-5xl leading-[1.02] font-extrabold tracking-[-0.03em] sm:text-7xl">
            Better Together. Better Local.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/90 sm:text-xl">
            Helping local businesses help visitors discover the best experiences
            their communities have to offer.
          </p>
          <a
            href="#join"
            className="mt-8 inline-block rounded-full bg-[var(--gh-sun)] px-6 py-3 font-bold text-[var(--gh-ink)]"
          >
            Interested in helping us build this?
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-5 py-12 sm:px-8">
        <h2 className="ghad-display text-3xl font-extrabold tracking-[-0.02em]">
          Visitors are already asking you.
        </h2>
        <p className="mt-3 text-lg text-[var(--gh-ink-soft)]">
          A restaurant customer asks what to do tomorrow. A paddleboard customer
          asks where to eat tonight. A hotel guest asks what is happening
          nearby.
        </p>
        <p className="mt-3 text-lg text-[var(--gh-ink-soft)]">
          You already give great answers. Go Have a Day would like to help
          connect those questions with genuinely useful local recommendations,
          so businesses can help visitors discover other businesses, activities,
          events and experiences.
        </p>

        <div className="mt-8 grid gap-4">
          <Example
            from="At the restaurant"
            ask="“What should we do tomorrow?”"
            to="A scan of the table card shows things to do nearby that suit the day: a paddle on the lake, a trail, something happening that evening."
          />
          <Example
            from="At the paddleboard shop"
            ask="“Where should we eat tonight?”"
            to="A scan of the rental card shows places to eat close by, picked because they are a good fit for tired, happy people, not because anyone paid."
          />
        </div>
      </section>

      <section className="bg-[var(--gh-sand)] px-5 py-12 sm:px-8">
        <div className="mx-auto max-w-2xl">
          <h2 className="ghad-display text-3xl font-extrabold tracking-[-0.02em]">
            What a table card might look like
          </h2>
          <p className="mt-2 text-[var(--gh-ink-soft)]">
            A mock-up to show the idea. The code is a placeholder and does not
            scan.
          </p>
          <div
            role="img"
            aria-label="Mock-up of a table card reading: Planning tomorrow? Scan for ideas nearby. With a placeholder QR code."
            className="mx-auto mt-6 max-w-[290px] rotate-[-2deg] rounded-[24px] bg-white p-6 text-center shadow-xl ring-1 ring-black/10"
          >
            <p className="text-[11px] font-bold tracking-[0.16em] text-[var(--gh-forest)] uppercase">
              Go Have a Day
            </p>
            <p className="ghad-display mt-2 text-2xl leading-tight font-extrabold">
              Planning tomorrow?
            </p>
            <p className="mt-1 text-sm text-black/65">
              Scan for ideas from locals nearby.
            </p>
            <svg
              viewBox="0 0 9 9"
              className="mx-auto mt-4 h-36 w-36"
              shapeRendering="crispEdges"
              aria-hidden="true"
            >
              <rect width="9" height="9" fill="#fff" />
              <g fill="#141414">
                <path d="M0 0h3v3H0zM6 0h3v3H6zM0 6h3v3H0z" />
                <path fill="#fff" d="M1 1h1v1H1zM7 1h1v1H7zM1 7h1v1H1z" />
                <path d="M4 0h1v1H4zM4 2h1v2H4zM5 4h2v1H5zM3 4h1v1H3zM6 6h1v1H6zM8 5h1v1H8zM4 6h1v1H4zM5 8h2v1H5zM8 8h1v1H8z" />
              </g>
            </svg>
            <p className="mt-3 text-[11px] text-black/50">
              Table card · concept mock-up
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-5 py-12 sm:px-8">
        <h2 className="ghad-display text-3xl font-extrabold tracking-[-0.02em]">
          The partner network, in a sentence
        </h2>
        <p className="mt-3 text-lg text-[var(--gh-ink-soft)]">
          Local businesses who know their town best, helping each other&apos;s
          visitors find what they would love, and helping us keep what we
          recommend honest and up to date.
        </p>

        <div className="mt-8 flex items-center gap-3">
          <h2 className="ghad-display text-3xl font-extrabold tracking-[-0.02em]">
            How it could work
          </h2>
          <Proposed />
        </div>
        <p className="mt-2 text-[var(--gh-ink-soft)]">
          This is a simple pilot we would like to try. None of it exists yet. Go
          Have a Day today is the discovery site you can already use; the
          partner side is an idea we want to shape with local businesses.
        </p>
        <ul className="mt-5 grid gap-3">
          {IDEAS.map((idea) => (
            <li
              key={idea}
              className="rounded-2xl bg-white px-4 py-3 ring-1 ring-black/10"
            >
              {idea}
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-[var(--gh-forest-soft)] px-5 py-12 sm:px-8">
        <div className="mx-auto max-w-2xl">
          <h2 className="ghad-display text-3xl font-extrabold tracking-[-0.02em]">
            Our principles
          </h2>
          <ol className="mt-5 grid gap-3">
            {PRINCIPLES.map((p, i) => (
              <li key={p} className="flex gap-3 text-lg">
                <span
                  aria-hidden="true"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--gh-forest)] text-sm font-bold text-white"
                >
                  {i + 1}
                </span>
                <span className="pt-0.5 font-semibold">{p}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="join" className="mx-auto max-w-2xl px-5 py-14 sm:px-8">
        <h2 className="ghad-display text-3xl font-extrabold tracking-[-0.02em]">
          Interested in helping us build this?
        </h2>
        <p className="mt-3 text-lg text-[var(--gh-ink-soft)]">
          We would love to hear from local businesses: what visitors ask you,
          what you wish they knew, and what would make this worth your time.
          Tell us about your business or a local favourite. It takes under a
          minute and needs no account.
        </p>
        <Link
          href="/contribute?from=gohaveaday"
          className="mt-6 inline-block rounded-full bg-[var(--gh-forest)] px-6 py-3 font-bold text-white"
        >
          Connect with Go Have a Day
        </Link>
        <p className="mt-6 text-sm text-black/55">
          <Link href="/discovery" className="underline">
            ← See Go Have a Day today
          </Link>
        </p>
      </section>
    </main>
  );
}
