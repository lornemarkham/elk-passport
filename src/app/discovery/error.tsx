"use client";

import { DiscoveryFailure } from "@/components/discovery-list/DiscoveryFailure";

/**
 * When Atlas cannot be reached.
 *
 * Says what actually went wrong and offers the one action that helps. The
 * failure this replaces was an unstyled Next.js stack trace containing an
 * undici `HeadersTimeoutError`, which tells a traveller nothing and tells them
 * it in a frightening way.
 *
 * It keeps the bar and the page's own ground (`DiscoveryFailure`): the loading
 * state already looks like Discovery, and a failure that suddenly looked like
 * a different site would be the same inconsistency arriving one step later.
 */
export default function DiscoveryError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <DiscoveryFailure onRetry={reset} />;
}
