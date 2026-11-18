import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/admin/requireAdmin";
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
        Moderation
      </h1>
      <p className="mt-1 mb-5 text-[14px] text-[#5c6370]">
        Reported, paused and removed Pulses. Three reports pause a Pulse
        automatically.
      </p>
      <Moderation />
    </>
  );
}
