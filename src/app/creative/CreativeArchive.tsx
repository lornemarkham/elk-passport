"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import type {
  Availability,
  CreativeCategory,
  CreativeStatus,
  CreativeWork,
} from "./archive";

export interface ArchiveCard {
  readonly work: CreativeWork;
  readonly open: Availability;
  readonly sources: readonly { readonly path: string; readonly url?: string }[];
}

/** Each drawer's colour: a tab on the card, a dot on the chip. */
const ACCENT: Readonly<Record<CreativeCategory, string>> = {
  Experiences: "#ff6b3d",
  October: "#f08c00",
  Christmas: "#3fae7a",
  Discovery: "#4aa8d8",
  "Design Evolution": "#b58cff",
  Brainstorming: "#f2c94c",
  "Product Philosophy": "#e8e0cf",
};

const STAMP: Readonly<Record<CreativeStatus, string>> = {
  experimental: "border-[#f2c94c]/70 text-[#f2c94c]",
  active: "border-emerald-400/70 text-emerald-300",
  archived: "border-[#d8cbb2]/60 text-[#d8cbb2]",
  missing: "border-[#ff6b5a]/80 text-[#ff8a7a]",
};

const STATUSES: readonly CreativeStatus[] = [
  "active",
  "experimental",
  "archived",
  "missing",
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, "-");

function haystack({ work, sources }: ArchiveCard): string {
  return [
    work.name,
    work.description,
    work.category,
    work.notes,
    work.originalRoute,
    work.route,
    work.commit?.hash,
    work.commit?.date,
    work.commit?.subject,
    ...sources.map((s) => s.path),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * The vault: one search across everything the record says, a drawer per
 * category, and a card per original that says where it came from, where it
 * is now, and whether it opens here.
 */
export function CreativeArchive({
  cards,
  categories,
  statusLabel,
  initialQuery,
  initialCategory,
}: {
  cards: readonly ArchiveCard[];
  categories: readonly CreativeCategory[];
  statusLabel: Readonly<Record<CreativeStatus, string>>;
  initialQuery: string;
  initialCategory: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<CreativeCategory | null>(
    categories.find((c) => slug(c) === initialCategory) ?? null,
  );
  const [status, setStatus] = useState<CreativeStatus | null>(null);

  // The search and the open drawer live in the URL, so a view of the archive
  // can be shared ("everything that needs restoring") and survives a reload.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (query) params.set("q", query);
    else params.delete("q");
    if (category) params.set("c", slug(category));
    else params.delete("c");
    const search = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${search ? `?${search}` : ""}`,
    );
  }, [query, category]);

  const indexed = useMemo(
    () => cards.map((card) => ({ card, text: haystack(card) })),
    [cards],
  );
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matching = indexed
    .filter(({ text }) => words.every((w) => text.includes(w)))
    .filter(({ card }) => !status || card.work.status === status)
    .map(({ card }) => card);
  const shown = matching.filter(
    (c) => !category || c.work.category === category,
  );

  const total = cards.length;
  const openHere = cards.filter((c) => c.open.href).length;
  const needsRestoring = cards.filter(
    (c) => c.work.status === "missing",
  ).length;

  return (
    <main className="min-h-dvh overflow-x-clip bg-[#13100c] text-[#efe6d4]">
      <div className="mx-auto max-w-6xl px-5 pt-14 pb-24 md:px-8 md:pt-20">
        <a
          href="/labs"
          className="text-[12px] font-medium tracking-[0.18em] text-[#efe6d4]/45 uppercase transition hover:text-[#efe6d4]/80"
        >
          ← Labs
        </a>
        <header className="mt-8 max-w-3xl">
          <p className="text-[12px] font-medium tracking-[0.3em] text-[#f08c00] uppercase">
            ELK · Passport · Go Have A Day
          </p>
          <h1 className="font-heading mt-4 text-[clamp(2.6rem,10vw,5.5rem)] leading-[0.95] font-semibold tracking-[-0.03em]">
            ELK Creative Archive
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-[#efe6d4]/70">
            Everything we made while finding out what Passport is for — the
            experiments, the prototypes, every round of design, and the
            documents that started it. Kept as they were made. Nothing here is
            the product; all of it is how we got there.
          </p>
          <dl
            data-testid="creative-stats"
            className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-[13px] text-[#efe6d4]/55"
          >
            <Stat label="originals" value={total} />
            <Stat label="open from here" value={openHere} />
            <Stat label="need restoring" value={needsRestoring} />
          </dl>
        </header>

        <div className="sticky top-0 z-10 -mx-5 mt-12 border-b border-[#efe6d4]/10 bg-[#13100c]/90 px-5 py-4 backdrop-blur md:-mx-8 md:px-8">
          <label className="flex items-center gap-3 rounded-full border border-[#efe6d4]/15 bg-[#efe6d4]/[0.04] px-4 py-2.5 focus-within:border-[#efe6d4]/45">
            <Search className="h-4 w-4 shrink-0 text-[#efe6d4]/45" />
            <span className="sr-only">Search the archive</span>
            <input
              data-testid="creative-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search names, routes, files, commits…"
              className="w-full bg-transparent text-[15px] text-[#efe6d4] placeholder:text-[#efe6d4]/35 focus:outline-none"
            />
          </label>
          <div
            role="group"
            aria-label="Drawers"
            className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0"
          >
            <Chip
              testId="creative-category-all"
              active={!category}
              onClick={() => setCategory(null)}
              label="Everything"
              count={matching.length}
            />
            {categories.map((c) => (
              <Chip
                key={c}
                testId={`creative-category-${slug(c)}`}
                active={category === c}
                onClick={() => setCategory(category === c ? null : c)}
                label={c}
                count={matching.filter((m) => m.work.category === c).length}
                accent={ACCENT[c]}
              />
            ))}
          </div>
          <div
            role="group"
            aria-label="Status"
            className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 md:mx-0 md:px-0"
          >
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                data-testid={`creative-status-${s}`}
                aria-pressed={status === s}
                onClick={() => setStatus(status === s ? null : s)}
                className={`shrink-0 rounded-sm border px-2 py-0.5 text-[10.5px] font-semibold tracking-[0.14em] uppercase transition ${
                  status === s
                    ? STAMP[s]
                    : "border-[#efe6d4]/15 text-[#efe6d4]/45 hover:text-[#efe6d4]/75"
                }`}
              >
                {statusLabel[s]}
              </button>
            ))}
          </div>
        </div>

        <p
          data-testid="creative-count"
          aria-live="polite"
          className="mt-6 text-[13px] text-[#efe6d4]/45"
        >
          {shown.length === 1 ? "1 original" : `${shown.length} originals`}
          {category ? ` in ${category}` : ""}
          {query ? ` matching “${query}”` : ""}
        </p>

        {shown.length === 0 ? (
          <p className="font-heading mt-16 text-center text-2xl text-[#efe6d4]/50">
            Nothing in the vault matches that. Yet.
          </p>
        ) : (
          (category ? [category] : categories).map((c) => {
            const inDrawer = shown.filter((s) => s.work.category === c);
            if (!inDrawer.length) return null;
            return (
              <section
                key={c}
                className="mt-12"
                aria-labelledby={`drawer-${slug(c)}`}
              >
                <h2
                  id={`drawer-${slug(c)}`}
                  className="flex items-baseline gap-3 border-t border-[#efe6d4]/10 pt-5"
                >
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 translate-y-[-2px] rounded-full"
                    style={{ background: ACCENT[c] }}
                  />
                  <span className="font-heading text-[28px] tracking-[-0.02em]">
                    {c}
                  </span>
                  <span className="text-[13px] text-[#efe6d4]/40">
                    {inDrawer.length}
                  </span>
                </h2>
                <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {inDrawer.map((card) => (
                    <li key={card.work.id}>
                      <Card card={card} statusLabel={statusLabel} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}

        <footer className="mt-24 max-w-2xl border-t border-[#efe6d4]/10 pt-6 text-[13px] leading-relaxed text-[#efe6d4]/45">
          The record behind this page is{" "}
          <code className="text-[#efe6d4]/70">src/app/creative/archive.ts</code>
          , and its test fails if an original goes missing without being marked.
          Dates are the commits that first added each thing; where that commit
          was a bulk snapshot, the card says so rather than guessing.
        </footer>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="sr-only">{label}</dt>
      <dd className="font-heading text-[28px] leading-none text-[#efe6d4]">
        {value}
      </dd>
      <span aria-hidden>{label}</span>
    </div>
  );
}

function Chip({
  testId,
  active,
  onClick,
  label,
  count,
  accent,
}: {
  testId: string;
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  accent?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={active}
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] whitespace-nowrap transition ${
        active
          ? "border-[#efe6d4] bg-[#efe6d4] text-[#13100c]"
          : "border-[#efe6d4]/15 text-[#efe6d4]/75 hover:border-[#efe6d4]/40"
      }`}
    >
      {accent ? (
        <span
          aria-hidden
          className="h-2 w-2 rounded-full"
          style={{ background: accent }}
        />
      ) : null}
      {label}
      <span className={active ? "text-[#13100c]/55" : "text-[#efe6d4]/35"}>
        {count}
      </span>
    </button>
  );
}

function Card({
  card: { work, open, sources },
  statusLabel,
}: {
  card: ArchiveCard;
  statusLabel: Readonly<Record<CreativeStatus, string>>;
}) {
  const missing = work.status === "missing";
  const moved = work.route && work.route !== work.originalRoute;
  return (
    <article
      data-testid={`creative-card-${work.id}`}
      data-status={work.status}
      className={`group relative flex h-full flex-col overflow-hidden rounded-xl border p-5 pt-6 transition ${
        missing
          ? "border-dashed border-[#ff6b5a]/35 bg-[#1a1410]"
          : "border-[#efe6d4]/10 bg-[#1d1813] hover:-translate-y-0.5 hover:border-[#efe6d4]/30"
      }`}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-1"
        style={{
          background: ACCENT[work.category],
          opacity: missing ? 0.4 : 1,
        }}
      />
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-heading text-[21px] leading-tight tracking-[-0.01em]">
          {work.name}
        </h3>
        <span
          data-testid={`creative-status-of-${work.id}`}
          className={`mt-1 max-w-[8.5rem] shrink-0 rotate-[-3deg] rounded-sm border-2 px-1.5 py-0.5 text-center text-[9.5px] leading-tight font-bold tracking-[0.14em] uppercase ${STAMP[work.status]}`}
        >
          {statusLabel[work.status]}
        </span>
      </div>
      <p className="mt-2 text-[14.5px] leading-relaxed text-[#efe6d4]/70">
        {work.description}
      </p>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11.5px] leading-snug text-[#efe6d4]/50">
        {work.originalRoute ? (
          <>
            <dt>{moved ? "first at" : "route"}</dt>
            <dd className="break-all text-[#efe6d4]/75">
              {work.originalRoute}
            </dd>
          </>
        ) : null}
        {moved ? (
          <>
            <dt>now at</dt>
            <dd className="break-all text-[#efe6d4]/75">{work.route}</dd>
          </>
        ) : null}
        <dt>source</dt>
        <dd className="flex flex-col">
          {sources.map((s) =>
            s.url ? (
              <a
                key={s.path}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="break-all text-[#efe6d4]/75 underline decoration-[#efe6d4]/20 underline-offset-2 hover:decoration-[#efe6d4]/70"
              >
                {s.path}
              </a>
            ) : (
              <span key={s.path} className="break-all text-[#efe6d4]/75">
                {s.path}
              </span>
            ),
          )}
        </dd>
        <dt>made</dt>
        <dd className="text-[#efe6d4]/75">
          {work.commit ? (
            <span title={work.commit.subject}>
              {work.commit.date} · {work.commit.hash}
            </span>
          ) : (
            "never committed"
          )}
        </dd>
      </dl>

      {work.notes ? (
        <details className="mt-3 text-[13px] text-[#efe6d4]/60">
          <summary className="cursor-pointer text-[12px] tracking-[0.12em] text-[#efe6d4]/45 uppercase select-none hover:text-[#efe6d4]/75">
            History
          </summary>
          <p className="mt-2 leading-relaxed">{work.notes}</p>
        </details>
      ) : null}

      <div className="mt-auto pt-5">
        {open.href ? (
          <a
            href={open.href}
            data-testid={`creative-open-${work.id}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#efe6d4] px-4 py-2 text-[13px] font-semibold text-[#13100c] transition hover:bg-white"
          >
            Open the original
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        ) : null}
        {open.note ? (
          <p
            data-testid={`creative-closed-${work.id}`}
            className={`text-[12.5px] leading-snug ${open.href ? "mt-2 text-[#efe6d4]/45" : missing ? "text-[#ff8a7a]/85" : "text-[#efe6d4]/50"}`}
          >
            {open.note}
          </p>
        ) : null}
      </div>
    </article>
  );
}
