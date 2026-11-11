import { Suspense } from "react";
import { PassportNav } from "@/components/shell/PassportNav";
import { currentUser } from "@/lib/auth/currentUser";

/**
 * **The one Go Have a Day header.** Mounted once, by the root layout, so every
 * page of every experience — present and future — wears it without asking,
 * and no experience can replace or hide it from its own layout. Experiences
 * keep their themes and their own bars *below* it.
 *
 * Reading who is signed in streams, so the bar is drawn at once with the
 * account slot reserved (`pending`) rather than holding the page back.
 */
export function GlobalHeader() {
  return (
    <Suspense fallback={<PassportNav pending />}>
      <SignedInHeader />
    </Suspense>
  );
}

async function SignedInHeader() {
  const user = await currentUser();
  return <PassportNav displayName={user?.displayName ?? null} />;
}
