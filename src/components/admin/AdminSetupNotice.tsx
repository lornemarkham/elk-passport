import { Terminal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Shown instead of a raw error when ADMIN_TOKEN isn't set — this is a
 * setup step, not a runtime failure, and should read like one. A curator
 * or developer landing here for the first time should know exactly what
 * to do without reading source code.
 */
export function AdminSetupNotice() {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Terminal className="text-muted-foreground h-5 w-5" />
          <CardTitle>One setup step left</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p className="text-muted-foreground">
          This page talks to Atlas&apos;s admin API, which is locked behind a
          shared secret so it can&apos;t be reached by accident. That secret
          isn&apos;t set for this app yet, so there&apos;s nothing to show here
          — this isn&apos;t a bug.
        </p>

        <ol className="flex flex-col gap-3">
          <li className="flex gap-3">
            <span className="bg-muted flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-medium">
              1
            </span>
            <span>
              Open{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                app/.env.local
              </code>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="bg-muted flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-medium">
              2
            </span>
            <span>
              Add{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                ADMIN_TOKEN=
              </code>
              , set to the same value Atlas uses (check{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">
                atlas/.env.local
              </code>
              )
            </span>
          </li>
          <li className="flex gap-3">
            <span className="bg-muted flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-medium">
              3
            </span>
            <span>
              Restart the dev server — env files are only read on startup
            </span>
          </li>
        </ol>

        <p className="text-muted-foreground text-xs">
          Reload this page once the server&apos;s back up.
        </p>
      </CardContent>
    </Card>
  );
}
