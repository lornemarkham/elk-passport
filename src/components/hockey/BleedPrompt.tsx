"use client";

import { useSyncExternalStore } from "react";
import { NHL_TEAMS } from "@/domain/hockey/fans";
import styles from "./hockey.module.css";

const EVENT = "hockey:bleed-later";

// A few colours along the top, so it reads as hockey before it reads as a form.
const STRIPE = ["VAN", "CGY", "TOR", "EDM", "MTL"].map((abbr) =>
  NHL_TEAMS.find((t) => t.abbr === abbr)!,
);

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/**
 * **The nonblocking ask.** For anyone on the night who hasn't said who they
 * bleed for — new arrivals and everybody who joined before teams existed.
 * A card in the page, never a wall in front of it: "Not now" puts it away on
 * this device for this night, and the team can still be picked from Group or
 * the chat at any time.
 */
export function BleedPrompt({
  slug,
  onOpen,
  strip = false,
}: {
  slug: string;
  onOpen: () => void;
  /**
   * A slim bar pinned above the tab bar, for the rooms where the page's own
   * order matters (dinner leads Plan): it moves nothing on the page.
   */
  strip?: boolean;
}) {
  const key = `hockey:${slug}:bleed-later`;
  const later = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(key) === "1",
    () => true,
  );
  if (later) return null;
  const notNow = () => {
    window.localStorage.setItem(key, "1");
    window.dispatchEvent(new Event(EVENT));
  };

  if (strip) {
    return (
      <aside
        aria-label="Who do you bleed for?"
        className="fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 mx-auto flex w-[calc(100%-1.5rem)] max-w-2xl items-center gap-2 rounded-full bg-[#101826]/95 py-1 pr-1 pl-4 shadow-lg ring-1 ring-[#ffd84d]/50 backdrop-blur"
      >
        <span className="min-w-0 flex-1 truncate text-[13.5px] leading-none font-extrabold text-white">
          Who do you bleed for?
        </span>
        <button
          type="button"
          onClick={onOpen}
          aria-label="Pick my team"
          className="min-h-10 shrink-0 rounded-full bg-[#ffd84d] px-4 text-[14px] font-bold text-[#0b1220]"
        >
          Pick
        </button>
        <button
          type="button"
          onClick={notNow}
          aria-label="Not now"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[16px] text-white/70"
        >
          ✕
        </button>
      </aside>
    );
  }

  return (
    <section
      aria-labelledby="bleed-ask"
      className="relative overflow-hidden rounded-3xl bg-[#101826] px-5 py-4 ring-1 ring-[#ffd84d]/40"
    >
      <div aria-hidden className="absolute top-0 right-0 flex h-1.5 w-full">
        {STRIPE.map((t) => (
          <span
            key={t.abbr}
            className="flex-1"
            style={{ background: t.colours.primary }}
          />
        ))}
      </div>
      <h2
        id="bleed-ask"
        className={`${styles.wide} text-[24px] leading-none text-white`}
      >
        WHO DO YOU BLEED FOR?
      </h2>
      <p className="mt-1.5 text-[14.5px] text-white/70">
        Your NHL team — any of the 32, not just tonight&apos;s. It goes beside
        your name, and Chirp Bot will have opinions.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="min-h-11 rounded-full bg-[#ffd84d] px-5 text-[15px] font-bold text-[#0b1220] transition active:scale-95"
        >
          Pick my team
        </button>
        <button
          type="button"
          onClick={notNow}
          className="min-h-11 rounded-full px-4 text-[15px] text-white/70 ring-1 ring-white/20"
        >
          Not now
        </button>
      </div>
    </section>
  );
}
