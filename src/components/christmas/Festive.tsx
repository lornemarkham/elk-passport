"use client";

import { Snowflake, Volume2, VolumeX } from "lucide-react";
import { SnowLayer } from "@/app/about/experiment-05-christmas/SnowLayer";
import { useFireplaceSound } from "@/app/about/experiment-05-christmas/useFireplaceSound";
import { cn } from "@/lib/utils";
import { useReducedMotion, useStored } from "./stored";

const SNOW_KEY = "passport.christmas.snow";

/**
 * **Snow and a fire, both optional.** The snowfall and the crackling hearth
 * are the original Christmas experiment's own (`/about/experiment-05-christmas`,
 * reused, not rewritten). Snow starts on unless the device asks for reduced
 * motion, and remembers being turned off. Sound never starts by itself.
 */
export function Festive({ className }: { readonly className?: string }) {
  const reduced = useReducedMotion();
  const [choice, setChoice] = useStored(SNOW_KEY);
  const snow = !reduced && choice !== "off";
  const fire = useFireplaceSound();
  const toggleSnow = () => setChoice(snow ? "off" : "on");

  const chip =
    "inline-flex min-h-11 items-center gap-2 rounded-full bg-white/15 px-4 text-sm font-semibold text-white backdrop-blur hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white";

  return (
    <>
      {snow && <SnowLayer />}
      <div className={cn("flex flex-wrap gap-2", className)}>
        <button
          type="button"
          onClick={toggleSnow}
          aria-pressed={snow}
          className={chip}
          data-testid="snow-toggle"
        >
          <Snowflake className="h-4 w-4" aria-hidden />
          {snow ? "Snow on" : "Let it snow"}
        </button>
        <button
          type="button"
          onClick={fire.toggle}
          aria-pressed={fire.on}
          className={chip}
          data-testid="sound-toggle"
        >
          {fire.on ? (
            <Volume2 className="h-4 w-4" aria-hidden />
          ) : (
            <VolumeX className="h-4 w-4" aria-hidden />
          )}
          {fire.on ? "Fire crackling" : "Light the fire"}
        </button>
      </div>
    </>
  );
}
