import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/currentUser";
import { NightsShelf } from "@/components/hockey/NightsShelf";
import { myNights } from "./_server/night";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hockey Night — Passport",
  robots: { index: false, follow: false },
};

export default async function HockeyPage({
  searchParams,
}: {
  searchParams: Promise<{ gone?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect(`/auth?next=${encodeURIComponent("/hockey")}`);
  const [nights, { gone }] = await Promise.all([myNights(user), searchParams]);
  return (
    <NightsShelf nights={nights} name={user.displayName} gone={gone === "1"} />
  );
}
