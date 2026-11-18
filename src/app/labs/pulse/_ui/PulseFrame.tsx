import Link from "next/link";
import { BRAND } from "@/lib/pulse/model";
import { PulseMark } from "./Mark";

/**
 * People's Pulse's own quiet frame — a paper page, its name, and "Powered by
 * ELK" at the foot — shared by `/labs/pulse` and Pulse Check (`/check`).
 */
export function PulseFrame({
  children,
  home,
  sub,
  aside,
}: {
  children: React.ReactNode;
  /** Where the name in the corner goes. */
  home: string;
  /** A second name beside the brand ("Pulse Check"). */
  sub?: string;
  aside: { href: string; label: string };
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#fbfaf7] text-[#14161a]">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-5 pt-5">
        <Link
          href={home}
          className="flex min-w-0 items-center gap-2.5 rounded-full focus-visible:ring-2 focus-visible:ring-[#14161a] focus-visible:outline-none"
        >
          <PulseMark />
          <span className="flex min-w-0 flex-col leading-tight sm:flex-row sm:items-baseline sm:gap-1.5">
            <span className="text-[17px] font-bold tracking-tight">
              {BRAND.name}
            </span>
            {sub ? (
              <span className="text-[13px] font-semibold text-[#e5484d] sm:text-[17px]">
                <span aria-hidden className="hidden sm:inline">
                  ·{" "}
                </span>
                {sub}
              </span>
            ) : null}
          </span>
        </Link>
        <Link
          href={aside.href}
          className="shrink-0 rounded-full px-3 py-2 text-[13px] font-medium text-[#5c6370] hover:text-[#14161a]"
        >
          {aside.label}
        </Link>
      </header>
      <main className="mx-auto w-full max-w-2xl min-w-0 flex-1 px-5 pt-4 pb-14">
        {children}
      </main>
      <footer className="border-t border-[#e7e3da] py-6 text-center text-[13px] text-[#5c6370]">
        <p>
          <span className="font-semibold text-[#14161a]">{BRAND.name}</span> ·{" "}
          {BRAND.tagline}
        </p>
        <p className="mt-1 tracking-wide" data-testid="pulse-footer">
          {BRAND.footer}
        </p>
      </footer>
    </div>
  );
}
