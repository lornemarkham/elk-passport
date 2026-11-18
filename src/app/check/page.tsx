import type { Metadata } from "next";
import Link from "next/link";
import { ASSESSMENT_INFO, CHECK_BRAND } from "@/lib/pulse/check";
import { checkShelves, type CheckShelves } from "@/lib/pulse/checkService";
import { checkStore, type CheckListed } from "@/lib/pulse/checkStore";
import {
  BRAND,
  PROVINCES,
  isProvince,
  provinceName,
  scopeLabel,
} from "@/lib/pulse/model";
import { NotReady } from "@/lib/pulse/store";

export const metadata: Metadata = {
  title: { absolute: `${CHECK_BRAND.name} — ${CHECK_BRAND.line}` },
  description:
    "Bring a claim you saw online, read what the sources actually say, and share the check back into the conversation. No account. Powered by ELK.",
  openGraph: {
    title: `${CHECK_BRAND.name} · ${BRAND.name}`,
    description: CHECK_BRAND.line,
    type: "website",
  },
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const plural = (n: number, one: string) =>
  `${n.toLocaleString("en-CA")} ${one}${n === 1 ? "" : "s"}`;

function CheckCard({ c }: { c: CheckListed }) {
  const info = ASSESSMENT_INFO[c.assessment];
  return (
    <li>
      <Link
        href={`/check/${c.slug}`}
        data-testid="check-card"
        className="block rounded-2xl border border-[#e7e3da] bg-white p-4 transition hover:border-[#14161a]/40 focus-visible:ring-2 focus-visible:ring-[#14161a] focus-visible:outline-none"
      >
        <p
          className="text-[12px] font-extrabold tracking-[0.12em] uppercase"
          style={{ color: info.color }}
        >
          {info.label}
        </p>
        <p className="mt-1 text-[16px] leading-snug font-semibold">
          “{c.claim}”
        </p>
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-[#5c6370]">
          <span>{scopeLabel(c.scope)}</span>
          <span>{plural(c.sources, "source")}</span>
          <span>{plural(c.votes, "vote")}</span>
          {c.posts ? <span>{plural(c.posts, "post")}</span> : null}
          {c.corrections ? (
            <span className="text-[#6d28d9]">
              Corrected{" "}
              {new Date(c.updatedAt).toLocaleDateString("en-CA", {
                month: "short",
                day: "numeric",
              })}
            </span>
          ) : null}
        </p>
      </Link>
    </li>
  );
}

function Shelf({
  id,
  title,
  line,
  items,
  empty,
}: {
  id: string;
  title: string;
  line: string;
  items: readonly CheckListed[];
  empty: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className="mt-9"
      data-testid={`check-shelf-${id}`}
    >
      <h2
        id={id}
        className="text-[13px] font-semibold tracking-[0.14em] text-[#5c6370] uppercase"
      >
        {title}
      </h2>
      <p className="mt-0.5 text-[12.5px] text-[#8a909a]">{line}</p>
      {items.length ? (
        <ul className="mt-3 grid gap-3">
          {items.map((c) => (
            <CheckCard key={c.pulseId} c={c} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[14px] text-[#8a909a]">{empty}</p>
      )}
    </section>
  );
}

export default async function CheckHome({ searchParams }: Props) {
  const sp = await searchParams;
  const p = typeof sp.p === "string" && isProvince(sp.p) ? sp.p : null;
  let shelves: CheckShelves | "not-ready";
  try {
    shelves = checkShelves(await checkStore().list(120), p);
  } catch (e) {
    if (!(e instanceof NotReady)) throw e;
    shelves = "not-ready";
  }
  return (
    <div className="pt-4">
      <p className="text-[12px] font-bold tracking-[0.16em] text-[#e5484d] uppercase">
        {CHECK_BRAND.name}
      </p>
      <h1 className="font-heading mt-2 text-[34px] leading-[1.1] font-bold tracking-tight sm:text-[42px]">
        Seen a claim? Check it.
      </h1>
      <p className="mt-3 text-[16px] leading-relaxed text-[#3f4550]">
        Bring a post, screenshot or headline. Read what the sources actually
        say. Then share the check back into the conversation, where others can
        look at the evidence and have their say.
      </p>
      <Link
        href="/check/new"
        data-testid="check-start"
        className="mt-5 flex min-h-14 items-center justify-center rounded-full bg-[#14161a] px-6 text-[17px] font-semibold text-white hover:bg-black"
      >
        Check a claim
      </Link>
      <ol className="mt-5 grid grid-cols-3 gap-2 text-center text-[12.5px] font-semibold text-[#3f4550]">
        {["Submit it", "Investigate it", "Share it back"].map((s, i) => (
          <li
            key={s}
            className="rounded-xl border border-[#e7e3da] bg-white px-2 py-3"
          >
            <span className="block text-[18px] text-[#e5484d]">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      <p className="mt-4 text-[12.5px] leading-relaxed text-[#5c6370]">
        A Pulse Check is the reading of the person who asked, from sources
        People&apos;s Pulse opened and quotes word for word. It is not
        independent verification, there is no automatic web search, and a vote
        never decides what is true.
      </p>

      {shelves === "not-ready" ? (
        <p className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-[15px] text-amber-900">
          Pulse Check is still being set up here. Try again soon.
        </p>
      ) : (
        <>
          <form
            method="get"
            className="mt-9 flex items-end gap-2"
            data-testid="check-place-filter"
          >
            <label className="grid flex-1 gap-1 text-[13px] font-medium text-[#5c6370]">
              Questions about
              <select
                name="p"
                defaultValue={p ?? ""}
                className="min-h-12 rounded-xl border border-[#d9d4c8] bg-white px-3 text-[16px] text-[#14161a]"
              >
                <option value="">All of Canada</option>
                {PROVINCES.map((x) => (
                  <option key={x.code} value={x.code}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="min-h-12 rounded-xl border border-[#14161a] bg-white px-4 text-[15px] font-semibold"
            >
              Show
            </button>
          </form>
          {p ? (
            <Shelf
              id="local"
              title={`About ${provinceName(p)}`}
              line="Checks whose claim is about this province or a town in it. Never where anyone is."
              items={shelves.local}
              empty="No checks about here yet."
            />
          ) : null}
          <Shelf
            id="trending"
            title="Trending"
            line="Most votes and posts in the last day."
            items={shelves.trending}
            empty="Nothing is trending right now."
          />
          <Shelf
            id="recent"
            title="Recent"
            line="Newest first."
            items={shelves.recent}
            empty="No checks yet. Be the first."
          />
          <Shelf
            id="discussed"
            title="Most discussed"
            line="Most posts."
            items={shelves.discussed}
            empty="No conversations yet."
          />
          <Shelf
            id="updated"
            title="Recently updated evidence"
            line="Checks corrected since they were published."
            items={shelves.updated}
            empty="No corrections yet."
          />
        </>
      )}
    </div>
  );
}
