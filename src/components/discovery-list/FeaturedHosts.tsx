import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  FEATURED_HOSTS,
  disclosure,
  type FeaturedHost,
} from "@/domain/featured/hosts";

/**
 * **A featured host, between the shelves** — one tasteful placement, not a
 * banner over the page (owner brief, 2026-11-08, P7). Every host gets the
 * same card; see `hosts.ts` for what one may and may not say.
 */
export function FeaturedHosts({
  hosts = FEATURED_HOSTS,
}: {
  readonly hosts?: readonly FeaturedHost[];
}) {
  if (hosts.length === 0) return null;
  return (
    <section aria-label="Featured hosts" data-testid="featured-hosts">
      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {hosts.map((host) => (
          <li
            key={host.id}
            data-testid={`featured-${host.id}`}
            className="flex flex-col justify-between gap-4 rounded-[28px] bg-[var(--gh-forest,#1f4d3a)] p-6 text-white sm:flex-row sm:items-end sm:p-8"
          >
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold tracking-[0.16em] text-[var(--gh-sun,#ffd166)] uppercase">
                {disclosure(host)}
              </p>
              <h2 className="ghad-display mt-2 text-3xl leading-tight font-extrabold tracking-[-0.03em] sm:text-4xl">
                {host.name}
                <span className="font-semibold text-white/75">
                  {" "}
                  with {host.host}
                </span>
              </h2>
              <p className="mt-2 text-base text-white/85 sm:text-lg">
                {host.line}
              </p>
              <ul
                className="mt-3 flex flex-wrap gap-2"
                aria-label="What they do"
              >
                {host.doing.map((d) => (
                  <li
                    key={d}
                    className="rounded-full bg-white/12 px-3 py-1 text-sm font-semibold"
                  >
                    {d}
                  </li>
                ))}
              </ul>
            </div>
            {host.href && (
              <Link
                href={host.href}
                className="inline-flex min-h-12 shrink-0 items-center gap-2 self-start rounded-full bg-white px-5 text-base font-semibold text-[var(--gh-ink,#111)] sm:self-end"
              >
                {host.cta ?? "Have a look"}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
