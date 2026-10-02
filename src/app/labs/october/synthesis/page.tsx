import type { Metadata } from "next";
import { OctoberDiscoverySurface } from "@/components/labs/october/synthesis/OctoberDiscoverySurface";

export const metadata: Metadata = { title: "October" };

/**
 * **Where the synthesis was built, still pointing at the shipped thing.**
 *
 * This route is kept so the link in every earlier report still works and so
 * the experiments have a sibling to compare against. It renders the **same
 * component** `/october/discover` renders — not a copy — so there is no
 * version of October here that can quietly drift from the one people use.
 */
export default async function OctoberSynthesisLab({
  searchParams,
}: {
  searchParams: Promise<{ sim?: string }>;
}) {
  return <OctoberDiscoverySurface sim={(await searchParams).sim} standalone />;
}
