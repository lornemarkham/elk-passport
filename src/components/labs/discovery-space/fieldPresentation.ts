import type { Experience as DomainExperience } from "@/domain/experience/types";
import type {
  FieldExperience,
  FieldLayout,
  LifeType,
  TemptationKind,
} from "./types";

/**
 * Everything about a card that is presentation, not domain data: hand-
 * scattered position, idle "sign of life" personality, which Peripheral
 * Temptation (if any) it supports, its living-video source (if any), and
 * its aura color. None of this belongs in the canonical `Experience` model
 * (IMP-002 §5 — "avoid embedding UI layout or animation coordinates in the
 * domain model"), so it's kept here, keyed by experience id, entirely
 * separate from filtering.
 */
export interface FieldPresentation {
  glow: string;
  life: LifeType;
  temptation?: TemptationKind;
  video?: string;
  layout: FieldLayout;
}

/**
 * Hand-scattered so the field reads as organic rather than gridded, and
 * stays clear of the pinned Mood Board on the right ~30% of the viewport.
 * Glow tones are deliberately muted — a single soft light source per card,
 * not a saturated gradient badge.
 */
export const FIELD_PRESENTATION: Record<string, FieldPresentation> = {
  campfire: {
    glow: "from-amber-200/14 to-transparent",
    life: "ember",
    temptation: "ember",
    video: "/video/discovery/campfire-summer.mp4",
    layout: {
      top: 8,
      left: 12,
      size: 190,
      rotate: -3,
      depth: 0.85,
      duration: 23,
      delay: 0,
      driftX: 10,
      driftY: 8,
    },
  },
  "wake-boat": {
    glow: "from-slate-300/14 to-transparent",
    life: "shimmer",
    layout: {
      top: 22,
      left: 42,
      size: 210,
      rotate: 2,
      depth: 0.5,
      duration: 28,
      delay: 1.2,
      driftX: 14,
      driftY: 10,
    },
  },
  "helicopter-tour": {
    glow: "from-slate-300/14 to-transparent",
    life: "still",
    temptation: "glint",
    layout: {
      top: 4,
      left: 54,
      size: 170,
      rotate: -2,
      depth: 0.35,
      duration: 32,
      delay: 2.4,
      driftX: 8,
      driftY: 14,
    },
  },
  "hidden-beach": {
    glow: "from-teal-200/14 to-transparent",
    life: "whisper",
    temptation: "ripple",
    layout: {
      top: 34,
      left: 6,
      size: 230,
      rotate: 3,
      depth: 0.95,
      duration: 21,
      delay: 0.6,
      driftX: 12,
      driftY: 9,
    },
  },
  "bbq-feast": {
    glow: "from-amber-200/14 to-transparent",
    life: "ember",
    video: "/video/discovery/steak-summer.mp4",
    layout: {
      top: 15,
      left: 30,
      size: 150,
      rotate: -4,
      depth: 0.4,
      duration: 30,
      delay: 3.1,
      driftX: 9,
      driftY: 12,
    },
  },
  stargazing: {
    glow: "from-violet-200/14 to-transparent",
    life: "shimmer",
    temptation: "shooting-star",
    layout: {
      top: 62,
      left: 18,
      size: 220,
      rotate: 2,
      depth: 0.9,
      duration: 25,
      delay: 1.8,
      driftX: 11,
      driftY: 15,
    },
  },
  "spa-escape": {
    glow: "from-yellow-100/14 to-transparent",
    life: "breathing",
    temptation: "steam",
    layout: {
      top: 48,
      left: 48,
      size: 180,
      rotate: -2,
      depth: 0.55,
      duration: 29,
      delay: 0.3,
      driftX: 13,
      driftY: 8,
    },
  },
  winery: {
    glow: "from-violet-200/14 to-transparent",
    life: "still",
    video: "/video/discovery/winery-summer.mp4",
    layout: {
      top: 72,
      left: 40,
      size: 200,
      rotate: 3,
      depth: 0.7,
      duration: 24,
      delay: 2.9,
      driftX: 10,
      driftY: 11,
    },
  },
  coffee: {
    glow: "from-amber-100/16 to-transparent",
    life: "still",
    temptation: "steam",
    layout: {
      top: 5,
      left: 24,
      size: 130,
      rotate: -1,
      depth: 0.3,
      duration: 34,
      delay: 4.2,
      driftX: 7,
      driftY: 10,
    },
  },
  "paddle-board": {
    glow: "from-teal-200/14 to-transparent",
    life: "still",
    temptation: "ripple",
    video: "/video/discovery/paddle-board-summer.mp4",
    layout: {
      top: 40,
      left: 55,
      size: 160,
      rotate: -3,
      depth: 0.45,
      duration: 31,
      delay: 1.1,
      driftX: 12,
      driftY: 9,
    },
  },
  snowmobile: {
    glow: "from-slate-300/14 to-transparent",
    life: "still",
    layout: {
      top: 78,
      left: 8,
      size: 200,
      rotate: 2,
      depth: 0.65,
      duration: 26,
      delay: 3.5,
      driftX: 9,
      driftY: 13,
    },
  },
  "chef-dinner": {
    glow: "from-amber-200/14 to-transparent",
    life: "whisper",
    layout: {
      top: 58,
      left: 30,
      size: 175,
      rotate: -2,
      depth: 0.6,
      duration: 28,
      delay: 0.9,
      driftX: 8,
      driftY: 10,
    },
  },
  cabin: {
    glow: "from-emerald-200/12 to-transparent",
    life: "still",
    temptation: "window-glow",
    layout: {
      top: 78,
      left: 26,
      size: 210,
      rotate: 1,
      depth: 0.8,
      duration: 22,
      delay: 2.1,
      driftX: 14,
      driftY: 7,
    },
  },
  "mountain-bike": {
    glow: "from-emerald-200/12 to-transparent",
    life: "still",
    video: "/video/discovery/mountain-biking-summer.mp4",
    layout: {
      top: 28,
      left: 20,
      size: 165,
      rotate: -4,
      depth: 0.5,
      duration: 30,
      delay: 4.8,
      driftX: 10,
      driftY: 12,
    },
  },
  "fire-lookout": {
    glow: "from-amber-200/14 to-transparent",
    life: "ember",
    layout: {
      top: 12,
      left: 46,
      size: 145,
      rotate: 4,
      depth: 0.3,
      duration: 33,
      delay: 1.6,
      driftX: 6,
      driftY: 14,
    },
  },
  "ice-fishing": {
    glow: "from-slate-300/14 to-transparent",
    life: "whisper",
    layout: {
      top: 66,
      left: 52,
      size: 155,
      rotate: -2,
      depth: 0.4,
      duration: 29,
      delay: 3.9,
      driftX: 9,
      driftY: 8,
    },
  },
  "lake-cruise": {
    glow: "from-teal-200/14 to-transparent",
    life: "shimmer",
    layout: {
      top: 50,
      left: 6,
      size: 195,
      rotate: 2,
      depth: 0.75,
      duration: 23,
      delay: 0.4,
      driftX: 12,
      driftY: 10,
    },
  },
  "hot-springs": {
    glow: "from-violet-200/14 to-transparent",
    life: "breathing",
    layout: {
      top: 80,
      left: 46,
      size: 185,
      rotate: -3,
      depth: 0.55,
      duration: 31,
      delay: 2.6,
      driftX: 11,
      driftY: 9,
    },
  },
  "live-music": {
    glow: "from-violet-200/14 to-transparent",
    life: "whisper",
    layout: {
      top: 36,
      left: 34,
      size: 140,
      rotate: 4,
      depth: 0.35,
      duration: 32,
      delay: 5.2,
      driftX: 7,
      driftY: 13,
    },
  },
  "sunset-dock": {
    glow: "from-yellow-100/14 to-transparent",
    life: "breathing",
    layout: {
      top: 76,
      left: 14,
      size: 205,
      rotate: -1,
      depth: 0.85,
      duration: 25,
      delay: 1.4,
      driftX: 13,
      driftY: 11,
    },
  },
};

/**
 * Combines a filtered canonical `Experience` with its field presentation
 * to produce what `DiscoveryCard` already knows how to render. Returns
 * `null` for an experience with no presentation entry — it has nowhere to
 * sit in this particular spatial field, which is expected: layout is a
 * Discovery-Space-specific concern, not every consumer of the canonical
 * model needs one.
 */
export function toFieldExperience(
  experience: DomainExperience,
): FieldExperience | null {
  const presentation = FIELD_PRESENTATION[experience.id];
  if (!presentation) return null;

  return {
    id: experience.id,
    name: experience.title,
    tagline: experience.shortDescription,
    glow: presentation.glow,
    life: presentation.life,
    temptation: presentation.temptation,
    video: presentation.video,
    layout: presentation.layout,
  };
}
