import type { Metadata } from "next";
import { WitchingHour } from "@/components/october/witching-hour/WitchingHour";

export const metadata: Metadata = {
  title: "Witching Hour — October",
  robots: { index: false, follow: false },
};

/**
 * `/october/witching-hour` — the first October scene.
 *
 * Reached from the end of Found You, once it is dark where the visitor is.
 * Nothing else links here.
 *
 * `?at=doorway` goes straight to the four choices after the first tap, so the
 * endings can be screened rather than waited for — the same reason the Video
 * Store has `?intervene=1`.
 */
export default async function WitchingHourPage({
  searchParams,
}: {
  searchParams: Promise<{ at?: string }>;
}) {
  const { at } = await searchParams;
  return <WitchingHour startAt={at === "doorway" ? "doorway" : undefined} />;
}
