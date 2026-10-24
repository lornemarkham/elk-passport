"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  Compass,
  House,
  MessageSquare,
  PlaneLanding,
  Settings,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { Avatar } from "../kit";

const ICONS = {
  home: House,
  arrivals: PlaneLanding,
  agenda: CalendarDays,
  explore: Compass,
  people: Users,
  you: UserRound,
  plans: Sparkles,
  memories: Camera,
  settings: Settings,
  back: ArrowLeft,
  ghad: Compass,
} as const;

export interface BarLink {
  readonly href: string;
  readonly label: string;
  readonly icon: keyof typeof ICONS;
  /** Active only on this exact path (Home), not its children. */
  readonly exact?: boolean;
  /** Only in the phone's menu (where Go Have a Day's bar is hidden). */
  readonly phoneOnly?: boolean;
}

/**
 * The conference bar. On a wide screen: name, tabs, messages, profile. On a
 * phone: name, messages and profile on top, the five tabs as a bar along the
 * bottom edge where a thumb is — each a full fifth of the width and 64 px
 * tall, the current one lit by a pill behind its icon (as Hockey Night's
 * bar is lit by its marker), clear of the home indicator.
 */
export function ConferenceBar({
  home,
  name,
  dates,
  accent,
  tabs,
  menu,
  chat,
  you,
  organiser,
}: {
  home: string;
  name: string;
  dates: string;
  accent: string;
  tabs: readonly BarLink[];
  menu: readonly BarLink[];
  chat: string | null;
  you: string;
  organiser: boolean;
}) {
  const path = usePathname() ?? "";
  const active = (l: BarLink) =>
    l.exact
      ? path === l.href
      : path === l.href || path.startsWith(`${l.href}/`);

  return (
    <>
      <div className="border-cf-line bg-cf-paper/90 supports-[backdrop-filter]:bg-cf-paper/75 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-3 px-4 sm:gap-4 sm:px-8">
          <Link
            href={home}
            className="flex min-w-0 items-center gap-2.5"
            aria-label={`${name}, home`}
          >
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: accent }}
            />
            <span className="cf-serif text-cf-ink truncate text-[17px]">
              {name}
            </span>
            <span className="text-cf-mist hidden truncate text-[13px] lg:inline">
              {dates}
            </span>
          </Link>
          <nav
            aria-label="Conference"
            className="ml-auto hidden h-full items-stretch gap-1 md:flex"
          >
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active(t) ? "page" : undefined}
                className={`relative flex items-center px-3 text-[14px] font-semibold transition ${
                  active(t) ? "text-cf-ink" : "text-cf-mist hover:text-cf-ink"
                }`}
              >
                {t.label}
                {active(t) ? (
                  <span
                    aria-hidden="true"
                    className="bg-cf-ink absolute inset-x-3 bottom-0 h-[2px] rounded-full"
                  />
                ) : null}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1 md:ml-2">
            {chat ? (
              <Link
                href={chat}
                aria-label="Group chat"
                title="Group chat"
                aria-current={path.startsWith(chat) ? "page" : undefined}
                className={`hover:bg-cf-sand flex h-10 w-10 items-center justify-center rounded-full transition ${
                  path.startsWith(chat) ? "bg-cf-sand" : ""
                }`}
              >
                <MessageSquare
                  className="h-[18px] w-[18px]"
                  strokeWidth={1.8}
                />
              </Link>
            ) : null}
            <ProfileMenu you={you} menu={menu} organiser={organiser} />
          </div>
        </div>
      </div>

      <nav
        aria-label="Conference sections"
        className="border-cf-line bg-cf-card/95 fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul
          className="mx-auto grid max-w-[560px] px-1"
          style={{
            gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
          }}
        >
          {tabs.map((t) => {
            const Icon = ICONS[t.icon];
            const on = active(t);
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={on ? "page" : undefined}
                  className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold tracking-[0.01em] transition active:scale-[0.96] ${
                    on ? "text-cf-ink" : "text-cf-mist"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                      on ? "bg-cf-sand" : ""
                    }`}
                  >
                    <Icon
                      className="h-[22px] w-[22px]"
                      strokeWidth={on ? 2.2 : 1.7}
                    />
                  </span>
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

function ProfileMenu({
  you,
  menu,
  organiser,
}: {
  you: string;
  menu: readonly BarLink[];
  organiser: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Your profile and settings"
        onClick={() => setOpen((o) => !o)}
        className="hover:bg-cf-sand flex h-10 items-center gap-2 rounded-full pr-1 pl-1 transition"
      >
        <Avatar name={you} size={30} you />
      </button>
      {open ? (
        <div
          role="menu"
          className="cf-rise border-cf-line absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border bg-white p-1.5 shadow-[0_12px_40px_rgba(23,24,27,0.14)]"
        >
          <p className="text-cf-mist px-3 pt-2 pb-2 text-[13px]">
            Signed in here as{" "}
            <span className="text-cf-ink font-semibold">{you}</span>
            {organiser ? " · organiser" : ""}
          </p>
          {menu.map((m) => {
            const Icon = ICONS[m.icon];
            return (
              <Link
                key={m.href}
                href={m.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={`text-cf-ink hover:bg-cf-paper flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium ${
                  m.phoneOnly ? "md:hidden" : ""
                }`}
              >
                <Icon className="text-cf-slate h-4 w-4" strokeWidth={1.8} />
                {m.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
