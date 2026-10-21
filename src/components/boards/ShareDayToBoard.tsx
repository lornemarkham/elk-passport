"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { ShareDayForm } from "./SharedPlans";

/**
 * **"Share this day with…" — for `/go`, beside *Print our adventure*.**
 *
 * Not mounted by this lane: `/go` belongs to Go Have A Day. It is built here
 * so the integration is one line — `<ShareDayToBoard link={printHref} />` —
 * and nothing about boards leaks into the day builder.
 *
 * Lists the boards this person may add to (owned, or shared with them to
 * edit). Signed out, or with no such board, it says how to get one rather
 * than showing an empty picker.
 */
interface Choice {
  readonly id: string;
  readonly name: string;
}

type State =
  | { readonly kind: "loading" }
  | { readonly kind: "signed-out" }
  | { readonly kind: "failed" }
  | { readonly kind: "ready"; readonly boards: readonly Choice[] };

export function ShareDayToBoard({ link }: { readonly link: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [boardId, setBoardId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/boards");
        if (response.status === 401) {
          if (!cancelled) setState({ kind: "signed-out" });
          return;
        }
        if (!response.ok) throw new Error(String(response.status));
        const all: { id: string; name: string; role: string }[] =
          await response.json();
        const boards = all
          .filter((b) => b.role !== "viewer")
          .map(({ id, name }) => ({ id, name }));
        if (!cancelled) {
          setState({ kind: "ready", boards });
          setBoardId(boards[0]?.id ?? "");
        }
      } catch {
        if (!cancelled) setState({ kind: "failed" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "loading" || state.kind === "failed") return null;

  if (state.kind === "signed-out") {
    return (
      <p className="text-sm text-black/55">
        <Link className="underline" href="/auth?next=/go">
          Sign in
        </Link>{" "}
        to share this day with a board.
      </p>
    );
  }

  if (state.boards.length === 0) {
    return (
      <p className="text-sm text-black/55">
        <Users className="mr-1 inline h-4 w-4" aria-hidden />
        Make a board, or join one somebody shares with you, to share days with
        other people.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-black/55">Share with</span>
        <select
          value={boardId}
          onChange={(e) => setBoardId(e.target.value)}
          className="min-h-11 rounded-lg border px-3"
        >
          {state.boards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      {boardId && <ShareDayForm key={boardId} boardId={boardId} link={link} />}
    </div>
  );
}
