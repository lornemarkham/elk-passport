import type { Metadata } from "next";
import { OctoberDiscoverySurface } from "@/components/labs/october/synthesis/OctoberDiscoverySurface";
import { FromOctoberBand } from "@/components/october/from/FromOctober";

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
 * **From October** sits above it as a strip: the way into the rooms. It is a
 * door beside Discover, not a change to it — the surface below is untouched,
 * and `iamoctober.com` (which serves this route at `/`) shows both.
 */
export default async function OctoberDiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ sim?: string }>;
}) {
  return (
    <>
      <FromOctoberBand />
      <OctoberDiscoverySurface sim={(await searchParams).sim} />
    </>
  );
}
