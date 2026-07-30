import type { ExperienceDefinition } from "./types";

/**
 * Five characters, one engine. Every number below is a deliberate creative
 * choice, not a placeholder — this is the actual performance direction for
 * each experience, expressed as trait values instead of animation code.
 */
export const EXPERIENCES: ExperienceDefinition[] = [
  {
    identity: {
      id: "campfire",
      emoji: "🔥",
      title: "Campfire",
      futureMemory: "The night nobody wanted to leave.",
      hue: {
        glow: "255, 150, 70",
        glowSoft: "255, 190, 120",
        accent: "255, 214, 160",
      },
      material: {
        color: "255, 214, 160",
        colorSoft: "255, 150, 70",
        direction: "rise",
        spread: 0.3,
      },
      physics: "floaty",
    },
    // Warm, patient, gently irregular. Notices you, doesn't chase you.
    personality: {
      warmth: 90,
      curiosity: 45,
      energy: 35,
      playfulness: 40,
      chaos: 60,
      gravity: 30,
      attention: 50,
      rhythm: 35,
      mystery: 50,
    },
  },
  {
    identity: {
      id: "helicopter",
      emoji: "🚁",
      title: "Helicopter",
      futureMemory: "Wheels up before you'd even said yes.",
      hue: {
        glow: "150, 165, 180",
        glowSoft: "210, 60, 50",
        accent: "230, 230, 235",
      },
      material: {
        color: "180, 170, 150",
        colorSoft: "120, 110, 95",
        direction: "outward",
        spread: 0.15,
      },
      physics: "rigid",
      signature: "helicopter-beacon",
    },
    // Cold, precise, locks on fast, heavy machine, no patience for stillness.
    personality: {
      warmth: 10,
      curiosity: 75,
      energy: 88,
      playfulness: 15,
      chaos: 15,
      gravity: 85,
      attention: 90,
      rhythm: 92,
      mystery: 12,
    },
  },
  {
    identity: {
      id: "sauna",
      emoji: "🧖",
      title: "Sauna",
      futureMemory: "The silence you didn't know you needed.",
      hue: {
        glow: "255, 240, 225",
        glowSoft: "255, 250, 245",
        accent: "255, 245, 235",
      },
      material: {
        color: "255, 250, 245",
        colorSoft: "255, 240, 225",
        direction: "rise",
        spread: 1.1,
      },
      physics: "floaty",
      signature: "sauna-haze",
    },
    // Warm, still, meditative. Barely notices you and settles like a held breath.
    personality: {
      warmth: 78,
      curiosity: 15,
      energy: 12,
      playfulness: 8,
      chaos: 12,
      gravity: 18,
      attention: 18,
      rhythm: 8,
      mystery: 28,
    },
  },
  {
    identity: {
      id: "dirtbike",
      emoji: "🏍",
      title: "Dirt Bike",
      futureMemory: "Mud in your teeth and a grin you can't undo.",
      hue: {
        glow: "200, 120, 60",
        glowSoft: "160, 100, 60",
        accent: "230, 180, 120",
      },
      material: {
        color: "175, 130, 80",
        colorSoft: "140, 100, 60",
        direction: "fall",
        spread: 0.6,
      },
      physics: "agile",
    },
    // Kinetic, eager, chaotic, rewards being thrown around.
    personality: {
      warmth: 25,
      curiosity: 60,
      energy: 82,
      playfulness: 92,
      chaos: 85,
      gravity: 50,
      attention: 65,
      rhythm: 70,
      mystery: 55,
    },
  },
  {
    identity: {
      id: "wine",
      emoji: "🍷",
      title: "Wine",
      futureMemory: "The conversation that ran an hour past the bottle.",
      hue: {
        glow: "120, 20, 40",
        glowSoft: "170, 40, 60",
        accent: "220, 90, 100",
      },
      material: {
        color: "230, 180, 190",
        colorSoft: "170, 40, 60",
        direction: "static",
        spread: 0.2,
      },
      physics: "liquid",
      signature: "wine-swirl",
    },
    // Composed, unhurried, sensual — dignified acknowledgment, liquid weight, rare shimmer.
    personality: {
      warmth: 45,
      curiosity: 30,
      energy: 18,
      playfulness: 18,
      chaos: 22,
      gravity: 68,
      attention: 28,
      rhythm: 20,
      mystery: 65,
    },
  },
];
