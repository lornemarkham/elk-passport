"use client";

import { SubjectUnavailable } from "@/components/passport/SubjectUnavailable";

/** Atlas did not answer for this subject. See `SubjectUnavailable`. */
export default function PlacesSubjectError(props: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return <SubjectUnavailable {...props} boundary="places-detail" />;
}
