import { redirect } from "next/navigation";

/** QR codes printed before the move still land. */
export default async function Page({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  redirect(`/october/witching-hour/join/${encodeURIComponent(code)}`);
}
