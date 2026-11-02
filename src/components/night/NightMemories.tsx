"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { shrinkPhoto } from "@/components/christmas/photo";
import type { Moment } from "@/domain/christmas/recap";

async function call(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(String(response.status));
  return response;
}

/**
 * **Memories** — photos and lines the two of you share with the adventure
 * (ADR 014: members only), through Christmas's moments route on the shared
 * core.
 */
export function NightMemories({
  adventureId,
  moments,
  sharing,
}: {
  adventureId: string;
  moments: readonly Moment[];
  sharing: boolean;
}) {
  const router = useRouter();
  const [words, setWords] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  async function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    if (!chosen) return;
    try {
      setPhoto(await shrinkPhoto(chosen));
    } catch {
      toast.error("That photo wouldn't shrink. Try another.");
    }
  }

  async function share(event: React.FormEvent) {
    event.preventDefault();
    if (!words.trim() && !photo) return;
    setBusy(true);
    try {
      await call(`/christmas/api/${adventureId}/moments`, "POST", {
        kind: "moment",
        text: words.trim() || null,
        photo,
      });
      setWords("");
      setPhoto(null);
      if (file.current) file.current.value = "";
      router.refresh();
    } catch {
      toast.error("Couldn't share that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="memories">
      {!sharing ? (
        <p className="text-muted-foreground rounded-2xl bg-black/5 p-4 text-sm">
          Sharing memories isn&apos;t switched on yet. Everything else works.
        </p>
      ) : (
        <>
          <ul className="grid gap-3">
            {moments.map((m) => (
              <li
                key={m.id}
                className="overflow-hidden rounded-3xl bg-white ring-1 ring-black/10"
              >
                {m.hasPhoto && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/christmas/api/${adventureId}/moments/${m.id}/photo`}
                    alt={m.text ?? "A shared photo"}
                    className="max-h-96 w-full object-cover"
                  />
                )}
                <div className="p-3 text-sm">
                  {m.text && <p>{m.text}</p>}
                  <p className="text-muted-foreground mt-1 text-xs">
                    {m.mine ? "You" : m.by}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <form onSubmit={share} className="mt-4 grid gap-2">
            <textarea
              value={words}
              onChange={(e) => setWords(e.target.value)}
              maxLength={600}
              rows={2}
              placeholder="A moment worth keeping"
              aria-label="A moment worth keeping"
              className="rounded-2xl border p-3 text-base"
            />
            <div className="flex gap-2">
              <label className="inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border font-bold">
                <Camera className="h-4 w-4" aria-hidden />
                {photo ? "Photo ready" : "Add a photo"}
                <input
                  ref={file}
                  type="file"
                  accept="image/*"
                  onChange={pick}
                  className="sr-only"
                />
              </label>
              <button
                disabled={busy || (!words.trim() && !photo)}
                className="min-h-12 rounded-2xl bg-[var(--n-forest)] px-5 font-bold text-white disabled:opacity-50"
              >
                Share
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
