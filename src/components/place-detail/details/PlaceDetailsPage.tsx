import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarCheck,
  CalendarPlus,
  Clock,
  Info,
  MapPin,
  Navigation,
  Phone,
  Sparkles,
  Trophy,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { ThemeProvider } from "@/components/ghad/theme";
import { SaveButton } from "@/components/place-detail/SaveButton";
import {
  addToDayHref,
  callHref,
  directionsHref,
  phoneDisplay,
  siteOf,
  type PlaceDetailsModel,
  type PlaceInfoSection,
  type PlaceLink,
  type PlaceSectionId,
} from "@/domain/place-details/model";
import { PlaceHeroPhotos } from "./PlaceHeroPhotos";

/**
 * **The one place page** (owner brief M1041). Every place Go Have a Day
 * shows is drawn here: an Atlas Organization at `/passport/[id]`, a local
 * favourite at `/favourites/[slug]`, and the Atlas Place page at
 * `/places/[id]`, which passes its own Atlas sections as `children`. A theme
 * adds to it (a badge, pairings, its own sections); it does not draw its own.
 *
 * What it is for, in the brief's words: _discover, explore, save and plan
 * without unnecessary external navigation_. So the page leads with the
 * photograph and the four things a person does next — Add to My Day, Save,
 * Directions, Call — keeps the facts a visitor checks (hours, where, how to
 * reach them) in a column beside the story on a wide screen, and puts the
 * business's own website, and every source the page was read from, in their
 * place: available, never the destination.
 *
 * Server-rendered; the Save control is the one client island.
 */
export function PlaceDetailsPage({
  model,
  back,
  dayHref,
  children,
}: {
  readonly model: PlaceDetailsModel;
  /** Same-site path back to where they came from, already checked. */
  readonly back?: string;
  /** `/day/{id}` with the day and age they carried, where wanted. */
  readonly dayHref?: string;
  /** A theme's own additions, drawn in the main column after the sections. */
  readonly children?: ReactNode;
}) {
  return (
    <PlaceDetailsFrame
      model={model}
      {...(back ? { back } : {})}
      {...(dayHref ? { dayHref } : {})}
      main={
        <>
          {model.description && (
            <Block title={`About ${model.name}`} testId="place-about">
              <p className="text-[17px] leading-relaxed text-black/80 sm:text-lg">
                {model.description}
              </p>
            </Block>
          )}
          {model.sections.map((section) => (
            <InfoSection key={section.id} section={section} />
          ))}
          <Gallery model={model} />
          {children}
          {model.whatsOn.length > 0 && (
            <Block title="On here" testId="place-whats-on">
              <LinkCards links={model.whatsOn} />
            </Block>
          )}
          {model.pairsWith.length > 0 && (
            <Block title="Make a day of it" testId="place-pairs">
              <LinkCards links={model.pairsWith} />
            </Block>
          )}
        </>
      }
    />
  );
}

/**
 * **The page's frame**: hero, identity, actions, the main column, the visitor
 * column, nearby, and Sources & accuracy. `/places/[id]` passes its own
 * Atlas Place sections as `main`, so a lake park and a pub share everything
 * but the story in the middle.
 */
export function PlaceDetailsFrame({
  model,
  main,
  back,
  dayHref,
  afterSources,
}: {
  readonly model: PlaceDetailsModel;
  readonly main: ReactNode;
  readonly back?: string;
  readonly dayHref?: string;
  /** Extra provenance a page holds that the model does not. */
  readonly afterSources?: ReactNode;
}) {
  return (
    <ThemeProvider>
      <article
        data-testid="place-details"
        className="mx-auto w-full max-w-6xl px-4 pt-3 pb-20 text-[#141414] sm:px-6 sm:pt-5 lg:px-8"
      >
        <Link
          href={back ?? "/discovery"}
          className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-black/60 hover:text-black"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {back ? "Back" : "Discover more"}
        </Link>

        <PlaceHeroPhotos
          name={model.name}
          photos={model.photos}
          kind={model.kindLabel}
        />

        <header className="mt-5 sm:mt-7">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] font-semibold tracking-wide text-black/60 uppercase">
            {model.badge && (
              <span
                data-testid="place-badge"
                className="rounded-full px-2.5 py-1 text-[11px] tracking-wider normal-case"
                style={{
                  backgroundColor: "var(--ghad-accent)",
                  color: "var(--ghad-accent-ink)",
                }}
              >
                {model.badge}
              </span>
            )}
            {model.kindLabel && <span>{model.kindLabel}</span>}
            {model.kindLabel && model.locality && (
              <span aria-hidden className="text-black/30">
                ·
              </span>
            )}
            {model.locality && (
              <span className="normal-case">{model.locality}</span>
            )}
          </p>
          <h1 className="ghad-display mt-2 text-[40px] leading-[0.98] font-extrabold tracking-[-0.03em] sm:text-6xl lg:text-7xl">
            {model.name}
          </h1>
          {model.tagline && (
            <p className="mt-3 max-w-3xl text-lg leading-snug text-black/75 sm:text-xl">
              {model.tagline}
            </p>
          )}
          {model.goodFor.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Good for">
              {model.goodFor.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full bg-black/[0.05] px-3 py-1.5 text-sm font-medium text-black/75"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </header>

        <Actions model={model} {...(dayHref ? { dayHref } : {})} />

        <div className="mt-8 grid gap-10 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
          <div className="flex min-w-0 flex-col gap-10">{main}</div>
          <VisitorColumn model={model} />
        </div>

        {model.nearby.length > 0 && (
          <section
            className="mt-14"
            aria-labelledby="place-nearby"
            data-testid="place-nearby"
          >
            <h2
              id="place-nearby"
              className="ghad-display text-2xl font-extrabold tracking-[-0.02em] sm:text-3xl"
            >
              Close by
            </h2>
            <p className="mt-1 text-sm text-black/55">
              Within a short drive, in a straight line.
            </p>
            <div className="mt-4">
              <LinkCards links={model.nearby} wide />
            </div>
          </section>
        )}

        <SourcesAndAccuracy model={model}>{afterSources}</SourcesAndAccuracy>
      </article>
    </ThemeProvider>
  );
}

/** The four things a person does next, then the quiet one. */
function Actions({
  model,
  dayHref,
}: {
  readonly model: PlaceDetailsModel;
  readonly dayHref?: string;
}) {
  const directions = directionsHref(model);
  const call = callHref(model.phone);
  const secondary =
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-4 text-[15px] font-semibold ring-1 ring-black/15 transition hover:ring-black/40";
  return (
    <div className="mt-6">
      <div
        data-testid="place-actions"
        className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2.5"
      >
        <Link
          href={addToDayHref(model.id)}
          data-testid="place-add-to-day"
          className="col-span-3 inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold shadow-sm transition hover:opacity-90"
          style={{
            backgroundColor: "var(--ghad-accent)",
            color: "var(--ghad-accent-ink)",
          }}
        >
          <CalendarPlus className="h-4.5 w-4.5" aria-hidden />
          Add to My Day
        </Link>
        <div className="[&_button]:min-h-12 [&_button]:w-full [&_button]:rounded-full [&_button]:px-4 [&_button]:text-[15px] [&_button]:font-semibold sm:[&_button]:w-auto">
          <SaveButton placeId={model.id} />
        </div>
        {directions ? (
          <a
            href={directions}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="place-directions"
            className={secondary}
          >
            <Navigation className="h-4 w-4" aria-hidden />
            Directions
          </a>
        ) : (
          <span className={`${secondary} text-black/35 ring-black/10`}>
            <Navigation className="h-4 w-4" aria-hidden />
            No address yet
          </span>
        )}
        {call ? (
          <a href={call} data-testid="place-call" className={secondary}>
            <Phone className="h-4 w-4" aria-hidden />
            Call
          </a>
        ) : (
          <span className={`${secondary} text-black/35 ring-black/10`}>
            <Phone className="h-4 w-4" aria-hidden />
            No phone
          </span>
        )}
      </div>
      {dayHref && (
        <Link
          href={dayHref}
          data-testid="lets-do-this"
          className="mt-3 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-black/70 underline-offset-4 hover:underline"
        >
          <CalendarCheck className="h-4 w-4" aria-hidden />
          Going on a particular day? See what we know about it
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}

/** Hours, where, and how to reach them: what a visitor checks, kept together. */
function VisitorColumn({ model }: { readonly model: PlaceDetailsModel }) {
  const directions = directionsHref(model);
  const call = callHref(model.phone);
  const site = model.website ? siteOf(model.website) : undefined;
  return (
    <aside
      data-testid="place-visitor"
      aria-label="Visiting"
      className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start"
    >
      <Card icon={Clock} title="Hours" testId="place-hours">
        {model.hours && model.hours.lines.length > 0 ? (
          <>
            <ul className="space-y-1 text-[15px]">
              {model.hours.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {!model.hours.confirmed && (
              <p className="mt-2 text-sm text-black/60">
                {model.hours.note ??
                  "As published by one source, not confirmed."}
              </p>
            )}
          </>
        ) : (
          <p className="text-[15px] text-black/65">
            {model.hours?.note ??
              "We don't have confirmed hours yet. Call ahead before you go."}
          </p>
        )}
      </Card>

      <Card icon={MapPin} title="Location" testId="place-location">
        {model.address ? (
          <p className="text-[15px]">{model.address}</p>
        ) : (
          <p className="text-[15px] text-black/65">
            We don&apos;t have an address for it yet.
          </p>
        )}
        {model.point && (
          <iframe
            title={`Map of ${model.name}`}
            src={osmEmbed(model.point)}
            loading="lazy"
            className="mt-3 h-44 w-full rounded-xl ring-1 ring-black/10"
          />
        )}
        {directions && (
          <a
            href={directions}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline"
          >
            Get directions
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </a>
        )}
      </Card>

      {(call || site || model.social.length > 0 || model.links.length > 0) && (
        <Card icon={Phone} title="Contact" testId="place-contact">
          {call && model.phone && (
            <a
              href={call}
              className="block text-[15px] font-semibold underline-offset-4 hover:underline"
            >
              {phoneDisplay(model.phone)}
            </a>
          )}
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-black/65">
            {model.website && site && (
              <li>
                <a
                  href={model.website}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="place-website"
                  className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                >
                  {site}
                  <ArrowUpRight className="h-3 w-3" aria-hidden />
                </a>
              </li>
            )}
            {model.links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                >
                  {l.label}
                  <ArrowUpRight className="h-3 w-3" aria-hidden />
                </a>
              </li>
            ))}
            {model.social.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                >
                  {s.label}
                  <ArrowUpRight className="h-3 w-3" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {model.partOf.length > 0 && (
        <Card icon={Info} title="Part of" testId="place-part-of">
          <ul className="flex flex-wrap gap-2">
            {model.partOf.map((p) => (
              <li key={p.href}>
                <Link
                  href={p.href}
                  className="inline-block rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-black/15 hover:ring-black/40"
                >
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </aside>
  );
}

const SECTION_ICONS: Record<PlaceSectionId, LucideIcon> = {
  "food-drink": Utensils,
  activities: Trophy,
  amenities: Sparkles,
  menus: BookOpen,
  visitor: Info,
  about: Info,
};

function InfoSection({ section }: { readonly section: PlaceInfoSection }) {
  const Icon = SECTION_ICONS[section.id];
  return (
    <Block
      title={section.title}
      icon={Icon}
      testId={`place-section-${section.id}`}
    >
      {section.lines.length > 0 && (
        <ul
          className={
            section.lines.every((l) => !l.label && l.text.length <= 40)
              ? "flex flex-wrap gap-2"
              : "grid gap-x-8 gap-y-3 sm:grid-cols-2"
          }
        >
          {section.lines.map((line) =>
            !line.label &&
            line.text.length <= 40 &&
            section.lines.every((l) => !l.label && l.text.length <= 40) ? (
              <li
                key={line.text}
                className="rounded-full bg-black/[0.05] px-3 py-1.5 text-[15px] font-medium"
              >
                {line.text}
              </li>
            ) : (
              <li
                key={(line.label ?? "") + line.text}
                className="text-[15px] leading-snug"
              >
                {line.label && (
                  <span className="block text-[13px] font-semibold tracking-wide text-black/55 uppercase">
                    {line.label}
                  </span>
                )}
                <span className="whitespace-pre-line">{line.text}</span>
              </li>
            ),
          )}
        </ul>
      )}
      {section.passages.map((p) => (
        <p
          key={p}
          className="mt-3 text-[15px] leading-relaxed text-black/75 first:mt-0"
        >
          {p}
        </p>
      ))}
    </Block>
  );
}

/** Every photograph after the hero, credited. */
function Gallery({ model }: { readonly model: PlaceDetailsModel }) {
  const rest = model.photos.slice(1);
  if (rest.length === 0) return null;
  return (
    <Block
      title="Photos"
      testId="place-gallery"
      // Two more are already in the wide hero; a third is not.
      className={model.photos.length <= 3 ? "lg:hidden" : ""}
    >
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {rest.map((p, i) => (
          <li
            key={p.url}
            className={`relative aspect-[4/3] overflow-hidden rounded-2xl bg-black/5 ${
              model.photos.length > 3 && i < 2 ? "lg:hidden" : ""
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- publisher hosts, sized by address */}
            <img
              src={p.url}
              alt={p.alt}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
            {p.credit && (
              <span className="absolute right-2 bottom-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white/90">
                {p.credit}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Block>
  );
}

function LinkCards({
  links,
  wide = false,
}: {
  readonly links: readonly PlaceLink[];
  readonly wide?: boolean;
}) {
  return (
    <ul
      className={`grid gap-3 ${wide ? "grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"}`}
    >
      {links.map((l) => (
        <li key={l.href + l.title}>
          <Link
            href={l.href}
            className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-black/10 transition hover:-translate-y-0.5 hover:ring-black/25"
          >
            {l.image && (
              <span className="relative block aspect-[16/9] bg-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element -- Atlas media hosts */}
                <img
                  src={l.image.url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col justify-between gap-2 p-4">
              <span>
                {l.eyebrow && (
                  <span className="block text-[12px] font-semibold tracking-wide text-black/50 uppercase">
                    {l.eyebrow}
                  </span>
                )}
                <span className="block text-[17px] leading-tight font-bold">
                  {l.title}
                </span>
                {l.line && (
                  <span className="mt-1 line-clamp-2 block text-sm text-black/65">
                    {l.line}
                  </span>
                )}
              </span>
              <ArrowRight
                className="h-4 w-4 text-black/40 transition group-hover:translate-x-0.5 group-hover:text-black"
                aria-hidden
              />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * **Sources & accuracy, folded.** Where every fact came from and the day it
 * was read, the full passages read from the business's pages, and how many
 * facts were left out for only repeating the page — there for whoever wants
 * to check, and out of the way of whoever wants to go.
 */
function SourcesAndAccuracy({
  model,
  children,
}: {
  readonly model: PlaceDetailsModel;
  readonly children?: ReactNode;
}) {
  const count = model.sources.length;
  return (
    <details
      data-testid="place-sources"
      className="group mt-14 rounded-2xl bg-black/[0.035] px-5 py-4 text-sm text-black/70"
    >
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 font-semibold text-black/85">
        <span>
          Sources &amp; accuracy
          <span className="ml-2 font-normal text-black/55">
            {count === 0
              ? "· no sources listed"
              : `· ${count} ${count === 1 ? "source" : "sources"}`}
          </span>
        </span>
        <span
          aria-hidden
          className="text-black/50 transition group-open:rotate-90"
        >
          ›
        </span>
      </summary>
      <div className="mt-3 space-y-4">
        <p>
          Go Have a Day reads public pages and Atlas, our place knowledge, and
          says only what they state. Hours, menus and prices change — check with
          the business before you make a special trip.
        </p>
        {count > 0 && (
          <ul className="space-y-1.5">
            {model.sources.map((s, i) => (
              <li key={`${s.url ?? ""}${s.label ?? ""}${i}`}>
                {s.label && (
                  <span className="font-semibold text-black/80">
                    {s.label}:{" "}
                  </span>
                )}
                {s.quote && <>“{s.quote}” — </>}
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    {s.site ?? s.url}
                  </a>
                ) : (
                  s.site
                )}
                {s.checked && <>, read {s.checked}</>}
              </li>
            ))}
          </ul>
        )}
        {model.readFromSources.length > 0 && (
          <div>
            <p className="font-semibold text-black/80">
              In full, as read from their pages
            </p>
            <ul className="mt-1.5 space-y-2">
              {model.readFromSources.map((r) => (
                <li
                  key={(r.label ?? "") + r.text}
                  className="whitespace-pre-line"
                >
                  {r.label && (
                    <span className="font-semibold">{r.label}: </span>
                  )}
                  {r.text}
                </li>
              ))}
            </ul>
          </div>
        )}
        {model.withheld > 0 && (
          <p>
            {model.withheld}{" "}
            {model.withheld === 1 ? "fact repeats" : "facts repeat"} what this
            page already says, so{" "}
            {model.withheld === 1 ? "it isn't" : "they aren't"} shown twice.
          </p>
        )}
        {children}
        {model.atlasHref && (
          <p>
            <Link
              href={model.atlasHref}
              className="underline underline-offset-2"
            >
              The Atlas record for {model.name}
            </Link>
          </p>
        )}
      </div>
    </details>
  );
}

function Block({
  title,
  icon: Icon,
  testId,
  className = "",
  children,
}: {
  readonly title: string;
  readonly icon?: LucideIcon;
  readonly testId?: string;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <section id={testId} data-testid={testId} className={className}>
      <h2 className="ghad-display flex items-center gap-2.5 text-2xl font-extrabold tracking-[-0.02em]">
        {Icon && (
          <span className="grid h-8 w-8 place-items-center rounded-full bg-black/[0.06]">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        )}
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Card({
  icon: Icon,
  title,
  testId,
  children,
}: {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly testId: string;
  readonly children: ReactNode;
}) {
  return (
    <section
      data-testid={testId}
      className="rounded-2xl bg-white p-5 ring-1 ring-black/10"
    >
      <h2 className="flex items-center gap-2 font-sans text-[13px] font-bold tracking-wider text-black/60 uppercase">
        <Icon className="h-4 w-4" aria-hidden />
        {title}
      </h2>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

function osmEmbed(p: { latitude: number; longitude: number }): string {
  const d = 0.006;
  const bbox = [
    p.longitude - d,
    p.latitude - d,
    p.longitude + d,
    p.latitude + d,
  ].join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&marker=${p.latitude},${p.longitude}&layer=mapnik`;
}
