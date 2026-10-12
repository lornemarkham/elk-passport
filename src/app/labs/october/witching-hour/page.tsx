import { redirect } from "next/navigation";

/** Witching Hour is October's, and lives at `/october/witching-hour`. This URL forwards. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ at?: string }>;
}) {
  const { at } = await searchParams;
  redirect(
    at === "doorway"
      ? "/october/witching-hour?at=doorway"
      : "/october/witching-hour",
  );
}
