import type { Metadata } from "next";
import { PhoneCompanion } from "../../PhoneCompanion";

export const metadata: Metadata = {
  title: "Witching Hour — Passport Labs",
  robots: { index: false, follow: false },
};

/** Where the QR code lands. The phone becomes a prop in the desktop's night. */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <PhoneCompanion code={code.toUpperCase()} />;
}
