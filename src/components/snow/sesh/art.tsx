/**
 * **Sesh Wars artwork**, drawn in SVG so it is crisp on a phone, costs no
 * download, and could be handed to an embroiderer as-is (each patch is a
 * flat field, a border, a stitched edge, one motif and a ribbon — the parts
 * a real patch is made of).
 *
 * Everything here is invented: the marmot, the "squadron", the insignia.
 * No real unit's markings, no real-world symbols beyond mountains, stars,
 * skis and planes.
 */
import type { ReactNode } from "react";
import type { FeatureKind } from "@/domain/snow/sesh/model";
import type { Motif, PatchDef } from "@/domain/snow/sesh/patches";

const CREAM = "#efe6cf";
const CHAR = "#2b2a27";
const OLIVE = "#4b5320";
const ORANGE = "#c8641e";
const RED = "#a8322d";

function MotifArt({ motif, ink }: { motif: Motif; ink: string }): ReactNode {
  const s = { fill: ink, stroke: ink } as const;
  switch (motif) {
    case "plane":
      return (
        <g {...s} strokeWidth={0}>
          <rect x={26} y={38} width={68} height={6} rx={3} />
          <rect x={22} y={52} width={76} height={7} rx={3.5} />
          <ellipse cx={60} cy={53} rx={9} ry={14} />
          <rect x={44} y={44} width={2} height={9} />
          <rect x={74} y={44} width={2} height={9} />
          <path d="M52 66 L68 66 L60 76 Z" />
          <circle cx={60} cy={40} r={3} fill={CHAR} />
          <rect x={58} y={28} width={4} height={10} rx={2} />
        </g>
      );
    case "rail":
      return (
        <g {...s}>
          <path
            d="M26 76 L94 64"
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
          />
          <path d="M34 77 L34 86 M86 66 L86 80" strokeWidth={3} fill="none" />
          <path
            d="M42 62 L78 56"
            strokeWidth={5}
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M60 58 L58 42 M58 46 L48 40 M58 46 L70 42"
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
          />
          <circle cx={57} cy={35} r={6} strokeWidth={0} />
        </g>
      );
    case "star":
      return (
        <path
          {...s}
          d="M60 26 L68 50 L94 50 L73 64 L81 88 L60 73 L39 88 L47 64 L26 50 L52 50 Z"
        />
      );
    case "crown":
      return (
        <g {...s}>
          <path d="M30 76 L28 42 L44 58 L60 34 L76 58 L92 42 L90 76 Z" />
          <rect x={30} y={78} width={60} height={7} rx={2} />
        </g>
      );
    case "swords":
      // Crossed skis and a pole: a challenge, not a weapon.
      return (
        <g {...s} strokeLinecap="round" fill="none">
          <path d="M34 30 Q30 26 34 24 L88 86" strokeWidth={6} />
          <path d="M86 30 Q90 26 86 24 L32 86" strokeWidth={6} />
          <path d="M60 26 L60 90" strokeWidth={2.5} />
          <circle cx={60} cy={82} r={5} strokeWidth={2.5} />
        </g>
      );
    case "phoenix":
      return (
        <g {...s}>
          <path d="M60 88 C40 80 38 58 50 44 C50 56 56 58 58 52 C56 40 62 30 72 24 C68 36 80 44 78 60 C77 74 70 84 60 88 Z" />
          <path
            d="M60 88 C54 82 54 72 60 64 C66 72 66 82 60 88 Z"
            fill={CREAM}
            stroke="none"
          />
        </g>
      );
    case "peaks":
      return (
        <g {...s}>
          <path d="M20 84 L46 44 L60 64 L74 38 L100 84 Z" />
          <path
            d="M46 44 L40 54 L46 52 L52 56 Z M74 38 L67 50 L74 47 L81 52 Z"
            fill={CREAM}
            stroke="none"
          />
        </g>
      );
    case "binoculars":
      return (
        <g {...s}>
          <circle cx={45} cy={64} r={14} />
          <circle cx={75} cy={64} r={14} />
          <rect x={40} y={36} width={12} height={22} rx={4} />
          <rect x={68} y={36} width={12} height={22} rx={4} />
          <rect x={52} y={44} width={16} height={8} rx={3} />
          <circle cx={45} cy={64} r={6} fill={CHAR} stroke="none" />
          <circle cx={75} cy={64} r={6} fill={CHAR} stroke="none" />
        </g>
      );
    case "flare":
      return (
        <g {...s} strokeLinecap="round">
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * Math.PI) / 6;
            return (
              <path
                key={i}
                d={`M${60 + Math.cos(a) * 12} ${58 + Math.sin(a) * 12} L${60 + Math.cos(a) * (i % 2 ? 24 : 32)} ${58 + Math.sin(a) * (i % 2 ? 24 : 32)}`}
                strokeWidth={4}
              />
            );
          })}
          <circle cx={60} cy={58} r={8} />
        </g>
      );
  }
}

function Shape({
  shape,
  field,
  border,
}: {
  shape: PatchDef["art"]["shape"];
  field: string;
  border: string;
}) {
  const stitch = {
    fill: "none",
    stroke: CREAM,
    strokeWidth: 1.6,
    strokeDasharray: "3 2.2",
    opacity: 0.85,
  };
  switch (shape) {
    case "roundel":
      return (
        <>
          <circle cx={60} cy={60} r={56} fill={border} />
          <circle cx={60} cy={60} r={48} fill={field} />
          <circle cx={60} cy={60} r={52} {...stitch} />
        </>
      );
    case "shield": {
      const d = (k: number) =>
        `M${60} ${4 + k} L${110 - k} ${18 + k} L${108 - k} ${62} C${104 - k} ${92 - k / 2} ${80} ${108 - k} ${60} ${116 - k} C${40} ${108 - k} ${16 + k} ${92 - k / 2} ${12 + k} ${62} L${10 + k} ${18 + k} Z`;
      return (
        <>
          <path d={d(0)} fill={border} />
          <path d={d(8)} fill={field} />
          <path d={d(4)} {...stitch} />
        </>
      );
    }
    case "wings":
      return (
        <>
          <path
            d="M60 30 C40 22 14 24 2 34 C14 38 18 42 10 46 C22 48 26 52 18 56 C32 58 40 60 60 66 Z"
            fill={border}
          />
          <path
            d="M60 30 C80 22 106 24 118 34 C106 38 102 42 110 46 C98 48 94 52 102 56 C88 58 80 60 60 66 Z"
            fill={border}
          />
          <circle cx={60} cy={60} r={42} fill={border} />
          <circle cx={60} cy={60} r={35} fill={field} />
          <circle cx={60} cy={60} r={38.5} {...stitch} />
        </>
      );
    case "pennant":
      return (
        <>
          <path d="M14 8 L106 8 L106 92 L60 116 L14 92 Z" fill={border} />
          <path d="M21 15 L99 15 L99 88 L60 108 L21 88 Z" fill={field} />
          <path
            d="M17.5 11.5 L102.5 11.5 L102.5 90 L60 112 L17.5 90 Z"
            {...stitch}
          />
        </>
      );
  }
}

/** One embroidered patch. Locked patches are greyed and dashed, not hidden. */
export function Patch({
  patch,
  locked = false,
  size = 112,
  title = true,
}: {
  patch: PatchDef;
  locked?: boolean;
  size?: number;
  title?: boolean;
}) {
  const { art } = patch;
  return (
    <svg
      viewBox="0 0 120 140"
      width={size}
      height={(size * 140) / 120}
      role="img"
      aria-label={`${patch.name} patch${locked ? " (not earned yet)" : ""}`}
      style={locked ? { filter: "grayscale(1)", opacity: 0.42 } : undefined}
    >
      <g
        filter={locked ? undefined : "drop-shadow(1.5px 2px 0 rgba(0,0,0,.35))"}
      >
        <Shape shape={art.shape} field={art.field} border={art.border} />
        <MotifArt motif={art.motif} ink={art.ink} />
      </g>
      {title && (
        <g>
          <path
            d="M6 112 L18 118 L6 124 L22 124 L22 112 Z M114 112 L102 118 L114 124 L98 124 L98 112 Z"
            fill={CHAR}
          />
          <rect
            x={16}
            y={110}
            width={88}
            height={16}
            rx={2}
            fill={art.border === CREAM ? RED : art.border}
            stroke={CHAR}
            strokeWidth={1.5}
          />
          <text
            x={60}
            y={121.5}
            textAnchor="middle"
            fontSize={patch.name.length > 13 ? 8 : 9.5}
            fontWeight={900}
            fill={CREAM}
            style={{
              letterSpacing: "0.08em",
              fontFamily: "var(--font-sesh-type), monospace",
            }}
          >
            {patch.name.toUpperCase()}
          </text>
          <text
            x={60}
            y={136}
            textAnchor="middle"
            fontSize={7}
            fill={CHAR}
            opacity={0.7}
            style={{ fontFamily: "var(--font-sesh-type), monospace" }}
          >
            {patch.code}
          </text>
        </g>
      )}
    </svg>
  );
}

/** The squadron's mascot: a marmot in flying goggles and a scarf. */
export function Marmot({ size = 120 }: { size?: number }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
      <path d="M38 96 C30 112 90 112 82 96 Z" fill={RED} />
      <path d="M78 98 L96 112 L84 100 Z" fill={RED} />
      <ellipse cx={60} cy={66} rx={34} ry={32} fill="#8a6239" />
      <circle cx={32} cy={40} r={9} fill="#8a6239" />
      <circle cx={88} cy={40} r={9} fill="#8a6239" />
      <circle cx={32} cy={40} r={4.5} fill="#5e3f22" />
      <circle cx={88} cy={40} r={4.5} fill="#5e3f22" />
      <ellipse cx={60} cy={80} rx={20} ry={15} fill="#d9b98a" />
      <path d="M26 52 L94 52" stroke={CHAR} strokeWidth={7} />
      <circle cx={46} cy={54} r={12} fill={CHAR} />
      <circle cx={74} cy={54} r={12} fill={CHAR} />
      <circle cx={46} cy={54} r={8.5} fill="#9fc3d6" />
      <circle cx={74} cy={54} r={8.5} fill="#9fc3d6" />
      <path
        d="M41 50 l5 -3 M69 50 l5 -3"
        stroke="#fff"
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <ellipse cx={60} cy={73} rx={5} ry={3.5} fill={CHAR} />
      <path
        d="M60 76 L60 80 M54 81 Q60 86 66 81"
        stroke={CHAR}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
      <rect x={55.5} y={82} width={4} height={5} rx={1} fill="#fff" />
      <rect x={60.5} y={82} width={4} height={5} rx={1} fill="#fff" />
    </svg>
  );
}

/** The Sesh Wars insignia: winged roundel, mountains, the marmot, a ribbon. */
export function Insignia({ size = 200 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 240 200"
      width={size}
      height={(size * 200) / 240}
      role="img"
      aria-label="Sesh Wars insignia"
    >
      <g fill={OLIVE} stroke={CHAR} strokeWidth={2}>
        <path d="M120 70 C88 52 40 48 4 66 C30 72 34 78 18 84 C40 88 46 94 30 100 C56 102 70 104 120 116 Z" />
        <path d="M120 70 C152 52 200 48 236 66 C210 72 206 78 222 84 C200 88 194 94 210 100 C184 102 170 104 120 116 Z" />
      </g>
      <g stroke={CREAM} strokeWidth={1.2} opacity={0.6}>
        <path
          d="M30 76 C60 72 90 76 112 84 M38 90 C64 86 90 90 112 96"
          fill="none"
        />
        <path
          d="M210 76 C180 72 150 76 128 84 M202 90 C176 86 150 90 128 96"
          fill="none"
        />
      </g>
      <circle cx={120} cy={86} r={64} fill={CHAR} />
      <circle cx={120} cy={86} r={58} fill={ORANGE} />
      <circle
        cx={120}
        cy={86}
        r={61}
        fill="none"
        stroke={CREAM}
        strokeWidth={1.6}
        strokeDasharray="4 3"
      />
      <circle cx={120} cy={86} r={48} fill={CREAM} />
      <path d="M74 112 L102 70 L116 90 L132 62 L166 112 Z" fill={OLIVE} />
      <path
        d="M102 70 L95 81 L102 78 L108 83 Z M132 62 L124 75 L132 72 L140 78 Z"
        fill="#fff"
      />
      <g transform="translate(92 66) scale(0.47)">
        <Marmot size={120} />
      </g>
      <path
        d="M40 150 L58 160 L40 170 L70 170 L70 150 Z M200 150 L182 160 L200 170 L170 170 L170 150 Z"
        fill="#7d2420"
        stroke={CHAR}
        strokeWidth={2}
      />
      <rect
        x={58}
        y={142}
        width={124}
        height={26}
        rx={3}
        fill={RED}
        stroke={CHAR}
        strokeWidth={2}
      />
      <text
        x={120}
        y={161}
        textAnchor="middle"
        fontSize={18}
        fill={CREAM}
        style={{
          fontFamily: "var(--font-sesh-display), Georgia, serif",
          letterSpacing: "0.08em",
        }}
      >
        SESH WARS
      </text>
      <text
        x={120}
        y={188}
        textAnchor="middle"
        fontSize={9}
        fill={CHAR}
        style={{
          fontFamily: "var(--font-sesh-type), monospace",
          letterSpacing: "0.18em",
        }}
      >
        MOUNTAIN SQUADRON · EST. 2026
      </text>
    </svg>
  );
}

const JACKETS = [
  ORANGE,
  RED,
  "#3c6e8f",
  "#e2b33d",
  "#6b8e23",
  "#8e4f8f",
  "#2f8f83",
];

/** Where the rider travels, by feature kind (viewBox 320×180). */
function lineFor(kind: FeatureKind): {
  track: string;
  path: string;
  deco: ReactNode;
} {
  switch (kind) {
    case "rail":
    case "box":
    case "jib":
      return {
        track: "M0 120 L110 120 L110 120 L250 108 L320 126",
        path: "M10 112 L104 112 L112 104 L240 92 L262 112 L320 118",
        deco:
          kind === "box" ? (
            <rect
              x={110}
              y={100}
              width={134}
              height={14}
              fill="#c9c2b0"
              stroke={CHAR}
              strokeWidth={2}
              transform="rotate(-4 110 100)"
            />
          ) : (
            <g stroke={CHAR} strokeWidth={3}>
              <path d="M110 104 L246 92" strokeWidth={4} />
              <path d="M120 104 L120 122 M236 93 L236 112" />
            </g>
          ),
      };
    case "roller":
      return {
        track: "M0 120 Q40 100 80 120 T160 120 T240 120 T320 120",
        path: "M0 112 Q40 92 80 112 T160 112 T240 112 T320 112",
        deco: null,
      };
    case "halfpipe":
    case "park-lane":
      return {
        track: "M0 40 Q30 150 160 150 Q290 150 320 40",
        path: "M30 70 Q60 140 160 142 Q260 140 300 30 Q306 18 296 26",
        deco: null,
      };
    case "jump":
    case "side-hit":
    default:
      return {
        track:
          "M0 126 L100 126 Q130 126 150 104 L180 104 L200 104 Q240 120 320 132",
        path: "M10 118 L100 118 Q132 116 150 96 Q180 30 230 98 Q260 118 320 124",
        deco: (
          <path
            d="M100 126 Q130 126 150 104 L150 128 Z"
            fill="#f4f1ea"
            stroke={CHAR}
            strokeWidth={2}
          />
        ),
      };
  }
}

/**
 * A drawn clip for Demo Mode. It moves only once tapped (`playing`), and it
 * always says what it is: an illustration, not footage.
 */
export function DemoReel({
  kind,
  seed,
  playing,
  sport,
}: {
  kind: FeatureKind;
  seed: number;
  playing: boolean;
  sport: "ski" | "snowboard";
}) {
  const jacket = JACKETS[seed % JACKETS.length];
  const spin = seed % 3 === 0;
  const { track, path, deco } = lineFor(kind);
  const sky = seed % 2 ? "#9fc3d6" : "#c9d9df";
  const id = `r${seed}`;
  return (
    <svg
      viewBox="0 0 320 180"
      className="h-full w-full"
      role="img"
      aria-label="Demo illustration of a rider on the feature — not real footage"
    >
      <defs>
        <linearGradient id={`${id}s`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={sky} />
          <stop offset="1" stopColor="#efe6cf" />
        </linearGradient>
      </defs>
      <rect width={320} height={180} fill={`url(#${id}s)`} />
      <path
        d="M0 96 L60 40 L100 70 L150 20 L210 72 L250 46 L320 92 L320 180 L0 180 Z"
        fill="#b8c4bf"
      />
      <path
        d="M150 20 L138 38 L150 34 L160 42 Z M60 40 L52 52 L60 49 L67 54 Z"
        fill="#fff"
      />
      <path
        d={`${track} L320 180 L0 180 Z`}
        fill="#f7f4ec"
        stroke={CHAR}
        strokeWidth={2}
      />
      {deco}
      {[40, 280].map((x) => (
        <g key={x} stroke={OLIVE} strokeWidth={0}>
          <path
            d={`M${x} 150 l-8 14 h16 Z M${x} 140 l-7 13 h14 Z`}
            fill={OLIVE}
          />
        </g>
      ))}
      <g>
        {playing && (
          <animateMotion
            dur="2.6s"
            repeatCount="indefinite"
            path={path}
            rotate="auto"
            keyPoints="0;1"
            keyTimes="0;1"
            calcMode="linear"
          />
        )}
        <g transform={playing ? undefined : "translate(60 112)"}>
          <g>
            {playing && spin && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                values="0;0;360;360"
                keyTimes="0;0.42;0.62;1"
                dur="2.6s"
                repeatCount="indefinite"
              />
            )}
            {sport === "snowboard" ? (
              <rect x={-13} y={-1} width={26} height={4} rx={2} fill={CHAR} />
            ) : (
              <g fill={CHAR}>
                <rect x={-14} y={-1} width={20} height={2.5} rx={1} />
                <rect x={-8} y={1.5} width={20} height={2.5} rx={1} />
              </g>
            )}
            <path
              d="M-5 -1 L-3 -11 M5 -1 L3 -11"
              stroke="#333"
              strokeWidth={3.4}
              strokeLinecap="round"
            />
            <path d="M-4 -11 L4 -11 L3 -23 L-3 -23 Z" fill={jacket} />
            <path
              d="M-3 -20 L-11 -15 M3 -20 L11 -24"
              stroke={jacket}
              strokeWidth={3}
              strokeLinecap="round"
            />
            <circle cx={0} cy={-28} r={5} fill="#f0c9a0" />
            <path
              d="M-5 -29 A5 5 0 0 1 5 -29 Z"
              fill={seed % 2 ? RED : OLIVE}
            />
            <rect x={-4} y={-29} width={8} height={2.4} rx={1} fill="#9fc3d6" />
          </g>
        </g>
      </g>
      <rect
        x={8}
        y={8}
        width={164}
        height={17}
        rx={3}
        fill={CHAR}
        opacity={0.85}
      />
      <text
        x={14}
        y={20}
        fontSize={9}
        fill={CREAM}
        style={{
          fontFamily: "var(--font-sesh-type), monospace",
          letterSpacing: "0.08em",
        }}
      >
        DEMO ILLUSTRATION · NOT FOOTAGE
      </text>
    </svg>
  );
}
