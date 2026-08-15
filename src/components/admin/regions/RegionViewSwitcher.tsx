/**
 * The Region workspace's view switcher. **Only List works today.**
 *
 * ## Why ship a control that mostly does nothing
 *
 * Because the alternative is worse. The Region page's long-term job is to
 * be the one place a curator manages a destination, and every one of these
 * views is a different question about the *same* scoped set of entities —
 * not a different page:
 *
 * | View | The question |
 * |---|---|
 * | List | which of these needs work? |
 * | Relationships | how is this destination connected? |
 * | Map | where is the knowledge thin, geographically? |
 * | Coverage | what does Atlas systematically not know here? |
 * | Timeline | what changed, and when? |
 *
 * Stating them here makes it structurally obvious that the answer to
 * "where does the map go?" is *a view*, not a sixth admin page. That is
 * exactly the mistake ADR 028 exists to prevent — a hierarchy level with
 * no unique responsibility — and a visible, disabled control is a cheaper
 * reminder than a document nobody opens.
 *
 * ## Honest about being unbuilt
 *
 * Disabled, `aria-disabled`, and labelled *Soon* on hover. Not a tab that
 * silently does nothing when clicked — the same rule the Region page
 * already follows by printing CLI commands instead of buttons that pretend
 * to start a crawl. **A control that lies about what it does teaches the
 * wrong model of the system.**
 *
 * Deliberately not a client component: nothing here holds state yet.
 * Whichever view lands first brings its own state with it.
 */

const VIEWS = [
  { id: "list", label: "List", ready: true },
  { id: "relationships", label: "Relationships", ready: false },
  { id: "map", label: "Map", ready: false },
  { id: "coverage", label: "Coverage", ready: false },
  { id: "timeline", label: "Timeline", ready: false },
] as const;

export function RegionViewSwitcher() {
  return (
    <div
      className="border-border flex w-fit items-center gap-1 rounded-lg border p-1"
      role="group"
      aria-label="Region view"
    >
      {VIEWS.map((view) =>
        view.ready ? (
          <span
            key={view.id}
            aria-current="true"
            className="bg-foreground text-background rounded-md px-3 py-1.5 text-sm font-medium"
          >
            {view.label}
          </span>
        ) : (
          <span
            key={view.id}
            aria-disabled="true"
            title="Not built yet"
            className="text-muted-foreground/50 cursor-not-allowed rounded-md px-3 py-1.5 text-sm"
          >
            {view.label}
          </span>
        ),
      )}
    </div>
  );
}
