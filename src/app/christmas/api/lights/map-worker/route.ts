import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * **MapLibre's worker, same-origin.** MapLibre 6 looks for
 * `maplibre-gl-worker.mjs` beside its own bundle, which Next's build does not
 * emit, so the map never loads in production ("Worker failed to load"). The
 * lights map points `setWorkerUrl` here instead. The file is the installed
 * package's own, read once and cached by version.
 */
const FILE = path.join(
  process.cwd(),
  "node_modules",
  "maplibre-gl",
  "dist",
  "maplibre-gl-worker.mjs",
);

let cached: Promise<string> | null = null;

export async function GET() {
  try {
    cached ??= readFile(FILE, "utf8");
    return new Response(await cached, {
      headers: {
        "Content-Type": "text/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    cached = null;
    return new Response("// map worker unavailable", { status: 503 });
  }
}
