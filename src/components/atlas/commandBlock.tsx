"use client";

import { useState } from "react";

/**
 * **A command an operator is about to run, and a way to take it with them.**
 *
 * The only client component in Knowledge Acquisition, and it exists for one
 * reason: a command you have to retype is a command you retype wrong. Copying
 * is the whole interaction — there is no state here worth calling state.
 *
 * The `cd` and the command are shown as two lines because they are two
 * decisions, and the wrong working directory is the most common way these fail.
 * Copying takes both, so the paste cannot land in the wrong repository.
 *
 * The button says what happened rather than showing a tick that fades: "Copied"
 * is legible to a screen reader, in monochrome, and to someone who looked away.
 */
export function CommandBlock({
  workingDirectory,
  command,
}: {
  workingDirectory: string;
  command: string;
}) {
  const [copied, setCopied] = useState(false);
  const full = `cd ${workingDirectory}\n${command}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused — over plain HTTP, or by policy.
      // The command is on screen and selectable either way, so the honest
      // response is to leave the button unchanged rather than claim success.
      setCopied(false);
    }
  }

  return (
    <div className="bg-muted/70 border-border/60 relative rounded-md border">
      <pre className="overflow-x-auto px-4 py-3.5 pr-24 font-mono text-[12.5px] leading-relaxed">
        <code>
          <span className="text-muted-foreground">cd {workingDirectory}</span>
          {"\n"}
          {command}
        </code>
      </pre>
      <button
        type="button"
        onClick={copy}
        className="hover:bg-background focus-visible:ring-ring border-border/60 bg-background/60 absolute top-2.5 right-2.5 rounded border px-2 py-1 text-[12px] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
