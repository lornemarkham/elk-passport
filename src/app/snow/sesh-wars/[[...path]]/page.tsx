import type { Metadata } from "next";
import Link from "next/link";
import { Insignia } from "@/components/snow/sesh/art";
import { RealSesh } from "@/components/snow/sesh/SeshApp";
import styles from "@/components/snow/sesh/sesh.module.css";
import { visibleTo } from "@/domain/snow/sesh/rules";
import { adventureSession, visitorDb } from "@/lib/adventures/server";
import { loadWorld, seshReady } from "../../_server/sesh";

export const dynamic = "force-dynamic";

const clock = () => Date.now();

export const metadata: Metadata = {
  title: "Sesh Wars — Snow — Passport",
  description:
    "Every feature has a champion. Every rider has a shot. Post a clip on a park feature, get challenged, let the mountain vote.",
};

function NotOpenYet() {
  return (
    <div className={styles.root}>
      <main className="mx-auto max-w-3xl px-4 py-12 text-center">
        <div className="mx-auto w-fit">
          <Insignia size={260} />
        </div>
        <h1 className={`${styles.display} mt-4 text-5xl uppercase`}>
          Sesh Wars is warming up
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-lg">
          The real competition opens here as soon as its home on Passport is
          switched on. Until then, the demo mountain is fully playable — 30
          fictional riders, challenges, votes, chirps, champions and patches.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/snow/sesh-wars/demo"
            className={`${styles.go} inline-flex min-h-12 items-center rounded-full px-6`}
          >
            Play the demo
          </Link>
          <Link
            href="/snow"
            className={`${styles.btn} inline-flex min-h-12 items-center px-6`}
          >
            Back to Snow
          </Link>
        </div>
      </main>
    </div>
  );
}

/** The real Sesh Wars: rows read as the caller, under row-level security. */
export default async function SeshWars({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = [] } = await params;
  const session = await adventureSession();
  const db = session?.db ?? (await visitorDb());
  const here = `/snow/sesh-wars${path.length ? `/${path.join("/")}` : ""}`;
  const signIn = `/auth?next=${encodeURIComponent(here)}`;
  if (!(await seshReady(db))) return <NotOpenYet />;
  const userId = session?.user.id ?? null;
  const loaded = await loadWorld(db, userId).catch(() => null);
  if (!loaded) return <NotOpenYet />;
  const { world, viewer } = loaded;
  return (
    <RealSesh
      world={visibleTo(world, viewer)}
      viewer={viewer}
      now={clock()}
      path={path}
      userId={userId}
      signIn={signIn}
    />
  );
}
