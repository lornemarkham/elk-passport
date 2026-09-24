import type { Metadata } from "next";
import { VhsWall } from "@/components/october/store/VhsWall";

export const metadata: Metadata = {
  title: "VHS Wall — Passport Labs",
  robots: { index: false, follow: false },
};

/**
 * `/labs/october/video-store` — the interactive VHS wall proof.
 *
 * `?intervene=1` makes October's refusal deterministic: pulling the designated
 * tape is always refused, so the beat can be screened rather than waited for.
 *
 * `?anomaly=1` arms the presence in the right aisle on its own rare schedule.
 *
 * `?presence=ghost` and `?presence=child` force the whole sequence a few
 * seconds after load, every refresh, so the two figures can be judged against
 * each other. Everything except the photograph is identical between them.
 * `?presence=1` is kept as an alias for `ghost`.
 */
export default async function VideoStorePage({
  searchParams,
}: {
  searchParams: Promise<{
    intervene?: string;
    anomaly?: string;
    presence?: string;
  }>;
}) {
  const { intervene, anomaly, presence } = await searchParams;
  const forced =
    presence === "child"
      ? "child"
      : presence === "ghost" || presence === "1"
        ? "ghost"
        : null;
  return (
    <VhsWall
      alwaysIntervene={intervene === "1"}
      anomalies={anomaly === "1"}
      forcePresence={forced}
    />
  );
}
