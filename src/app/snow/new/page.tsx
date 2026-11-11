import type { Metadata } from "next";
import { SnowPage } from "@/components/snow/kit";
import { NewDay } from "@/components/snow/NewDay";
import { sharedDaysReady } from "../_server/readiness";

export const metadata: Metadata = {
  title: "Start a snow day — Passport",
  robots: { index: false },
};

export default async function NewSnowDay({
  searchParams,
}: {
  searchParams: Promise<{ mountain?: string; again?: string; atlas?: string }>;
}) {
  const { mountain, again, atlas } = await searchParams;
  // Offered only where the database can hold a shared day (see readiness.ts).
  const sharedReady = await sharedDaysReady();
  return (
    <>
      <SnowPage>
        <main className="mx-auto max-w-xl px-5 pt-24 pb-24">
          <NewDay
            mountainId={mountain}
            again={again}
            atlasName={atlas?.slice(0, 80)}
            sharedReady={sharedReady}
          />
        </main>
      </SnowPage>
    </>
  );
}
