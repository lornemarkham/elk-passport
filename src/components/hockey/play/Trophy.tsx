import styles from "../hockey.module.css";

/**
 * **The Sycle Cup.** Drawn, not an emoji: a bowl on a tiered base the way
 * the real one is built, engraved with the night's name, in brushed gold
 * with a slow shine. `glow` brightens it when somebody has actually won it.
 * Decorative — every place it appears says in words what it stands for.
 */
export function Trophy({
  size = 120,
  glow = false,
  engraving = "SYCLE",
}: {
  size?: number;
  glow?: boolean;
  engraving?: string;
}) {
  const id = `cup-${size}-${glow ? 1 : 0}`;
  return (
    <span
      aria-hidden
      className={`${styles.trophy} ${glow ? styles.trophyGlow : ""} relative inline-block shrink-0`}
      style={{ width: size, height: size * 1.25 }}
    >
      <svg viewBox="0 0 100 125" width={size} height={size * 1.25}>
        <defs>
          <linearGradient id={`${id}-gold`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#8a6a12" />
            <stop offset="0.28" stopColor="#ffe27a" />
            <stop offset="0.5" stopColor="#fff6c9" />
            <stop offset="0.72" stopColor="#e9b93a" />
            <stop offset="1" stopColor="#7a5a0c" />
          </linearGradient>
          <linearGradient id={`${id}-steel`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#5c6a7d" />
            <stop offset="0.45" stopColor="#e8eef6" />
            <stop offset="1" stopColor="#4a5566" />
          </linearGradient>
          <linearGradient id={`${id}-wood`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#3b2412" />
            <stop offset="1" stopColor="#1c1008" />
          </linearGradient>
        </defs>
        {/* Bowl */}
        <path
          d="M18 14 H82 C82 34 70 46 56 48 L56 56 H44 L44 48 C30 46 18 34 18 14 Z"
          fill={`url(#${id}-gold)`}
          stroke="#5c430a"
          strokeWidth="1"
        />
        <ellipse
          cx="50"
          cy="14"
          rx="32"
          ry="5"
          fill="#fff3b8"
          stroke="#8a6a12"
          strokeWidth="1"
        />
        <ellipse
          cx="50"
          cy="14.6"
          rx="27"
          ry="3.4"
          fill="#6b5010"
          opacity="0.55"
        />
        {/* Handles */}
        <path
          d="M18 18 C6 18 6 34 22 36"
          fill="none"
          stroke={`url(#${id}-gold)`}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M82 18 C94 18 94 34 78 36"
          fill="none"
          stroke={`url(#${id}-gold)`}
          strokeWidth="4"
          strokeLinecap="round"
        />
        {/* Collar and tiers */}
        <rect
          x="38"
          y="56"
          width="24"
          height="6"
          rx="1.5"
          fill={`url(#${id}-steel)`}
        />
        <rect
          x="31"
          y="62"
          width="38"
          height="12"
          rx="2"
          fill={`url(#${id}-gold)`}
          stroke="#5c430a"
          strokeWidth="0.8"
        />
        <rect
          x="26"
          y="74"
          width="48"
          height="14"
          rx="2"
          fill={`url(#${id}-steel)`}
          stroke="#3a4250"
          strokeWidth="0.8"
        />
        <rect
          x="21"
          y="88"
          width="58"
          height="16"
          rx="2"
          fill={`url(#${id}-gold)`}
          stroke="#5c430a"
          strokeWidth="0.8"
        />
        <rect
          x="16"
          y="104"
          width="68"
          height="15"
          rx="2.5"
          fill={`url(#${id}-wood)`}
        />
        {/* Engraving bands */}
        <text
          x="50"
          y="70.5"
          textAnchor="middle"
          fontSize="6.4"
          fontWeight="900"
          fill="#4a3608"
          letterSpacing="0.6"
        >
          {engraving}
        </text>
        <text
          x="50"
          y="83.4"
          textAnchor="middle"
          fontSize="5.4"
          fontWeight="800"
          fill="#2c3440"
          letterSpacing="0.8"
        >
          CUP
        </text>
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={25 + i * 13}
            y="92"
            width="11"
            height="8"
            rx="1"
            fill="none"
            stroke="#7a5a0c"
            strokeWidth="0.6"
          />
        ))}
        <rect
          x="22"
          y="108"
          width="56"
          height="6"
          rx="1"
          fill="none"
          stroke="#c9a24a"
          strokeWidth="0.6"
          opacity="0.7"
        />
      </svg>
    </span>
  );
}
