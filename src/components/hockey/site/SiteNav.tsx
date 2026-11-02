"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { hockeyPath } from "@/domain/hockey/site";
import styles from "./site.module.css";

const LINKS = [
  { href: hockeyPath(), label: "Home", exact: true },
  { href: hockeyPath("/games"), label: "Scores" },
  { href: hockeyPath("/standings"), label: "Standings" },
  { href: hockeyPath("/teams"), label: "Teams" },
  { href: hockeyPath("/my-nights"), label: "My Hockey Nights" },
];

export function SiteNav() {
  const path = usePathname() ?? "";
  return (
    <nav
      aria-label="Hockey"
      className={`${styles.noScrollbar} -mx-4 flex gap-1 overflow-x-auto px-4 pb-2.5`}
    >
      {LINKS.map((l) => {
        const on = l.exact
          ? path === l.href
          : path === l.href || path.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={on ? "page" : undefined}
            className={`flex min-h-9 shrink-0 items-center rounded-full px-3.5 text-[14px] font-semibold transition ${
              on
                ? "bg-white text-[#05080f]"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
