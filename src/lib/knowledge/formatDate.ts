/**
 * Deterministic, locale-independent date formatting for the Entity
 * Workspace.
 *
 * Exists because `toLocaleDateString()` broke React hydration: the Node
 * server rendered `2026-08-11` and the browser rendered `8/11/2026`, React
 * threw a hydration mismatch, and the whole client tree was regenerated —
 * which silently killed every `onClick` in the workspace's client
 * components. The symptom was a button that looked fine and did nothing.
 *
 * Worth keeping as a rule beyond this file: in a server-rendered app,
 * anything locale- or timezone-dependent is a hydration hazard, and the
 * failure mode is not a visible error but dead interactivity.
 *
 * ISO-style `YYYY-MM-DD` is also the right choice on its own merits for
 * admin tooling — unambiguous for a curator regardless of where they are.
 */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toISOString().slice(0, 10);
}
