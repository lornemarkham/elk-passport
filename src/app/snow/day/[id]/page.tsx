import type { Metadata } from "next";
import { PassportNav } from "@/components/shell/PassportNav";
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
      <PassportNav displayName={null} />
      <SnowPage>
        <SnowDayScreen id={id} />
      </SnowPage>
    </>
  );
}
