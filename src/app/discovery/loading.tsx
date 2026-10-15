import { DiscoverySkeleton } from "@/components/discovery-list/DiscoverySkeleton";
import { dayLine } from "@/domain/discovery/dayLine";
import { PassportNav } from "@/components/shell/PassportNav";

/**
 * Shown while the route itself is resolving — before the page has said what
 * it is waiting for.
 *
 * Not decoration: `/discovery/candidates` returns the whole corpus, and under a
 * concurrent population run that has measured a minute. A blank page for a
 * minute reads as broken, and this says which of the two it is.
 *
 * **It is the page, not a picture of a different page.** It used to be a cream
 * `main` under an `h1` reading "What could you do?" and no bar at all, and
 * the page that replaced it was white, with a bar and another heading — so a
 * cold visit read as one website giving way to another. This is the real bar
 * (`PassportNav`, with its reader's slot held open) and the real frame
 * (`DiscoverySkeleton`), which `page.tsx` also uses for the slower wait
 * inside it. The two cannot drift: they are the same components.
 */
export default function DiscoveryLoading() {
  return (
    <>
      <PassportNav pending />
      <DiscoverySkeleton today={dayLine(new Date())} />
    </>
  );
}
