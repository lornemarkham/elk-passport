import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Dream } from "@/components/dream/Dream";
import { Reel } from "@/components/dream/Reel";
import { dreamEnabled } from "@/lib/dream/flag";
import { dreamPool } from "@/lib/dream/server";
import { reelFor } from "@/domain/dream/reel";
import { townById } from "@/domain/discovery/towns";
import { PLACE_COOKIE } from "@/domain/location/prefs";

export const metadata: Metadata = {
  title: "Dream — Go Have a Day Labs",
  description:
    "Discover when you know. Dream when you don't. Go when you're ready. An experiment: say the day you want, or let real places near you help you find it.",
  robots: { index: false },
};

/**
 * **`/labs/dream`** — mission 1130's experiment, behind `GHAD_DREAM`
 * (`lib/dream/flag.ts`). It replaces nothing: Discovery, `/go`, Christmas
 * and every URL are untouched, and its answers open into them.
 *
 * The first bytes are the page itself — the words, the box, the doors —
 * so somebody can start typing at once. The reel of real places streams in
 * behind them from the same cached corpus read `/go` makes.
 */
export default async function DreamPage() {
  if (!dreamEnabled()) notFound();
  const jar = await cookies();
  const shared = jar.get(PLACE_COOKIE)?.value;
  const at = shared && townById(shared) ? shared : "vernon";
  return (
    <main>
      <Dream
        initialTown={at}
        reel={
          <Suspense fallback={<Reel frames={[]} />}>
            <ReelFor at={at} />
          </Suspense>
        }
      />
    </main>
  );
}

async function ReelFor({ at }: { at: string }) {
  const read = await dreamPool();
  return (
    <Reel
      frames={
        read.atlas === "ok"
          ? reelFor({ pool: read.pool, townId: at, today: read.today })
          : []
      }
    />
  );
}
