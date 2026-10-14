import path from "node:path";
import type { NextConfig } from "next";

/**
 * **Passport's project root is this directory, and it is stated rather than
 * inferred.**
 *
 * Next infers the workspace root by walking up for lockfiles. `app/` has one,
 * and so does `~/Businesses/Websites` — a stray `package-lock.json` that
 * declares no dependencies and sits beside no `package.json`. Next picks the
 * outermost, so Passport's root silently became the directory holding forty
 * unrelated projects.
 *
 * That inference has already cost a day. The root changed when the parent
 * lockfile appeared, and Turbopack reused a `.next` cache built under the
 * previous root: entries were keyed `[project]/…` while the running server
 * resolved `[project]/elk-passport/app/…`, so lookups missed and the page
 * failed with *"Could not find … in the React Client Manifest"* — a symptom
 * that names neither the cache nor the root.
 *
 * Pinning the root makes it a fact about this project instead of a
 * consequence of what happens to exist in a parent directory. It also stops
 * module resolution and file watching from spanning every sibling project.
 * The parent lockfile is left alone: it is not Passport's to delete, and
 * Passport should not depend on its absence.
 */
/**
 * **October lived in Labs first, and was printed, bookmarked and shared there.**
 *
 * Its rooms now live under `/october`, where the host mapping, the theme and
 * the sign-in return path all know them. These URLs keep working: a redirect
 * declared here carries the query string and the dynamic segments across
 * untouched (`?at=doorway`, `?intervene=1`, a QR code's join code), which a
 * hand-written `redirect()` in a page only does for the parameters it
 * remembers to copy.
 *
 * Temporary (307), not permanent: a browser caches a 308 indefinitely, and
 * nobody should be unable to take a route back.
 *
 * The Video Store was never moved. `/labs/october/video-store` rendered the
 * very component `/october/store` renders, so it forwards to that one rather
 * than becoming a second copy of the room.
 *
 * `/labs/october/synthesis` is deliberately not here: it is the Labs sibling
 * the discovery experiments are compared against, and still serves.
 */
const OCTOBER_FROM_LABS = [
  ["found-you", "found-you"],
  ["witching-hour", "witching-hour"],
  ["discovery", "discovery"],
  ["for-bryan", "for-bryan"],
  ["scariest-room", "scariest-room"],
  ["secret-room", "secret-room"],
  ["sketchbook", "sketchbook"],
] as const;

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
  async redirects() {
    return [
      {
        source: "/labs/october/video-store",
        destination: "/october/store",
        permanent: false,
      },
      ...OCTOBER_FROM_LABS.flatMap(([from, to]) => [
        {
          source: `/labs/october/${from}`,
          destination: `/october/${to}`,
          permanent: false,
        },
        {
          source: `/labs/october/${from}/:path*`,
          destination: `/october/${to}/:path*`,
          permanent: false,
        },
      ]),
    ];
  },
};

export default nextConfig;
