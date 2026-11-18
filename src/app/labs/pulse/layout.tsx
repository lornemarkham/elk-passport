import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/pulse/model";
import { PulseMark } from "./_ui/Mark";

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s — ${BRAND.name}` },
  description: BRAND.tagline,
};

/**
 * People's Pulse sits inside Passport, under Labs, with its own quiet frame:
 * a paper page, its name, and "Powered by ELK" at the foot.
 */
export default function PulseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#fbfaf7] text-[#14161a]">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-5 pt-5">
        <Link
          href="/labs/pulse"
          className="flex items-center gap-2.5 rounded-full focus-visible:ring-2 focus-visible:ring-[#14161a] focus-visible:outline-none"
        >
          <PulseMark />
          <span className="text-[17px] font-bold tracking-tight">
            {BRAND.name}
          </span>
        </Link>
        <Link
          href="/labs"
          className="rounded-full px-3 py-2 text-[13px] font-medium text-[#5c6370] hover:text-[#14161a]"
        >
          Labs
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
