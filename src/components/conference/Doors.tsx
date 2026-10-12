import Link from "next/link";
import type { Door } from "@/domain/conference/modules";

export function Doors({ doors }: { doors: readonly Door[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-3" data-testid="doors">
      {doors.map((d) => (
        <li key={d.href}>
          <Link
            href={d.href}
            className="flex h-full flex-col rounded-2xl border border-black/10 p-4"
          >
            <span className="text-[17px] font-bold">{d.title}</span>
            <span className="mt-1 text-[14px] text-black/55">{d.blurb}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
