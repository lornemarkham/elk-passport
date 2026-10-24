import {
  Coffee,
  GraduationCap,
  PartyPopper,
  Plane,
  Presentation,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import type { AgendaKind } from "@/domain/conference/types";

/**
 * **How each kind of agenda line looks.** Sessions: clean and confident.
 * Skills: the same, with their own mark. Breaks: small and quiet. Meals:
 * warm. Social: a little playful. The celebration: the evening of the week.
 * Travel: a dashed send-off. The kind comes from the organiser's agenda,
 * never from a title.
 */
export interface KindLook {
  readonly label: string;
  readonly Icon: LucideIcon;
  /** The card, when it isn't on now. */
  readonly card: string;
  /** The eyebrow's colour on that card. */
  readonly eyebrow: string;
  /** The dot on the timeline's rule. */
  readonly dot: string;
  /** A one-line row instead of a card. */
  readonly compact?: boolean;
}

export const KIND_LOOK: Record<AgendaKind, KindLook> = {
  session: {
    label: "General session",
    Icon: Presentation,
    card: "border border-cf-line bg-white",
    eyebrow: "text-cf-slate",
    dot: "bg-cf-ink",
  },
  skills: {
    label: "Skills session",
    Icon: GraduationCap,
    card: "border border-cf-line bg-white",
    eyebrow: "text-[#36557a]",
    dot: "bg-[#36557a]",
  },
  break: {
    label: "Break",
    Icon: Coffee,
    card: "border border-transparent bg-transparent",
    eyebrow: "text-cf-mist",
    dot: "bg-cf-line",
    compact: true,
  },
  meal: {
    label: "Meal",
    Icon: UtensilsCrossed,
    card: "border border-[#ecdcc4] bg-[#fbf4ea]",
    eyebrow: "text-[#8a5a2b]",
    dot: "bg-[#c08a4f]",
  },
  social: {
    label: "Social",
    Icon: PartyPopper,
    card: "border border-[#cfe3d6] bg-[#f1f8f3]",
    eyebrow: "text-cf-sage",
    dot: "bg-cf-sage",
  },
  celebration: {
    label: "The celebration",
    Icon: Sparkles,
    card: "cf-gala border border-[#a5814a]/60 text-white",
    eyebrow: "text-[#e2cc9f]",
    dot: "bg-cf-brass",
  },
  travel: {
    label: "Travel",
    Icon: Plane,
    card: "border border-dashed border-cf-line bg-white/60",
    eyebrow: "text-cf-slate",
    dot: "bg-cf-mist",
  },
};

export const lookFor = (kind: AgendaKind | undefined) =>
  KIND_LOOK[kind ?? "session"];
