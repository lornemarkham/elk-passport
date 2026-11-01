"use client";

import { createContext, useContext } from "react";

/**
 * **What this group calls its trophy.** The Sycle Cup for the nights that
 * started it all; whatever a host engraved for any other run
 * (`night.ts cupNameOf`). One context, so the trophy, the board, the
 * champion card and the shelf all say the same name without every
 * component being handed it.
 */
const CupNameContext = createContext<string>("Sycle Cup");

export const CupNameProvider = CupNameContext.Provider;

export function useCupName(): string {
  return useContext(CupNameContext);
}

/** "SYCLE" from "Sycle Cup"; "OFFICE" from "The Office Cup" — what the trophy is engraved with. */
export function engravingOf(cupName: string): string {
  const words = cupName
    .replace(/\bcup\b/gi, "")
    .replace(/^\s*the\s+/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const word = words.at(-1) ?? "CUP";
  return word.slice(0, 9).toUpperCase();
}
