import { notFound } from "next/navigation";
import { MemoriesAlbum } from "@/components/conference-together/MemoriesAlbum";
import { ModuleTop, NotOpen } from "@/components/conference-together/ModuleTop";
import { readAlbum } from "@/lib/conference-memories/service";
import { modulePage } from "@/lib/conference-together/page";
import { memoriesDeps } from "@/lib/conference-together/request";

export const dynamic = "force-dynamic";

/** **The `memories` module: the shared album.** `?plan=<id>` shows one plan's photos. */
export default async function MemoriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ plan?: string }>;
}) {
  const page = await modulePage((await params).id, "memories");
  if (!page) notFound();
  const { ctx, identity, open } = page;
  const c = ctx.conference;
  if (!open)
    return (
      <>
        <ModuleTop
          conferenceId={c.id}
          conferenceName={c.name}
          title="Memories"
        />
        <NotOpen what="Memories" />
      </>
    );
  const album = await readAlbum(memoriesDeps(), identity, c.id);
  if (!album) notFound();
  return (
    <>
      <ModuleTop
        conferenceId={c.id}
        conferenceName={c.name}
        title="Memories"
        lede="What we did together, in pictures. Kept for everyone until a month after the last day."
      />
      <MemoriesAlbum
        conferenceId={c.id}
        initial={album}
        planFilter={(await searchParams).plan}
      />
    </>
  );
}
