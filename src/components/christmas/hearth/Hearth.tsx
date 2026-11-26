"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { Festive } from "@/components/christmas/Festive";
import { useReducedMotion } from "@/components/christmas/stored";
import { VERSES, VERSE_MS } from "@/domain/christmas/verses";
import { lightFire, type Fire } from "./fire";
import { useHearthSound } from "./useHearthSound";
import styles from "./hearth.module.css";

/**
 * **Come on in. Stay awhile.** — the Christmas hero (owner brief M1127,
 * "Stay Awhile").
 *
 * A room at night: the snow, a star high above, and a fire in a hearth hung
 * with stockings beside a lit tree. The words say one thing at a time and
 * fade to the next. There is nothing here to choose — the place, the
 * distance, Advent, New Year's Eve and every way in wait below, for when the
 * visitor is ready. Two small things sit in the corner for whoever wants
 * them: the fire's sound (always off until asked) and a pause.
 *
 * Everything in the picture is drawn — SVG and a canvas fire — so a phone
 * opened from a business card fetches no video and no photograph to see it,
 * and the room is there, still, at first paint and with reduced motion.
 */
export function Hearth({ countdown }: { countdown: string }) {
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const still = reduced || paused;
  const sound = useHearthSound();
  const room = useRef<HTMLElement>(null);
  const flame = useRef<HTMLCanvasElement>(null);
  const fire = useRef<Fire | null>(null);
  const stillNow = useRef(still);
  const [verse, setVerse] = useState(0);
  const [burning, setBurning] = useState(false);

  useEffect(() => {
    const canvas = flame.current;
    if (!canvas) return;
    fire.current = lightFire(canvas, {
      still: stillNow.current,
      onGlow: (glow) =>
        room.current?.style.setProperty("--fire", glow.toFixed(3)),
    });
    // The drawn fire takes over from the painted glow once it has a frame.
    const lit = requestAnimationFrame(() => setBurning(true));
    return () => {
      cancelAnimationFrame(lit);
      fire.current?.stop();
      fire.current = null;
    };
  }, []);

  useEffect(() => {
    stillNow.current = still;
    fire.current?.setStill(still);
  }, [still]);

  useEffect(() => {
    if (still) return;
    const turn = window.setInterval(
      () => setVerse((v) => (v + 1) % VERSES.length),
      VERSE_MS,
    );
    return () => window.clearInterval(turn);
  }, [still]);

  return (
    <header
      ref={room}
      className={styles.room}
      data-still={still ? "" : undefined}
      data-testid="hearth"
    >
      <div className={styles.sky} aria-hidden />
      <div className={styles.glow} aria-hidden />

      <div className={styles.star} aria-hidden data-testid="bethlehem">
        <span className={styles.ray} />
        <Star />
      </div>

      <div
        className={styles.scene}
        role="img"
        aria-label="A fire burning in a stone hearth hung with stockings and a garland of lights, a Christmas tree glowing beside it, and one bright star above."
      >
        <div className={styles.tree}>
          <Tree />
        </div>
        <div className={styles.fireplace}>
          <FireplaceBack />
          <span className={styles.embers} />
          <canvas
            ref={flame}
            className={styles.flame}
            data-burning={burning ? "" : undefined}
          />
          <FireplaceFront />
        </div>
        <div className={styles.floor} />
        <div className={styles.vignette} />
      </div>

      <div className={styles.words}>
        <p className={styles.eyebrow}>Go Have a Christmas</p>
        <h1 className={`ghad-display ${styles.title}`}>
          {/* Three lines in any font, so the web font arriving moves nothing. */}
          <span>Your </span>
          <span>Christmas </span>
          <span>Starts Here</span>
        </h1>
        <div className={styles.verses} data-testid="verse">
          {VERSES.map((v, i) => (
            <p
              key={v.text}
              className={styles.verse}
              data-on={i === verse ? "" : undefined}
              aria-hidden={i === verse ? undefined : true}
            >
              <span className={styles.line}>{v.text}</span>
              {v.carol && <span className={styles.carol}>{v.carol}</span>}
            </p>
          ))}
        </div>
        <p className={styles.countdown} data-testid="countdown">
          <span aria-hidden className={styles.spark}>
            ✦
          </span>{" "}
          {countdown}
        </p>
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          onClick={sound.toggle}
          aria-pressed={sound.on}
          aria-label={sound.on ? "Quiet the fire" : "Hear the fire"}
          title={sound.on ? "Quiet the fire" : "Hear the fire"}
          data-testid="hearth-sound"
        >
          {sound.on ? (
            <Volume2 className="h-4 w-4" aria-hidden />
          ) : (
            <VolumeX className="h-4 w-4" aria-hidden />
          )}
        </button>
        {!reduced && (
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-pressed={paused}
            aria-label={
              paused ? "Let the fire flicker again" : "Pause the fire and words"
            }
            title={paused ? "Let it flicker again" : "Pause"}
            data-testid="hearth-pause"
          >
            {paused ? (
              <Play className="h-4 w-4" aria-hidden />
            ) : (
              <Pause className="h-4 w-4" aria-hidden />
            )}
          </button>
        )}
      </div>

      {!still && <Festive />}
    </header>
  );
}

/** The Star of Bethlehem: four long points, the longest falling earthward. */
function Star() {
  return (
    <svg viewBox="-60 -60 120 200" className={styles.starSvg}>
      <defs>
        <radialGradient id="hh-halo">
          <stop offset="0" stopColor="#fff6dc" stopOpacity="0.9" />
          <stop offset="0.25" stopColor="#ffd98a" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hh-tail" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle className={styles.halo} r="58" fill="url(#hh-halo)" />
      <g className={styles.flare} fill="#fff3d0" opacity="0.7">
        <path
          d="M0 -16 L2.2 -2.2 L16 0 L2.2 2.2 L0 16 L-2.2 2.2 L-16 0 L-2.2 -2.2Z"
          transform="rotate(45)"
        />
      </g>
      <path
        fill="url(#hh-tail)"
        d="M0 -44 C1.6 -9 6 -2 30 0 C6 2 2 8 0 136 C-2 8 -6 2 -30 0 C-6 -2 -1.6 -9 0 -44Z"
      />
      <circle r="3.4" fill="#fff" />
    </svg>
  );
}

const TIERS: readonly [number, number, number][] = [
  [26, 150, 58],
  [86, 238, 88],
  [156, 326, 114],
  [226, 414, 136],
  [298, 478, 150],
];

/** Fairy lights on the tree, row by row, the same every render. */
const TREE_LIGHTS = Array.from({ length: 7 }, (_, row) => {
  const y = 96 + row * 56;
  const half = ((y - 26) / 452) * 132;
  const count = 2 + row;
  return Array.from({ length: count }, (_, i) => ({
    x: 150 - half + ((i + (row % 2 ? 0.75 : 0.35)) / count) * half * 2,
    y: y + ((i * 7) % 11) - 5,
    warm: (row + i) % 3 !== 0,
  }));
}).flat();

function Tree() {
  return (
    <svg viewBox="0 0 300 520" className={styles.svg}>
      <defs>
        <linearGradient id="hh-needles" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#21603f" />
          <stop offset="0.45" stopColor="#123f2b" />
          <stop offset="1" stopColor="#071d14" />
        </linearGradient>
        <radialGradient id="hh-bulb">
          <stop offset="0" stopColor="#fffbe8" />
          <stop offset="0.3" stopColor="#ffd98a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffb547" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hh-bulb-cool">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.3" stopColor="#fff1d6" stopOpacity="0.85" />
          <stop offset="1" stopColor="#fff1d6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="139" y="466" width="22" height="40" fill="#24140b" />
      {TIERS.map(([top, bottom, half]) => (
        <path
          key={top}
          fill="url(#hh-needles)"
          d={`M150 ${top} L${150 + half} ${bottom} Q150 ${bottom + 16} ${150 - half} ${bottom}Z`}
        />
      ))}
      {/* A garland of gold ribbon, wound round. */}
      <g
        fill="none"
        stroke="#e3a83b"
        strokeOpacity="0.4"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <path d="M112 150 Q160 168 196 140" />
        <path d="M86 260 Q160 286 226 248" />
        <path d="M64 370 Q160 400 248 356" />
      </g>
      <g className={styles.bulbs}>
        {TREE_LIGHTS.map((l, i) => (
          <circle
            key={i}
            cx={l.x}
            cy={l.y}
            r="7"
            fill={l.warm ? "url(#hh-bulb)" : "url(#hh-bulb-cool)"}
            style={{ animationDelay: `${(i * 0.37) % 3.1}s` }}
          />
        ))}
      </g>
      {/* Presents underneath. */}
      <rect x="44" y="470" width="62" height="44" rx="3" fill="#8e1c26" />
      <rect x="71" y="470" width="8" height="44" fill="#e3a83b" />
      <rect x="44" y="486" width="62" height="7" fill="#e3a83b" />
      <rect x="184" y="482" width="54" height="32" rx="3" fill="#efe4cf" />
      <rect x="206" y="482" width="9" height="32" fill="#1d5a3f" />
    </svg>
  );
}

/** Mantel lights: little gold points along the garland's swags. */
const MANTEL_LIGHTS = Array.from({ length: 19 }, (_, i) => {
  const x = 22 + i * 31;
  const swag = Math.sin(((x - 22) / 556) * Math.PI * 3);
  return { x, y: 74 + Math.abs(swag) * 26 };
});

function FireplaceBack() {
  return (
    <svg viewBox="0 0 600 440" className={styles.svg}>
      <defs>
        <linearGradient id="hh-stone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a1f19" />
          <stop offset="1" stopColor="#3b2a1f" />
        </linearGradient>
        <pattern
          id="hh-courses"
          width="64"
          height="32"
          patternUnits="userSpaceOnUse"
          x="38"
          y="96"
        >
          <path
            d="M0 0.5 H64 M0 16.5 H64 M0.5 0 V16 M32.5 16 V32"
            stroke="#120c08"
            strokeOpacity="0.55"
            strokeWidth="1.5"
            fill="none"
          />
        </pattern>
        <radialGradient
          id="hh-inside"
          cx="300"
          cy="420"
          r="230"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#7a3612" />
          <stop offset="0.45" stopColor="#2e1209" />
          <stop offset="1" stopColor="#120604" />
        </radialGradient>
        <radialGradient
          id="hh-lit"
          cx="300"
          cy="360"
          r="330"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#ff9a45" stopOpacity="0.55" />
          <stop offset="0.6" stopColor="#ff8a3a" stopOpacity="0.12" />
          <stop offset="1" stopColor="#ff8a3a" stopOpacity="0" />
        </radialGradient>
        <radialGradient
          id="hh-shade"
          cx="300"
          cy="380"
          r="360"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0.25" stopColor="#0a0503" stopOpacity="0" />
          <stop offset="1" stopColor="#0a0503" stopOpacity="0.55" />
        </radialGradient>
        <radialGradient id="hh-candle-glow">
          <stop offset="0" stopColor="#ffd98a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hh-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6e4122" />
          <stop offset="0.3" stopColor="#3d2313" />
          <stop offset="1" stopColor="#5a3018" />
        </linearGradient>
      </defs>
      {/* The surround: two stone legs and the lintel. */}
      <rect x="38" y="96" width="524" height="318" fill="url(#hh-stone)" />
      <rect x="38" y="96" width="524" height="318" fill="url(#hh-courses)" />
      <path
        fill="url(#hh-inside)"
        d="M136 414 V218 Q136 166 188 166 H412 Q464 166 464 218 V414Z"
      />
      <path
        fill="none"
        stroke="#4e3a2c"
        strokeWidth="6"
        d="M130 414 V216 Q130 160 186 160 H414 Q470 160 470 216 V414"
      />
      {/* Shadow everywhere the fire does not reach. */}
      <rect x="38" y="96" width="524" height="318" fill="url(#hh-shade)" />
      {[42, 478].map((x, i) => (
        <g key={x} transform={`translate(${x} 96)`}>
          <path
            fill={i ? "#184d34" : "#8a1f29"}
            d="M4 10 H54 V70 Q54 80 64 84 L76 90 Q88 97 82 108 Q75 118 60 113 L18 98 Q4 92 4 78Z"
          />
          <rect x="0" y="0" width="58" height="20" rx="5" fill="#e6dac3" />
        </g>
      ))}
      {/* Firelight on the stone, breathing with the fire. */}
      <rect
        className={styles.lit}
        x="0"
        y="60"
        width="600"
        height="380"
        fill="url(#hh-lit)"
      />
      {/* Candles on the mantel. */}
      {[86, 514].map((x) => (
        <g key={x}>
          <rect x={x - 7} y="30" width="14" height="34" rx="2" fill="#f3e9d4" />
          <ellipse
            className={styles.candle}
            cx={x}
            cy="22"
            rx="4"
            ry="9"
            fill="#ffd98a"
          />
          <circle cx={x} cy="22" r="22" fill="url(#hh-candle-glow)" />
        </g>
      ))}
      {/* The mantel shelf. */}
      <rect x="0" y="62" width="600" height="12" rx="2" fill="#7a4a27" />
      <rect x="14" y="72" width="572" height="26" fill="url(#hh-wood)" />
    </svg>
  );
}

function FireplaceFront() {
  return (
    <svg viewBox="0 0 600 440" className={styles.svg}>
      <defs>
        <linearGradient id="hh-log" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a2214" />
          <stop offset="0.6" stopColor="#24140b" />
          <stop offset="1" stopColor="#c2541c" />
        </linearGradient>
        <radialGradient id="hh-bed">
          <stop offset="0" stopColor="#ffb352" />
          <stop offset="0.5" stopColor="#e2581d" stopOpacity="0.8" />
          <stop offset="1" stopColor="#7a1f0a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hh-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a4434" />
          <stop offset="0.15" stopColor="#2f231b" />
          <stop offset="1" stopColor="#1a130e" />
        </linearGradient>
      </defs>
      <ellipse cx="300" cy="400" rx="132" ry="16" fill="url(#hh-bed)" />
      <g>
        <rect
          x="196"
          y="370"
          width="196"
          height="26"
          rx="13"
          fill="url(#hh-log)"
          transform="rotate(-7 294 383)"
        />
        <rect
          x="214"
          y="378"
          width="186"
          height="24"
          rx="12"
          fill="url(#hh-log)"
          transform="rotate(9 307 390)"
        />
        <ellipse cx="203" cy="392" rx="9" ry="11" fill="#6b3a1c" />
        <ellipse cx="396" cy="404" rx="8" ry="10" fill="#6b3a1c" />
      </g>
      {/* The grate. */}
      <g fill="#120c08">
        <rect x="190" y="402" width="220" height="7" rx="2" />
        <rect x="200" y="392" width="6" height="22" rx="2" />
        <rect x="394" y="392" width="6" height="22" rx="2" />
      </g>
      {/* The hearthstone. */}
      <rect x="0" y="412" width="600" height="28" fill="url(#hh-floor)" />
      {/* The garland along the mantel, and its lights. */}
      <path
        fill="none"
        stroke="#0e3323"
        strokeWidth="15"
        strokeLinecap="round"
        d="M18 72 Q70 104 122 72 T 226 72 T 330 72 T 434 72 T 538 72 Q560 84 584 72"
      />
      <path
        fill="none"
        stroke="#1d5a3f"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray="2 9"
        d="M18 70 Q70 102 122 70 T 226 70 T 330 70 T 434 70 T 538 70 Q560 82 584 70"
      />
      <g className={styles.bulbs}>
        {MANTEL_LIGHTS.map((l, i) => (
          <circle
            key={i}
            cx={l.x}
            cy={l.y - 4}
            r="3.2"
            fill="#ffe3a3"
            style={{ animationDelay: `${(i * 0.53) % 2.9}s` }}
          />
        ))}
      </g>
    </svg>
  );
}
