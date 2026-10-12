import { redirect } from "next/navigation";

/** Found You is October's, and lives at `/october/found-you`. This URL forwards. */
export default function Page() {
  redirect("/october/found-you");
}
