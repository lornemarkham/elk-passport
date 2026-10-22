"use client";

import { Check } from "lucide-react";
import { SectionHead, Surface } from "@/experience-lab/ui/atoms";
import { MODULES, type ModuleId } from "@/domain/hockey/modules";
import type { SharedNight } from "./useSharedNight";

/**
 * **What's in tonight — a row per module, tap to leave one out.**
 *
 * The same list on the start form and, for the host, on the night itself.
 * Who's in, the conversation and the Cup are not on it: they are the night.
 */
export function ModuleToggles({
  on,
  onChange,
  disabled,
}: {
  on: readonly ModuleId[];
  onChange: (next: ModuleId[]) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="What's in tonight"
      className="flex flex-col gap-1.5"
    >
      {MODULES.map((m) => {
        const checked = on.includes(m.id);
        return (
          <button
            key={m.id}
            type="button"
            role="checkbox"
            aria-checked={checked}
            disabled={disabled}
            onClick={() =>
              onChange(
                checked
                  ? on.filter((id) => id !== m.id)
                  : MODULES.map((x) => x.id).filter(
                      (id) => id === m.id || on.includes(id),
                    ),
              )
            }
            className={`flex min-h-12 w-full items-center gap-3 rounded-2xl border px-3.5 py-2 text-left transition disabled:opacity-50 ${checked ? "border-white/35 bg-white/[0.06]" : "border-white/10"}`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checked ? "border-white bg-white text-black" : "border-white/30"}`}
            >
              {checked && <Check className="h-3.5 w-3.5" />}
            </span>
            <span className="min-w-0">
              <span
                className={`block text-[14.5px] font-medium ${checked ? "text-white" : "text-white/50"}`}
              >
                {m.label}
              </span>
              <span className="block text-[13.5px] text-white/60">
                {m.detail}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The host's settings for a night already under way. */
export function TonightSettings({ night }: { night: SharedNight }) {
  if (night.role !== "host") return null;
  return (
    <section aria-label="What's in tonight">
      <SectionHead
        title="What's in tonight"
        subtitle="Only you can change this. Leaving something out hides it for everybody; nobody's answers are thrown away."
      />
      <Surface>
        <ModuleToggles on={night.modules} onChange={night.setModules} />
      </Surface>
    </section>
  );
}
