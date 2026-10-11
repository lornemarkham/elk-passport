"use client";

import { useMemo, useState } from "react";
import type { Subject, Theme } from "@/lib/design-lab/sample";
import { useHere } from "@/lib/location/useHere";
import { distanceKm } from "@/lib/environment/geo";

export interface Picks {
  doing?: string;
  who?: string;
  when?: string;
  far?: string;
}

/**
 * **What the controls actually do — and what they honestly cannot.**
 *
 * Every narrowing here is a direct read of something Atlas states. Where a
 * control cannot narrow, it does not pretend to: it returns a `note` that the
 * surface prints beside the results, so a person is never left guessing
 * whether their tap did anything.
 *
 * ```
 * doing   Atlas's affordance names                       narrows
 * who     suitability statements: adults-only, families  narrows
 * when    stated start dates / recurrence                narrows
 * far     distance between two stated positions          narrows once shared
 * ```
 *
 * `who` deliberately uses only the two unambiguous shapes Atlas states without
 * being asked an age. The real product sends `childAge` and gets a verdict per
 * subject; a prototype that guessed at the rest would be inventing the one
 * thing this whole contract exists to carry, so the surface says what it is
 * doing and what it is not.
 */
export function useDiscovery(
  subjects: readonly Subject[],
  verbs: readonly { label: string; ids: readonly string[] }[],
  /**
   * The server's instant, as an ISO string.
   *
   * Passed in rather than read here: a clock read during render is impure, and
   * a client that reads its own would disagree with the markup it was sent.
   */
  now: string,
) {
  const [picks, setPicks] = useState<Picks>({});
  const { at, ask, place } = useHere();

  const set = (key: keyof Picks) => (next: string | undefined) =>
    setPicks((previous) => ({ ...previous, [key]: next }));

  const kmTo = useMemo(() => {
    return (subject: Subject): number | undefined => {
      if (!at || !subject.coordinates) return undefined;
      const [longitude, latitude] = subject.coordinates;
      return distanceKm(at, { latitude, longitude });
    };
  }, [at]);

  const { results, notes } = useMemo(() => {
    const notes: string[] = [];
    const chosen = verbs.find((verb) => verb.label === picks.doing);
    let pool = chosen
      ? subjects.filter((subject) => chosen.ids.includes(subject.id))
      : [...subjects];

    if (picks.who === "a young child") {
      const before = pool.length;
      pool = pool.filter((subject) => !subject.audience?.adultsOnly);
      const shut = before - pool.length;
      notes.push(
        shut > 0
          ? `${shut} removed: Atlas states an adults-only rule. It says nothing either way about most of the rest.`
          : "Nothing here carries a stated adults-only rule. Atlas says nothing either way about most of them.",
      );
    }
    if (picks.who === "friends") {
      notes.push(
        "Atlas states nothing about groups, so this changes nothing — it is here to show the question, not to filter.",
      );
    }

    if (picks.when === "today") {
      const today = now.slice(0, 10);
      pool = pool.filter(
        (subject) =>
          !subject.startTime || subject.startTime.slice(0, 10) <= today,
      );
      notes.push("Dated things Atlas says start later are set aside.");
    }
    if (picks.when === "this week") {
      const week = new Date(Date.parse(now) + 7 * 86_400_000)
        .toISOString()
        .slice(0, 10);
      pool = pool.filter(
        (subject) =>
          !subject.startTime || subject.startTime.slice(0, 10) <= week,
      );
    }

    if (picks.far && picks.far !== "anywhere") {
      const limit = picks.far === "close to home" ? 15 : 60;
      pool = pool.filter((subject) => {
        const km = kmTo(subject);
        // **Unplaced is not far away.** Two candidates in three carry no
        // coordinates, and dropping them here would be the oldest mistake in
        // this product wearing a new control.
        if (km === undefined) return true;
        return picks.far === "worth the drive"
          ? km > 15 && km <= 120
          : km <= limit;
      });
      notes.push(
        "Distance only narrows what Atlas has placed; it never rules out somewhere it has not.",
      );
    }

    const results = pool
      .map((subject) => ({ subject, km: kmTo(subject) }))
      .sort((a, b) => {
        if (a.km === undefined && b.km === undefined) return 0;
        if (a.km === undefined) return 1;
        if (b.km === undefined) return -1;
        return a.km - b.km;
      });

    return { results, notes };
  }, [subjects, verbs, picks, kmTo, now]);

  return { picks, set, results, notes, at, ask, place, kmTo };
}

/** Themes narrowed to a result set, keeping each theme's stated basis. */
export function themesOf(
  themes: readonly Theme[],
  allowed: ReadonlySet<string>,
  least = 3,
): Theme[] {
  return themes
    .map((theme) => ({
      ...theme,
      subjects: theme.subjects.filter((subject) => allowed.has(subject.id)),
    }))
    .filter((theme) => theme.subjects.length >= least);
}
