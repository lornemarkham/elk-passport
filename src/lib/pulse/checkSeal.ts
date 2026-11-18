import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { CheckSource } from "./check";

/**
 * A source travels from the reader to the browser and back on publish. It is
 * sealed with the server's key so what is published is exactly what the
 * server read: nobody can hand in an excerpt a page never said.
 */
export function sealSource(key: string, s: CheckSource): string {
  const body = Buffer.from(JSON.stringify(s)).toString("base64url");
  const sig = createHmac("sha256", key)
    .update(`check-source|${body}`)
    .digest("base64url")
    .slice(0, 32);
  return `${body}.${sig}`;
}

export function openSource(key: string, sealed: unknown): CheckSource | null {
  if (typeof sealed !== "string" || sealed.length > 12_000) return null;
  const [body, sig] = sealed.split(".", 2);
  if (!body || !sig) return null;
  const want = createHmac("sha256", key)
    .update(`check-source|${body}`)
    .digest("base64url")
    .slice(0, 32);
  if (
    sig.length !== want.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(want))
  )
    return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof s?.url !== "string" || typeof s?.readAt !== "string")
      return null;
    return s as CheckSource;
  } catch {
    return null;
  }
}
