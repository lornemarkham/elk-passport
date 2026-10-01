"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { OctoberPlace } from "@/domain/environment/places";

/**
 * One tap per town. No form, no save button, no dropdown.
 *
 * Writes to `passport_profiles.home_area` through the route Account already
 * uses — one place stores this, and it is the field that has existed since the
 * profile did.
 */
export function AreaPicker({
  places,
  current,
}: {
  readonly places: readonly OctoberPlace[];
  readonly current: string | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);
  const [chosen, setChosen] = useState(current);

  async function choose(place: OctoberPlace) {
    setSaving(place.id);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeArea: place.name }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setChosen(place.name);
      router.refresh();
    } catch {
      // Said, not swallowed: a failed save that looked like a success would
      // send somebody back to a product quietly using the wrong town.
      toast.error("Couldn't save that area.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <ul data-testid="area-picker" className="mt-8 flex flex-wrap gap-2">
      {places.map((place) => {
        const on = chosen === place.name;
        return (
          <li key={place.id}>
            <button
              type="button"
              data-testid={`area-${place.id}`}
              aria-pressed={on}
              disabled={saving !== null}
              onClick={() => void choose(place)}
              className={`min-h-11 rounded-full border px-4 text-sm transition-colors disabled:opacity-50 ${
                on
                  ? "border-[#d09a4e]/60 bg-[#d09a4e]/15 text-[#f3efe4]"
                  : "border-[#e9e6da]/12 text-[#e9e6da]/60 hover:border-[#e9e6da]/30 hover:text-[#e9e6da]/90"
              }`}
            >
              {place.name.replace(/,\s*BC$/i, "")}
              {saving === place.id ? " …" : ""}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
