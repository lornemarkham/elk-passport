import Link from "next/link";
import type { Door } from "@/domain/conference/modules";

export function Doors({ doors }: { doors: readonly Door[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-3" data-testid="doors">
      {doors.map((d) => (
        <li key={d.href}>
          <Link
            href={d.href}
            className="group bg-cf-ink hover:bg-cf-graphite flex h-full flex-col rounded-2xl p-5 text-white transition"
          >
            <span className="cf-serif text-[19px] leading-snug">{d.title}</span>
            <span className="mt-1 flex-1 text-[14px] text-white/65">
              {d.blurb}
            </span>
            <span className="mt-4 text-[13px] font-semibold text-[#d8c39d] transition group-hover:translate-x-0.5">
              Build it in Go Have A Day →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
