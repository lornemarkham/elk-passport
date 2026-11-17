/**
 * **Markers that don't pile up.** Points already projected to screen pixels
 * are grouped greedily: the first point not yet taken gathers every other
 * within `radius` pixels. A group of one is a marker; more is a ✨ cluster
 * with a count. Pure, so the map can call it on every zoom.
 */
export interface Projected<T> {
  readonly item: T;
  readonly x: number;
  readonly y: number;
}

export interface Group<T> {
  readonly items: readonly T[];
  readonly x: number;
  readonly y: number;
}

export function cluster<T>(
  points: readonly Projected<T>[],
  radius = 44,
): Group<T>[] {
  const taken = new Array<boolean>(points.length).fill(false);
  const out: Group<T>[] = [];
  const r2 = radius * radius;
  for (let i = 0; i < points.length; i++) {
    if (taken[i]) continue;
    const a = points[i]!;
    taken[i] = true;
    const members = [a];
    for (let j = i + 1; j < points.length; j++) {
      if (taken[j]) continue;
      const b = points[j]!;
      if ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= r2) {
        taken[j] = true;
        members.push(b);
      }
    }
    out.push({
      items: members.map((m) => m.item),
      x: members.reduce((s, m) => s + m.x, 0) / members.length,
      y: members.reduce((s, m) => s + m.y, 0) / members.length,
    });
  }
  return out;
}
