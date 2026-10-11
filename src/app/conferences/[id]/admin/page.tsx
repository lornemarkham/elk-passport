import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { conferenceSetup } from "@/lib/conference/config";
import { deps, readIdentity } from "@/lib/conference/request";
import { adminFor } from "@/lib/conference/service";
import {
  AccessPanel,
  DangerPanel,
  MembersPanel,
} from "@/components/conference/AdminPanels";
import { Closed } from "@/components/conference/Closed";
import { DetailsForm } from "@/components/conference/DetailsForm";
import { Section } from "@/components/conference/ui";

export const dynamic = "force-dynamic";

/** **The organiser's dashboard.** Ways in first, because a new conference has none. */
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
    <div className="mx-auto max-w-[760px] px-5 pt-10">
      <Link
        href={`/conferences/${id}`}
        className="text-[15px] text-black/55 underline"
      >
        ← {view.conference.name}
      </Link>
      <h1 className="mt-3 text-[36px] leading-none font-black tracking-[-0.03em]">
        Organiser settings
      </h1>
      <AccessPanel view={view} />
      <MembersPanel view={view} />
      <Section title="Details">
        <DetailsForm conferenceId={id} initial={view.conference} />
      </Section>
      <DangerPanel conferenceId={id} name={view.conference.name} />
    </div>
  );
}
