import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/admin/requireAdmin";
import { Featured } from "./Featured";
import { Moderation } from "./Moderation";

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
        Moderation
      </h2>
      <p className="mt-1 mb-5 text-[14px] text-[#5c6370]">
        Reported, paused and removed Pulses. Three reports pause a Pulse
        automatically.
      </p>
      <Moderation />
    </>
  );
}
