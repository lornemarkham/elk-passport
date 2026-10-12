"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { call } from "./api";
import { Problem } from "./ui";

export function AcceptInvite({
  token,
  accent,
  ink,
}: {
  token: string;
  accent: string;
  ink: string;
}) {
  const router = useRouter();
  const here = usePathname();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <div className="mt-8">
      <button
        disabled={busy}
        style={{ background: accent, color: ink }}
        className="w-full rounded-xl px-6 py-4 text-[18px] font-extrabold disabled:opacity-50 sm:w-auto"
        onClick={async () => {
          setBusy(true);
          const r = await call<{ conferenceId: string }>(
            "POST",
            "/api/conferences/join",
            { token },
          );
          setBusy(false);
          if (r.ok) router.push(`/conferences/${r.conferenceId}`);
          else if (r.error === "signed-out")
            router.push(`/auth?next=${encodeURIComponent(here)}`);
          else setProblem(r.message);
        }}
      >
        I&apos;m in
      </button>
      <Problem>{problem}</Problem>
    </div>
  );
}
