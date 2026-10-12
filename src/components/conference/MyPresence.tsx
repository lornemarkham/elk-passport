"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ConferenceViewer } from "@/domain/conference/contracts";
import { call } from "./api";
import { field, Problem, secondary } from "./ui";

/**
 * **How you appear here, and to whom.** Hidden is the default and the first
 * option. Leaving is on the same card, not buried, because "participants
 * control what they share" includes sharing nothing at all.
 */
export function MyPresence({
  conferenceId,
  you,
  people,
}: {
  conferenceId: string;
  you: ConferenceViewer;
  /** "colleagues", "guests"… */
  people: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(you.displayName ?? "");
  const [visibility, setVisibility] = useState(you.visibility);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty =
    name.trim() !== (you.displayName ?? "") || visibility !== you.visibility;

  return (
    <div className="rounded-2xl border border-black/10 p-4">
      <label className="block text-[14px] font-semibold text-black/70">
        Your name here
        <input
          className={`${field} mt-1`}
          value={name}
          maxLength={40}
          placeholder="What people call you"
          onChange={(e) => {
            setSaved(false);
            setName(e.target.value);
          }}
        />
      </label>
      <fieldset className="mt-4 flex flex-col gap-2 text-[15px]">
        <legend className="sr-only">Who can see you</legend>
        {(
          [
            ["hidden", `Just me. Other ${people} don't see I'm here.`],
            ["members", `Show my name to other ${people}.`],
          ] as const
        ).map(([value, words]) => (
          <label key={value} className="flex items-center gap-3">
            <input
              type="radio"
              name="visibility"
              className="h-5 w-5"
              checked={visibility === value}
              onChange={() => {
                setSaved(false);
                setVisibility(value);
              }}
            />
            {words}
          </label>
        ))}
      </fieldset>
      <p className="mt-2 text-[13px] text-black/45">
        Organisers can always see who has joined, so they can look after the
        list.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          className={secondary}
          disabled={busy || !dirty}
          onClick={async () => {
            setBusy(true);
            setProblem(null);
            const r = await call(
              "PATCH",
              `/api/conferences/${conferenceId}/me`,
              {
                displayName: name,
                visibility,
              },
            );
            setBusy(false);
            if (!r.ok) return setProblem(r.issues?.[0]?.message ?? r.message);
            setSaved(true);
            router.refresh();
          }}
        >
          Save
        </button>
        {saved ? (
          <span className="text-[14px] text-black/55">Saved.</span>
        ) : null}
        <button
          className="ml-auto text-[14px] text-black/50 underline"
          disabled={busy}
          onClick={async () => {
            if (!window.confirm("Leave, and remove everything about you here?"))
              return;
            const r = await call(
              "DELETE",
              `/api/conferences/${conferenceId}/me`,
            );
            if (!r.ok) return setProblem(r.message);
            router.push("/conferences");
          }}
        >
          Leave and forget me
        </button>
      </div>
      <Problem>{problem}</Problem>
    </div>
  );
}
