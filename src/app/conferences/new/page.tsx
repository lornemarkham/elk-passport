import { redirect } from "next/navigation";
import { conferenceSetup } from "@/lib/conference/config";
import { isGuest } from "@/lib/conference/identity";
import { readIdentity } from "@/lib/conference/request";
import { Closed } from "@/components/conference/Closed";
import { DetailsForm } from "@/components/conference/DetailsForm";

export const dynamic = "force-dynamic";

export default async function NewConferencePage() {
  const setup = conferenceSetup();
  if (!setup.open) return <Closed missing={setup.missing} />;
  const identity = await readIdentity(setup.config);
  const guest = identity === null || isGuest(identity);
  if (guest && !setup.config.allowGuestOrganisers) redirect("/conferences");

  return (
    <div className="mx-auto max-w-[760px] px-5 pt-10">
      <h1 className="text-[36px] leading-none font-semibold tracking-[-0.03em]">
        Start a conference
      </h1>
      <p className="text-cf-slate mt-3 mb-8">
        Nobody can get in until you turn on a code or make a link. You can
        change everything later.
      </p>
      <DetailsForm />
    </div>
  );
}
