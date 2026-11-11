import type { Metadata } from "next";
import { SnowPage } from "@/components/snow/kit";
import { JoinPlan } from "@/components/snow/JoinPlan";

export const metadata: Metadata = {
  title: "Join a snow day — Passport",
  robots: { index: false },
};

export default function JoinPage() {
  return (
    <>
      <SnowPage>
        <main className="mx-auto max-w-xl px-5 pt-24 pb-24">
          <JoinPlan />
        </main>
      </SnowPage>
    </>
  );
}
