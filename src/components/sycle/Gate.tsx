"use client";

import { useState } from "react";

/** The conference code. One box, one button, and a human answer when it's wrong. */
export function Gate() {
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-8 flex max-w-md flex-col gap-3 sm:flex-row"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setProblem(null);
        const r = await fetch("/api/sycle/access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        setBusy(false);
        if (r.ok) return window.location.reload();
        setProblem(
          r.status === 429
            ? "Too many tries. Have a coffee and try again in fifteen minutes."
            : "That's not the code. It's in the conference welcome email.",
        );
      }}
    >
      <input
        className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-[16px] text-white outline-none placeholder:text-white/35 focus:border-[#ffd27a]"
        placeholder="Conference code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        autoComplete="off"
        data-testid="sycle-code"
      />
      <button
        disabled={busy || !code.trim()}
        className="rounded-xl bg-[#ffd27a] px-5 py-3 font-extrabold text-black disabled:opacity-50"
      >
        Let me in
      </button>
      {problem ? (
        <p role="alert" className="text-[14px] text-[#ffb59e] sm:basis-full">
          {problem}
        </p>
      ) : null}
    </form>
  );
}
