"use client";

import { useEffect, useState } from "react";
import {
  categoryLabel,
  experienceLabel,
  type ContributorView,
} from "@/domain/contributions/model";
import type { Progress } from "@/domain/contributions/milestones";
import { deviceToken } from "./device";
import { Milestones } from "./SuggestSomething";

const STATUS: Record<ContributorView["status"], string> = {
  pending: "Waiting for review",
  approved: "Approved",
  declined: "Not used",
};

/** This person's progress and their recent suggestions, read from the server. */
export function MyContributions() {
  const [data, setData] = useState<{
    progress: Progress;
    recognisedBy: "account" | "device" | "address";
    mine: ContributorView[];
  } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch(`/api/contributions/mine?device=${encodeURIComponent(deviceToken())}`)
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
      )
      .then(setData)
      .catch(() => setFailed(true));
  }, []);
  if (failed)
    return (
      <p className="text-sm text-black/60" data-testid="mine-unavailable">
        Your progress isn&apos;t available right now.
      </p>
    );
  if (!data)
    return <p className="text-sm text-black/60">Loading your progress…</p>;
  return (
    <div className="space-y-3" data-testid="my-contributions">
      <Milestones progress={data.progress} recognisedBy={data.recognisedBy} />
      {data.mine.length > 0 && (
        <ul className="divide-y divide-black/10 rounded-2xl bg-white ring-1 ring-black/10">
          {data.mine.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
            >
              <span>
                <strong>{s.name}</strong>
                <span className="text-black/55">
                  {" "}
                  · {categoryLabel(s.category)} ·{" "}
                  {experienceLabel(s.experience)}
                </span>
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                  s.status === "approved"
                    ? "bg-[#e8f3ec] text-[#0f3b2b]"
                    : s.status === "pending"
                      ? "bg-[#f7e3e1] text-[#b3242f]"
                      : "bg-black/5 text-black/55"
                }`}
              >
                {STATUS[s.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
