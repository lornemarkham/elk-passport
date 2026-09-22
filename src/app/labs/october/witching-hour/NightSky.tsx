"use client";

/**
 * **The world, drawn.**
 *
 * One SVG, no images. Everything a later visit might quietly change is a
 * named prop: which distant lights are on, whether the moon is clear, whether
 * the left-hand tree is still there. The scene can be altered while nobody is
 * looking by changing a boolean — there is no animation for a viewer to catch,
 * which is the point.
 *
 * `motion` is the reduced-motion switch. Off, the clouds do not drift and the
 * branch does not move; the lights still change state, because those are
 * information, not decoration.
 */
export interface World {
  lights: readonly [boolean, boolean, boolean];
  moonClear: boolean;
  leftTree: boolean;
  branchStir: boolean;
  /**
   * The whole sky, darker. Added after the screening: the tree vanishing was
   * missed, because a change at the edge of the frame is a change the eye
   * has to go looking for. A drop in overall light is noticed before it is
   * looked at. Paired with the tree, the return glance lands on a world that
   * is wrong in two ways, one of them impossible to miss.
   */
  dim: boolean;
}

export const OPENING_WORLD: World = {
  lights: [false, true, true],
  moonClear: false,
  leftTree: true,
  branchStir: false,
  dim: false,
};

export function NightSky({
  world,
  motion,
  drift = 0,
  portrait = false,
}: {
  world: World;
  motion: boolean;
  /** Camera: 0 at the top of the night, 1 at the end. Parallax only. */
  drift?: number;
  /**
   * A phone held upright is a different frame, not a cropped one. `slice` on
   * a 1000-wide scene showed the middle third — both distant lights and half
   * the moon fell off the edges, and with them the entire left/right grammar
   * the night is teaching. So the composition is re-laid for a tall frame:
   * same elements, same proportions to each other, placed where a portrait
   * viewer can actually see them.
   */
  portrait?: boolean;
}) {
  const W = portrait ? 620 : 1000;
  // Everything horizontal is a fraction of the frame, so the left light is
  // still on the left and the moon still upper-right at any aspect.
  const fx = (f: number) => Math.round(f * W);
  const cloudX = motion ? -40 + drift * 60 : 0;
  const treeX = drift * 18;
  const moonX = fx(portrait ? 0.7 : 0.69);
  const moonY = portrait ? 260 : 230;

  return (
    <svg
      viewBox={`0 0 ${W} 1000`}
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        <radialGradient id="wh-sky" cx="50%" cy="35%" r="80%">
          <stop offset="0%" stopColor="#101625" />
          <stop offset="60%" stopColor="#070a12" />
          <stop offset="100%" stopColor="#030408" />
        </radialGradient>
        <radialGradient id="wh-moonglow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f4efe0" stopOpacity="0.55" />
          <stop offset="45%" stopColor="#d9d3c2" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#d9d3c2" stopOpacity="0" />
        </radialGradient>
        {/* Filter regions widened far past the default. SVG clips a blur to
            110% of the element's box, which turns a glowing point into a
            faintly visible square — the one artefact that says "web page"
            louder than anything else on screen. */}
        <filter id="wh-soft" x="-300%" y="-300%" width="700%" height="700%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <filter id="wh-cloud" x="-120%" y="-300%" width="340%" height="700%">
          <feGaussianBlur stdDeviation="26" />
        </filter>
      </defs>

      <rect width={W} height="1000" fill="url(#wh-sky)" />
      {/* Dim: a veil over the sky only, so the silhouettes stay black and the
          moon's glow still reads. No transition — it is simply darker now. */}
      <rect
        width={W}
        height="1000"
        fill="#020308"
        opacity={world.dim ? 0.55 : 0}
      />

      {/* Stars: fixed, faint, a few. A sky that twinkles is a screensaver. */}
      {STARS.map(([x, y, r], i) => (
        <circle
          key={i}
          cx={fx(x)}
          cy={y}
          r={r}
          fill="#e9e6da"
          opacity={0.35 + (i % 3) * 0.15}
        />
      ))}

      {/* Moon */}
      <g transform={`translate(${moonX} ${moonY})`}>
        <circle r="140" fill="url(#wh-moonglow)" filter="url(#wh-soft)" />
        <circle r="46" fill="#efe9d6" />
        {/* Waning gibbous: the shadow is drawn, not implied. */}
        <ellipse cx="18" cy="0" rx="34" ry="46" fill="#0b0f18" opacity="0.92" />
      </g>

      {/* Cloud bank across the moon. Drifts in front of it, never past it. */}
      <g
        style={{
          transform: `translateX(${cloudX}px)`,
          transition: motion ? "transform 40s linear" : undefined,
        }}
        opacity={world.moonClear ? 0.35 : 0.88}
        filter="url(#wh-cloud)"
      >
        <ellipse
          cx={moonX - 50}
          cy={moonY - 15}
          rx={fx(0.23)}
          ry="46"
          fill="#1a1f2e"
        />
        <ellipse
          cx={moonX + 70}
          cy={moonY + 20}
          rx={fx(0.2)}
          ry="38"
          fill="#161a28"
        />
        <ellipse
          cx={moonX - 130}
          cy={moonY + 25}
          rx={fx(0.16)}
          ry="30"
          fill="#141827"
        />
      </g>

      {/* Distant lights along the far hill. Three windows, four kilometres away. */}
      <g>
        {LIGHTS.map(([x, y], i) => (
          <g key={i}>
            <circle
              cx={fx(x)}
              cy={y}
              r="14"
              fill="#ffd9a0"
              opacity={world.lights[i] ? 0.18 : 0}
              filter="url(#wh-soft)"
            />
            <circle
              cx={fx(x)}
              cy={y}
              r="2.2"
              fill="#ffe2b0"
              opacity={world.lights[i] ? 0.95 : 0}
            />
          </g>
        ))}
      </g>

      {/* Far hill */}
      <path
        d={`M0 700 C ${fx(0.18)} 660, ${fx(0.32)} 690, ${fx(0.5)} 668 C ${fx(0.7)} 645, ${fx(0.82)} 690, ${W} 660 L${W} 1000 L0 1000Z`}
        fill="#05070c"
      />

      {/* Tree line. The left tree can be absent. Nothing announces it. */}
      <g style={{ transform: `translateX(${treeX}px)` }}>
        {world.leftTree && (
          <Tree x={fx(0.12)} h={portrait ? 300 : 330} lean={-2} />
        )}
        <Tree x={fx(0.3)} h={portrait ? 230 : 270} lean={1} />
        <Tree
          x={fx(0.79)}
          h={portrait ? 280 : 310}
          lean={2}
          stir={motion && world.branchStir}
        />
        <Tree x={fx(0.93)} h={portrait ? 220 : 250} lean={-1} />
      </g>

      {/* Ground */}
      <rect y="820" width={W} height="180" fill="#020305" />
    </svg>
  );
}

function Tree({
  x,
  h,
  lean,
  stir = false,
}: {
  x: number;
  h: number;
  lean: number;
  stir?: boolean;
}) {
  const base = 830;
  const top = base - h;
  return (
    <g
      style={{
        transformOrigin: `${x}px ${base}px`,
        transform: `rotate(${lean}deg)`,
      }}
    >
      <path d={conifer(x, top, base, h)} fill="#03040a" />
      {/* One low branch on the right side. It stirs when the scene says so. */}
      <path
        d={`M${x + 4} ${base - h * 0.55} q 30 -8 52 4`}
        stroke="#03040a"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
        style={{
          transformOrigin: `${x + 4}px ${base - h * 0.55}px`,
          transform: stir ? "rotate(-4deg)" : "rotate(0deg)",
          transition: "transform 1400ms cubic-bezier(.3,.9,.4,1)",
        }}
      />
    </g>
  );
}

/**
 * A conifer as a single closed outline: a spine of widening tiers, each edge
 * broken into a few uneven points so it reads as branches rather than
 * geometry. Seeded by `x`, so the same tree is the same tree on every render
 * — a silhouette that changed shape between visits would be a tell.
 */
function conifer(x: number, top: number, base: number, h: number): string {
  let seed = Math.floor(x * 7919) % 2147483647;
  const rnd = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };

  const tiers = 7;
  const right: [number, number][] = [];
  const left: [number, number][] = [];

  right.push([x, top]);
  for (let i = 1; i <= tiers; i++) {
    const f = i / tiers;
    const y = top + h * f * 0.94;
    const w = 6 + Math.pow(f, 1.25) * (h * 0.24);
    // Each tier: a droop outward then a tuck back in, with jitter.
    const jr = (rnd() - 0.5) * w * 0.35;
    const jl = (rnd() - 0.5) * w * 0.35;
    right.push([x + w + jr, y]);
    right.push([x + w * 0.55, y + h * 0.035]);
    left.push([x - w * 0.55, y + h * 0.035]);
    left.push([x - w - jl, y]);
  }
  right.push([x + 5, base]);
  left.push([x - 5, base]);

  const pts = [...right, ...left.reverse()];
  return `M${pts.map(([px, py]) => `${px.toFixed(1)} ${py.toFixed(1)}`).join(" L")} Z`;
}

/** x as a fraction of the frame width; y in the 1000-tall frame. */
const STARS: readonly [number, number, number][] = [
  [0.08, 90, 1.2],
  [0.16, 40, 0.8],
  [0.24, 130, 1],
  [0.33, 60, 0.9],
  [0.42, 110, 1.1],
  [0.51, 50, 0.7],
  [0.86, 80, 1],
  [0.93, 150, 0.8],
  [0.96, 40, 1.1],
  [0.59, 140, 0.8],
  [0.12, 210, 0.7],
  [0.37, 190, 0.9],
  [0.88, 300, 0.7],
  [0.04, 320, 0.8],
];

/** Left window, centre window, right window — on the far hill. */
const LIGHTS: readonly [number, number][] = [
  [0.15, 662],
  [0.52, 655],
  [0.842, 668],
];
