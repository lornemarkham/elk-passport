import { TraceProvider } from "@/components/admin/learning-tracer/TraceContext";
import { LearningTracerPanel } from "@/components/admin/learning-tracer/LearningTracerPanel";
import { LearningTracerToggleButton } from "@/components/admin/learning-tracer/LearningTracerToggleButton";

/**
 * Shared shell for Atlas's curator workbench. Just the eyebrow label now —
 * the back-navigation link moved into each page individually (page.tsx
 * goes back to Passport; the sub-pages go back to this overview), since
 * "back" means something different depending on how deep you are, and a
 * shared layout can't tell which page is active without more machinery
 * than a one-line label is worth.
 *
 * Named "Atlas" deliberately, not "Passport" — this is Atlas's tooling,
 * hosted here for practical reasons (Passport already has a UI kit, an
 * admin auth pattern, and routing; Atlas is a plain Node server with none
 * of that), not because it's a Passport feature. Worth remembering when
 * deciding what belongs under here: the test is "does this grow Atlas's
 * knowledge faster or with higher quality," not "does this serve Passport."
 *
 * `TraceProvider` is mounted here, once, for the whole workbench — not per
 * page — so the Learning Tracer's last emission and open/closed state
 * survive navigating between Explorer, Duplicates, and this overview page.
 * `ContentOperationsLayout` itself stays a server component; `TraceProvider`
 * is the one client boundary, wrapping `{children}` rather than replacing it.
 *
 * Curator Workbench v2: widened from `max-w-4xl` to `max-w-6xl` — the
 * Content Explorer's two-column entity-list-plus-detail layout was the
 * direct cause of the page's own worst scrolling problem, cramped into a
 * column narrower than a workspace tool needs. The Learning Tracer's
 * toggle no longer lives in this header — it's a fixed, self-positioning
 * floating launcher now (`LearningTracerToggleButton`), rendered once
 * alongside the panel rather than claiming permanent header space.
 */
export default function ContentOperationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TraceProvider>
      <main className="bg-background min-h-screen">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <p className="text-muted-foreground mb-4 text-xs font-medium tracking-wide uppercase">
            Atlas Curator Workbench
          </p>
          {children}
        </div>
      </main>
      <LearningTracerPanel />
      <LearningTracerToggleButton />
    </TraceProvider>
  );
}
