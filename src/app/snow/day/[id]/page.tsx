import type { Metadata } from "next";
import { SnowPage } from "@/components/snow/kit";
import { SnowDayScreen } from "@/components/snow/SnowDayScreen";

export const metadata: Metadata = {
  title: "Your snow day — Passport",
  robots: { index: false },
};

export default async function SnowDayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <SnowPage>
        <SnowDayScreen id={id} />
      </SnowPage>
    </>
  );
}
