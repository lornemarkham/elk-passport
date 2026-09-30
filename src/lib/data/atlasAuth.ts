import "server-only";

/**
 * **How Passport proves it is Passport.**
 *
 * Atlas stopped answering the internet (Atlas `e6f94f9`): every route except
 * `/health` now requires `Authorization: Bearer $ATLAS_SERVICE_TOKEN`, and
 * admin routes require that *and* `x-admin-token`. The service token says
 * "this is Passport"; the admin token says "and it may change the corpus".
 * They are two different claims and neither substitutes for the other.
 *
 * ## One place, because there were sixty
 *
 * Passport reaches Atlas from five product modules and thirty-four admin proxy
 * routes, each of which built its own headers inline. A secret added in sixty
 * places is a secret missing from one of them, and the one it is missing from
 * is the one nobody exercises until it matters. Everything that talks to Atlas
 * now gets its headers from here.
 *
 * ## `server-only`, and why that is the whole security model
 *
 * This module cannot be imported into a client bundle: Next refuses the build.
 * That is the guarantee — not a naming convention, not a review habit. The
 * variable is deliberately **not** `NEXT_PUBLIC_*`; anything prefixed that way
 * is inlined into JavaScript served to every visitor, which for a shared
 * service secret would be the same as publishing it.
 *
 * ## An unset token is a misconfiguration, not a quiet fallback
 *
 * `atlasAuthHeaders` sends no `Authorization` when the token is unset rather
 * than inventing one, and `describeAtlasFailure` reports that case as
 * `not-configured`. The alternative — swallowing it — is precisely how an
 * unauthenticated Passport comes to render "nothing is on tonight" over a
 * corpus of two and a half thousand things.
 */

/** Where Atlas is. One constant, read by everything that speaks to it. */
export const ATLAS_BASE_URL =
  process.env.ATLAS_API_URL ?? "http://localhost:3000";

/**
 * The shared secret, or nothing.
 *
 * Read per call rather than captured at module load so a test can set it, and
 * so a serverless instance started before the variable existed does not hold a
 * stale `undefined` for its lifetime.
 */
export const atlasServiceToken = (): string | undefined => {
  const token = process.env.ATLAS_SERVICE_TOKEN?.trim();
  return token ? token : undefined;
};

/** Whether Passport is configured to identify itself to Atlas at all. */
export const atlasIsConfigured = (): boolean =>
  atlasServiceToken() !== undefined;

/**
 * Atlas's headers, with whatever else the caller needs.
 *
 * **Additive.** `x-admin-token` and `Content-Type` are the caller's business
 * and pass through untouched; this only ever contributes `Authorization`. A
 * caller that passes its own `Authorization` keeps it, because a caller that
 * specific knows something this does not.
 */
export function atlasAuthHeaders(
  extra?: Readonly<Record<string, string>>,
): Record<string, string> {
  const token = atlasServiceToken();
  const headers: Record<string, string> = { ...extra };
  if (token && !headers.Authorization && !headers.authorization) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Why a call to Atlas did not produce an answer.
 *
 * The distinction Passport was missing entirely. Every one of these used to
 * arrive at a `.catch(() => [])` and become an empty corpus, so a wrong token
 * and a quiet month were the same page.
 *
 * ```
 * not-configured  Passport has no service token — ours to fix
 * unauthorized    Atlas refused the one we sent — ours to fix
 * unavailable     Atlas is not set up, or not answering — theirs to fix
 * unreachable     nothing answered at all — the network, or Atlas is down
 * ```
 */
export type AtlasFailure =
  "not-configured" | "unauthorized" | "unavailable" | "unreachable";

/**
 * An Atlas read that could not be answered, and the reason, so a surface can
 * tell the truth instead of rendering an absence.
 */
export class AtlasUnavailableError extends Error {
  readonly reason: AtlasFailure;
  readonly status?: number;

  constructor(
    reason: AtlasFailure,
    status?: number,
    options?: { readonly cause?: unknown },
  ) {
    // The original failure is kept rather than replaced: "fetch failed" and
    // "getaddrinfo ENOTFOUND" are the difference between Atlas being down and
    // `ATLAS_API_URL` pointing at nothing, and only one of them is Atlas's.
    super(MESSAGES[reason], options);
    this.name = "AtlasUnavailableError";
    this.reason = reason;
    if (status !== undefined) this.status = status;
  }
}

const MESSAGES: Record<AtlasFailure, string> = {
  "not-configured":
    "Passport has no ATLAS_SERVICE_TOKEN, so it cannot identify itself to Atlas.",
  unauthorized: "Atlas refused Passport's service token.",
  unavailable: "Atlas is not accepting requests.",
  unreachable: "Atlas did not answer.",
};

export const isAtlasUnavailable = (
  error: unknown,
): error is AtlasUnavailableError => error instanceof AtlasUnavailableError;

/**
 * What an Atlas response means for authentication, if anything.
 *
 * `401` is the token being wrong or absent; Atlas answers `503` when its *own*
 * `ATLAS_SERVICE_TOKEN` is unset, which is a different party's problem and is
 * reported as such. Any other status is this function's business to ignore —
 * a 404 from Atlas is an answer, not a failure to reach it.
 */
export function describeAtlasFailure(
  status: number,
): AtlasUnavailableError | undefined {
  if (status === 401 || status === 403) {
    return new AtlasUnavailableError(
      atlasIsConfigured() ? "unauthorized" : "not-configured",
      status,
    );
  }
  if (status === 503) return new AtlasUnavailableError("unavailable", status);
  return undefined;
}
