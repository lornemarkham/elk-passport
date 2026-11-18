import { PULSE_RED } from "./brand";

/** The People's Pulse mark: a heartbeat line in a dot. */
export function PulseMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden
      className="shrink-0"
    >
      <circle cx="16" cy="16" r="16" fill={PULSE_RED} />
      <path
        d="M5 17h6l2.5-6 4 11 3-8 1.5 3H27"
        fill="none"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
