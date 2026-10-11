"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

/**
 * **Leave this board.**
 *
 * Joining took a deliberate tap; leaving takes two — one to ask, one to mean
 * it — and says plainly what goes with you: your name on the member list and
 * every "I'm interested" you raised here. Days you shared stay for whoever is
 * already in on them, without your name.
 *
 * If Passport cannot actually take you off yet, it says so and leaves you
 * where you are. It never tells somebody they have left while everyone on
 * the board can still see them.
 */
export function LeaveBoard({
  boardId,
  boardName,
}: {
  readonly boardId: string;
  readonly boardName?: string;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function leave() {
    setLeaving(true);
    setProblem(null);
    try {
      const response = await fetch(
        `/api/boards/${encodeURIComponent(boardId)}/members/me`,
        { method: "DELETE" },
      );
      if (response.status === 204) {
        router.replace("/boards");
        router.refresh();
        return;
      }
      const body = await response.json().catch(() => null);
      setProblem(
        typeof body?.message === "string"
          ? body.message
          : typeof body?.error === "string"
            ? body.error
            : "Couldn't leave just now. Please try again.",
      );
    } catch {
      setProblem("Couldn't leave just now. Please try again.");
    } finally {
      setLeaving(false);
    }
  }

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-1.5 text-sm"
      >
        <LogOut className="h-4 w-4" aria-hidden />
        Leave this board
      </button>
    );
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border p-4 text-sm"
      role="group"
      aria-label="Leave this board"
    >
      <p>
        Leave {boardName ? <strong>{boardName}</strong> : "this board"}? Your
        name comes off the member list and your &ldquo;interested&rdquo; marks
        here go with you. Days you shared stay, without your name. Coming back
        needs an invite link again.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={leave}
          disabled={leaving}
          className="bg-foreground text-background min-h-11 rounded-full px-4 font-medium disabled:opacity-60"
        >
          {leaving ? "Leaving…" : "Leave"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAsking(false);
            setProblem(null);
          }}
          disabled={leaving}
          className="min-h-11 rounded-full border px-4 font-medium"
        >
          Stay
        </button>
      </div>
      {problem && (
        <p className="text-red-700" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}
