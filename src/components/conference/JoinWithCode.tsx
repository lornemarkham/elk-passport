"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { call } from "./api";
import { field, primary, Problem } from "./ui";

/** One box, one button, and a human answer when it's wrong. */
export function JoinWithCode({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initial);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setProblem(null);
        const r = await call<{ conferenceId: string }>(
          "POST",
          "/api/conferences/join",
          { code },
        );
        setBusy(false);
        if (r.ok) router.push(`/conferences/${r.conferenceId}`);
        else setProblem(r.message);
      }}
    >
      <label className="sr-only" htmlFor="conference-code">
        Conference code
      </label>
      <input
        id="conference-code"
        className={`${field} font-mono tracking-widest uppercase sm:flex-1`}
        placeholder="ABC-DEF-GHJ"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        autoComplete="off"
        autoCapitalize="characters"
      />
      <button disabled={busy || !code.trim()} className={primary}>
        Let me in
      </button>
      <div className="sm:basis-full">
        <Problem>{problem}</Problem>
      </div>
    </form>
  );
}
