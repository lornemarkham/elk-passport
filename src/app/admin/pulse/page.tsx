import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/admin/requireAdmin";
import { Checks } from "./Checks";
import { Drafts } from "./Drafts";
import { Featured } from "./Featured";
import { Moderation } from "./Moderation";
import { Usage } from "./Usage";

export const metadata: Metadata = {
  title: "People's Pulse moderation",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * People's Pulse moderation, in the admin workbench: the admin layout and
 * middleware gate it, and this page checks again. Anyone else gets sign-in
 * or a 404.
 */
export default async function PulseAdmin() {
  await requireAdminPage("/admin/pulse");
  return (
    <>
      <h1 className="font-heading pt-4 text-[28px] font-bold tracking-tight">
        Question of the Day
      </h1>
      <p className="mt-1 mb-4 text-[14px] text-[#5c6370]">
        Pick one Pulse to feature at the top of People&apos;s Pulse for a day.
        Days end at midnight Pacific. A day with no pick shows nothing.
      </p>
      <Featured />
      <h2 className="font-heading mt-10 text-[24px] font-bold tracking-tight">
        Usage
      </h2>
      <p className="mt-1 mb-4 text-[14px] text-[#5c6370]">
        Last 30 days, all People&apos;s Pulse experiences. Aggregate counts
        only.
      </p>
      <Usage />
      <h2 className="font-heading mt-10 text-[24px] font-bold tracking-tight">
        Proposed questions
      </h2>
      <p className="mt-1 mb-4 text-[14px] text-[#5c6370]">
        Timely questions proposed by agents, never published on their own. Read
        each one, check its sources, then publish.
      </p>
      <Drafts />
      <h2 className="font-heading mt-10 text-[24px] font-bold tracking-tight">
        Moderation
      </h2>
      <p className="mt-1 mb-5 text-[14px] text-[#5c6370]">
        Reported, paused and removed Pulses. Three reports pause a Pulse
        automatically.
      </p>
      <Moderation />
      <h2 className="font-heading mt-10 text-[24px] font-bold tracking-tight">
        Pulse Check
      </h2>
      <p className="mt-1 mb-5 text-[14px] text-[#5c6370]">
        Discussion posts people reported, and the newest checks. Screenshots
        attached to a check open for administrators at
        /api/pulse/check/&lt;id&gt;/file.
      </p>
      <Checks />
    </>
  );
}
