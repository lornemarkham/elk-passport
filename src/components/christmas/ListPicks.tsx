"use client";

import Link from "next/link";
import { Gift } from "lucide-react";
import { useStash } from "./lights/stash";
import { usePicks } from "./Picks";

/**
 * **What has been added so far** — the things put on My Christmas List with the
 * "Add" button. They live on this device only, so this says how many and
 * carries them into a plan; their names and dates show on the plan page.
 */
export function ListPicks({ planHref }: { readonly planHref: string }) {
  const { picked, clearPicks } = usePicks();
  const lights = useStash();
  const total = picked.length + lights.length;
  const query = [
    picked.length ? `with=${picked.join(",")}` : "",
    lights.length ? `lights=${lights.join(",")}` : "",
  ]
    .filter(Boolean)
    .join("&");
  return (
    <div
      className="rounded-[22px] bg-white p-5 ring-1 ring-black/5"
      data-testid="list-picks"
    >
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <Gift className="h-5 w-5" aria-hidden />
        Added to My Christmas List
      </h2>
      {total === 0 ? (
        <p className="mt-2 text-base text-[var(--gh-ink-soft)]">
          Nothing added yet. Tap <strong>Add to My Christmas List</strong> on
          any event, market or light display and it waits here.{" "}
          <Link
            href="/christmas/discover"
            className="font-semibold underline underline-offset-4"
          >
            Find something
          </Link>
          .
        </p>
      ) : (
        <>
          <p className="mt-2 text-base" data-testid="list-count">
            {total} thing{total === 1 ? "" : "s"} added. They&apos;re kept on
            this device only, until you turn them into a plan.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`${planHref}${planHref.includes("?") ? "&" : "?"}${query}`}
              className="inline-flex min-h-11 items-center rounded-full bg-[#b3242f] px-5 font-bold text-white"
              data-testid="list-plan"
            >
              Plan these
            </Link>
            <button
              type="button"
              onClick={clearPicks}
              className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold underline underline-offset-4"
            >
              Clear
            </button>
          </div>
        </>
      )}
    </div>
  );
}
