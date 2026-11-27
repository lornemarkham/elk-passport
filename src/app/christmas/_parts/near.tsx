import Link from "next/link";
import { FindCard } from "@/components/christmas/FindCard";
import { PinCard } from "@/components/christmas/lights/PinCard";
import { AtlasDown } from "@/components/christmas/parts";
import { townById } from "@/domain/discovery/towns";
import { answer, writeAsk, type Ask } from "@/domain/christmas/discover";
import { seasonsBest } from "@/domain/christmas/best";
import { around } from "@/domain/christmas/around";
import { longRun } from "@/domain/christmas/ways";
import type { PinView } from "@/domain/christmas/lights/model";
import { inNorthOkanagan, matchesFeatured } from "@/domain/christmas/featured";
import { christmasFinds } from "../_server/corpus";
import { lightsFor, viewer } from "../_server/lights";

/** Recommendations on the front page: a few strong ones, not a directory. */
export const NEAR_FINDS = 4;
export const NEAR_PINS = 3;

/**
 * **Happening near you** — the old front page's six rows, distilled to
 * the four strongest Atlas finds and the three community displays nearest
 * in time. It is the only part of the front page that waits on Atlas, so it
 * streams in behind the six ways rather than holding the page back.
 *
 * The order is `around`'s: Happening soon first (Atlas's dates, soonest
 * first), then lights, markets, Santa and festive things, each find once.
 * Community pins are local listings checked by a person and are shown
 * apart from Atlas's finds, as before.
 */
export async function NearYou({
  ask,
  today,
  discoverHref,
  lightsHref,
}: {
  readonly ask: Ask;
  readonly today: string;
  readonly discoverHref: string;
  readonly lightsHref: string;
}) {
  const [corpus, lights] = await Promise.all([
    christmasFinds(ask, today),
    viewer().then((v) => lightsFor(v)),
  ]);
  const town = townById(ask.at);
  const townName = town?.name.replace(/,\s*BC$/, "");
  // The featured events are said once, above; the feed keeps its own copy out.
  const finds0 = inNorthOkanagan(ask.at)
    ? corpus.finds.filter((f) => !matchesFeatured(f.experience.title))
    : corpus.finds;
  const answered = answer(finds0, ask);
  const sections = around(answered, today, lights.pins, ask.km);
  // `around`'s order, except that a year-long "run" doesn't lead (`longRun`).
  const finds = unique(
    sections.flatMap((s) => s.finds),
    (f) => f.experience.id,
  )
    .map((f, i) => ({ f, i }))
    .sort((a, b) => Number(longRun(a.f)) - Number(longRun(b.f)) || a.i - b.i)
    .map(({ f }) => f)
    .slice(0, NEAR_FINDS);
  const pins = unique(
    sections.flatMap((s) => s.pins),
    (p) => p.id,
  ).slice(0, NEAR_PINS);
  const nearPins = unique(
    sections.flatMap((s) => s.pins),
    (p) => p.id,
  );
  const best = seasonsBest(
    answered.shelves.find((s) => s.id === "near")?.finds ?? [],
    nearPins.length,
  );
  const origin = town
    ? { latitude: town.latitude, longitude: town.longitude }
    : undefined;

  return (
    <section id="near" className="scroll-mt-20" data-testid="near-you">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-bold tracking-[0.14em] text-[#b3242f] uppercase">
            Happening near you
          </p>
          <h2 className="ghad-display mt-1 text-3xl leading-[1] font-extrabold tracking-[-0.03em] sm:text-4xl">
            Christmas around {townName ?? "you"}{" "}
            <span className="text-base font-semibold text-[var(--gh-ink-soft)]">
              within {ask.km} km
            </span>
          </h2>
        </div>
        <Link
          href={discoverHref}
          className="inline-flex min-h-11 items-center text-base font-semibold underline underline-offset-4"
          data-testid="near-all"
        >
          See everything
        </Link>
      </div>
      {corpus.outage && <AtlasDown />}
      {finds.length > 0 && (
        <div
          className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6"
          data-testid="near-finds"
        >
          {finds.map((f) => (
            <FindCard key={f.experience.id} find={f} origin={origin} compact />
          ))}
        </div>
      )}
      {pins.length > 0 && (
        <div className={finds.length > 0 ? "mt-4" : ""}>
          <p className="mb-2 text-sm font-semibold text-[var(--gh-ink-soft)]">
            From the community lights map
            <span className="font-normal">
              {" "}
              — local listings, each checked by a person
            </span>
          </p>
          <PinRow pins={pins} />
        </div>
      )}
      {!corpus.outage && (
        <BestRow
          best={best}
          ask={ask}
          townName={townName}
          lightsHref={lightsHref}
        />
      )}
      {finds.length === 0 && pins.length === 0 && !corpus.outage && (
        <p
          className="rounded-[22px] bg-white p-5 text-base ring-1 ring-black/5"
          data-testid="near-empty"
        >
          We have nothing dated for Christmas within {ask.km} km of{" "}
          {townName ?? "here"} yet, and nobody has pinned lights close by. Try
          another place above, the{" "}
          <Link
            href={lightsHref}
            className="font-semibold underline underline-offset-4"
          >
            lights map
          </Link>
          , or one of Passport&apos;s ideas — they work anywhere.
        </p>
      )}
    </section>
  );
}

/**
 * **The season's best, by kind** (owner brief M1064): the big Christmas
 * things — lights, Santa, markets, live shows, festivals and the Holiday
 * Train, winter fun, free things — each with how many Atlas lists within the
 * radius, and the two that need no listing (movies, a night in). A count of
 * none is said, never hidden: the tile still opens the kind, where _Worth the
 * drive_ shows what is farther.
 */
function BestRow({
  best,
  ask,
  townName,
  lightsHref,
}: {
  readonly best: ReturnType<typeof seasonsBest>;
  readonly ask: Ask;
  readonly townName: string | undefined;
  readonly lightsHref: string;
}) {
  const place = { at: ask.at, km: ask.km };
  const q = writeAsk(place);
  return (
    <div className="mt-6" data-testid="seasons-best">
      <h3 className="ghad-display text-xl leading-tight font-extrabold sm:text-2xl">
        The season&apos;s best around {townName ?? "you"}
      </h3>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {best.map((b) => {
          const href =
            b.id === "movies"
              ? `/christmas/movies${q ? `?${q}` : ""}`
              : b.id === "home"
                ? `/christmas/for/cozy${q ? `?${q}` : ""}`
                : b.id === "lights"
                  ? lightsHref
                  : b.id === "free"
                    ? `/christmas/discover?${writeAsk({ ...place, budget: "free" })}`
                    : `/christmas/discover?${writeAsk({ ...place, themes: [b.id] })}`;
          return (
            <li key={b.id}>
              <Link
                href={href}
                className="flex h-full min-h-20 flex-col justify-center rounded-[20px] bg-white p-3 ring-1 ring-black/5 hover:ring-black/25"
                data-testid={`best-${b.id}`}
              >
                <span className="flex items-center gap-2 leading-tight font-extrabold">
                  <span className="text-xl" aria-hidden>
                    {b.emoji}
                  </span>
                  {b.label}
                </span>
                <span className="mt-1 text-sm text-[var(--gh-ink-soft)]">
                  {b.count === undefined
                    ? b.line
                    : b.count === 0
                      ? `None listed within ${ask.km} km yet`
                      : `${b.count} within ${ask.km} km`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PinRow({ pins }: { readonly pins: readonly PinView[] }) {
  return (
    <ul
      className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6"
      data-testid="near-pins"
    >
      {pins.map((p) => (
        <li key={p.id} className="w-[17.5rem] shrink-0 snap-start">
          <PinCard pin={p} day />
        </li>
      ))}
    </ul>
  );
}

function unique<T>(list: readonly T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  return list.filter((t) => {
    const k = key(t);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
