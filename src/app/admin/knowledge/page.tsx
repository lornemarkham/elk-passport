import type { Metadata } from "next";
import { DOMAIN_STATUS_MEANING } from "@/lib/knowledge/knowledgeDomains";
import { loadAllDomainProgress } from "@/lib/knowledge/missionContext";
import { PageHeader, Section } from "@/components/atlas/ui";
import { DomainList } from "@/components/atlas/domain";

export const metadata: Metadata = {
  title: "Knowledge Domains · Atlas",
  description:
    "The permanent responsibilities through which Atlas learns a region.",
};

/**
 * **Knowledge Domains — the permanent responsibilities.**
 *
 * ## The one question
 *
 * *"What is Atlas responsible for knowing, and what is being worked on in each?"*
 *
 * ## Domains, missions, and the difference
 *
 * A **Knowledge Domain** never finishes. Recreation is Atlas's responsibility
 * for as long as Atlas exists; publishers change beneath it and the domain
 * stays. A **Mission** is the opposite — a finite job inside a domain, small
 * enough to start and complete. Every row shows the domain and the mission
 * currently running in it.
 *
 * That split is new, and it fixed something real: a domain used to carry one
 * open-ended piece of work with no finish condition, so nobody could ever
 * complete anything.
 *
 * ## Why domains and not publishers
 *
 * A publisher is a phone number. OpenStreetMap could vanish tomorrow and
 * Geography would still be Atlas's responsibility. Organising this page by
 * publisher would mean rewriting it every time a source changed, and would
 * leave nowhere to record a responsibility Atlas has accepted but cannot yet
 * meet — which is most of them. Two of the six domains have no publisher at
 * all, and that is the most useful thing this page says.
 *
 * ## What is deliberately absent
 *
 * **No coverage percentage.** Atlas cannot know how many lakes the Okanagan
 * has, so it cannot know what fraction it holds. When coverage becomes
 * measurable it will be measured; until then its absence is the report.
 *
 * **No run controls.** Nothing here executes.
 *
 * ## The mission shown is derived, not authored
 *
 * Each row's current mission comes from `evaluateDomain` — the first mission
 * whose conditions are not yet satisfied. It is read from the same snapshot the
 * domain pages use, taken once for all six, so this page and a domain page can
 * never disagree about what to do next.
 */
export default async function KnowledgeDomainsPage() {
  const states = await loadAllDomainProgress(new Date());

  return (
    <div className="flex flex-col gap-14">
      <PageHeader
        back={{ href: "/admin", label: "Atlas" }}
        title="Knowledge Domains"
        description="What Atlas is responsible for knowing"
      />

      <section className="max-w-2xl">
        <p className="text-[15px] leading-relaxed">
          A <strong>Knowledge Domain</strong> is a permanent responsibility for
          a kind of knowledge. Sources change beneath it; the domain stays. It
          never finishes — it becomes healthier.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          The finite work happens in <strong>missions</strong> inside a domain.
          Each row below shows the mission currently running. Open one and the
          page leads with the command, the questions waiting on you, and whether
          it is finished.
        </p>
      </section>

      <Section title="Domains">
        <DomainList
          entries={states.map((s) => ({
            domain: s.domain,
            current: s.progress.current?.mission,
            completed: s.progress.completed,
            totalMissions: s.progress.total,
          }))}
        />

        {/* The key. Three glyphs are three glyphs until someone says what they
            mean, and a tooltip is not an answer for a keyboard or a screen
            reader. Stated in the open, once, under the list. */}
        <dl className="text-muted-foreground mt-4 flex flex-col gap-1.5 text-[12.5px]">
          <div className="flex gap-2">
            <dt
              aria-hidden
              className="text-primary w-3 shrink-0 text-[10px] leading-[1.5]"
            >
              ●
            </dt>
            <dd>
              <span className="text-foreground/80">Operational</span> —{" "}
              {DOMAIN_STATUS_MEANING.operational}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt
              aria-hidden
              className="text-foreground/70 w-3 shrink-0 text-[10px] leading-[1.5]"
            >
              ◐
            </dt>
            <dd>
              <span className="text-foreground/80">Ready</span> —{" "}
              {DOMAIN_STATUS_MEANING.ready}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt
              aria-hidden
              className="text-muted-foreground w-3 shrink-0 text-[10px] leading-[1.5]"
            >
              ○
            </dt>
            <dd>
              <span className="text-foreground/80">Planning</span> —{" "}
              {DOMAIN_STATUS_MEANING.planning}
            </dd>
          </div>
        </dl>
      </Section>
    </div>
  );
}
