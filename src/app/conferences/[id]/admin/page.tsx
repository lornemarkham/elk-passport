import { notFound, redirect } from "next/navigation";
import { conferenceSetup } from "@/lib/conference/config";
import { deps, readIdentity } from "@/lib/conference/request";
import { adminFor } from "@/lib/conference/service";
import {
  AccessPanel,
  DangerPanel,
  MembersPanel,
} from "@/components/conference/AdminPanels";
import { AgendaEditor } from "@/components/conference/AgendaEditor";
import { Closed } from "@/components/conference/Closed";
import { DetailsForm } from "@/components/conference/DetailsForm";
import { PageHead, Panel, PanelHead, wrap } from "@/components/conference/kit";

export const dynamic = "force-dynamic";

const SECTIONS = [
  ["access", "Ways in"],
  ["agenda", "Agenda"],
  ["details", "Details"],
  ["members", "People"],
] as const;

/**
 * **The organiser's settings.** Ways in first, because a new conference has
 * none; then the agenda, the details (venue included) and the people. It is
 * the only place administrative forms live — the overview has none.
 */
export default async function AdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const setup = conferenceSetup();
  if (!setup.open) return <Closed missing={setup.missing} />;
  const identity = await readIdentity(setup.config);
  if (!identity) notFound();
  const { id } = await params;
  const result = await adminFor(deps(), identity, id);
  if (!result.ok && result.error === "forbidden")
    redirect(`/conferences/${id}`);
  if (!result.ok) notFound();
  const { view } = result;

  return (
    <>
      <PageHead
        eyebrow="For organisers"
        title="Organiser settings"
        lede="Who can get in, what's on, and what people see. Only organisers can open this page."
      >
        <nav
          aria-label="Settings sections"
          className="mt-6 flex flex-wrap gap-2"
        >
          {SECTIONS.map(([anchor, label]) => (
            <a
              key={anchor}
              href={`#${anchor}`}
              className="border-cf-line text-cf-slate hover:border-cf-ink/30 hover:text-cf-ink rounded-full border bg-white px-3.5 py-1.5 text-[13px] font-semibold transition"
            >
              {label}
            </a>
          ))}
        </nav>
      </PageHead>
      <div className={wrap}>
        <div className="max-w-[880px] space-y-6 pt-6 pb-20">
          <Panel className="p-5 sm:p-7">
            <div id="access" className="scroll-mt-24" />
            <PanelHead eyebrow="Ways in" title="Invite people" />
            <AccessPanel view={view} />
          </Panel>
          <Panel className="p-5 sm:p-7">
            <div id="agenda" className="scroll-mt-24" />
            <PanelHead eyebrow="Agenda" title="What's on" />
            <p className="text-cf-slate mt-1 mb-5 text-[14px]">
              Times are in {view.conference.timeZone.replace(/_/g, " ")}.
              Everyone sees changes straight away.
            </p>
            <AgendaEditor conferenceId={id} details={view.conference} />
          </Panel>
          <Panel className="p-5 sm:p-7">
            <div id="details" className="scroll-mt-24" />
            <PanelHead eyebrow="Details" title="The conference" />
            <div className="mt-5">
              <DetailsForm conferenceId={id} initial={view.conference} />
            </div>
          </Panel>
          <Panel className="p-5 sm:p-7">
            <div id="members" className="scroll-mt-24" />
            <MembersPanel view={view} />
            <DangerPanel conferenceId={id} name={view.conference.name} />
          </Panel>
        </div>
      </div>
    </>
  );
}
