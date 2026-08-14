import { redirect } from "next/navigation";

// Moved under the Content Operations Center, then moved again so the
// overview (not Duplicate Review) is the front door — this file couldn't
// be deleted from the environment that built the move, so it redirects
// instead of leaving a stale duplicate page behind. Safe to actually
// delete this file and its folder once you've confirmed the new location
// works.
export default function LegacyAdminDuplicatesRedirect() {
  redirect("/admin/content");
}
