"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * **One way every control on an adventure talks to the server**: send,
 * say what went wrong in words, refresh the page from the database. The
 * database decides what anyone may do (RLS); this only asks.
 */
export function useAdventure(adventureId: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const base = `/api/adventures/${adventureId}`;

  const call = useCallback(
    async <T = unknown>(path: string, method: string, body?: unknown) => {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = (await response.json().catch(() => ({}))) as T & {
        error?: string;
      };
      if (!response.ok && !(json as { kind?: string }).kind) {
        throw new Error(
          response.status === 503
            ? "Adventures can't be reached right now."
            : (json.error ?? "That didn't work."),
        );
      }
      return json as T;
    },
    [base],
  );

  /** Do something, then show the adventure as the database now has it. */
  const act = useCallback(
    async (work: () => Promise<unknown>, done?: string) => {
      setBusy(true);
      try {
        await work();
        if (done) toast.success(done);
        router.refresh();
        return true;
      } catch (error) {
        toast.error((error as Error).message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  return { call, act, busy };
}
