"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Check, Info } from "lucide-react";
import { FindCard } from "./FindCard";
import { MoreFilters } from "./MoreFilters";
import { HOME_KEY } from "./home";
import { AtlasDown } from "./parts";
import { discoverHref, type Ask, type Find } from "@/domain/christmas/discover";
import {
  availability,
  hostFor,
  viewOf,
  type FinderData,
} from "@/domain/christmas/finder";
import { isThemeId, themeById, type ThemeId } from "@/domain/christmas/themes";
import { shortDay } from "@/domain/christmas/when";
import { cn } from "@/lib/utils";

/** Cards a section shows before "Show more" — a phone is not a database. */
const FIRST = 6;
const MORE = 12;

/** "tomorrow", "this weekend", "Sat, Nov 29" — said mid-sentence. */
const said = (when: string) =>
  /^(Tonight|Tomorrow|This weekend|Any date)$/.test(when)
    ? when.toLowerCase()
    : when;

/** What `?theme=` says, read the same way the server reads it. */
function themesIn(params: URLSearchParams): ThemeId[] {
  return [...new Set((params.get("theme") ?? "").split(",").filter(isThemeId))];
}

/**
 * **Christmas discovery, in the visitor's hand** (owner brief M1128, "One
 * Beautiful Experience"). The server has answered where, when and how far
 * for every category at once (`finderData`); this filters it. Categories
 * are several at once — markets _and_ lights _and_ festive food — and a tap
 * changes the results at once: the address is updated in place, so the page
 * can still be shared, and nothing goes back to the server.
 *
 * A category is offered only with something in it, said with how many.
 * One with none for these days is said apart, with the next day it _is_
 * confirmed — a choice, never a silent change of date. When nothing
 * matches, the page answers as a host would (`hostFor`).
 *
 * How the list was made — the radius, what was set aside and why — is one
 * tap away under _How we chose these_, never on every screen.
 */
export function Finder({
  data,
  ask,
  today,
  when,
  townName,
  origin,
  youngest,
  pinsOn,
  outage,
  lights,
  evening,
  warm,
}: {
  readonly data: FinderData;
  readonly ask: Ask;
  readonly today: string;
  /** "Tomorrow", "Sat, Nov 29 – Sun, Nov 30", "Any date". */
  readonly when: string;
  readonly townName: string;
  readonly origin: { latitude: number; longitude: number };
  readonly youngest?: number;
  /** Community displays lit for the days: they count as Holiday lights. */
  readonly pinsOn: number;
  readonly outage: boolean;
  /** The community map's displays, rendered by the server. */
  readonly lights?: ReactNode;
  /** Dinner open that evening (a single day asked), rendered by the server. */
  readonly evening?: ReactNode;
  /** A warm stop near the lights, rendered by the server. */
  readonly warm?: ReactNode;
}) {
  const params = useSearchParams();
  const pathname = usePathname();
  const themes = useMemo(
    () => themesIn(new URLSearchParams(params.toString())),
    [params],
  );
  const [shown, setShown] = useState(FIRST);
  const dated = Boolean(ask.from || ask.to);
  const days = { from: ask.from, to: ask.to };

  // Home, from any Christmas page, comes back to this very discovery.
  useEffect(() => {
    try {
      const q = params.toString();
      sessionStorage.setItem(HOME_KEY, q ? `?${q}` : "");
    } catch {
      /* private mode: Home opens on the defaults */
    }
  }, [params]);

  const choose = (next: readonly ThemeId[]) => {
    const q = new URLSearchParams(params.toString());
    if (next.length) q.set("theme", next.join(","));
    else q.delete("theme");
    q.delete("all");
    setShown(FIRST);
    // In place: no server trip, no scroll, and Back still leaves the page.
    window.history.replaceState(
      null,
      "",
      `${pathname}${q.size ? `?${q}` : ""}${window.location.hash}`,
    );
  };
  const toggle = (t: ThemeId) =>
    choose(themes.includes(t) ? themes.filter((x) => x !== t) : [...themes, t]);

  const { open, closed } = availability(data, pinsOn ? { lights: pinsOn } : {});
  const showLights = themes.length === 0 || themes.includes("lights");
  const view = viewOf(data, themes, days, today);
  // Community lights count as Holiday lights, so they are something too.
  const empty = view.empty && !(showLights && lights);
  const host = empty ? hostFor(data, themes, days, today) : undefined;
  const asked = themes.length
    ? themes.map((t) => themeById(t).label).join(" or ")
    : "Christmas events";
  const showEvening = themes.length === 0 || themes.includes("food");
  // A card says the chosen category it belongs to, when there is one.
  const chosenOf = (f: Find) =>
    themes.find((t) => f.reading.themes.includes(t));
  const card = (f: Find) => {
    const chosen = chosenOf(f);
    return (
      <FindCard
        key={f.experience.id}
        find={f}
        origin={origin}
        {...(youngest !== undefined ? { youngest } : {})}
        {...(chosen ? { theme: chosen } : {})}
      />
    );
  };
  const linkFor = (next: Partial<Ask>) =>
    discoverHref({ ...ask, themes, ...next });

  return (
    <div className="space-y-8 sm:space-y-12" data-testid="finder">
      {/* ------------------------------------------------ the categories */}
      <div className="space-y-3">
        <div
          role="group"
          aria-label="What would you like to find? Choose as many as you like"
          className="-mx-4 flex snap-x [scrollbar-width:thin] gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
          data-testid="categories"
        >
          <Chip
            on={themes.length === 0}
            onClick={() => choose([])}
            testId="chip-all"
            label="Everything"
            count={data.total + pinsOn}
          />
          {open.map((a) => (
            <Chip
              key={a.id}
              on={themes.includes(a.id)}
              onClick={() => toggle(a.id)}
              testId={`chip-${a.id}`}
              label={a.label}
              emoji={a.emoji}
              count={a.count}
            />
          ))}
          {/* A category somebody chose that has nothing here stays
              visible, chosen, so it can be un-chosen. */}
          {themes
            .filter((t) => !open.some((a) => a.id === t))
            .map((t) => (
              <Chip
                key={t}
                on
                onClick={() => toggle(t)}
                testId={`chip-${t}`}
                label={themeById(t).label}
                emoji={themeById(t).emoji}
                count={0}
              />
            ))}
        </div>
        {closed.length > 0 && !outage && (
          <Later
            closed={closed.filter((a) => !themes.includes(a.id))}
            dated={dated}
            when={when}
            townName={townName}
            km={ask.km}
            linkFor={linkFor}
            onPick={toggle}
          />
        )}
        <MoreFilters ask={{ ...ask, themes }} />
      </div>

      {outage && <AtlasDown />}

      {/* -------------------------------------------- nothing for this ask */}
      {empty && !outage && host && (
        <section
          className="rounded-[28px] bg-white p-5 shadow-[0_10px_34px_rgba(8,35,25,0.08)] ring-1 ring-black/5 sm:p-8"
          data-testid="nothing"
          aria-labelledby="nothing-title"
        >
          <h2
            id="nothing-title"
            className="ghad-display text-2xl leading-tight font-extrabold tracking-tight sm:text-3xl"
          >
            {dated
              ? `No ${asked} confirmed for ${said(when)} near ${townName}`
              : `No ${asked} listed near ${townName} yet`}
          </h2>
          <p className="mt-1 text-base text-[var(--gh-ink-soft)]">
            {host.next.length || host.sameDay.length || host.further.length
              ? "Here's what we'd suggest instead — your date and distance stay as they are."
              : "Nothing we know of comes close yet. Try another day, or look a little further."}
          </p>

          {host.next.length > 0 && (
            <div className="mt-5" data-testid="host-next">
              <h3 className="text-sm font-bold tracking-[0.12em] text-[#b3242f] uppercase">
                The next confirmed days
              </h3>
              <ul className="mt-2 grid gap-2 sm:grid-cols-3">
                {host.next.map(({ day, find }) => (
                  <li key={find.experience.id}>
                    <Link
                      href={linkFor({ when: undefined, from: day, to: day })}
                      scroll={false}
                      className="flex h-full flex-col rounded-[18px] bg-[#f6efe2] p-3.5 ring-1 ring-black/5 hover:ring-black/25"
                      data-testid="host-next-day"
                    >
                      <span className="text-sm font-extrabold text-[#0f3b2b]">
                        {shortDay(day)}
                      </span>
                      <span className="mt-0.5 leading-tight font-bold">
                        {find.experience.title}
                      </span>
                      <span className="mt-auto pt-2 text-sm font-semibold text-[#8e1d26]">
                        Show {shortDay(day)} →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {host.sameDay.length > 0 && (
            <div className="mt-6" data-testid="host-same-day">
              <h3 className="text-sm font-bold tracking-[0.12em] text-[#b3242f] uppercase">
                {dated ? `Also on ${said(when)}, nearby` : "Also near you"}
              </h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {host.sameDay.map(card)}
              </div>
            </div>
          )}

          {host.further.length > 0 && (
            <div className="mt-6" data-testid="host-further">
              <h3 className="text-sm font-bold tracking-[0.12em] text-[#b3242f] uppercase">
                A little further, {said(when)}
              </h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {host.further.map(card)}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            {dated && (
              <Link
                href={linkFor({
                  when: undefined,
                  from: undefined,
                  to: undefined,
                })}
                scroll={false}
                className="inline-flex min-h-12 items-center rounded-full bg-[#0f3b2b] px-5 font-bold text-white"
                data-testid="host-any-date"
              >
                Any date
              </Link>
            )}
            {themes.length > 0 && (
              <button
                type="button"
                onClick={() => choose([])}
                className="inline-flex min-h-12 items-center rounded-full border-2 border-black/10 bg-white px-5 font-bold hover:border-black/30"
              >
                Everything
              </button>
            )}
          </div>
        </section>
      )}

      {/* ------------------------------------------------- the spotlight */}
      {view.spotlight && (
        <section aria-labelledby="spotlight-title" data-testid="spotlight">
          <h2
            id="spotlight-title"
            className="mb-3 text-sm font-bold tracking-[0.14em] text-[#b3242f] uppercase"
          >
            {dated ? `Don't miss ${said(when)}` : "Don't miss"}
          </h2>
          <FindCard
            find={view.spotlight}
            origin={origin}
            feature
            {...(youngest !== undefined ? { youngest } : {})}
            {...(chosenOf(view.spotlight)
              ? { theme: chosenOf(view.spotlight)! }
              : {})}
          />
        </section>
      )}

      {view.weekend.length > 0 && (
        <Section
          id="weekend"
          kicker="This weekend"
          title="Something wonderful this weekend"
        >
          <Row cols="lg:grid-cols-4">{view.weekend.map(card)}</Row>
        </Section>
      )}

      {view.around.length > 0 && (
        <Section
          id="near"
          kicker={`Around ${townName}`}
          title={dated ? `What's on ${said(when)}` : "Coming up"}
          count={view.around.length}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {view.around.slice(0, shown).map(card)}
          </div>
          {view.around.length > shown && (
            <button
              type="button"
              onClick={() => setShown((n) => n + MORE)}
              className="mt-5 inline-flex min-h-12 items-center rounded-full border-2 border-black/10 bg-white px-5 font-semibold hover:border-black/30"
              data-testid="more-near"
            >
              Show {Math.min(MORE, view.around.length - shown)} more
            </button>
          )}
        </Section>
      )}

      {showEvening && evening}
      {showLights && lights}

      {view.seasonal.length > 0 && (
        <Section
          id="seasonal"
          kicker="Any day this season"
          title="Seasonal favourites"
          line="Rinks, hills and places that are part of the season. Their days aren't listed, so check before you go."
        >
          <Row>{view.seasonal.slice(0, FIRST).map(card)}</Row>
        </Section>
      )}

      {view.drive.length > 0 && (
        <Section
          id="drive"
          kicker="Worth the drive"
          title="A little further afield"
          line={`Big Christmas outings beyond ${ask.km} km of ${townName}.`}
        >
          <Row>{view.drive.map(card)}</Row>
        </Section>
      )}

      {view.maybe.length > 0 && (
        <details
          className="rounded-[24px] bg-white/60 p-4 ring-1 ring-black/5"
          data-testid="shelf-maybe"
        >
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <span className="ghad-display text-xl font-extrabold">
              Might be on {said(when)}{" "}
              <span className="text-[var(--gh-ink-soft)]">
                {view.maybe.length}
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold underline underline-offset-4">
              Show
            </span>
          </summary>
          <p className="mt-1 text-base text-[var(--gh-ink-soft)]">
            Nearby, but their listings don&apos;t confirm these days. Check
            before you go.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {view.maybe.slice(0, MORE).map(card)}
          </div>
        </details>
      )}

      {data.unplacedFinds.length > 0 && (
        <Section
          id="unplaced"
          kicker="Set apart"
          title="Location not confirmed"
          line={`These listings don't say where they are, so they could be anywhere — not necessarily near ${townName}. Check before you go.`}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.unplacedFinds
              .filter(
                (f) =>
                  themes.length === 0 ||
                  f.reading.themes.some((t) => themes.includes(t)),
              )
              .map(card)}
          </div>
        </Section>
      )}

      {showLights && warm}

      <HowWeChose data={data} ask={ask} townName={townName} />
    </div>
  );
}

/**
 * A shelf: a swipeable row on a phone (one card and the edge of the next,
 * so it reads as more to see), a grid on anything wider.
 */
function Row({
  children,
  cols = "lg:grid-cols-3",
  testId,
}: {
  readonly children: ReactNode;
  readonly cols?: string;
  readonly testId?: string;
}) {
  return (
    <div
      className={cn(
        "-mx-4 flex snap-x snap-mandatory [scrollbar-width:none] gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 [&>*]:w-[84%] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-auto",
        cols,
      )}
      {...(testId ? { "data-testid": testId } : {})}
    >
      {children}
    </div>
  );
}

function Chip({
  on,
  onClick,
  label,
  emoji,
  count,
  testId,
}: {
  readonly on: boolean;
  readonly onClick: () => void;
  readonly label: string;
  readonly emoji?: string;
  readonly count: number;
  readonly testId: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-full border-2 px-4 text-sm font-semibold whitespace-nowrap transition-colors motion-reduce:transition-none",
        on
          ? "border-[#0f3b2b] bg-[#0f3b2b] text-white"
          : "border-black/10 bg-white hover:border-black/30",
      )}
      data-testid={testId}
    >
      {on ? (
        <Check className="h-4 w-4" aria-hidden />
      ) : emoji ? (
        <span aria-hidden>{emoji}</span>
      ) : null}
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 text-xs font-bold tabular-nums",
          on ? "bg-white/20" : "bg-black/5 text-[var(--gh-ink-soft)]",
        )}
        aria-label={`${count} ${count === 1 ? "thing" : "things"}`}
      >
        {count}
      </span>
    </button>
  );
}

/**
 * **Categories with nothing for these days**, said apart — never offered as
 * if they held something. Each says the next day it is confirmed in the
 * radius, as a choice; one with none on any day says how far the nearest is.
 */
function Later({
  closed,
  dated,
  when,
  townName,
  km,
  linkFor,
  onPick,
}: {
  readonly closed: ReturnType<typeof availability>["closed"];
  readonly dated: boolean;
  readonly when: string;
  readonly townName: string;
  readonly km: number;
  readonly linkFor: (next: Partial<Ask>) => string;
  readonly onPick: (t: ThemeId) => void;
}) {
  const coming = closed.filter((a) => a.next);
  const far = closed.filter((a) => !a.next && a.nearestKm !== undefined);
  const none = closed.filter((a) => !a.next && a.nearestKm === undefined);
  if (closed.length === 0) return null;
  return (
    <div className="text-sm text-[var(--gh-ink-soft)]" data-testid="later">
      {coming.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="font-semibold text-[var(--gh-ink)]">
            Not on {said(when)}:
          </span>
          {coming.map((a) => (
            <Link
              key={a.id}
              href={linkFor({
                when: undefined,
                from: a.next!,
                to: a.next!,
                themes: [a.id],
              })}
              scroll={false}
              className="inline-flex min-h-9 items-center gap-1 rounded-full bg-white/70 px-3 ring-1 ring-black/10 hover:ring-black/30"
              data-testid={`later-${a.id}`}
            >
              <span aria-hidden>{a.emoji}</span>
              {a.label}
              <span className="font-semibold text-[#0f3b2b]">
                · next {shortDay(a.next!)}
              </span>
            </Link>
          ))}
        </p>
      )}
      {far.length > 0 && (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="font-semibold text-[var(--gh-ink)]">
            Further than {km} km:
          </span>
          {far.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onPick(a.id)}
              className="inline-flex min-h-9 items-center gap-1 rounded-full bg-white/70 px-3 ring-1 ring-black/10 hover:ring-black/30"
              data-testid={`later-${a.id}`}
            >
              <span aria-hidden>{a.emoji}</span>
              {a.label}
              <span className="font-semibold">· {a.nearestKm} km</span>
            </button>
          ))}
        </p>
      )}
      {none.length > 0 && (
        <p className="mt-1.5" data-testid="later-none">
          {dated
            ? "Nothing confirmed nearby on any day yet"
            : `Nothing listed near ${townName} yet`}
          {": "}
          {none.map((a) => a.label).join(", ")}.
        </p>
      )}
    </div>
  );
}

function Section({
  id,
  kicker,
  title,
  line,
  count,
  children,
}: {
  readonly id: string;
  readonly kicker: string;
  readonly title: string;
  readonly line?: string;
  readonly count?: number;
  readonly children: ReactNode;
}) {
  return (
    <section
      id={`shelf-${id}`}
      className="scroll-mt-24"
      data-testid={`shelf-${id}`}
      aria-labelledby={`shelf-${id}-title`}
    >
      <p className="text-sm font-bold tracking-[0.14em] text-[#b3242f] uppercase">
        {kicker}
      </p>
      <h2
        id={`shelf-${id}-title`}
        className="ghad-display mt-1 text-2xl leading-tight font-extrabold tracking-tight sm:text-3xl"
      >
        {title}
        {count !== undefined && (
          <span className="ml-2 text-lg font-semibold text-[var(--gh-ink-soft)]">
            {count}
          </span>
        )}
      </h2>
      {line && (
        <p className="mt-1 max-w-2xl text-base text-[var(--gh-ink-soft)]">
          {line}
        </p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const REMOVED: Readonly<Record<string, string>> = {
  dates: "aren't on these dates",
  unconfirmed: "aren't confirmed for tonight",
  finished: "have already finished today",
  budget: "aren't stated as free",
  time: "usually take longer than you have",
  distance: "are further away, or in another part of the province",
};

/**
 * **How we chose these** — the evidence, on demand (owner brief M1128:
 * "sophisticated underneath, beautifully simple on the surface"). The
 * radius and how it is measured, what each rule set aside, and the listings
 * with no confirmed place or an earlier year's dates, which are never shown
 * as near or as this year's.
 */
function HowWeChose({
  data,
  ask,
  townName,
}: {
  readonly data: FinderData;
  readonly ask: Ask;
  readonly townName: string;
}) {
  const removed = Object.entries(data.removed).filter(
    ([why, n]) => n > 0 && REMOVED[why],
  );
  return (
    <details
      className="rounded-[20px] p-1 text-sm text-[var(--gh-ink-soft)]"
      data-testid="how-we-chose"
    >
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 font-semibold underline underline-offset-4 [&::-webkit-details-marker]:hidden">
        <Info className="h-4 w-4" aria-hidden />
        How we chose these
      </summary>
      <div className="mt-2 max-w-3xl space-y-2 pl-1">
        <p>
          Everything here is within {ask.km} km of {townName}, measured in a
          straight line from the town. Events come from local event listings,
          with their own dates; &ldquo;On now&rdquo; and &ldquo;Upcoming&rdquo;
          mean the organiser&apos;s dates are confirmed. Lights on the map are
          pinned by locals and checked by a person. We never invent a time, a
          price or that something is open.
        </p>
        {removed.length > 0 && (
          <p data-testid="removed">
            Not shown:{" "}
            {removed.map(([why, n]) => `${n} that ${REMOVED[why]}`).join(" · ")}
            .
          </p>
        )}
        {data.unplaced > 0 && (
          <p data-testid="unplaced-note">
            {data.unplaced}{" "}
            {data.unplaced === 1 ? "listing doesn't" : "listings don't"} say
            where {data.unplaced === 1 ? "it is" : "they are"}, so{" "}
            {data.unplaced === 1 ? "it isn't" : "they aren't"} shown as near
            you.{" "}
            {!ask.unplaced && (
              <Link
                href={discoverHref({ ...ask, unplaced: true }).replace(
                  "#discover",
                  "#shelf-unplaced",
                )}
                scroll={false}
                className="font-semibold underline underline-offset-4"
                data-testid="show-unplaced-link"
              >
                See them, set apart
              </Link>
            )}
          </p>
        )}
        {data.past > 0 && (
          <p>
            {data.past} {data.past === 1 ? "listing has" : "listings have"} only
            an earlier year&apos;s dates, so{" "}
            {data.past === 1 ? "it isn't" : "they aren't"} shown as on this
            year.
          </p>
        )}
      </div>
    </details>
  );
}
