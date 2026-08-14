import type { ReactNode } from "react";

/**
 * The one visual pattern every content section on the Place Detail page
 * uses — a title and a divider, nothing more opinionated than that. A
 * section that has nothing to show returns `null` before ever rendering
 * this, so an empty section never appears as an empty heading with
 * nothing underneath it.
 */
export function SectionShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t py-8 first:border-t-0 first:pt-0">
      <h2 className="mb-3 text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
