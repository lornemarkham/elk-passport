"use client";

import { createContext, useContext } from "react";

/**
 * **What to call the product, on a page that serves two of them.**
 *
 * The auth pages are Client Components; the thing that knows which experience
 * a request belongs to is the middleware, and the layout that reads its stamp
 * is a Server Component. One value has to cross that boundary, so it crosses
 * as a value rather than as a second copy of the decision: nothing below
 * looks at a hostname, and there is still exactly one auth implementation.
 *
 * `Passport` is the default because that is what these pages were, and a page
 * rendered outside the provider must not change.
 */
const ExperienceName = createContext("Passport");

export function ExperienceNameProvider({
  name,
  children,
}: {
  readonly name: string;
  readonly children: React.ReactNode;
}) {
  return <ExperienceName value={name}>{children}</ExperienceName>;
}

/** The name of the product this page is being used inside. */
export function useExperienceName(): string {
  return useContext(ExperienceName);
}
