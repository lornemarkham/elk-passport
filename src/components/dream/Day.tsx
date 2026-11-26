"use client";

import type { DreamDay } from "@/domain/dream/compose";
import { Photo } from "./Photo";
import styles from "./dream.module.css";

/** Every stop's destination, in order, as one route in the phone's own map app. */
function routeHref(day: DreamDay, from: string): string | undefined {
  const points = day.stops.flatMap((s) => {
    if (!s.directions) return [];
    const to = new URL(s.directions).searchParams.get("destination");
    return to ? [to] : [];
  });
  if (points.length === 0) return undefined;
  const params = new URLSearchParams({
    api: "1",
    origin: from,
    destination: points[points.length - 1]!,
  });
  if (points.length > 1) params.set("waypoints", points.slice(0, -1).join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

const minutesLine = (m: number) =>
  m <= 0
    ? ""
    : m < 60
      ? `${m} min`
      : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ""}`;

/**
 * **Go when you're ready.** The scenes joined into one day by the Day
 * Builder — its title, its honest notes first, its stops — and the doors out:
 * the same day in Go Have a Day (where it is saved, shared and started), the
 * printable guide, and the whole route in the map app.
 */
export function Day({ day, from }: { day: DreamDay; from: string }) {
  const route = routeHref(day, from);
  return (
    <section className={styles.day} aria-labelledby="your-day">
      <p className={styles.kicker}>Go when you&rsquo;re ready</p>
      <h2 id="your-day" className={styles.dayTitle}>
        {day.title}
      </h2>
      <p className={styles.dayOpening}>{day.opening}</p>
      {day.honest.length > 0 ? (
        <ul className={styles.honest} aria-label="What this day could not do">
          {day.honest.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      ) : null}
      <ol className={styles.stops}>
        {day.stops.map((stop, i) => (
          <li key={stop.id} className={styles.stop}>
            <span className={styles.stopNo} aria-hidden>
              {i + 1}
            </span>
            <Photo photo={stop.photo} alt="" className={styles.stopPhoto} />
            <div className={styles.stopBody}>
              <p className={styles.stopTitle}>
                {stop.href ? <a href={stop.href}>{stop.title}</a> : stop.title}
              </p>
              <p className={styles.stopMeta}>
                {[
                  minutesLine(stop.minutes),
                  stop.km !== undefined ? `${stop.km} km from the last` : "",
                  stop.cost ?? "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className={styles.stopWhy}>{stop.because}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className={styles.go}>
        <a className={styles.primary} href={day.goHref}>
          Plan it, save it, start it →
        </a>
        {route ? (
          <a
            className={styles.action}
            href={route}
            target="_blank"
            rel="noreferrer"
          >
            The whole route in Maps
          </a>
        ) : null}
        <a className={styles.action} href={day.printHref}>
          Print the guide
        </a>
      </div>
      <p className={styles.small}>
        Distances are straight lines, not roads. Opens in Go Have a Day, which
        keeps the day, shares it and walks you through it when you start.
      </p>
    </section>
  );
}
