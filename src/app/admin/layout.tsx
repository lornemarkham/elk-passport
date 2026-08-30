import { TraceProvider } from "@/components/admin/learning-tracer/TraceContext";
import { LearningTracerPanel } from "@/components/admin/learning-tracer/LearningTracerPanel";
import { LearningTracerToggleButton } from "@/components/admin/learning-tracer/LearningTracerToggleButton";

/**
 * The Atlas admin shell.
 *
 * ## The Learning Tracer's provider lives here, and had gone missing
 *
 * `TraceProvider` was mounted once for the whole workbench in
 * `admin/content/layout.tsx`. `3609a41` ("nine routes become seven") deleted
 * that layout and moved `explorer/` out from under it, and nothing
 * re-mounted the provider — so `useTrace()` threw and `/admin/explorer`
 * returned a 500 from that commit onward. It fails loudly on purpose; what
 * was missing was anywhere for it to be heard.
 *
 * Mounted here rather than per page, so the tracer's last emission and
 * open/closed state survive navigating between admin pages. This layout
 * stays a server component — `TraceProvider` is the one client boundary,
 * wrapping `{children}` rather than replacing them. The panel and its
 * launcher are `fixed` and self-positioning, so neither affects the measure
 * below.
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
    <TraceProvider>
      <main className="bg-background min-h-screen">
        <div className="mx-auto max-w-[1100px] px-8 py-12">{children}</div>
      </main>
      <LearningTracerPanel />
      <LearningTracerToggleButton />
    </TraceProvider>
  );
}
