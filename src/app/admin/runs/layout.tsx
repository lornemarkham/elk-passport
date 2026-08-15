/**
 * Shell for the Ingestion Observatory. Sibling of `/admin/entities` and
 * for the same reason: the Curator Workbench layout constrains to
 * `max-w-6xl`, and a timeline of a city-scale run needs the full width.
 */
export default function ObservatoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="bg-background min-h-screen">
      <div className="mx-auto max-w-[1400px] px-8 py-10">{children}</div>
    </main>
  );
}
