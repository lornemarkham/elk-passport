import { countdown, type Countdown } from "@/domain/hockey/countdown";
import { groupCeiling } from "./ability";
import type { Person, SnowDay } from "./day";

/**
 * **Getting ready is part of the day.**
 *
 * The countdown is Hockey Night's (`domain/hockey/countdown.ts`), reused as
 * is. What is Snow's own is the gear list and the reminders that arrive as
 * the day gets closer — a handful, each one earning its place, and none of
 * them an AI nudge. Reminders are *shown when the person opens the day*;
 * nothing here sends a notification.
 */
export interface GearItem {
  readonly id: string;
  readonly label: string;
  readonly why: string;
  /** Items a rider needs; an après-only guest skips these. */
  readonly rider?: "ski" | "snowboard";
  /** Anyone who owns no gear is told to arrange it. */
  readonly rentable?: boolean;
}

export const GEAR: readonly GearItem[] = [
  {
    id: "helmet",
    label: "Helmet",
    why: "Worn on the hill, every run.",
    rentable: true,
  },
  {
    id: "goggles",
    label: "Goggles",
    why: "Flat light and wind are the real hazards.",
    rentable: true,
  },
  {
    id: "skis",
    label: "Skis, boots and poles",
    why: "Your own or rented.",
    rider: "ski",
    rentable: true,
  },
  {
    id: "board",
    label: "Board and boots",
    why: "Your own or rented.",
    rider: "snowboard",
    rentable: true,
  },
  {
    id: "layers",
    label: "Warm base layer + waterproof shell",
    why: "Cotton is cold and wet; wear layers you can shed.",
  },
  {
    id: "gloves",
    label: "Waterproof gloves or mittens",
    why: "Pack a spare pair.",
  },
  {
    id: "sun",
    label: "Sunscreen + lip balm",
    why: "Snow reflects sun back at you.",
  },
  {
    id: "ticket",
    label: "Lift ticket or pass",
    why: "Bought or collected before you reach the lift.",
  },
  { id: "water", label: "Water + a snack", why: "Tired riders get sloppy." },
  {
    id: "phone",
    label: "Phone charged, trail map saved",
    why: "Cold drains batteries and signal can vanish on the hill.",
  },
  {
    id: "cash",
    label: "Card + a little cash",
    why: "Parking and lodge counters.",
  },
  {
    id: "dry",
    label: "Dry clothes for the drive home",
    why: "The best part of après.",
  },
];

/** Gear a particular person should be thinking about. */
export function gearFor(person: Person): readonly GearItem[] {
  if (person.discipline === "apres")
    return GEAR.filter(
      (g) => !g.rider && !["helmet", "goggles"].includes(g.id),
    );
  return GEAR.filter((g) => !g.rider || g.rider === person.discipline);
}

export interface Reminder {
  readonly id: string;
  readonly text: string;
}

/**
 * What to remember at this distance from the day. `daysOut` is whole days
 * (negative once it has started). Cumulative where it should be: a week out
 * the crew still needs the day-of reminders when they get there.
 */
export function reminders(
  day: SnowDay,
  daysOut: number | undefined,
): Reminder[] {
  const out: Reminder[] = [];
  const renters = day.people.filter(
    (p) => p.discipline !== "apres" && !p.ownGear,
  );
  const ceiling = groupCeiling(day.people);
  if (daysOut === undefined) {
    out.push({
      id: "pick-date",
      text: "Pick a date and the crew can start counting down.",
    });
  } else if (daysOut >= 5) {
    if (renters.length)
      out.push({
        id: "rentals",
        text: `Sort rentals for ${renters.map((r) => r.name).join(", ")} — popular times fill up.`,
      });
    if (ceiling === "first-timer" || ceiling === "beginner")
      out.push({
        id: "lesson",
        text: "Someone is new to this: look into a lesson with the resort.",
      });
    out.push({ id: "tickets", text: "Settle how everyone gets lift access." });
  } else if (daysOut >= 2) {
    out.push({
      id: "gear-check",
      text: "Check your gear list — helmet, goggles, layers.",
    });
    out.push({
      id: "ride-plan",
      text: "Lock who drives and where you leave from.",
    });
  } else if (daysOut >= 0) {
    out.push({
      id: "conditions",
      text: "Check the resort's own snow report and lift status — Passport doesn't know them.",
    });
    out.push({
      id: "charge",
      text: "Charge your phone and save the trail map.",
    });
    out.push({
      id: "roads",
      text: "Check road conditions and whether chains or winter tires are required.",
    });
  }
  return out;
}

export type Phase = "planning" | "soon" | "day" | "after";

/** Where the crew is on the journey. Days are compared as local calendar days. */
export function phaseOf(date: string | undefined, today: string): Phase {
  if (!date) return "planning";
  if (date < today) return "after";
  if (date === today) return "day";
  return daysBetween(today, date) <= 7 ? "soon" : "planning";
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T12:00:00Z`);
  const b = Date.parse(`${to}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Countdown to the meeting time (or 8:30 if none), as the day starts locally. */
export function countdownToDay(now: Date, day: SnowDay): Countdown | undefined {
  if (!day.date) return undefined;
  const at = new Date(`${day.date}T${day.meetTime ?? "08:30"}:00`);
  return Number.isNaN(at.getTime()) ? undefined : countdown(now, at);
}

export function packedCount(day: SnowDay, person: Person) {
  const items = gearFor(person);
  return {
    done: items.filter((g) => day.packed.includes(`${person.id}:${g.id}`))
      .length,
    total: items.length,
  };
}
