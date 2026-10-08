"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/observability/report";

/**
 * **The last resort — when even the layout failed.**
 *
 * A route-level `error.tsx` renders inside its layout; if the layout itself
 * throws, nothing catches it and the visitor gets Next's default page. This
 * replaces its own `<html>` and so cannot rely on anything above it,
 * including fonts and the theme — which is why the styling here is inline and
 * plain rather than the product's.
 *
 * It still reports. A failure this total is the single most important one to
 * hear about and the one we were least likely to.
 */
export default function GlobalError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    reportError(error, {
      boundary: "global",
      ...(error.digest ? { digest: error.digest } : {}),
    });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0c0a0c",
          color: "#e9e6da",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "1.25rem",
        }}
      >
        <div style={{ maxWidth: "26rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", margin: 0, color: "#f3efe4" }}>
            Something went badly wrong.
          </h1>
          <p style={{ marginTop: "0.75rem", opacity: 0.6, lineHeight: 1.6 }}>
            Nothing you have saved is lost. We have been told this happened.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.75rem",
              minHeight: "2.75rem",
              padding: "0 1.5rem",
              borderRadius: "999px",
              border: "none",
              background: "#d09a4e",
              color: "#15100a",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
