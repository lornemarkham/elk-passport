"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";
import type { Action } from "@/domain/snow/sesh/actions";
import type { Viewer, World } from "@/domain/snow/sesh/model";
import { PATCHES, earnedPatches } from "@/domain/snow/sesh/patches";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useCelebrate } from "./celebrate";
import {
  SeshProvider,
  cx,
  parseScreen,
  styles,
  type ActResult,
  type SeshCtx,
  type Upload,
} from "./ctx";
import { MeScreen, PostScreen } from "./Post";
import {
  ChallengeScreen,
  ClipScreen,
  FeatureScreen,
  FeedScreen,
  Home,
  MountainScreen,
  NotHere,
  PatchesScreen,
  RiderScreen,
} from "./Screens";
import { DEMO_VIEWER, useDemo } from "./useDemo";

const CLIP_BUCKET = "sesh-wars-clips";

function Router({ path }: { path: readonly string[] }) {
  const s = parseScreen(path);
  switch (s.k) {
    case "home":
      return <Home />;
    case "mountain":
      return <MountainScreen id={s.id} />;
    case "feature":
      return <FeatureScreen id={s.id} />;
    case "clip":
      return <ClipScreen id={s.id} />;
    case "challenge":
      return <ChallengeScreen id={s.id} />;
    case "rider":
      return <RiderScreen id={s.id} />;
    case "feed":
      return <FeedScreen mountain={s.mountain} />;
    case "post":
      return <PostScreen feature={s.feature} />;
    case "answer":
      return <PostScreen answerTo={s.clip} />;
    case "patches":
      return <PatchesScreen />;
    case "me":
      return <MeScreen />;
    case "missing":
      return <NotHere what="That page" />;
  }
}

function Shell({
  ctx,
  path,
  banner,
}: {
  ctx: SeshCtx;
  path: readonly string[];
  banner?: ReactNode;
}) {
  const { base, viewer } = ctx;
  return (
    <SeshProvider value={ctx}>
      <div className={styles.root}>
        <nav
          className={cx(styles.bar, "sticky top-0 z-30")}
          aria-label="Sesh Wars"
        >
          <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-3 py-2 text-sm font-bold whitespace-nowrap">
            <Link
              href="/snow"
              className="px-2 py-1 opacity-80 hover:opacity-100"
            >
              ← Snow
            </Link>
            <Link
              href={base}
              className={cx(
                styles.display,
                "mr-2 px-2 py-1 text-lg tracking-wider uppercase",
              )}
            >
              Sesh Wars
            </Link>
            <Link
              href={`${base}/feed`}
              className="rounded-full px-3 py-1 hover:bg-white/10"
            >
              Feed
            </Link>
            <Link
              href={`${base}/post`}
              className="rounded-full bg-[var(--sw-orange)] px-3 py-1 text-[var(--sw-cream)]"
            >
              + Post
            </Link>
            <Link
              href={`${base}/patches`}
              className="rounded-full px-3 py-1 hover:bg-white/10"
            >
              Patches
            </Link>
            <Link
              href={
                viewer.riderId ? `${base}/r/${viewer.riderId}` : `${base}/me`
              }
              className="rounded-full px-3 py-1 hover:bg-white/10"
            >
              {viewer.riderId ? "Me" : viewer.signedIn ? "Join" : "Rider"}
            </Link>
            {!viewer.signedIn && (
              <a
                href={ctx.signIn}
                className="ml-auto rounded-full border border-[var(--sw-cream)] px-3 py-1"
              >
                Sign in
              </a>
            )}
          </div>
        </nav>
        {banner}
        <main className="mx-auto max-w-6xl px-4 pb-24">
          <Router path={path} />
        </main>
      </div>
    </SeshProvider>
  );
}

// ── The real thing ──────────────────────────────────────────────────────

export function RealSesh({
  world,
  viewer,
  now,
  path,
  userId,
  signIn,
}: {
  world: World;
  viewer: Viewer;
  now: number;
  path: string[];
  userId: string | null;
  signIn: string;
}) {
  const router = useRouter();
  const celebrate = useCelebrate();
  const act = useCallback(
    async (a: Action, upload?: Upload): Promise<ActResult> => {
      let videoPath: string | undefined;
      let posterPath: string | undefined;
      if (a.type === "post") {
        if (!upload || !userId)
          return { ok: false, reason: "Pick the video first." };
        const ext =
          /quicktime/.test(upload.video.type) ||
          /\.mov$/i.test(upload.video.name)
            ? "mov"
            : /webm/.test(upload.video.type)
              ? "webm"
              : "mp4";
        const key = crypto.randomUUID();
        videoPath = `${userId}/${key}.${ext}`;
        const bucket = supabaseBrowser().storage.from(CLIP_BUCKET);
        const up = await bucket.upload(videoPath, upload.video, {
          contentType:
            upload.video.type || `video/${ext === "mov" ? "quicktime" : ext}`,
          upsert: false,
        });
        if (up.error)
          return {
            ok: false,
            reason:
              "The upload didn't make it. Try again on better signal — your clip is still on your phone.",
          };
        if (upload.poster) {
          posterPath = `${userId}/${key}.jpg`;
          const p = await bucket.upload(posterPath, upload.poster, {
            contentType: "image/jpeg",
            upsert: false,
          });
          if (p.error) posterPath = undefined;
        }
      }
      const before = viewer.riderId
        ? new Set(
            earnedPatches(world, now, viewer.riderId).map((e) => e.patch.id),
          )
        : new Set<string>();
      const res = await fetch("/snow/sesh-wars/api/act", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: a, videoPath, posterPath }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        created?: string;
        patches?: string[];
      };
      if (!res.ok)
        return {
          ok: false,
          reason: body.error ?? "That didn't work. Try again in a moment.",
        };
      // The server worked out the rider's patches from the database's record.
      const fresh = PATCHES.filter(
        (p) => (body.patches ?? []).includes(p.id) && !before.has(p.id),
      );
      if (fresh.length)
        celebrate(
          fresh.map((patch) => ({ patch, at: new Date().toISOString() })),
        );
      router.refresh();
      return { ok: true, created: body.created };
    },
    [router, userId, viewer.riderId, world, now, celebrate],
  );
  const ctx: SeshCtx = {
    mode: "real",
    base: "/snow/sesh-wars",
    world,
    viewer,
    now,
    act,
    signIn,
    celebrate,
  };
  return <Shell ctx={ctx} path={path} />;
}

// ── Demo Mode ───────────────────────────────────────────────────────────

export function DemoSesh({ path }: { path: string[] }) {
  const demo = useDemo();
  const celebrate = useCelebrate();
  const [crowned, setCrowned] = useState<string | null>(null);
  const you = DEMO_VIEWER.riderId!;
  const newPatches = useCallback(
    (after: World, at: number) => {
      const had = new Set(
        earnedPatches(demo.world, demo.now, you).map((e) => e.patch.id),
      );
      celebrate(
        earnedPatches(after, at, you).filter((e) => !had.has(e.patch.id)),
      );
    },
    [demo.world, demo.now, you, celebrate],
  );
  const act = useCallback(
    async (a: Action): Promise<ActResult> => {
      const r = demo.act(a);
      if (!r.ok) return r;
      newPatches(r.world, demo.now);
      return { ok: true, created: r.created };
    },
    [demo, newPatches],
  );
  const skip = () => {
    const out = demo.skip();
    if (!out) return;
    newPatches(out.world, out.now);
    setCrowned(
      "The buzzer went. Fictional riders voted; challenges that closed have winners, and champions are crowned.",
    );
  };
  const ctx: SeshCtx = {
    mode: "demo",
    base: "/snow/sesh-wars/demo",
    world: demo.world,
    viewer: DEMO_VIEWER,
    now: demo.now,
    act,
    signIn: "/snow/sesh-wars/demo",
    celebrate,
    demo: { skip, reset: demo.reset, skippedHours: demo.skippedHours },
  };
  const banner = (
    <div className="border-b-2 border-[var(--sw-char)] bg-[#f3c969] text-[var(--sw-ink)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm">
        <b className={cx(styles.stencil, "uppercase")}>Demo mode</b>
        <span>
          30 fictional riders, fictional features, drawn clips. Nothing you do
          here leaves this phone or mixes with real riders.
        </span>
        <span className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={skip}
            className={cx(styles.btn, "px-3 py-1 text-xs")}
          >
            ⏩ Skip 24 h
          </button>
          <button
            type="button"
            onClick={demo.reset}
            className={cx(styles.btn, "px-3 py-1 text-xs")}
          >
            Start over
          </button>
          <Link
            href="/snow/sesh-wars"
            className={cx(styles.btn, "px-3 py-1 text-xs")}
          >
            Real Sesh Wars
          </Link>
        </span>
        {demo.skippedHours > 0 && (
          <span className="w-full text-xs">
            Demo clock: {demo.skippedHours} h ahead of real time.
          </span>
        )}
      </div>
    </div>
  );
  if (!demo.ready)
    return (
      <div className={styles.root}>
        <p className="p-8 text-center">Loading the demo mountain…</p>
      </div>
    );
  return (
    <>
      <Shell ctx={ctx} path={path} banner={banner} />
      {crowned && (
        <div
          role="status"
          className={cx(
            styles.toast,
            "fixed inset-x-4 bottom-4 z-40 mx-auto max-w-md p-4 text-sm",
          )}
        >
          {crowned}
          <button
            type="button"
            className="ml-3 underline"
            onClick={() => setCrowned(null)}
          >
            OK
          </button>
        </div>
      )}
    </>
  );
}
