import type { Metadata } from "next";
import { VhsWall } from "@/components/october/store/VhsWall";

export const metadata: Metadata = { title: "The Video Store — October" };

/**
 * `/october/store` — the Video Store, in the product.
 *
 * The same wall as `/labs/october/video-store`, which stays where it is with
 * its review flags. This route takes the whole screen like the lab one does
 * (see the layout's note on authored experiences), and it is the one the
 * Secret Room's door opens onto.
 *
 * `?intervene=1` is honoured here too, so October's refusal can be screened.
 */
export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<{ intervene?: string; anomaly?: string }>;
}) {
  const { intervene, anomaly } = await searchParams;
  return (
    <VhsWall alwaysIntervene={intervene === "1"} anomalies={anomaly === "1"} />
  );
}
