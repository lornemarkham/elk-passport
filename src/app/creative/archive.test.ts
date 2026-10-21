import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FIXTURES } from "@/experience-lab/fixtures";
import { labExperiments } from "@/app/labs/experiments";
import nextConfig from "../../../next.config";
import {
  CREATIVE_ARCHIVE,
  PUBLISHED_COMMIT,
  availability,
  type CreativeWork,
} from "./archive";

/**
 * **The archive's preservation rules.** If one of these fails, the fix is
 * almost never to change the test: an original was moved or deleted, or a new
 * experiment arrived without an entry. Mark a removed original `missing` with
 * the commit it can be recovered from; give a new one an entry.
 */
const ROOT = path.resolve(__dirname, "../../..");
const at = (p: string) => path.join(ROOT, p);

/** Git, when this checkout has history to ask. Shallow clones skip those checks. */
function git(...args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}
const HAS_HISTORY =
  git("rev-parse", "--is-shallow-repository") === "false" &&
  git("cat-file", "-e", `${PUBLISHED_COMMIT}^{commit}`) !== null;

const inCommit = (hash: string, p: string) =>
  git("cat-file", "-e", `${hash}:${p.replace(/\/$/, "")}`) !== null;

/** The page file a route is served from, following `[param]` directories. */
function pageFor(route: string): string | null {
  if (/\.[a-z]+$/.test(route)) {
    return existsSync(at(`public${route}`)) ? `public${route}` : null;
  }
  let dir = "src/app";
  for (const seg of route.split("/").filter(Boolean)) {
    if (existsSync(at(`${dir}/${seg}`))) {
      dir = `${dir}/${seg}`;
      continue;
    }
    const param = readdirSync(at(dir)).find((d) => /^\[[^.]+\]$/.test(d));
    if (!param) return null;
    dir = `${dir}/${param}`;
  }
  return existsSync(at(`${dir}/page.tsx`)) ? `${dir}/page.tsx` : null;
}

function pagesUnder(dir: string): string[] {
  return readdirSync(at(dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    if (statSync(at(rel)).isDirectory()) return pagesUnder(rel);
    return name === "page.tsx" || name.endsWith(".html") ? [rel] : [];
  });
}

const routeOf = (page: string) =>
  page.startsWith("public/")
    ? page.slice("public".length)
    : "/" + path.dirname(page.slice("src/app/".length)).replace(/^\.$/, "");

const routesOf = (w: CreativeWork) =>
  [w.originalRoute, w.route].filter((r): r is string => Boolean(r));

const present = CREATIVE_ARCHIVE.filter((w) => w.status !== "missing");
const missing = CREATIVE_ARCHIVE.filter((w) => w.status === "missing");

describe("the creative archive manifest", () => {
  it("gives every original one entry with a unique id", () => {
    const ids = CREATIVE_ARCHIVE.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never loses an original: every source of a present entry exists", () => {
    for (const w of present) {
      for (const s of w.sources) {
        expect(existsSync(at(s)), `${w.id}: ${s}`).toBe(true);
      }
    }
  });

  it("says where every missing original can be recovered from", () => {
    for (const w of missing) {
      expect(
        Boolean(w.commit) || /Recovery:/.test(w.notes ?? ""),
        `${w.id} needs a commit or a recovery note`,
      ).toBe(true);
    }
  });

  it("opens every present original at a route that is really served", async () => {
    const redirects = await nextConfig.redirects!();
    const redirected = (route: string) =>
      redirects.some(
        (r) =>
          r.source === route ||
          (r.source.endsWith("/:path*") &&
            route.startsWith(r.source.replace("/:path*", "/"))),
      );
    for (const w of present) {
      for (const r of routesOf(w)) {
        expect(
          pageFor(r) !== null || redirected(r),
          `${w.id}: nothing serves ${r}`,
        ).toBe(true);
      }
    }
  });

  it("has an entry for every experiment page and HTML original", () => {
    const pages = [
      ...pagesUnder("src/app/about"),
      ...pagesUnder("src/app/labs"),
      ...pagesUnder("public/labs"),
    ];
    const archived = CREATIVE_ARCHIVE.flatMap(routesOf);
    for (const page of pages) {
      const route = routeOf(page);
      if (route === "/labs") continue; // the Labs index itself
      // A `[param]` page belongs to the entry for the route above it.
      const owner = route.replace(/\/\[[^\]]+\].*$/, "");
      expect(
        archived.some((r) => r === owner || r.startsWith(`${owner}/`)),
        `${page} (${route}) has no archive entry`,
      ).toBe(true);
    }
  });

  it("has an entry for every Experience Lab fixture", () => {
    const archived = CREATIVE_ARCHIVE.flatMap(routesOf);
    for (const f of FIXTURES) {
      expect(archived, f.slug).toContain(`/labs/experience/${f.slug}`);
    }
  });

  it("covers every Labs experiment, so the two lists cannot drift apart", () => {
    const linked = new Set(CREATIVE_ARCHIVE.map((w) => w.labId));
    for (const dev of [true, false]) {
      for (const e of labExperiments({}, dev)) {
        expect(linked.has(e.id), e.id).toBe(true);
      }
    }
  });

  it("writes dates as dates and hashes as hashes", () => {
    for (const w of CREATIVE_ARCHIVE) {
      if (!w.commit) continue;
      expect(w.commit.hash, w.id).toMatch(/^[0-9a-f]{7,40}$/);
      expect(w.commit.date, w.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe.skipIf(!HAS_HISTORY)("the manifest against git history", () => {
  it("dates every original by the commit it names, not by a guess", () => {
    for (const w of CREATIVE_ARCHIVE) {
      if (!w.commit) continue;
      const [date, ...subject] = (
        git("log", "-1", "--format=%ad %s", "--date=short", w.commit.hash) ?? ""
      ).split(" ");
      expect(date, `${w.id}: ${w.commit.hash}`).toBe(w.commit.date);
      expect(subject.join(" "), w.id).toBe(w.commit.subject);
    }
  });

  it("can recover every git-only original from the commit it names", () => {
    for (const w of missing) {
      if (!w.commit) continue;
      for (const s of w.sources) {
        expect(inCommit(w.commit.hash, s), `${w.id}: ${s}`).toBe(true);
      }
    }
  });

  it("links to GitHub only where the source is really there", () => {
    for (const w of CREATIVE_ARCHIVE.filter((x) => x.onGitHub)) {
      for (const s of w.sources) {
        expect(inCommit(PUBLISHED_COMMIT, s), `${w.id}: ${s}`).toBe(true);
      }
    }
  });

  it("does not record as never-committed a document that git has", () => {
    for (const w of missing.filter((x) => !x.commit)) {
      for (const s of w.sources) {
        const name = path.basename(s);
        expect(
          git("log", "--all", "--format=%h", "--", `*${name}`),
          `${w.id}: ${name} is in git history after all`,
        ).toBe("");
      }
    }
  });
});

describe("what the archive links to, per environment", () => {
  const byId = (id: string) => CREATIVE_ARCHIVE.find((w) => w.id === id)!;

  it("never links a missing original", () => {
    for (const w of missing) {
      expect(
        availability(w, { ATLAS_API_URL: "http://atlas" }, true).href,
      ).toBe(undefined);
    }
  });

  it("opens the original Christmas HTML and Hockey Night with no environment at all", () => {
    expect(availability(byId("christmas-passport-html"), {}, false).href).toBe(
      "/labs/discovery-space/christmas-passport.html",
    );
    expect(availability(byId("hockey-night-original"), {}, false).href).toBe(
      "/labs/experience/sycle-hockey-night",
    );
  });

  it("defers to Labs: what Labs closes, the archive does not link", () => {
    for (const w of CREATIVE_ARCHIVE.filter((x) => x.labId)) {
      for (const dev of [true, false]) {
        const lab = labExperiments({}, dev).find((e) => e.id === w.labId)!;
        const a = availability(w, {}, dev);
        expect(Boolean(a.href), `${w.id} dev=${dev}`).toBe(
          lab.status === "playable",
        );
        if (lab.status !== "playable") expect(a.note).toBe(lab.note);
      }
    }
  });

  it("does not link what needs Atlas where there is none, and says why", () => {
    const design = byId("design-lab");
    expect(availability(design, {}, false)).toEqual({
      note: "Needs Atlas, which is not configured in this environment.",
    });
    expect(
      availability(design, { ATLAS_API_URL: "http://atlas" }, false).href,
    ).toBe("/labs/design");
  });

  it("opens a moved original at where it lives now", () => {
    expect(availability(byId("october-video-store"), {}, false).href).toBe(
      "/october/store",
    );
  });
});
