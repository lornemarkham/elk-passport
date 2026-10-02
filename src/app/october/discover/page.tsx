import type { Metadata } from "next";
import { OctoberDiscoverySurface } from "@/components/labs/october/synthesis/OctoberDiscoverySurface";

export const metadata: Metadata = { title: "Discover — October" };

/**
 * **October's Discover — the synthesis, promoted.**
 *
 * This route used to render a page of lanes built per content type. It now
 * renders the surface the four discovery experiments produced: one possibility
 * pool across Atlas, films and Doings; one search; one filter vocabulary; one
 * ranking; one Choices. The page it replaced is kept, unchanged and unlinked,
 * at `/labs/october/discovery/legacy`.
 *
 * Nothing in the October navigation changed, because nothing had to — every
 * link in the product already pointed here.
 */
export default async function OctoberDiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ sim?: string }>;
}) {
  return <OctoberDiscoverySurface sim={(await searchParams).sim} />;
}
