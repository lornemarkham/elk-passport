import { Sparkles } from "lucide-react";

/**
 * The front door: **"What should Atlas learn?"**
 *
 * ## Deliberately, visibly not working yet
 *
 * The input is disabled, and says so in plain words directly beneath
 * itself. That is the whole design decision, and it was the hard one.
 *
 * An enabled box that accepted "Wineries in the Okanagan" and then
 * apologised would be a lie told twice — once by the affordance, once by
 * the response. A page whose entire claim is *"every number here is real"*
 * cannot open with a control that pretends. So the box is present because
 * it states the ambition better than any paragraph could — **Atlas is
 * something you teach, not something you operate** — and it is inert
 * because that ambition isn't built.
 *
 * The examples are illustrations of the intended vocabulary, not buttons.
 * They are the clearest way to show that a mission is a *subject*
 * ("BC Waterfalls", "Halloween Events"), not a URL or a command.
 *
 * What replaces it when the planner gains a UI: this same box, enabled,
 * routing to `RegionLearningPlanner` — which already produces a reviewable
 * plan for exactly this shape of request.
 */
const EXAMPLES = [
  "Restaurants in Vernon",
  "Wineries in the Okanagan",
  "Big White",
  "Vancouver Breweries",
  "BC Waterfalls",
  "Halloween Events",
  "Sports Teams in Vancouver",
];

export function MissionLauncher() {
  return (
    <section className="border-border rounded-2xl border p-8">
      <div className="flex items-center gap-2">
        <Sparkles className="text-muted-foreground h-3.5 w-3.5" />
        <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Teach Atlas
        </p>
      </div>

      <h2 className="mt-3 text-2xl font-semibold tracking-tight">
        What should Atlas learn?
      </h2>

      <div className="mt-5">
        <input
          type="text"
          disabled
          placeholder="Wineries in the Okanagan…"
          aria-label="What should Atlas learn (not yet available)"
          className="border-border bg-muted/30 text-muted-foreground w-full cursor-not-allowed rounded-xl border px-5 py-4 text-lg outline-none"
        />
        <p className="text-muted-foreground mt-2.5 text-sm leading-relaxed">
          <span className="text-foreground font-medium">Not yet.</span> Atlas
          can&apos;t plan from a phrase today — it learns from sources you point
          it at, and from what those sources link to. This box is here because
          it&apos;s where Atlas is going: you name a subject, Atlas proposes a
          plan, you approve it.
        </p>
      </div>

      <div className="mt-5">
        <p className="text-muted-foreground mb-2.5 text-xs">
          Missions Atlas should eventually accept
        </p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <span
              key={example}
              className="border-border text-muted-foreground rounded-full border border-dashed px-3 py-1.5 text-xs"
            >
              {example}
            </span>
          ))}
        </div>
      </div>

      <p className="text-muted-foreground mt-6 text-xs leading-relaxed">
        Today you teach Atlas by giving it a starting page — a resort&apos;s
        dining directory, a park&apos;s official site — and letting it follow
        what that page lists. Everything it discovers appears below.
      </p>
    </section>
  );
}
