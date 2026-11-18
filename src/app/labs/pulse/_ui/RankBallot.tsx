"use client";

import { ArrowDown, ArrowUp, X } from "lucide-react";
import type { PulseOption } from "@/lib/pulse/model";

/**
 * **Rank These on a phone**: tap things in the order you like them. Tapping
 * fills the next place; the arrows move a ranked thing; × takes it back out.
 * No dragging, so it works with a thumb, a keyboard and a screen reader.
 */
export function RankBallot({
  options,
  order,
  onOrder,
}: {
  options: readonly PulseOption[];
  order: readonly string[];
  onOrder: (next: string[]) => void;
}) {
  const left = options.filter((o) => !order.includes(o.id));
  const labelOf = (id: string) => options.find((o) => o.id === id)?.label ?? id;
  const move = (i: number, by: -1 | 1) => {
    const next = [...order];
    [next[i], next[i + by]] = [next[i + by]!, next[i]!];
    onOrder(next);
  };
  return (
    <div className="grid gap-4" data-testid="pulse-rank-ballot">
      {order.length > 0 ? (
        <ol className="grid gap-2" aria-label="Your order">
          {order.map((id, i) => (
            <li
              key={id}
              data-testid="pulse-ranked"
              className="flex min-h-14 items-center gap-3 rounded-2xl border-2 border-[#14161a] bg-white pr-1.5 pl-3 text-[17px] font-semibold"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#14161a] text-[15px] text-white">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate">{labelOf(id)}</span>
              <button
                type="button"
                aria-label={`Move ${labelOf(id)} up`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-[#3f4550] disabled:opacity-25"
              >
                <ArrowUp className="h-5 w-5" aria-hidden />
              </button>
              <button
                type="button"
                aria-label={`Move ${labelOf(id)} down`}
                disabled={i === order.length - 1}
                onClick={() => move(i, 1)}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-[#3f4550] disabled:opacity-25"
              >
                <ArrowDown className="h-5 w-5" aria-hidden />
              </button>
              <button
                type="button"
                aria-label={`Take ${labelOf(id)} out`}
                onClick={() => onOrder(order.filter((x) => x !== id))}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-[#3f4550]"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </li>
          ))}
        </ol>
      ) : null}
      {left.length > 0 ? (
        <div>
          <p className="text-[14px] font-medium text-[#5c6370]">
            {order.length === 0
              ? "Tap your favourite first."
              : `Tap what's number ${order.length + 1}.`}
          </p>
          <ul className="mt-2 grid gap-2">
            {left.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  data-testid={`pulse-rank-${o.id}`}
                  onClick={() => {
                    const next = [...order, o.id];
                    // The last one has only one place left: put it there.
                    if (left.length === 2)
                      next.push(left.find((x) => x.id !== o.id)!.id);
                    onOrder(next);
                  }}
                  className="flex min-h-14 w-full items-center rounded-2xl border-2 border-dashed border-[#d9d4c8] bg-white px-4 text-left text-[17px] font-semibold transition hover:border-[#bdb7aa]"
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
