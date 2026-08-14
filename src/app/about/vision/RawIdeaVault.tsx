"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Collapsed by default — this is a notebook, not a section meant to be
 * read top to bottom on every visit. Deliberately no styling to make any
 * one entry look more finished than another: same size, same weight,
 * quotes and half-thoughts and shot lists sitting next to each other
 * exactly as raw as they arrived. Add to `RAW_IDEA_VAULT` in
 * `content.ts`, nothing here needs to change.
 */
export function RawIdeaVault({ entries }: { entries: readonly string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-current/10 pt-8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <span className="font-heading text-2xl md:text-3xl">
          Raw Idea Vault
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <p className="mt-2 text-sm opacity-50">
        Unpolished on purpose. Quotes, fragments, shot lists, strange thoughts —
        nothing here has been cleaned up.
      </p>

      {open && (
        <div className="mt-8 flex flex-col gap-4">
          {entries.map((entry) => (
            <p
              key={entry}
              className="border-l-2 border-current/15 pl-4 text-base leading-relaxed opacity-75"
            >
              {entry}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
