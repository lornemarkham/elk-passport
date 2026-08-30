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
const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
