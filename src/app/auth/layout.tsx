import type { Metadata } from "next";
import { headers } from "next/headers";
import {
  EXPERIENCE_HEADER,
  experienceFromHeader,
  themeFor,
} from "@/lib/domains/experience-domains";
import { ExperienceNameProvider } from "@/components/auth/ExperienceName";

/**
 * **Authentication wears the product it was entered from.**
 *
 * `/auth`, `/auth/forgot` and `/auth/update-password` are one implementation
 * serving two products. Signing in from October used to drop a person onto a
 * pale card titled *ELK Passport* — the right form, in the wrong world, at
 * the one moment the product is asking to be trusted with a password.
 *
 * Nothing under here is forked. The pages were already written against the
 * theme tokens rather than literal colours, so the entire change is which
 * theme those tokens resolve from, decided once on the server and applied to
 * one wrapper.
 *
 * **Why a layout and not the pages.** They are Client Components, and a
 * client that reads `window.location.host` has already painted once by the
 * time it knows the answer — a flash of the wrong product. The middleware
 * stamps the request; this reads the stamp and renders it correctly the first
 * time.
 *
 * **Passport gets no wrapper at all.** Not `data-theme="passport"` either:
 * these pages inherit `:root`, which is Adventure Basecamp, and the named
 * `passport` theme is the account page's own cream. Stamping it here would
 * have quietly recoloured Passport's sign-in — caught by rendering both hosts
 * side by side rather than by reasoning about it.
 */
export async function generateMetadata(): Promise<Metadata> {
  const experience = experienceFromHeader(
    (await headers()).get(EXPERIENCE_HEADER),
  );
  return experience ? { title: `Sign in — ${experience.name}` } : {};
}

export default async function AuthLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const experience = experienceFromHeader(
    (await headers()).get(EXPERIENCE_HEADER),
  );
  if (!experience) return <>{children}</>;

  return (
    <div
      data-theme={themeFor(experience)}
      data-experience={experience.name}
      className="bg-background text-foreground min-h-screen"
    >
      {/* The colours are the theme's; the name has to be carried, because the
          pages inside are Client Components and the stamp is on the request. */}
      <ExperienceNameProvider name={experience.name}>
        {children}
      </ExperienceNameProvider>
    </div>
  );
}
