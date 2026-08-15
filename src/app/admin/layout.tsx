/**
 * The Atlas admin shell.
 *
 * ## One calm surface
 *
 * The app-wide `<body>` carries `bg-topo` — a dotted topographic texture
 * that belongs to Passport, where a little warmth suits a traveller-facing
 * product. Behind dense operational lists it is visual noise competing with
 * the data for attention.
 *
 * This overrides it for `/admin` **only**. Passport is untouched: scoping
 * the surface is a one-line override, whereas removing the texture globally
 * would be redesigning a product this task is not about.
 *
 * ## One container
 *
 * A single measure and a single rhythm, so moving between admin pages never
 * shifts the left edge of the content. Previously each area declared its
 * own width — `max-w-6xl`, `max-w-[1400px]`, `max-w-[1800px]` — and pages
 * visibly jumped as you navigated between them.
 *
 * `max-w-[1100px]` is chosen for reading, not for filling the display. Long
 * lists are easier to scan at a fixed measure, and the pages that genuinely
 * need more width (the entity workspace, a run timeline) still declare
 * their own shell in their own segment.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="bg-background min-h-screen">
      <div className="mx-auto max-w-[1100px] px-8 py-12">{children}</div>
    </main>
  );
}
