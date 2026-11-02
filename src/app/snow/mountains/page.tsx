import type { Metadata } from "next";
import { PassportNav } from "@/components/shell/PassportNav";
import { SnowPage } from "@/components/snow/kit";
import { MountainExplorer } from "@/components/snow/MountainExplorer";
import { atlasSkiAreas, type AtlasAreas } from "../_server/atlas";

export const metadata: Metadata = {
  title: "Find a mountain — Snow — Passport",
};
export const dynamic = "force-dynamic";

export default async function MountainsPage() {
  const atlas: AtlasAreas = await atlasSkiAreas().catch(() => ({
    status: "unavailable",
    areas: [],
  }));
  return (
    <>
      <PassportNav displayName={null} />
      <SnowPage>
        <main className="mx-auto max-w-5xl px-5 pt-24 pb-24">
          <MountainExplorer atlas={atlas} />
        </main>
      </SnowPage>
    </>
  );
}
