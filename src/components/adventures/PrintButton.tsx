"use client";

import { Printer } from "lucide-react";
import { pillClass } from "./kit";

/** Print the page — the paper is the point (Fishing With Emi, A6). */
export function PrintButton({
  label = "Print the guide",
}: {
  readonly label?: string;
}) {
  return (
    <button
      type="button"
      data-testid="print-guide"
      onClick={() => window.print()}
      className={pillClass("light", "print:hidden")}
    >
      <Printer className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}
