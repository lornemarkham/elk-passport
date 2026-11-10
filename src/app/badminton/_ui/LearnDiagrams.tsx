import type { DiagramId } from "@/lib/courtqueue/learn";

/**
 * Small drawings for the lessons. Drawn here, so there is nothing to load and
 * nothing to link to: a half court seen from above (the net at the top), a
 * side view of the net, and a few shapes that say the rest.
 */

const LIME = "#bef264";
const LINE = "rgba(255,255,255,0.55)";
const SOFT = "rgba(255,255,255,0.12)";

function Frame({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 220 150"
      role="img"
      aria-label={label}
      className="w-full rounded-xl bg-slate-900 ring-1 ring-white/10"
    >
      {children}
    </svg>
  );
}

/** Half a doubles court from above: net on top, back line at the bottom. */
function HalfCourt({ x = 60, w = 100 }: { x?: number; w?: number }) {
  const h = 130;
  const y = 10;
  return (
    <g stroke={LINE} strokeWidth="1" fill="none">
      <rect x={x} y={y} width={w} height={h} fill={SOFT} />
      <line x1={x} x2={x + w} y1={y} y2={y} strokeWidth="3" stroke="#fff" />
      <line x1={x} x2={x + w} y1={y + 28} y2={y + 28} />
      <line x1={x + w / 2} x2={x + w / 2} y1={y + 28} y2={y + h} />
      <line x1={x + 6} x2={x + 6} y1={y} y2={y + h} />
      <line x1={x + w - 6} x2={x + w - 6} y1={y} y2={y + h} />
      <line x1={x} x2={x + w} y1={y + 12} y2={y + 12} opacity="0" />
    </g>
  );
}

function Dot({ x, y, label }: { x: number; y: number; label?: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r="7" fill={LIME} />
      {label && (
        <text
          x={x}
          y={y + 3}
          fontSize="8"
          textAnchor="middle"
          fill="#0f172a"
          fontWeight="700"
        >
          {label}
        </text>
      )}
    </g>
  );
}

const Arrow = ({ d }: { d: string }) => (
  <path
    d={d}
    stroke={LIME}
    strokeWidth="2"
    fill="none"
    markerEnd="url(#head)"
  />
);

const Defs = () => (
  <defs>
    <marker
      id="head"
      markerWidth="6"
      markerHeight="6"
      refX="5"
      refY="3"
      orient="auto"
    >
      <path d="M0,0 L6,3 L0,6 Z" fill={LIME} />
    </marker>
  </defs>
);

const Caption = ({
  x,
  y,
  children,
}: {
  x: number;
  y: number;
  children: React.ReactNode;
}) => (
  <text x={x} y={y} fontSize="9" fill="#fff" textAnchor="middle">
    {children}
  </text>
);

export function Diagram({ id }: { id: DiagramId }) {
  switch (id) {
    case "grip":
      return (
        <Frame label="A racket handle held with the V between thumb and finger on top, like a handshake">
          <Defs />
          <ellipse
            cx="110"
            cy="38"
            rx="26"
            ry="32"
            stroke="#fff"
            strokeWidth="3"
            fill={SOFT}
          />
          <line
            x1="110"
            x2="110"
            y1="70"
            y2="96"
            stroke="#fff"
            strokeWidth="3"
          />
          <rect
            x="102"
            y="96"
            width="16"
            height="42"
            rx="5"
            fill="rgba(255,255,255,0.25)"
            stroke="#fff"
          />
          <path
            d="M96 104 L110 98 L124 104"
            stroke={LIME}
            strokeWidth="3"
            fill="none"
          />
          <Arrow d="M170 70 L128 100" />
          <Caption x={176} y={62}>
            V on top
          </Caption>
          <Caption x={52} y={116}>
            fingers loose,
          </Caption>
          <Caption x={52} y={128}>
            squeeze to hit
          </Caption>
        </Frame>
      );
    case "serve":
      return (
        <Frame label="Side view: a low serve just clears the net and lands near the short line">
          <Defs />
          <line x1="10" x2="210" y1="130" y2="130" stroke={LINE} />
          <line
            x1="110"
            x2="110"
            y1="130"
            y2="80"
            stroke="#fff"
            strokeWidth="3"
          />
          <Arrow d="M40 112 Q100 76 150 126" />
          <Dot x={34} y={116} />
          <circle cx="152" cy="127" r="3" fill="#fff" />
          <Caption x={110} y={72}>
            net
          </Caption>
          <Caption x={166} y={144}>
            short line
          </Caption>
        </Frame>
      );
    case "footwork":
      return (
        <Frame label="Small steps from the middle to each corner, then back to the middle">
          <Defs />
          <HalfCourt />
          <Dot x={110} y={78} label="1" />
          <Arrow d="M100 72 L72 36" />
          <Arrow d="M120 72 L148 36" />
          <Arrow d="M100 88 L72 124" />
          <Arrow d="M120 88 L148 124" />
          <Caption x={110} y={146}>
            middle first, reach, back to the middle
          </Caption>
        </Frame>
      );
    case "clear-drop":
      return (
        <Frame label="Side view: a clear is high and deep, a drop is soft and falls just over the net">
          <Defs />
          <line x1="10" x2="210" y1="130" y2="130" stroke={LINE} />
          <line
            x1="104"
            x2="104"
            y1="130"
            y2="88"
            stroke="#fff"
            strokeWidth="3"
          />
          <Dot x={30} y={110} />
          <Arrow d="M40 100 Q110 -10 196 126" />
          <path
            d="M40 106 Q80 76 120 124"
            stroke="#fff"
            strokeWidth="2"
            strokeDasharray="4 3"
            fill="none"
            markerEnd="url(#head)"
          />
          <Caption x={128} y={30}>
            clear: high and deep
          </Caption>
          <Caption x={146} y={144}>
            drop: soft, just over
          </Caption>
        </Frame>
      );
    case "doubles":
      return (
        <Frame label="Two shapes: front and back to attack, side by side to defend">
          <Defs />
          <HalfCourt x={14} w={80} />
          <Dot x={54} y={36} />
          <Dot x={54} y={104} />
          <Caption x={54} y={147}>
            Attack: front and back
          </Caption>
          <HalfCourt x={126} w={80} />
          <Dot x={146} y={74} />
          <Dot x={186} y={74} />
          <Caption x={166} y={147}>
            Defend: side by side
          </Caption>
        </Frame>
      );
    case "talk":
      return (
        <Frame label="Speech bubbles saying Mine, Yours and Switch">
          <Defs />
          <Dot x={50} y={100} />
          <Dot x={170} y={100} />
          <rect x="20" y="22" width="70" height="30" rx="14" fill={LIME} />
          <text
            x="55"
            y="42"
            fontSize="14"
            textAnchor="middle"
            fill="#0f172a"
            fontWeight="800"
          >
            Mine!
          </text>
          <rect x="130" y="22" width="70" height="30" rx="14" fill="#fff" />
          <text
            x="165"
            y="42"
            fontSize="14"
            textAnchor="middle"
            fill="#0f172a"
            fontWeight="800"
          >
            Yours!
          </text>
          <rect
            x="75"
            y="62"
            width="70"
            height="26"
            rx="13"
            fill="rgba(255,255,255,0.2)"
          />
          <text
            x="110"
            y="79"
            fontSize="12"
            textAnchor="middle"
            fill="#fff"
            fontWeight="700"
          >
            Switch
          </text>
        </Frame>
      );
    case "target":
      return (
        <Frame label="Aim for a target, such as a back corner, before each hit">
          <Defs />
          <HalfCourt />
          <circle
            cx="76"
            cy="124"
            r="12"
            stroke={LIME}
            strokeWidth="2"
            fill="none"
          />
          <circle cx="76" cy="124" r="5" fill={LIME} />
          <Dot x={140} y={46} />
          <Arrow d="M133 52 L86 116" />
          <Caption x={110} y={146}>
            pick a target, then hit
          </Caption>
        </Frame>
      );
  }
}
