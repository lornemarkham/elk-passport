import { Suspense, type ReactNode } from "react";
import { PendingContent, PendingProvider } from "@/components/loading/Pending";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";
import { ThemeProvider } from "@/components/ghad/theme";
import { FindCard } from "@/components/christmas/FindCard";
import { PicksProvider } from "@/components/christmas/Picks";
import { DiscoverControls } from "@/components/christmas/DiscoverControls";
import { MoreFilters } from "@/components/christmas/MoreFilters";
import { EveningCard, PinNearCard } from "@/components/christmas/NearbyCards";
import { RememberDistance } from "@/components/christmas/RememberDistance";
import { RememberTown } from "@/components/christmas/RememberTown";
import { AtlasDown } from "@/components/christmas/parts";
import styles from "@/components/christmas/christmas.module.css";
import { adventureSession } from "@/lib/adventures/server";
import { todayIn } from "@/lib/adventures/overview";
import {
  answer,
  readAsk,
  writeAsk,
  youngest,
  type Ask,
  type Find,
} from "@/domain/christmas/discover";
import { lightsNear, openThisEvening } from "@/domain/christmas/nearby";
import { THEMES, themeById } from "@/domain/christmas/themes";
import { whenLabel } from "@/domain/christmas/when";
import { cn } from "@/lib/utils";
import { christmasFinds } from "../_server/corpus";
import { lightsFor, viewer } from "../_server/lights";
import { rememberedKm, whereAreWe } from "../_server/where";

export const metadata: Metadata = {
  title: "Find Christmas — Passport",
  description:
    "Christmas markets, lights, Santa and festive food near you — where, when and how far, with dates and distance on every card.",
};

/** Cards a shelf shows before "Show all" — a phone is not a database. */
const SHELF = 12;

/** Shelves kept closed: not confirmed for the days, no place, or an earlier year. */
const FOLDED: ReadonlySet<string> = new Set([
  "maybe",
  "town",
  "unplaced",
  "past",
]);

const REMOVED: Readonly<Record<string, string>> = {
  interests: "are in other categories",
  dates: "aren't on these dates",
  unconfirmed: "aren't confirmed for tonight",
  finished: "have already finished today",
  budget: "aren't stated as free",
  time: "usually take longer than you have",
  distance: "are further away, or in another part of the province",
};

/**
 * **Christmas Discovery: WHERE, WHEN, HOW FAR** (owner brief "Christmas
 * discovery UX repair", 2026-11-22). Three controls and the results under
 * them — no questionnaire. A category is one tap and one category; more
 * than one, children's ages, price and time sit under _More filters_.
 * What is confirmed near the search origin leads; what only might be on,
 * what is worth a longer drive and what has no confirmed place are each on
 * their own shelf, said to be what they are.
 */
export default async function ChristmasDiscoverPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const today = todayIn();
  const remembered = await rememberedKm();
  const asked = readAsk(params, {
    today,
    ...(remembered ? { km: remembered } : {}),
  });
  // Discover always looks from somewhere: the place chosen, the one
  // remembered, or Vernon — never an unplaced directory.
  const where = await whereAreWe(asked.at);
  const ask: Ask = { ...asked, at: where.at };
  const [session, corpus, lights] = await Promise.all([
    adventureSession().catch(() => null),
    christmasFinds(ask, today),
    viewer()
      .then((v) => lightsFor(v))
      .catch(() => ({ pins: [], ready: false })),
  ]);
  const result = answer(corpus.finds, ask, { today, now: new Date() });
  const all = typeof params.all === "string" ? params.all : undefined;
  const age = youngest(ask);
  const town = result.town!;
  const townName = town.name.replace(/,\s*BC$/, "");
  const origin = { latitude: town.latitude, longitude: town.longitude };
  const theme = ask.themes.length === 1 ? ask.themes[0] : undefined;
  const dated = Boolean(ask.from || ask.to);
  const days = dated
    ? { from: ask.from ?? ask.to!, to: ask.to ?? ask.from! }
    : undefined;
  const oneDay = days && days.from === days.to ? days.from : undefined;
  const when = whenLabel(ask, today);
  const tonight = oneDay === today;

  // The community map's displays, for lights and for "what's on" — and the
  // only popularity evidence there is.
  const showLights = !theme || theme === "lights";
  const pins = showLights
    ? lightsNear(lights.pins, origin, ask.km, days)
    : { on: [], popular: [] };
  // Dinner for the evening asked, by its own hours (no showtimes exist).
  const evening =
    oneDay && (!theme || theme === "food") && ask.themes.length <= 1
      ? openThisEvening(corpus.experiences, origin, ask.km, oneDay)
      : [];

  const href = (next: Partial<Ask>) => {
    const q = writeAsk({ ...ask, ...next });
    return `/christmas/discover${q ? `?${q}` : ""}`;
  };
  // The planner carries where, when and how far, not the category.
  const carry = writeAsk({ ...ask, themes: [] });
  const removed = Object.entries(result.removed).filter(([, n]) => n > 0);
  const near = result.shelves.find((s) => s.id === "near");
  const rest = result.shelves.filter((s) => s.id !== "near");
  const heading = theme
    ? themeById(theme).label
    : ask.themes.length > 1
      ? ask.themes.map((t) => themeById(t).label).join(" + ")
      : "Christmas near you";

  const renderShelf = (shelf: (typeof result.shelves)[number]) => {
    const folded = FOLDED.has(shelf.id);
    const title = (
      <h2 className="ghad-display text-2xl font-extrabold tracking-tight sm:text-3xl">
        {shelf.title}{" "}
        <span className="text-[var(--gh-ink-soft)]">{shelf.finds.length}</span>
      </h2>
    );
    const body = (
      <>
        {shelf.line && (
          <p className="mt-1 max-w-2xl text-base text-[var(--gh-ink-soft)]">
            {shelf.line}
          </p>
        )}
        {cards(shelf.finds, all === shelf.id ? 60 : SHELF)}
        {all !== shelf.id && shelf.finds.length > SHELF && (
          <Link
            href={`${href({})}${writeAsk(ask) ? "&" : "?"}all=${shelf.id}#shelf-${shelf.id}`}
            className="mt-4 inline-flex min-h-12 items-center rounded-full border-2 border-black/10 bg-white px-5 font-semibold hover:border-black/30"
            data-testid={`more-${shelf.id}`}
          >
            Show all {shelf.finds.length}
          </Link>
        )}
      </>
    );
    return folded ? (
      <details
        key={shelf.id}
        id={`shelf-${shelf.id}`}
        open={all === shelf.id || shelf.id === "unplaced"}
        className="scroll-mt-4 rounded-[24px] bg-white/60 p-4 ring-1 ring-black/5"
        data-testid={`shelf-${shelf.id}`}
      >
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          {title}
          <span className="shrink-0 text-sm font-semibold underline underline-offset-4">
            Show
          </span>
        </summary>
        {body}
      </details>
    ) : (
      <section
        key={shelf.id}
        id={`shelf-${shelf.id}`}
        className="scroll-mt-4"
        data-testid={`shelf-${shelf.id}`}
      >
        {title}
        {body}
      </section>
    );
  };

  const cards = (finds: readonly Find[], limit: number) => (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {finds.slice(0, limit).map((f) => (
        <FindCard
          key={f.experience.id}
          find={f}
          origin={origin}
          youngest={age}
          {...(theme ? { theme } : {})}
        />
      ))}
    </div>
  );

  const extra = (id: string, title: string, line: string, cards: ReactNode[]) =>
    cards.length > 0 && (
      <section id={`shelf-${id}`} data-testid={`shelf-${id}`}>
        <h2 className="ghad-display text-2xl font-extrabold tracking-tight sm:text-3xl">
          {title}{" "}
          <span className="text-[var(--gh-ink-soft)]">{cards.length}</span>
        </h2>
        <p className="mt-1 max-w-2xl text-base text-[var(--gh-ink-soft)]">
          {line}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards}
        </div>
      </section>
    );

  return (
    <>
      {where.chosen && <RememberTown town={ask.at!} />}
      {typeof params.km === "string" && <RememberDistance km={ask.km} />}
      <ThemeProvider className="block">
        <PicksProvider
          planHref={`/christmas/plan${carry ? `?${carry}` : ""}`}
          signedIn={Boolean(session)}
        >
          <main className={`${styles.page} min-h-screen pb-28`}>
            <PendingProvider>
              <header
                className={`${styles.night} z-30`}
                style={{ overflow: "visible" }}
              >
                <div className="mx-auto max-w-6xl px-4 pt-4 pb-5 sm:px-6 sm:pt-5 sm:pb-6">
                  <Link
                    href={`/christmas?at=${ask.at}`}
                    className="hidden min-h-11 items-center gap-1.5 rounded-full bg-white/10 px-4 text-sm font-semibold hover:bg-white/20 sm:inline-flex"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                    Christmas
                  </Link>
                  <h1 className="ghad-display text-[1.9rem] leading-[0.95] font-extrabold tracking-[-0.04em] sm:mt-3 sm:text-5xl">
                    {heading}
                  </h1>
                  <Suspense fallback={null}>
                    <DiscoverControls
                      {...(ask.when ? { when: ask.when } : {})}
                      {...(ask.from ? { from: ask.from } : {})}
                      {...(ask.to ? { to: ask.to } : {})}
                      km={ask.km}
                      today={today}
                      label={when}
                    />
                  </Suspense>
                  <p
                    className="mt-3 text-base font-semibold text-white/90"
                    data-testid="result-count"
                  >
                    {corpus.outage
                      ? "The event listings aren't answering just now."
                      : `${result.total} ${result.total === 1 ? "thing" : "things"} ${dated ? "confirmed" : "found"} within ${ask.km} km of ${townName}${dated ? ` · ${when}` : ""}${age !== undefined ? ` · checked for a ${age}-year-old` : ""}.`}
                  </p>
                </div>
                <div className={styles.lights} aria-hidden />
              </header>
              <PendingContent>
                <div className="mx-auto max-w-6xl space-y-7 px-4 pt-5 sm:px-6">
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-[var(--gh-ink-soft)]">
                      Category{" "}
                      <span className="font-normal">— one at a time</span>
                    </p>
                    <nav
                      aria-label="Category"
                      className="relative -mx-4 flex snap-x [scrollbar-width:thin] gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
                      data-testid="categories"
                    >
                      {[
                        { id: undefined, label: "All", emoji: "🎄" },
                        ...THEMES,
                      ].map((t) => {
                        const on =
                          t.id === undefined
                            ? ask.themes.length === 0
                            : ask.themes.length === 1 && ask.themes[0] === t.id;
                        return (
                          <Link
                            key={t.id ?? "all"}
                            href={href({ themes: t.id ? [t.id] : [] })}
                            aria-current={on ? "true" : undefined}
                            scroll={false}
                            className={cn(
                              "inline-flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-full border-2 px-4 text-sm font-semibold whitespace-nowrap",
                              on
                                ? "border-[#b3242f] bg-[#b3242f] text-white"
                                : "border-black/10 bg-white hover:border-black/30",
                            )}
                            data-testid={`chip-${t.id ?? "all"}`}
                          >
                            <span aria-hidden>{t.emoji}</span>
                            {t.label}
                          </Link>
                        );
                      })}
                    </nav>
                  </div>

                  {/* What is narrowing the results, said whenever anything is, each one a tap to clear. */}
                  {(dated || ask.themes.length > 0 || moreOn(ask)) && (
                    <div
                      className="flex flex-wrap items-center gap-2 text-sm"
                      data-testid="active-filters"
                    >
                      <span className="font-semibold">Showing:</span>
                      <span className="rounded-full bg-white px-3 py-1.5 font-semibold ring-1 ring-black/10">
                        {ask.themes.length
                          ? ask.themes
                              .map((t) => themeById(t).label)
                              .join(" + ")
                          : "Every category"}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-semibold ring-1",
                          dated
                            ? "bg-[#0f3b2b] text-white ring-[#0f3b2b]"
                            : "bg-white ring-black/10",
                        )}
                        data-testid="active-when"
                      >
                        {when}
                        {dated && (
                          <Link
                            href={href({
                              when: undefined,
                              from: undefined,
                              to: undefined,
                            })}
                            aria-label={`Clear the date (${when})`}
                            className="-mr-1 ml-1 grid h-6 w-6 place-items-center rounded-full bg-white/20 hover:bg-white/40"
                            data-testid="clear-when"
                            scroll={false}
                          >
                            <X className="h-3.5 w-3.5" aria-hidden />
                          </Link>
                        )}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1.5 font-semibold ring-1 ring-black/10">
                        Within {ask.km} km of {townName}
                      </span>
                      {(dated || ask.themes.length > 0 || moreOn(ask)) && (
                        <Link
                          href={href({
                            themes: [],
                            when: undefined,
                            from: undefined,
                            to: undefined,
                            ages: [],
                            budget: "any",
                            hours: undefined,
                            unplaced: undefined,
                          })}
                          className="ml-1 min-h-9 font-bold underline underline-offset-4"
                          data-testid="reset"
                          scroll={false}
                        >
                          Reset
                        </Link>
                      )}
                      {dated && ask.themes.length > 0 && (
                        <span className="w-full text-[var(--gh-ink-soft)]">
                          The date stays on when you change category.
                        </span>
                      )}
                    </div>
                  )}

                  <MoreFilters ask={ask} />

                  {corpus.outage && <AtlasDown />}

                  {near && (
                    <section id="shelf-near" data-testid="shelf-near">
                      <h2 className="ghad-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                        {near.title}{" "}
                        <span className="text-[var(--gh-ink-soft)]">
                          {near.finds.length}
                        </span>
                      </h2>
                      <p className="mt-1 max-w-2xl text-base text-[var(--gh-ink-soft)]">
                        {near.line}
                      </p>
                      {cards(near.finds, all === "near" ? 60 : SHELF)}
                      {all !== "near" && near.finds.length > SHELF && (
                        <Link
                          href={`${href({})}${writeAsk(ask) ? "&" : "?"}all=near#shelf-near`}
                          className="mt-4 inline-flex min-h-12 items-center rounded-full border-2 border-black/10 bg-white px-5 font-semibold hover:border-black/30"
                          data-testid="more-near"
                        >
                          Show all {near.finds.length}
                        </Link>
                      )}
                    </section>
                  )}

                  {!corpus.outage && result.total === 0 && (
                    <div
                      className="rounded-[28px] bg-white p-6 text-center ring-1 ring-black/5"
                      data-testid="nothing"
                    >
                      <p className="ghad-display text-2xl font-extrabold">
                        {dated
                          ? `Nothing confirmed within ${ask.km} km for ${when.toLowerCase() === "tonight" ? "tonight" : when}`
                          : `Nothing within ${ask.km} km of ${townName}`}
                      </p>
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        {dated && (
                          <Link
                            href={href({
                              when: undefined,
                              from: undefined,
                              to: undefined,
                            })}
                            className="inline-flex min-h-12 items-center rounded-full bg-[#0f3b2b] px-5 font-bold text-white"
                          >
                            Any date
                          </Link>
                        )}
                        {ask.km < 50 && (
                          <Link
                            href={href({ km: 50 })}
                            className="inline-flex min-h-12 items-center rounded-full border-2 border-black/10 bg-white px-5 font-bold"
                          >
                            Within 50 km
                          </Link>
                        )}
                        {ask.themes.length > 0 && (
                          <Link
                            href={href({ themes: [] })}
                            className="inline-flex min-h-12 items-center rounded-full border-2 border-black/10 bg-white px-5 font-bold"
                          >
                            Every category
                          </Link>
                        )}
                      </div>
                    </div>
                  )}

                  {extra(
                    "lights-on",
                    tonight
                      ? "Lights on tonight"
                      : dated
                        ? "Lights on these dates"
                        : "On the lights map",
                    `Displays on the community lights map within ${ask.km} km, confirmed lit this season by a person.`,
                    pins.on.map((n) => <PinNearCard key={n.pin.id} near={n} />),
                  )}
                  {extra(
                    "popular",
                    "Popular nearby",
                    `Lights families rated on the map, within ${ask.km} km — the real average and how many people rated. Nothing else here is ranked by popularity: we don't have that evidence.`,
                    pins.popular.map((n) => (
                      <PinNearCard key={n.pin.id} near={n} />
                    )),
                  )}
                  {extra(
                    "evening",
                    tonight
                      ? "Dinner open tonight"
                      : "Dinner open that evening",
                    `Restaurants within ${ask.km} km whose own published hours have them open after 8 pm. Book ahead.`,
                    evening.map((o) => (
                      <EveningCard key={o.experience.id} open={o} />
                    )),
                  )}
                  {oneDay && !theme && (
                    <p
                      className="text-sm text-[var(--gh-ink-soft)]"
                      data-testid="no-showtimes"
                    >
                      Movies aren&apos;t listed: cinemas don&apos;t publish
                      their showtimes to us, so we can&apos;t say what&apos;s
                      playing {tonight ? "tonight" : "that day"}.
                    </p>
                  )}

                  {rest.map(renderShelf)}

                  {result.unplaced > 0 && !ask.unplaced && (
                    <p
                      className="text-base text-[var(--gh-ink-soft)]"
                      data-testid="unplaced-note"
                    >
                      {result.unplaced}{" "}
                      {result.unplaced === 1
                        ? "listing doesn't"
                        : "listings don't"}{" "}
                      say where {result.unplaced === 1 ? "it is" : "they are"},
                      so {result.unplaced === 1 ? "it isn't" : "they aren't"}{" "}
                      shown as near you.{" "}
                      <Link
                        href={href({ unplaced: true })}
                        className="font-semibold underline underline-offset-4"
                        data-testid="show-unplaced-link"
                      >
                        Show them separately
                      </Link>
                    </p>
                  )}

                  {removed.length > 0 && (
                    <p
                      className="text-sm text-[var(--gh-ink-soft)]"
                      data-testid="removed"
                    >
                      Not shown:{" "}
                      {removed
                        .map(([why, n]) => `${n} that ${REMOVED[why] ?? why}`)
                        .join(" · ")}
                      .
                    </p>
                  )}
                </div>
              </PendingContent>
            </PendingProvider>
          </main>
        </PicksProvider>
      </ThemeProvider>
    </>
  );
}

function moreOn(ask: Ask): boolean {
  return (
    ask.ages.length > 0 ||
    ask.budget === "free" ||
    Boolean(ask.hours) ||
    Boolean(ask.unplaced)
  );
}
