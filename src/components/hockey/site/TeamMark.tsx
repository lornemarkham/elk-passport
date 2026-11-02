import { teamByAbbr } from "@/domain/hockey/fans";
import { teamColours } from "@/domain/hockey/teams";
import styles from "./site.module.css";

/**
 * A club as the site draws it: its two colours and its three letters, cut
 * like a shoulder patch. Deliberately not its logo — Passport holds no
 * licence for any club's marks (`teams.ts`).
 */
export function TeamMark({
  abbr,
  size = 40,
  className = "",
}: {
  abbr: string;
  size?: number;
  className?: string;
}) {
  const team = teamByAbbr(abbr);
  const c = team?.colours ?? teamColours(abbr);
  return (
    <span
      aria-hidden
      className={`${styles.mark} ${className}`}
      style={
        {
          width: size,
          height: size,
          "--primary": c.primary,
          "--secondary": c.secondary,
          "--ink": c.ink,
        } as React.CSSProperties
      }
    >
      <span
        className={styles.display}
        style={{ fontSize: Math.round(size * 0.34), lineHeight: 1 }}
      >
        {abbr}
      </span>
    </span>
  );
}
