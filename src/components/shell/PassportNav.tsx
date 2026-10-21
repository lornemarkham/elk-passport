"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ThemePicker, ThemeProvider } from "@/components/ghad/theme";
import { Wordmark } from "@/components/ghad/Wordmark";

/**
 * **The bar, in the product's own identity.**
 *
 * Walked the deployed product before this existed:
 *
 * ```
 * /            no header, no nav, two links, no sign-in
 * /places      a header of its own, no nav
 * /discovery   a header of its own, and a nav that switches modes
 * /boards      no header, no nav, ZERO links — a dead end
 * /account     no header, no nav, ZERO links — a dead end
 * /october     a real bar, on every October screen
 * ```
 *
 * It is still that bar — plain type that says where you are and stays in one
 * place — now wearing the consumer identity: white ground, near-black type,
 * and the accent on exactly one thing, which is where you are.
 *
 * ## Why the wordmark changed and the repository did not
 *
 * This bar said **Passport**, which is the name of the software. GO HAVE A DAY
 * is the name of the product, so it is what a person reads. Nothing else is
 * renamed; see `Wordmark`.
 *
 * ## Why the theme picker lives here
 *
 * It is one choice that applies to every screen, so it belongs on the one
 * component every screen already has — rather than on Discovery, where it
 * would have looked like a property of Discovery.
 *
 * ## What is deliberately not on it
 *
 * Inspiration, the planner, LIVE. The doctrine fences those off (§13, §14),
 * and a nav is the loudest possible place to promise something that does not
 * exist — which is exactly what the greyed-out `Map` and `AI` tabs were doing
 * on Discovery for months before they were removed.
 *
 * ## Why Experiences is a menu and not three tabs
 *
 * Conference, Hockey Night and October are real products, and until now the
 * only way into them from Go Have a Day was one sentence on the Day Builder
 * (Conference) or an address somebody sent you (the other two). The owner's
 * decision (2026-10-15): Passport is the platform, Go Have a Day is its
 * flagship, and the three are specialised experiences powered by it — so they
 * are reachable from here, but grouped under one word rather than sitting
 * beside Discover, Places and Saved as if they were sections of this product.
 * That keeps the question in doctrine §10 (what an Experience *is*) open while
 * answering the narrower one of how a person finds them.
 *
 * The menu is a row that opens *under* the bar rather than a floating panel:
 * the bar scrolls sideways on a phone, and a scrolling container clips
 * anything positioned over its edge, so a dropdown anchored to the button
 * was cut off at exactly the width it was needed most.
 */

const DESTINATIONS = [
  { href: "/discovery", label: "Discover" },
  { href: "/places", label: "Places" },
  // **Saved means what somebody saved, not the index of their boards.** This
  // pointed at `/boards`, which is the administration screen the owner's
  // route through Discovery → My Places → Back to Boards → Your Boards came
  // out of. `/boards` is still there for anybody who goes looking for it.
  {
    href: "/saved",
    label: "Saved",
    /**
     * A board **is** a saved collection, so somebody looking at one is in this
     * section even though the link points elsewhere. Without this, opening a
     * board unlit the only nav item that described where they were. An
     * adventure is where saved things are planned, so it lights Saved too.
     */
    also: ["/boards", "/adventures"],
  },
] as const;

/**
 * **The experiences, by their existing routes.** Each one keeps its own
 * access rules: `/hockey` sends a visitor to sign in and comes back, and
 * `/conferences` says whether it is open and asks for a code or an account
 * itself. Nothing here bypasses that — these are links, not doors cut into
 * the wall.
 */
const EXPERIENCES = [
  { href: "/conferences", label: "Conference", testId: "conference" },
  { href: "/hockey", label: "Hockey Night", testId: "hockey" },
  { href: "/october", label: "October", testId: "october" },
] as const;

export function PassportNav({
  displayName = null,
  pending = false,
}: {
  /** The signed-in person's name, or `null` for a visitor. */
  readonly displayName?: string | null;
  /**
   * **Who this is is still being read.** The bar is drawn at once — it needs
   * nobody's name — and the one slot that does reserves its width instead of
   * saying "Sign in" to somebody who is about to be greeted by name. Used
   * while a page streams: see `DiscoveryFrame`.
   */
  readonly pending?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const inside = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const here = (destination: { href: string; also?: readonly string[] }) =>
    inside(destination.href) || (destination.also ?? []).some(inside);
  const from = encodeURIComponent(pathname || "/discovery");

  // **The Experiences row.** Closed until asked; closes again when the page
  // changes, on Escape, or on a press anywhere outside the header — the three
  // ways a person says "never mind" without saying it. "Open" is remembered
  // as *the path it was opened on*, so moving to another page closes it by
  // arithmetic rather than by an effect that sets state after the render.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const setOpen = (next: boolean) => setOpenedOn(next ? pathname : null);
  const header = useRef<HTMLElement>(null);
  const rowId = useId();
  const inExperience = EXPERIENCES.some((e) => inside(e.href));
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenedOn(null);
    };
    const onPress = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setOpenedOn(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPress);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPress);
    };
  }, [open]);

  return (
    <ThemeProvider>
      <header ref={header} className="border-b border-black/10 bg-white">
        {/* **The bar scrolls rather than pushing the page.** "GO HAVE A DAY"
            is four times the width of the word it replaced, and at 375px the
            bar came to 519px — so the whole document scrolled sideways by
            144px and every section under it could be dragged off the screen.
            `overflow-x-auto` keeps the overflow where it belongs, the same
            answer the five control rows already use. */}
        <nav
          aria-label="Go Have A Day"
          className="mx-auto flex max-w-[1760px] items-center gap-0.5 overflow-x-auto px-3 sm:gap-1 sm:px-6 lg:px-10"
        >
          {/* The wordmark is the way home, which is the one navigation
              convention it is safe to assume everybody already knows. */}
          <span className="mr-1 inline-flex min-h-12 shrink-0 items-center sm:mr-4">
            <Wordmark href="/" lines={1} />
          </span>

          {DESTINATIONS.map((d) => {
            const current = here(d);
            return (
              <Link
                key={d.href}
                href={d.href}
                aria-current={current ? "page" : undefined}
                data-testid={`passport-nav-${d.label.toLowerCase()}`}
                style={
                  current ? { borderColor: "var(--ghad-accent)" } : undefined
                }
                className={`-mb-px inline-flex min-h-12 shrink-0 items-center border-b-2 px-1.5 text-[14px] font-semibold whitespace-nowrap transition-colors sm:px-3 ${
                  current
                    ? "text-[#111]"
                    : "border-transparent text-black/60 hover:text-black/85"
                }`}
              >
                {d.label}
              </Link>
            );
          })}

          {/* Same type and the same underline as the sections, because from
              here it behaves like one: it lights up when you are inside any
              experience. It is a button, not a link — it opens the row below
              rather than going anywhere itself. */}
          <button
            type="button"
            aria-expanded={open}
            aria-controls={rowId}
            aria-current={inExperience ? "page" : undefined}
            data-testid="passport-nav-experiences"
            onClick={() => setOpen(!open)}
            style={
              inExperience ? { borderColor: "var(--ghad-accent)" } : undefined
            }
            className={`-mb-px inline-flex min-h-12 shrink-0 cursor-pointer items-center gap-1 border-b-2 px-1.5 text-[14px] font-semibold whitespace-nowrap transition-colors sm:px-3 ${
              inExperience || open
                ? "text-[#111]"
                : "border-transparent text-black/60 hover:text-black/85"
            }`}
          >
            Experiences
            <span
              aria-hidden
              className={`text-[10px] transition-transform ${open ? "rotate-180" : ""}`}
            >
              ▾
            </span>
          </button>

          <span className="flex-1" />

          {/* Hidden below `sm`: at phone width the bar only fits through Saved,
              and LABS and Sign in sat beyond the edge. */}
          <ThemePicker className="mr-1 hidden shrink-0 sm:mr-2 sm:flex" />

          {/* **Discreet on purpose.** Labs is where unfinished experiments
              live, so it is the quietest thing on the bar: small, uppercase,
              no accent. It is not a section (§10 is still open). */}
          <Link
            href="/labs"
            aria-current={inside("/labs") ? "page" : undefined}
            data-testid="passport-nav-labs"
            className={`inline-flex min-h-12 shrink-0 items-center px-1.5 text-[11px] font-semibold tracking-[0.14em] uppercase transition-colors sm:px-3 ${
              inside("/labs")
                ? "text-[#111]"
                : "text-black/45 hover:text-black/80"
            }`}
          >
            Labs
          </Link>

          {/* Carries where you are, so auth and the account page can bring you
              back — the same fix October's bar already had. */}
          {pending ? (
            <span
              aria-hidden
              data-testid="passport-account-pending"
              className="inline-flex min-h-12 w-20 shrink-0 sm:w-24"
            />
          ) : displayName ? (
            <Link
              href={`/account?next=${from}`}
              data-testid="passport-account"
              className="inline-flex min-h-12 shrink-0 items-center px-2.5 text-[14px] text-black/60 transition-colors hover:text-black/85 sm:px-3"
            >
              {displayName}
            </Link>
          ) : (
            <Link
              href={`/auth?next=${from}`}
              data-testid="passport-sign-in"
              style={{ color: "var(--ghad-accent)" }}
              className="inline-flex min-h-12 shrink-0 items-center px-2.5 text-[14px] font-semibold sm:px-3"
            >
              Sign in
            </Link>
          )}
        </nav>

        {/* **The row.** Rendered only while open, so a closed menu is nothing
            on the page rather than something hidden on it — and nothing for a
            screen reader to walk past. The links are plain links to the
            existing routes. */}
        {open && (
          <nav
            id={rowId}
            aria-label="Experiences"
            data-testid="passport-experiences"
            className="border-t border-black/10 bg-[#fafafa]"
          >
            <ul className="mx-auto flex max-w-[1760px] items-center gap-0.5 overflow-x-auto px-3 sm:gap-1 sm:px-6 lg:px-10">
              {EXPERIENCES.map((e) => {
                const current = inside(e.href);
                return (
                  <li key={e.href} className="shrink-0">
                    <Link
                      href={e.href}
                      aria-current={current ? "page" : undefined}
                      data-testid={`passport-experience-${e.testId}`}
                      style={
                        current
                          ? { borderColor: "var(--ghad-accent)" }
                          : undefined
                      }
                      className={`-mb-px inline-flex min-h-11 items-center border-b-2 px-1.5 text-[14px] font-semibold whitespace-nowrap transition-colors sm:px-3 ${
                        current
                          ? "text-[#111]"
                          : "border-transparent text-black/60 hover:text-black/85"
                      }`}
                    >
                      {e.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </header>
    </ThemeProvider>
  );
}
