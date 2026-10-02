import Link from "next/link";

/**
 * Moving between the three experiments without going back to the index.
 *
 * It is a lab fixture, not a product navigation. It says which experiment you
 * are in because the whole point is comparing them, and a person three
 * prototypes deep should never have to work out which one they are looking at.
 */
export function LabBar({ here }: { readonly here: string }) {
  const tabs = [
    ["/labs/october/discovery/a", "A · Tonight"],
    ["/labs/october/discovery/b", "B · What do you feel like"],
    ["/labs/october/discovery/c", "C · Trust me"],
    ["/labs/october/discovery/d", "D · Discover"],
  ] as const;
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#e9e6da]/10 pb-4 text-xs">
      <Link
        href="/labs/october/discovery"
        className="text-[#e9e6da]/35 hover:text-[#e9e6da]"
      >
        Lab
      </Link>
      {tabs.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          className={
            href === here
              ? "text-[#d09a4e]"
              : "text-[#e9e6da]/35 hover:text-[#e9e6da]"
          }
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
