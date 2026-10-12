import {
  CLOCK_HOUR,
  CLOCK_MINUTE,
  MISSING_PICTURES,
  WINDOW_BARS,
} from "@/domain/october/room";

/**
 * **The room, drawn once.** One SVG on a 100 × 130 board, so the same picture
 * is a phone-sized diorama and a desktop one, and every hotspot is a
 * percentage of it.
 *
 * What it draws is the puzzle's *evidence* and nothing else: four bars across
 * the window, a clock stopped at 7:20, and five nails with three pictures on
 * them. The numbers are generated from `room.ts`, not typed here, so the room
 * cannot disagree with its own answer.
 */

export const BOARD = { width: 100, height: 130 } as const;

/** Where each thing is, for the hotspots. Board units. */
export const SPOTS = {
  window: { x: 6, y: 8, w: 30, h: 36 },
  clock: { x: 41, y: 9, w: 18, h: 18 },
  wall: { x: 62, y: 8, w: 34, h: 34 },
  door: { x: 33, y: 50, w: 34, h: 58 },
  radio: { x: 5, y: 76, w: 24, h: 18 },
  tv: { x: 71, y: 74, w: 25, h: 24 },
  vcr: { x: 71, y: 99, w: 25, h: 8 },
  floor: { x: 0, y: 110, w: 100, h: 20 },
} as const;

/** Five nails in two rows; three are holding a picture. */
const SLOTS: readonly { x: number; y: number; hung: boolean }[] = [
  { x: 64, y: 11, hung: true },
  { x: 76, y: 11, hung: false },
  { x: 88, y: 11, hung: true },
  { x: 70, y: 26, hung: false },
  { x: 82, y: 26, hung: true },
];

export function RoomScene({
  open,
  radioGlow,
  tvOn,
  tvGlow,
}: {
  /** The door has opened and the light is coming through it. */
  readonly open: boolean;
  /** October is drawing the eye to the radio. */
  readonly radioGlow: boolean;
  /** The television has something on it. */
  readonly tvOn: boolean;
  /** The VCR is asking for the tape. */
  readonly tvGlow: boolean;
}) {
  const bars = Array.from({ length: WINDOW_BARS }, (_, i) => {
    const w = SPOTS.window.w - 6;
    return SPOTS.window.x + 3 + (w / (WINDOW_BARS + 1)) * (i + 1);
  });
  const hours = ((CLOCK_HOUR % 12) + CLOCK_MINUTE / 60) * 30;
  const minutes = CLOCK_MINUTE * 6;
  const hung = SLOTS.filter((s) => s.hung).length;
  const missing = SLOTS.length - hung;
  // The scene refuses to be drawn wrongly: the evidence has to match.
  if (missing !== MISSING_PICTURES) {
    throw new Error("The wall does not hold the number the radio asks for.");
  }
  const c = { x: SPOTS.clock.x + 9, y: SPOTS.clock.y + 9 };

  return (
    <svg
      viewBox={`0 0 ${BOARD.width} ${BOARD.height}`}
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      aria-hidden
      data-testid="room-scene"
    >
      <defs>
        <pattern
          id="room-paper"
          width="6"
          height="10"
          patternUnits="userSpaceOnUse"
        >
          <rect width="6" height="10" fill="#241d27" />
          <rect width="2.6" height="10" fill="#2a2230" />
          <circle cx="4.6" cy="5" r="0.5" fill="#3a2d36" />
        </pattern>
        <linearGradient id="room-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1417" />
          <stop offset="1" stopColor="#0b0809" />
        </linearGradient>
        <radialGradient id="room-moon" cx="0.5" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#dfe7f2" />
          <stop offset="0.5" stopColor="#8ea2c0" />
          <stop offset="1" stopColor="#334158" />
        </radialGradient>
        <radialGradient id="room-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffcf8a" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ffcf8a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="room-door-light" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffe2b0" />
          <stop offset="1" stopColor="#ffc478" />
        </linearGradient>
      </defs>

      {/* Walls and floor. */}
      <rect width="100" height="110" fill="url(#room-paper)" />
      <rect y="108" width="100" height="22" fill="url(#room-floor)" />
      <rect y="107" width="100" height="1.6" fill="#120d10" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <path
          key={i}
          d={`M ${50 + (i - 3) * 6} 108 L ${50 + (i - 3) * 22} 130`}
          stroke="#0a0708"
          strokeWidth="0.3"
        />
      ))}

      {/* The window: the only honest light, and four bars across it. */}
      <g>
        <rect
          x={SPOTS.window.x}
          y={SPOTS.window.y}
          width={SPOTS.window.w}
          height={SPOTS.window.h}
          fill="#0e1018"
          stroke="#3b3138"
          strokeWidth="1.2"
        />
        <rect
          x={SPOTS.window.x + 1.5}
          y={SPOTS.window.y + 1.5}
          width={SPOTS.window.w - 3}
          height={SPOTS.window.h - 3}
          fill="#1a2234"
        />
        <circle
          cx={SPOTS.window.x + 20}
          cy={SPOTS.window.y + 12}
          r="6.5"
          fill="url(#room-moon)"
        />
        <circle
          cx={SPOTS.window.x + 22}
          cy={SPOTS.window.y + 11}
          r="6"
          fill="#1a2234"
          opacity="0.35"
        />
        {bars.map((x) => (
          <rect
            key={x}
            data-bar
            x={x - 0.8}
            y={SPOTS.window.y + 1.5}
            width="1.6"
            height={SPOTS.window.h - 3}
            fill="#08080b"
          />
        ))}
        <rect
          x={SPOTS.window.x - 1.5}
          y={SPOTS.window.y + SPOTS.window.h}
          width={SPOTS.window.w + 3}
          height="1.8"
          fill="#2e252c"
        />
      </g>

      {/* The clock, stopped. */}
      <g>
        <circle
          cx={c.x}
          cy={c.y}
          r="9"
          fill="#d8cfb8"
          stroke="#3b2f2c"
          strokeWidth="1.3"
        />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * 30 * Math.PI) / 180;
          const long = i % 3 === 0;
          return (
            <line
              key={i}
              x1={c.x + Math.sin(a) * (long ? 6.4 : 7.4)}
              y1={c.y - Math.cos(a) * (long ? 6.4 : 7.4)}
              x2={c.x + Math.sin(a) * 8}
              y2={c.y - Math.cos(a) * 8}
              stroke="#2b2220"
              strokeWidth={long ? 0.7 : 0.35}
            />
          );
        })}
        <line
          data-hand="hour"
          x1={c.x}
          y1={c.y}
          x2={c.x + Math.sin((hours * Math.PI) / 180) * 4.6}
          y2={c.y - Math.cos((hours * Math.PI) / 180) * 4.6}
          stroke="#1c1514"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <line
          data-hand="minute"
          x1={c.x}
          y1={c.y}
          x2={c.x + Math.sin((minutes * Math.PI) / 180) * 6.8}
          y2={c.y - Math.cos((minutes * Math.PI) / 180) * 6.8}
          stroke="#1c1514"
          strokeWidth="0.6"
          strokeLinecap="round"
        />
        <circle cx={c.x} cy={c.y} r="0.8" fill="#1c1514" />
      </g>

      {/* Five nails. Three pictures. */}
      {SLOTS.map((s, i) =>
        s.hung ? (
          <g key={i} data-frame>
            <rect
              x={s.x}
              y={s.y}
              width="8"
              height="11"
              fill="#17110f"
              stroke="#4a3a2c"
              strokeWidth="0.7"
            />
            <rect x={s.x + 1} y={s.y + 1} width="6" height="9" fill="#2b2a2e" />
            <ellipse
              cx={s.x + 4}
              cy={s.y + 4.6}
              rx="1.7"
              ry="2.2"
              fill="#161518"
            />
            <path
              d={`M ${s.x + 1.2} ${s.y + 10} Q ${s.x + 4} ${s.y + 6} ${s.x + 6.8} ${s.y + 10} Z`}
              fill="#161518"
            />
          </g>
        ) : (
          <g key={i} data-pale>
            <rect
              x={s.x}
              y={s.y}
              width="8"
              height="11"
              fill="#5d4c58"
              opacity="0.7"
            />
            <circle cx={s.x + 4} cy={s.y - 0.4} r="0.5" fill="#6d5a4f" />
          </g>
        ),
      )}

      {/* The door, and the light on the other side of it. */}
      <g>
        <rect
          x={SPOTS.door.x - 2}
          y={SPOTS.door.y - 2}
          width={SPOTS.door.w + 4}
          height={SPOTS.door.h + 2}
          fill="#120d10"
        />
        <rect
          x={SPOTS.door.x}
          y={SPOTS.door.y}
          width={SPOTS.door.w}
          height={SPOTS.door.h}
          fill={open ? "url(#room-door-light)" : "#2b2128"}
          stroke="#43343a"
          strokeWidth="0.7"
          className={open ? "room-door-open" : undefined}
        />
        {!open ? (
          <>
            <rect
              x={SPOTS.door.x + 4}
              y={SPOTS.door.y + 5}
              width={SPOTS.door.w - 8}
              height="20"
              fill="none"
              stroke="#3a2d33"
              strokeWidth="0.5"
            />
            <rect
              x={SPOTS.door.x + 4}
              y={SPOTS.door.y + 30}
              width={SPOTS.door.w - 8}
              height="22"
              fill="none"
              stroke="#3a2d33"
              strokeWidth="0.5"
            />
            <circle
              cx={SPOTS.door.x + SPOTS.door.w - 5}
              cy={SPOTS.door.y + 30}
              r="1.5"
              fill="#b49a67"
            />
            <rect
              x={SPOTS.door.x + 1}
              y={SPOTS.door.y + SPOTS.door.h - 1.2}
              width={SPOTS.door.w - 2}
              height="1"
              fill="#ffcf8a"
              className="room-seam"
            />
          </>
        ) : null}
      </g>

      {/* The radio: a low shelf and a warm dial. */}
      <g>
        <rect x="3" y="93" width="28" height="1.8" fill="#2b2026" />
        <rect x="4" y="94" width="1.4" height="14" fill="#2b2026" />
        <rect x="28" y="94" width="1.4" height="14" fill="#2b2026" />
        {radioGlow ? (
          <circle
            cx="17"
            cy="84"
            r="16"
            fill="url(#room-glow)"
            className="room-pulse"
          />
        ) : null}
        <rect
          x={SPOTS.radio.x + 1}
          y={SPOTS.radio.y + 2}
          width={SPOTS.radio.w - 2}
          height={SPOTS.radio.h - 3}
          rx="1.5"
          fill="#4a3526"
          stroke="#2a1d15"
          strokeWidth="0.6"
        />
        <rect x="9" y="80" width="16" height="6" fill="#d8b977" opacity="0.8" />
        <line
          x1="12"
          y1="80"
          x2="12"
          y2="86"
          stroke="#7a1d12"
          strokeWidth="0.5"
        />
        <circle cx="10.5" cy="90" r="1.5" fill="#1d130d" />
        <circle cx="23.5" cy="90" r="1.5" fill="#1d130d" />
        <line
          x1="22"
          y1="76"
          x2="31"
          y2="66"
          stroke="#9c8f7a"
          strokeWidth="0.4"
        />
      </g>

      {/* The television, and the machine under it. */}
      <g>
        <rect x="70" y="99" width="27" height="1.8" fill="#2b2026" />
        <rect x="71" y="100" width="1.4" height="8" fill="#2b2026" />
        <rect x="94" y="100" width="1.4" height="8" fill="#2b2026" />
        <rect
          x={SPOTS.tv.x}
          y={SPOTS.tv.y}
          width={SPOTS.tv.w}
          height={SPOTS.tv.h - 2}
          rx="2"
          fill="#26252a"
          stroke="#141316"
          strokeWidth="0.7"
        />
        <rect
          x={SPOTS.tv.x + 2}
          y={SPOTS.tv.y + 2}
          width={SPOTS.tv.w - 4}
          height={SPOTS.tv.h - 6}
          rx="3"
          fill={tvOn ? "#2c3a38" : "#0b0d0e"}
        />
        <rect
          x={SPOTS.vcr.x}
          y={SPOTS.vcr.y - 1}
          width={SPOTS.vcr.w}
          height={SPOTS.vcr.h}
          fill="#1e1d20"
          stroke="#0d0c0e"
          strokeWidth="0.5"
        />
        <rect
          x={SPOTS.vcr.x + 3}
          y={SPOTS.vcr.y + 1.5}
          width="12"
          height="2"
          fill={tvGlow ? "#ffcf8a" : "#050405"}
          className={tvGlow ? "room-pulse" : undefined}
        />
        <text
          x={SPOTS.vcr.x + 19}
          y={SPOTS.vcr.y + 5.2}
          fontSize="2.6"
          fill="#b3492f"
          fontFamily="monospace"
          className="room-blink"
        >
          12:00
        </text>
      </g>
    </svg>
  );
}
