"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SnowDay } from "@/domain/snow/day";
import { chosenFor } from "@/domain/snow/day";
import { listDayIds, listSharedDays, readDay } from "./store";
import { Card } from "./kit";

/** Your snow days on this device. Renders nothing until there is one. */
export function MyDays() {
  const [days, setDays] = useState<SnowDay[]>([]);
  const [shared, setShared] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => {
    const found = listDayIds().flatMap((id) => readDay(id) ?? []);
    /* eslint-disable react-hooks/set-state-in-effect -- the server cannot see this device */
    setDays(found);
    setShared(listSharedDays());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  if (days.length === 0 && shared.length === 0) return null;
  return (
    <section aria-labelledby="mine" data-testid="my-days">
      <h2 id="mine" className="mb-3 text-2xl font-extrabold">
        Your snow days
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {shared.map((d) => (
          <li key={d.id}>
            <Link href={`/snow/day/${d.id}`} className="block">
              <Card className="transition hover:border-[var(--sn-frost)]">
                <p className="text-lg font-bold">{d.title}</p>
                <p className="text-sm text-[var(--sn-ice)]/75">
                  Shared with your crew
                </p>
              </Card>
            </Link>
          </li>
        ))}
        {days.map((d) => (
          <li key={d.id}>
            <Link href={`/snow/day/${d.id}`} className="block">
              <Card className="transition hover:border-[var(--sn-frost)]">
                <p className="text-lg font-bold">{d.title}</p>
                <p className="text-sm text-[var(--sn-ice)]/75">
                  {[
                    chosenFor(d, "mountain")?.label,
                    d.date,
                    `${d.people.length} in`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
