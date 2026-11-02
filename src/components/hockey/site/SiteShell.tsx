import Link from "next/link";
import { ATTRIBUTION, HOCKEY_SITE, hockeyPath } from "@/domain/hockey/site";
import { CreateNightLink } from "./CreateNightLink";
import { SiteNav } from "./SiteNav";
import styles from "./site.module.css";

/** The public hockey site's frame: brand, navigation, one button, and whose numbers these are. */
export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.site}>
      <header className={styles.header}>
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex items-center justify-between gap-3 pt-3 pb-2">
            <Link
              href={hockeyPath()}
              className="flex min-h-11 items-center gap-2"
              aria-label={`${HOCKEY_SITE.name} home`}
            >
              <span aria-hidden className="text-[22px] leading-none">
                🏒
              </span>
              <span
                className={`${styles.display} text-[22px] leading-none tracking-tight`}
              >
                Hockey Night
              </span>
            </Link>
            <CreateNightLink
              from="header"
              className={`${styles.cta} flex min-h-10 items-center rounded-full px-4 text-[13.5px] uppercase`}
            >
              Create a night
            </CreateNightLink>
          </div>
          <SiteNav />
        </div>
      </header>
      {children}
      <footer className="mx-auto max-w-5xl px-4 pt-12 pb-16">
        <div className="border-t border-white/10 pt-6 text-[12.5px] leading-relaxed text-white/45">
          <p>{ATTRIBUTION}</p>
          <p className="mt-3">
            {HOCKEY_SITE.name} is made by {HOCKEY_SITE.by}. Every Hockey Night
            is private to the people invited to it.
          </p>
        </div>
      </footer>
    </div>
  );
}
