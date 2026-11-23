import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import {
  LocalFavouriteCard,
  HoursNote,
} from "@/components/featured/LocalFavouriteCard";
import {
  LOCAL_FAVOURITES,
  favouriteBySlug,
  phoneText,
  type Sourced,
} from "@/domain/featured/locals";
import { sizedImage } from "@/lib/media/sizedImage";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return LOCAL_FAVOURITES.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const f = favouriteBySlug((await params).slug);
  if (!f) return {};
  return {
    title: `${f.name} — ${f.place} — Go Have a Day`,
    description: f.line,
    openGraph: {
      title: f.name,
      description: f.line,
      ...(f.photos[0] ? { images: [{ url: f.photos[0].url }] } : {}),
    },
  };
}

const host = (url: string) => new URL(url).hostname.replace(/^www\./, "");

function Source({ fact, label }: { fact: Sourced<unknown>; label: string }) {
  return (
    <li>
      <span className="font-semibold text-black/80">{label}:</span> “
      {fact.quote}” —{" "}
      <a
        href={fact.source}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2"
      >
        {host(fact.source)}
      </a>
      , read {fact.checked}
    </li>
  );
}

/**
 * **A local favourite's own page** — shareable, so the pub can send its
 * customers here too. The destination card, the rest of its photographs,
 * what to pair it with in Passport, and where every fact came from.
 */
export default async function FavouritePage({ params }: Props) {
  const f = favouriteBySlug((await params).slug);
  if (!f) notFound();
  const more = f.photos.slice(1);
  return (
    <main className="mx-auto max-w-4xl px-4 pt-4 pb-16 sm:px-6 sm:pt-8">
      <LocalFavouriteCard
        favourite={f}
        headingLevel="h1"
        linkToPage={false}
        priority
      />

      {more.length > 0 && (
        <ul
          className="mt-3 grid grid-cols-2 gap-3"
          aria-label={`More photos of ${f.name}`}
        >
          {more.map((p) => (
            <li
              key={p.url}
              className="relative aspect-[4/3] overflow-hidden rounded-2xl"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- the publisher's own host, resized by address (sizedImage) */}
              <img
                {...sizedImage(p.url, [500, 960])}
                sizes="(min-width: 896px) 440px, 50vw"
                alt={p.alt}
                decoding="async"
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <span className="absolute right-2 bottom-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] text-white/85">
                {p.credit}
              </span>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-10" aria-labelledby="pair">
        <h2
          id="pair"
          className="ghad-display text-3xl font-extrabold tracking-[-0.02em]"
        >
          Make a day of it
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {f.pairsWith.map((p) => (
            <li key={p.href}>
              <Link
                href={p.href}
                className="flex h-full flex-col justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-black/10 transition hover:-translate-y-0.5 hover:ring-black/25"
              >
                <span>
                  <span className="block text-lg leading-tight font-bold">
                    {p.label}
                  </span>
                  <span className="mt-1 block text-sm text-black/65">
                    {p.line}
                  </span>
                </span>
                <ArrowRight className="h-5 w-5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 grid gap-6 sm:grid-cols-2" aria-label="Details">
        <div>
          <h2 className="text-lg font-bold">Getting there</h2>
          <p className="mt-1 text-base">{f.address.value}</p>
          {f.phone && (
            <p className="mt-1 text-base">
              <a
                href={`tel:${f.phone.value}`}
                className="underline underline-offset-4"
              >
                {phoneText(f.phone.value)}
              </a>
            </p>
          )}
          <HoursNote favourite={f} className="mt-1 text-sm text-black/65" />
          {!f.hours.confirmed && f.hours.published && (
            <p className="mt-1 text-sm text-black/65">
              The pub&apos;s own site says: “{f.hours.published.quote}”.
            </p>
          )}
          {f.social.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-3 text-sm">
              {f.social.map((s) => (
                <a
                  key={s.url}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold underline underline-offset-4"
                >
                  {s.label}
                </a>
              ))}
            </p>
          )}
        </div>
        <div>
          <h2 className="text-lg font-bold">In their words</h2>
          <p className="mt-1 text-base text-black/80">“{f.said.value}”</p>
          <p className="mt-1 text-sm text-black/55">— {host(f.said.source)}</p>
        </div>
      </section>

      <section
        className="mt-10 rounded-2xl bg-black/[0.035] p-4 text-sm text-black/65"
        aria-labelledby="why"
      >
        <h2 id="why" className="font-bold text-black/85">
          Why it&apos;s here, and where this comes from
        </h2>
        <p className="mt-1">
          A local favourite we pick because it fits the experiences it appears
          in. Every detail below was read from a public page on the day shown;
          check hours with the pub before you go.
        </p>
        <ul className="mt-2 space-y-1">
          <Source fact={f.said} label="Description" />
          <Source fact={f.address} label="Address" />
          <Source fact={f.at} label="Map point" />
          {f.phone && <Source fact={f.phone} label="Phone" />}
          {f.website && <Source fact={f.website} label="Website" />}
          {!f.hours.confirmed && f.hours.published && (
            <Source fact={f.hours.published} label="Hours, as published" />
          )}
        </ul>
        <p className="mt-2">
          <Link
            href={`/passport/${f.atlasId}?kind=Organization&atlas=1`}
            className="underline underline-offset-2"
          >
            What Atlas knows about {f.name}
          </Link>
        </p>
      </section>
    </main>
  );
}
