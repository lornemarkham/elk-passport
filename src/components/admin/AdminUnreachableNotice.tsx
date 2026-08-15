import { PlugZap } from "lucide-react";

/**
 * Shown when Atlas is configured but did not answer.
 *
 * Deliberately **not** `AdminSetupNotice`. That component asserts *"that
 * secret isn't set for this app yet"* — a specific, confident diagnosis
 * that is simply false when the real cause was a three-second timeout. An
 * operator who has already set `ADMIN_TOKEN` and is told to go set it
 * learns to distrust the whole screen.
 *
 * Atlas has made this mistake once before, at a different layer: a schema
 * check that reported "missing column" for what was actually a permission
 * error, and cost an hour. The rule that came out of it applies here
 * unchanged — **a diagnostic that is confidently wrong is worse than no
 * diagnostic.**
 *
 * So this says only what is known: the request did not come back. It names
 * the most likely cause without asserting it, and it does not describe the
 * data, because we have not seen the data.
 */
export function AdminUnreachableNotice({
  what = "This page",
}: {
  what?: string;
}) {
  return (
    <div className="border-border rounded-xl border border-dashed p-6">
      <p className="flex items-center gap-2 text-sm font-medium">
        <PlugZap className="text-muted-foreground h-4 w-4" />
        Atlas isn&apos;t responding
      </p>
      <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
        {what} needs Atlas&apos;s admin API, and the request timed out rather
        than being refused. Nothing here is a statement about what Atlas holds —
        we could not ask.
      </p>
      <p className="text-muted-foreground mt-3 text-sm">
        Check that the API is running on port 3000 (
        <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
          npm run api
        </code>{" "}
        in{" "}
        <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
          atlas/
        </code>
        ), then reload.
      </p>
    </div>
  );
}
