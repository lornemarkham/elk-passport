import type { Metadata } from "next";
import { VhsWall } from "@/components/october/store/VhsWall";

export const metadata: Metadata = { title: "The Video Store — October" };

/**
 * `/october/store` — the Video Store, in the product.
 *
 * The one Video Store. `/october/store` used to render this same
 * wall from a second page and now forwards here, query string and all. The
 * route takes the whole screen (see the layout's note on authored
 * experiences), and it is the one the Secret Room's door opens onto.
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
export default async function StorePage({
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
