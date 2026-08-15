"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ExternalLink,
  Fish,
  Printer,
  Scale,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CATCH_FLOW,
  FISHING_101,
  GEAR_BUY,
  GEAR_OPTIONAL,
  GEAR_OWNED,
  GEAR_RECOMMENDED,
  LEARNING_CARDS,
  LEGAL_RULES,
  LEGAL_WARNING,
  LIVE_CHECKS,
  MEMORY_FIELDS,
  MEMORY_NOTE,
  MODULES,
  MODULE_GROUPS,
  MOMENTS,
  PACK_LIST,
  RIG_STEPS,
  SOURCES,
  TIER_META,
  TRIP,
  type ModuleGroup,
  type Tier,
} from "./content";

/**
 * **Fishing With Emi** — a real outing, used as a product prototype.
 *
 * The question underneath it is not "can Passport write about fishing".
 * It is whether Passport can hold **more possibility than it shows any
 * one person**, and assemble the subset that fits a specific uncle and a
 * specific five-year-old. So the Adventure Builder is the argument: 22
 * modules exist, 13 are on for Emi, and the 9 that are off stay visible
 * with the reason they were not chosen. A page that only rendered her 13
 * would look identical to a page that only had 13 — which is precisely
 * the difference this experiment is trying to make visible.
 *
 * ## Three kinds of claim, three visual treatments
 *
 * The hard part of a page like this is not layout, it is that a fishing
 * regulation, a wildfire status and a suggested game are all "content"
 * and must not look alike. So every claim carries a `Tier`:
 *
 * - **verified** — quoted from a primary source, cited, dated.
 * - **live-check** — deliberately shows no status. Passport is not
 *   fetching it, so an unticked box is the honest rendering and a green
 *   checkmark would be a fabrication.
 * - **prototype** — Passport's own suggestion, marked as invented.
 *
 * Legal content gets its own treatment entirely — bordered, quoted,
 * linked, with an "as of" date on every rule, because it is the only
 * content here that can end a day badly.
 *
 * ## What is deliberately absent
 *
 * No drive-time estimate, no distances, no chosen ice cream shop, no
 * "safe to go" indicator, no persistence. Each of those would require
 * inventing something Atlas does not hold. Seidner Lake in particular is
 * rendered as a scout stop with an explicit warning, because it does not
 * appear in the Region 8 water-specific tables and Passport has no
 * authoritative evidence about it.
 */

const GROUP_ORDER: readonly ModuleGroup[] = [
  "fishing",
  "nature",
  "learning",
  "games",
];

/** Tier pill. The one component that makes the page's honesty legible. */
function TierTag({ tier, className = "" }: { tier: Tier; className?: string }) {
  const meta = TIER_META[tier];
  const styles: Record<Tier, string> = {
    verified: "border-primary/30 bg-primary/10 text-primary",
    "live-check": "border-accent/40 bg-accent/10 text-accent",
    prototype: "border-border bg-muted text-muted-foreground",
  };
  return (
    <span
      title={meta.blurb}
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase ${styles[tier]} ${className}`}
    >
      {meta.short}
    </span>
  );
}

function SourceLink({ id }: { id: string }) {
  const source = SOURCES[id];
  if (!source) return null;
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary decoration-primary/30 hover:decoration-primary inline-flex items-baseline gap-1 underline underline-offset-2"
    >
      {source.publisher}
      <ExternalLink className="h-3 w-3 shrink-0 self-center print:hidden" />
    </a>
  );
}

function Section({
  id,
  eyebrow,
  title,
  lede,
  children,
  className = "",
}: {
  id: string;
  eyebrow: string;
  title: string;
  lede?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`border-border border-t py-14 print:break-inside-avoid print:py-6 ${className}`}
    >
      <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
        {eyebrow}
      </p>
      <h2 className="font-heading mt-2 text-3xl font-medium tracking-tight md:text-4xl">
        {title}
      </h2>
      {lede ? (
        <p className="text-muted-foreground mt-3 max-w-2xl leading-relaxed">
          {lede}
        </p>
      ) : null}
      <div className="mt-8">{children}</div>
    </section>
  );
}

export function FishingWithEmi() {
  const emiDefaults = useMemo(
    () => new Set(MODULES.filter((m) => m.forEmi).map((m) => m.id)),
    [],
  );
  const [selected, setSelected] = useState<ReadonlySet<string>>(emiDefaults);
  const [showUnselected, setShowUnselected] = useState(true);

  const isEmiVersion = useMemo(() => {
    if (selected.size !== emiDefaults.size) return false;
    for (const id of emiDefaults) if (!selected.has(id)) return false;
    return true;
  }, [selected, emiDefaults]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const chosen = MODULES.filter((m) => selected.has(m.id));
  const chosenCards = LEARNING_CARDS.filter((c) => selected.has(c.moduleId));
  const packetItems = chosen.filter((m) => m.packet && m.packet.length > 0);

  return (
    <main className="bg-background text-foreground min-h-screen">
      <Link
        href="/about/ideas-to-make-pages"
        className="border-border bg-card/80 fixed top-4 left-4 z-50 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-sm transition-opacity hover:opacity-70 print:hidden"
      >
        <ArrowLeft className="h-3 w-3" />
        ELK Labs
      </Link>

      <div className="mx-auto max-w-4xl px-5 pb-24 print:max-w-none print:px-0 print:pb-0">
        {/* ============================================================
            Hero
            ============================================================ */}
        <header className="bg-topo -mx-5 px-5 pt-24 pb-14 print:mx-0 print:px-0 print:pt-0">
          <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
            Experiment 07 — Passport prototype
          </p>
          <h1 className="font-heading mt-4 text-5xl font-medium tracking-tight text-balance md:text-6xl">
            {TRIP.title}
          </h1>
          <p className="text-muted-foreground mt-4 max-w-2xl text-lg leading-relaxed">
            {TRIP.subtitle}
          </p>

          <div className="border-primary/30 bg-primary/5 mt-8 rounded-xl border-l-4 p-5">
            <p className="font-heading text-xl leading-snug font-medium md:text-2xl">
              {TRIP.mission}
            </p>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              {TRIP.successNote}
            </p>
          </div>

          <dl className="mt-8 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {TRIP.facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-muted-foreground text-[0.7rem] font-medium tracking-wider uppercase">
                  {fact.label}
                </dt>
                <dd className="mt-0.5 font-medium">{fact.value}</dd>
              </div>
            ))}
          </dl>

          <p className="text-muted-foreground mt-6 max-w-2xl text-sm leading-relaxed italic">
            {TRIP.timingCaveat}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3 print:hidden">
            <Button size="lg" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print adventure
            </Button>
            <a
              href="#legal"
              className="text-muted-foreground hover:text-foreground text-sm font-medium underline underline-offset-4"
            >
              Jump to the legal rules
            </a>
          </div>
        </header>

        {/* ============================================================
            How to read this page — the evidence legend
            ============================================================ */}
        <section className="border-border border-t py-10 print:break-inside-avoid print:py-6">
          <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
            How to read this page
          </p>
          <h2 className="font-heading mt-2 text-2xl font-medium tracking-tight">
            Three kinds of claim, and they are not equal
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {(Object.keys(TIER_META) as Tier[]).map((tier) => (
              <div
                key={tier}
                className="border-border bg-card rounded-xl border p-4"
              >
                <TierTag tier={tier} />
                <p className="mt-3 text-sm font-medium">
                  {TIER_META[tier].label}
                </p>
                <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                  {TIER_META[tier].blurb}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================
            Moments
            ============================================================ */}
        <Section
          id="moments"
          eyebrow="The route"
          title="Four moments, not a list of directions"
          lede="Passport's job is to say why a stop is worth making, not just where it is. One of these four is the fishing. One of them is explicitly not verified."
        >
          <ol className="space-y-4">
            {MOMENTS.map((moment) => (
              <li
                key={moment.id}
                className="border-border bg-card rounded-xl border p-5 print:break-inside-avoid"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
                  <span className="bg-primary text-primary-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                    {moment.index}
                  </span>
                  <h3 className="font-heading text-xl font-medium">
                    {moment.name}
                  </h3>
                  <TierTag tier={moment.tier} />
                  <span className="text-muted-foreground w-full text-sm sm:w-auto">
                    {moment.kind}
                  </span>
                </div>
                <p className="mt-3 leading-relaxed">{moment.why}</p>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {moment.detail}
                </p>
                {moment.caution ? (
                  <p className="border-accent/40 bg-accent/5 mt-3 flex gap-2 rounded-lg border-l-2 p-3 text-sm leading-relaxed">
                    <AlertTriangle className="text-accent mt-0.5 h-4 w-4 shrink-0" />
                    <span>{moment.caution}</span>
                  </p>
                ) : null}
                {moment.sourceIds ? (
                  <p className="text-muted-foreground mt-3 text-xs">
                    Sources:{" "}
                    {moment.sourceIds.map((sid, i) => (
                      <span key={sid}>
                        {i > 0 ? ", " : ""}
                        <SourceLink id={sid} />
                      </span>
                    ))}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </Section>

        {/* ============================================================
            Adventure Builder — the product argument
            ============================================================ */}
        <Section
          id="builder"
          eyebrow="Adventure builder"
          title="The same lake, a different adventure"
          lede="Passport holds more possibilities than it shows any one person. These are all of them. The highlighted ones are what Passport chose for a five-year-old on her first trip — and the ones it did not choose stay visible, with the reason."
        >
          <div className="border-border bg-card sticky top-3 z-20 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 print:hidden">
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="text-accent h-4 w-4 shrink-0" />
              <span>
                <span className="font-semibold">{chosen.length}</span> of{" "}
                {MODULES.length} modules on
                {isEmiVersion ? (
                  <span className="text-accent font-medium">
                    {" "}
                    — Emi&apos;s version
                  </span>
                ) : (
                  <span className="text-muted-foreground"> — customised</span>
                )}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowUnselected((v) => !v)}
              >
                {showUnselected ? "Hide the off ones" : "Show all options"}
              </Button>
              <Button
                size="sm"
                variant={isEmiVersion ? "secondary" : "default"}
                onClick={() => setSelected(new Set(emiDefaults))}
                disabled={isEmiVersion}
              >
                Reset to Emi&apos;s version
              </Button>
            </div>
          </div>

          <div className="space-y-8">
            {GROUP_ORDER.map((group) => {
              const items = MODULES.filter((m) => m.group === group).filter(
                (m) => showUnselected || selected.has(m.id),
              );
              if (items.length === 0) return null;
              return (
                <div key={group}>
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <h3 className="font-heading text-lg font-medium">
                      {MODULE_GROUPS[group].label}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {MODULE_GROUPS[group].blurb}
                    </p>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {items.map((module) => {
                      const on = selected.has(module.id);
                      return (
                        <button
                          key={module.id}
                          type="button"
                          onClick={() => toggle(module.id)}
                          aria-pressed={on}
                          className={`rounded-xl border p-4 text-left transition ${
                            on
                              ? "border-primary/50 bg-primary/5"
                              : // An unchosen module is a control, not part of
                                // the adventure — it must not reach the packet.
                                "border-border bg-card hover:border-foreground/25 print:hidden"
                          }`}
                        >
                          <span className="flex items-start gap-3">
                            <span
                              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                                on
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border"
                              }`}
                            >
                              {on ? <Check className="h-3 w-3" /> : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-baseline gap-2">
                                <span className="font-medium">
                                  {module.title}
                                </span>
                                {module.forEmi ? (
                                  <span className="text-accent text-[0.65rem] font-medium tracking-wide uppercase">
                                    For Emi
                                  </span>
                                ) : null}
                              </span>
                              <span className="text-muted-foreground mt-1 block text-sm leading-relaxed">
                                {module.blurb}
                              </span>
                              <span className="text-muted-foreground/80 mt-2 block text-xs leading-relaxed italic">
                                {module.reason}
                              </span>
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* ============================================================
            Before you go
            ============================================================ */}
        <Section
          id="before"
          eyebrow="Before you go"
          title="Five things Passport cannot check for you"
          lede="These change daily or hourly. Passport is not retrieving them, so it shows no status at all — every one is unticked on purpose."
        >
          <ul className="space-y-3">
            {LIVE_CHECKS.map((item) => (
              <li
                key={item.id}
                className="border-accent/40 bg-accent/5 flex gap-3 rounded-xl border border-l-4 p-4 print:break-inside-avoid"
              >
                <span className="border-accent/60 mt-0.5 h-4 w-4 shrink-0 rounded border-2" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-accent text-[0.65rem] font-semibold tracking-wider uppercase">
                      Check before departure
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                    {item.why}
                  </p>
                  {item.sourceId ? (
                    <p className="mt-1.5 text-xs">
                      <SourceLink id={item.sourceId} />
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          <h3 className="font-heading mt-10 text-xl font-medium">
            And the things you pack
          </h3>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {PACK_LIST.map((item) => (
              <li
                key={item.id}
                className="border-border bg-card flex gap-3 rounded-xl border p-4 print:break-inside-avoid"
              >
                <span className="border-border mt-0.5 h-4 w-4 shrink-0 rounded border-2" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-medium">{item.label}</span>
                    <TierTag tier={item.tier} />
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                    {item.why}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        {/* ============================================================
            Legal — the most visually distinct block on the page
            ============================================================ */}
        <section
          id="legal"
          className="border-border border-t py-14 print:break-before-page print:py-6"
        >
          <div className="flex items-center gap-2">
            <Scale className="text-primary h-5 w-5 shrink-0" />
            <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">
              The legal part — read this one properly
            </p>
          </div>
          <h2 className="font-heading mt-2 text-3xl font-medium tracking-tight md:text-4xl">
            What the law actually says
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl leading-relaxed">
            Every rule below is quoted from a primary source, linked, and dated.
            Nothing here is paraphrased from memory.
          </p>

          <div className="border-destructive/40 bg-destructive/5 mt-6 flex gap-3 rounded-xl border p-4">
            <AlertTriangle className="text-destructive mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm leading-relaxed font-medium">
              {LEGAL_WARNING}
            </p>
          </div>

          <div className="mt-6 space-y-4">
            {LEGAL_RULES.map((rule) => {
              const source = SOURCES[rule.sourceId];
              return (
                <article
                  key={rule.id}
                  className={`rounded-xl border p-5 print:break-inside-avoid ${
                    rule.emphasis
                      ? "border-primary/40 bg-primary/5 border-l-4"
                      : "border-border bg-card"
                  }`}
                >
                  <h3 className="font-heading text-lg font-medium">
                    {rule.heading}
                  </h3>
                  <p className="mt-2 leading-relaxed">{rule.plain}</p>
                  {rule.quote ? (
                    <blockquote className="border-border text-muted-foreground mt-3 border-l-2 pl-3 text-sm leading-relaxed italic">
                      {rule.quote}
                    </blockquote>
                  ) : null}
                  {rule.caveat ? (
                    <p className="bg-muted mt-3 rounded-lg p-3 text-sm leading-relaxed">
                      {rule.caveat}
                    </p>
                  ) : null}
                  <p className="text-muted-foreground mt-3 text-xs">
                    {rule.where} · <SourceLink id={rule.sourceId} /> · checked{" "}
                    {source?.checked}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        {/* ============================================================
            Gear
            ============================================================ */}
        <Section
          id="gear"
          eyebrow="What to buy"
          title="You already own the expensive part"
          lede="Two rods and a licence is most of the way there. Passport's job here is to keep the list small — separating what you have from what you need is the pattern worth generalising later."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="border-primary/40 bg-primary/5 rounded-xl border p-5 print:break-inside-avoid">
              <div className="flex items-center gap-2">
                <Check className="text-primary h-4 w-4 shrink-0" />
                <h3 className="font-heading text-lg font-medium">
                  Already have
                </h3>
              </div>
              <ul className="mt-3 space-y-3">
                {GEAR_OWNED.map((item) => (
                  <li key={item.id}>
                    <p className="decoration-primary/40 text-sm font-medium line-through">
                      {item.name}
                    </p>
                    <p className="text-muted-foreground text-sm">{item.note}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-accent/50 bg-accent/5 rounded-xl border p-5 print:break-inside-avoid">
              <div className="flex items-center gap-2">
                <ShoppingCart className="text-accent h-4 w-4 shrink-0" />
                <h3 className="font-heading text-lg font-medium">
                  Buy before the trip
                </h3>
                <span className="text-accent text-xs font-semibold">
                  {GEAR_BUY.length} items
                </span>
              </div>
              <ul className="mt-3 space-y-3">
                {GEAR_BUY.map((item) => (
                  <li key={item.id} className="flex gap-2.5">
                    <span className="border-accent/50 mt-1 h-3.5 w-3.5 shrink-0 rounded border-2" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {item.name}
                      </span>
                      <span className="text-muted-foreground block text-sm">
                        {item.note}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="border-border bg-card rounded-xl border p-5 print:break-inside-avoid">
              <h3 className="font-heading text-base font-medium">
                Strongly recommended
              </h3>
              <ul className="mt-3 space-y-3">
                {GEAR_RECOMMENDED.map((item) => (
                  <li key={item.id} className="flex gap-2.5">
                    <span className="border-border mt-1 h-3.5 w-3.5 shrink-0 rounded border-2" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {item.name}
                      </span>
                      <span className="text-muted-foreground block text-sm">
                        {item.note}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-border bg-card rounded-xl border p-5 print:break-inside-avoid">
              <h3 className="font-heading text-base font-medium">
                Optional backup tackle
              </h3>
              <ul className="mt-3 space-y-3">
                {GEAR_OPTIONAL.map((item) => (
                  <li key={item.id} className="flex gap-2.5">
                    <span className="border-border mt-1 h-3.5 w-3.5 shrink-0 rounded border-2" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {item.name}
                      </span>
                      <span className="text-muted-foreground block text-sm">
                        {item.note}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* ============================================================
            Fishing 101
            ============================================================ */}
        <Section
          id="fishing-101"
          eyebrow="Fishing 101"
          title="One setup. Learn this and nothing else."
          lede="A bobber, a weight, a hook and a worm. It is the simplest rig that genuinely catches trout, and it gives a five-year-old something to watch."
        >
          <div className="border-border bg-card rounded-xl border p-5 print:break-inside-avoid">
            <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Top of the line, down to the worm
            </p>
            <ol className="mt-4 space-y-0">
              {RIG_STEPS.map((step, i) => (
                <li key={step.part} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="border-primary bg-primary/10 flex h-3 w-3 shrink-0 rounded-full border-2" />
                    {i < RIG_STEPS.length - 1 ? (
                      <span className="bg-border min-h-8 w-px flex-1" />
                    ) : null}
                  </div>
                  <div className="pb-5">
                    <p className="text-sm font-semibold">{step.part}</p>
                    <p className="text-muted-foreground text-sm">{step.note}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <ol className="mt-6 space-y-3">
            {FISHING_101.map((item, i) => (
              <li
                key={item.step}
                className="border-border bg-card flex gap-4 rounded-xl border p-4 print:break-inside-avoid"
              >
                <span className="bg-muted text-muted-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-medium">{item.step}</p>
                  <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                    {item.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        {/* ============================================================
            If we catch one
            ============================================================ */}
        <Section
          id="catch"
          eyebrow="If we catch one"
          title="Decide before it happens, not during"
          lede="A fish out of water is on a clock. Reading this at the shoreline with a trout flapping and a five-year-old shouting is too late."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {CATCH_FLOW.map((phase) => (
              <div
                key={phase.phase}
                className={`rounded-xl border p-5 print:break-inside-avoid ${
                  phase.tone === "release"
                    ? "border-primary/40 bg-primary/5"
                    : phase.tone === "keep"
                      ? "border-accent/40 bg-accent/5"
                      : "border-border bg-card"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Fish
                    className={`h-4 w-4 shrink-0 ${
                      phase.tone === "release"
                        ? "text-primary"
                        : phase.tone === "keep"
                          ? "text-accent"
                          : "text-muted-foreground"
                    }`}
                  />
                  <h3 className="font-heading text-lg font-medium">
                    {phase.phase}
                  </h3>
                </div>
                <ul className="mt-3 space-y-2">
                  {phase.steps.map((step) => (
                    <li
                      key={step}
                      className="text-sm leading-relaxed before:mr-2 before:text-current/40 before:content-['—']"
                    >
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        {/* ============================================================
            Emi's cards — driven by the builder
            ============================================================ */}
        <Section
          id="cards"
          eyebrow="For Emi"
          title="Cards for the drive and the quiet bits"
          lede="These follow the Adventure Builder. Turn a module off above and its card disappears from here and from the printed packet."
        >
          {chosenCards.length === 0 ? (
            <p className="border-border text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
              No cards — every module that carries one is switched off in the
              builder above.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {chosenCards.map((card) => (
                <div
                  key={card.id}
                  className="border-border bg-card rounded-xl border p-4 print:break-inside-avoid"
                >
                  <p className="font-heading text-base font-medium">
                    {card.question}
                  </p>
                  <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                    {card.answer}
                  </p>
                </div>
              ))}
            </div>
          )}

          {packetItems.length > 0 ? (
            <div className="mt-6 space-y-4">
              {packetItems.map((module) => (
                <div
                  key={module.id}
                  className="border-border bg-card rounded-xl border p-5 print:break-inside-avoid"
                >
                  <h3 className="font-heading text-base font-medium">
                    {module.title}
                  </h3>
                  <ul className="mt-2 space-y-1.5">
                    {module.packet?.map((line) => (
                      <li
                        key={line}
                        className="text-muted-foreground text-sm leading-relaxed before:mr-2 before:text-current/40 before:content-['—']"
                      >
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </Section>

        {/* ============================================================
            Memory
            ============================================================ */}
        <Section
          id="memory"
          eyebrow="Afterwards"
          title="What we will actually remember"
          lede="The part of the trip worth keeping is not the route. Fill this in at the treat stop while she still has opinions about it."
        >
          <div className="border-border bg-card rounded-xl border p-5">
            <ul className="space-y-4">
              {MEMORY_FIELDS.map((field) => (
                <li key={field.id}>
                  {field.kind === "check" ? (
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        className="border-border accent-primary h-4 w-4 rounded"
                      />
                      <span className="text-sm font-medium">{field.label}</span>
                    </label>
                  ) : (
                    <label className="block">
                      <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                        {field.label}
                      </span>
                      <input
                        type="text"
                        className="border-border focus:border-primary mt-1 w-full border-0 border-b bg-transparent px-0 py-1.5 text-sm outline-none"
                      />
                    </label>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-muted-foreground mt-4 flex gap-2 text-sm leading-relaxed">
            <TierTag tier="prototype" className="mt-0.5" />
            <span>{MEMORY_NOTE}</span>
          </p>
        </Section>

        {/* ============================================================
            Sources
            ============================================================ */}
        <Section
          id="sources"
          eyebrow="Sources"
          title="Everything cited on this page"
          lede="Each was fetched and read on the date shown. A checked date is not a guarantee — it is a statement about when someone last looked."
        >
          <ul className="space-y-2">
            {Object.values(SOURCES).map((source) => (
              <li
                key={source.id}
                className="border-border flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b pb-2 text-sm"
              >
                <span className="min-w-0">
                  <SourceLink id={source.id} /> — {source.label}
                </span>
                <span className="text-muted-foreground text-xs">
                  checked {source.checked}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <footer className="text-muted-foreground border-border border-t py-10 text-sm print:hidden">
          <p>
            ELK Labs experiment 07. A real outing used as a product prototype —
            not a published itinerary, and not a substitute for the official
            regulations.
          </p>
        </footer>
      </div>
    </main>
  );
}
