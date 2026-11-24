"use client";

import Link from "next/link";
import { Gift, X } from "lucide-react";
import type { SavedFind } from "@/domain/christmas/saved";
import { toggleStash, useStash } from "./lights/stash";
import { useAddedNames } from "./names";
import { usePicks } from "./Picks";

/**
 * **What is on My Christmas List** — one list from two places that used to be
 * two: the Christmas things the person **saved** (Passport's Saved, read on
 * the server with their own session, so on every device they sign in on) and
 * the things **added** with the "Add" button or the lights map (this device
 * only, until they become a plan). A thing both saved and added counts once.
 *
 * Saved things whose dates have gone stay on the list, apart and labelled —
 * wanting them is still true — but they are not carried into a plan.
 */
export function ListPicks({
  planHref,
  saved,
  signedIn,
  readFailed = false,
}: {
  readonly planHref: string;
  readonly saved: readonly SavedFind[];
  readonly signedIn: boolean;
  /** Saved could not be read just now: say so rather than show it empty. */
  readonly readFailed?: boolean;
}) {
  const { picked, clearPicks, togglePick } = usePicks();
  const lights = useStash();
  const names = useAddedNames();
  const live = saved.filter((s) => !s.over);
  const over = saved.filter((s) => s.over);
  const savedIds = new Set(saved.map((s) => s.id));
  const deviceOnly = picked.filter((id) => !savedIds.has(id));
  const withIds = [...live.map((s) => s.id), ...deviceOnly].slice(0, 12);
  const total = live.length + deviceOnly.length + lights.length;
  const query = [
    withIds.length ? `with=${withIds.join(",")}` : "",
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
      {readFailed && (
        <p className="mt-2 text-sm text-[var(--gh-ink-soft)]" role="status">
          We couldn&apos;t read what you saved just now. Reload in a moment —
          nothing has been lost.
        </p>
      )}
      {live.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="list-saved">
          {live.map((s) => (
            <SavedRow key={s.id} find={s} />
          ))}
        </ul>
      )}
      {deviceOnly.length + lights.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="list-added">
          {deviceOnly.map((id) => (
            <AddedRow
              key={id}
              id={id}
              emoji="🎄"
              name={names[id]}
              onRemove={() => togglePick(id)}
            />
          ))}
          {lights.map((id) => (
            <AddedRow
              key={id}
              id={id}
              emoji="✨"
              name={
                names[id] ?? {
                  title: "A light display on your tour",
                  href: `/christmas/lights/${id}`,
                }
              }
              onRemove={() => toggleStash(id)}
            />
          ))}
        </ul>
      )}
      {total === 0 && over.length === 0 ? (
        <div className="mt-2" data-testid="list-empty">
          <p className="text-base text-[var(--gh-ink-soft)]">
            {signedIn
              ? "Nothing here yet. Save or add any event, market or light display and it waits here."
              : "Nothing here yet. Add any event, market or light display and it waits here. Sign in to keep your saved ones on every device."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/christmas/discover"
              data-testid="list-find"
              className="inline-flex min-h-11 items-center rounded-full bg-[#b3242f] px-5 font-bold text-white"
            >
              Find events &amp; markets
            </Link>
            <Link
              href="/christmas/lights"
              className="inline-flex min-h-11 items-center rounded-full px-5 font-semibold ring-1 ring-black/15 hover:ring-black/40"
            >
              Browse the lights map
            </Link>
            {!signedIn && (
              <Link
                href="/auth?next=/christmas/list"
                className="inline-flex min-h-11 items-center rounded-full px-5 font-semibold ring-1 ring-black/15 hover:ring-black/40"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      ) : (
        <>
          {total > 0 && (
            <p className="mt-3 text-base" data-testid="list-count">
              {total} thing{total === 1 ? "" : "s"} on your list.
              {deviceOnly.length + lights.length > 0 &&
                ` ${deviceOnly.length + lights.length} ${deviceOnly.length + lights.length === 1 ? "is" : "are"} kept on this device only, until you turn them into a plan.`}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {total > 0 && (
              <Link
                href={`${planHref}${planHref.includes("?") ? "&" : "?"}${query}`}
                className="inline-flex min-h-11 items-center rounded-full bg-[#b3242f] px-5 font-bold text-white"
                data-testid="list-plan"
              >
                Plan these
              </Link>
            )}
            <Link
              href="/christmas/discover"
              className="inline-flex min-h-11 items-center rounded-full px-5 font-semibold ring-1 ring-black/15 hover:ring-black/40"
            >
              Find more
            </Link>
            {deviceOnly.length + lights.length > 0 && (
              <button
                type="button"
                onClick={clearPicks}
                className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold underline underline-offset-4"
              >
                Clear what I added here
              </button>
            )}
          </div>
        </>
      )}
      {over.length > 0 && (
        <details
          className="mt-4 rounded-2xl bg-[#f6f1e6]"
          data-testid="list-over"
        >
          <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-bold">
            Saved, but the dates have gone ({over.length})
          </summary>
          <ul className="grid gap-2 px-3 pb-3 sm:grid-cols-2">
            {over.map((s) => (
              <SavedRow key={s.id} find={s} />
            ))}
          </ul>
          <p className="px-4 pb-3 text-sm text-[var(--gh-ink-soft)]">
            Still yours, and not put into a new plan as if it were on this year.
            If it comes back, it&apos;s here.
          </p>
        </details>
      )}
    </div>
  );
}

function SavedRow({ find }: { readonly find: SavedFind }) {
  return (
    <li data-testid="list-saved-item" data-find={find.id}>
      <Link
        href={find.href}
        className="flex min-h-14 items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-black/10 hover:ring-black/30"
      >
        <span className="text-2xl" aria-hidden>
          {find.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 block font-bold">{find.title}</span>
          <span className="block text-sm text-[var(--gh-ink-soft)]">
            {find.line ??
              (find.confidence === "unconfirmed"
                ? "Dates not confirmed"
                : "Check the days")}
          </span>
        </span>
      </Link>
    </li>
  );
}

/**
 * A thing added on this phone: its name and page when they were remembered
 * at the moment of adding; otherwise (added before names were kept) it says
 * so plainly rather than guess.
 */
function AddedRow({
  id,
  emoji,
  name,
  onRemove,
}: {
  readonly id: string;
  readonly emoji: string;
  readonly name: { readonly title: string; readonly href: string } | undefined;
  readonly onRemove: () => void;
}) {
  const title = name?.title ?? "Something you added";
  const body = (
    <>
      <span className="text-2xl" aria-hidden>
        {emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block font-bold">{title}</span>
        <span className="block text-sm text-[var(--gh-ink-soft)]">
          On this phone
        </span>
      </span>
    </>
  );
  return (
    <li
      data-testid="list-added-item"
      data-find={id}
      className="flex items-center gap-2 rounded-2xl bg-white p-3 ring-1 ring-black/10"
    >
      {name ? (
        <Link
          href={name.href}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 hover:underline"
        >
          {body}
        </Link>
      ) : (
        <span className="flex min-h-12 min-w-0 flex-1 items-center gap-3">
          {body}
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${title} from My Christmas List`}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--gh-ink-soft)] hover:bg-black/5"
        data-testid="list-added-remove"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>
    </li>
  );
}
