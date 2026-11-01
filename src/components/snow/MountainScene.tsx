import styles from "./snow.module.css";

/**
 * **The mountains, drawn.** Original vector artwork — layered ridges under an
 * alpenglow sky — so the Experience has strong mountain imagery with no
 * photo licence, no network and no invented place behind it. Real photographs
 * of real mountains belong to Atlas's media (doctrine §2.3) and arrive on a
 * mountain's own card when Atlas has one.
 */
const FLAKES = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100,
  size: 3 + ((i * 7) % 5),
  dur: 7 + ((i * 13) % 9),
  delay: -((i * 5) % 11),
}));

export function MountainScene({ className = "" }: { className?: string }) {
  return (
    <div className={`overflow-hidden ${className}`} aria-hidden="true">
      <svg
        viewBox="0 0 800 360"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id="sn-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0b1d33" />
            <stop offset="0.55" stopColor="#35557d" />
            <stop offset="0.85" stopColor="#f08a5d" />
            <stop offset="1" stopColor="#ffc27a" />
          </linearGradient>
          <linearGradient id="sn-far" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8fb3d4" />
            <stop offset="1" stopColor="#3b628a" />
          </linearGradient>
          <linearGradient id="sn-mid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#dbeaf6" />
            <stop offset="1" stopColor="#2a4d73" />
          </linearGradient>
        </defs>
        <rect width="800" height="360" fill="url(#sn-sky)" />
        <circle cx="610" cy="215" r="34" fill="#ffe3b0" opacity="0.85" />
        <path
          d="M0 250 L90 170 L150 215 L250 120 L340 210 L420 150 L520 225 L610 140 L700 210 L800 160 V360 H0Z"
          fill="url(#sn-far)"
        />
        <path
          d="M0 290 L120 190 L170 230 L300 90 L330 120 L350 108 L470 250 L560 175 L640 245 L720 200 L800 260 V360 H0Z"
          fill="url(#sn-mid)"
        />
        <path
          d="M300 90 L330 120 L350 108 L322 150 L300 130 L282 150Z"
          fill="#fff"
          opacity="0.95"
        />
        <path
          d="M0 330 L100 280 L210 320 L330 270 L470 325 L590 285 L700 320 L800 295 V360 H0Z"
          fill="#0f2a46"
        />
        <g fill="#0a1e33">
          {[40, 70, 520, 560, 610, 740].map((x, i) => (
            <path
              key={x}
              d={`M${x} ${345 - (i % 2) * 6} l12 -34 l12 34z M${x + 2} ${330 - (i % 2) * 6} l10 -28 l10 28z`}
            />
          ))}
        </g>
        <rect y="338" width="800" height="22" fill="#07121f" />
      </svg>
      {FLAKES.map((f, i) => (
        <span
          key={i}
          className={styles.flake}
          style={{
            left: `${f.left}%`,
            width: f.size,
            height: f.size,
            animationDuration: `${f.dur}s`,
            animationDelay: `${f.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
