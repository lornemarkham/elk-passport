import { ArrowUpRight, FileText } from "lucide-react";
import type { MediaItem } from "@/lib/knowledge/entityKnowledgeView";

/**
 * **The first reusable content component.** One gallery, used everywhere.
 *
 * ## What it is for
 *
 * Every entity Atlas will ever hold has media: a trail has photographs, a
 * festival has a poster, a resort has a trail map, a restaurant has menus.
 * Those are the same component with different contents, and the moment we
 * let them be four components they will drift into four behaviours.
 *
 * ## Three rules, each of which was a bug first
 *
 * **The hero is marked, not separated.** Showing the lead image above the
 * gallery hides the only question worth asking about it — *is this the
 * right one out of these?* The BullWheel led with a photograph of the
 * restaurant next door for weeks, and it was invisible precisely because it
 * was displayed on its own.
 *
 * **A rejected asset stays visible, struck through.** An asset that
 * disappears when rejected looks exactly like one that was never found.
 * Those mean opposite things, and only one of them needs a curator.
 *
 * **Documents are opened, not looked at.** A menu PDF in a photo grid is a
 * grey rectangle. It gets a row with the source's own words for it —
 * "Summer Menu" is the only thing distinguishing one PDF from another.
 *
 * ## Deliberately not built
 *
 * No carousel, masonry, slideshow, comparison view, lightbox, tagging, drag
 * ordering or crop tool. A flat grid answers *what do we have* and *which
 * one leads*, which is the entire job today. `MediaItem` is
 * presentation-agnostic, so any of those become a change here and nowhere
 * else — which is the reason to resist adding them before something needs
 * one.
 */
export function MediaGallery({
  media,
  columns = 6,
}: {
  media: readonly MediaItem[];
  columns?: 4 | 6;
}) {
  if (media.length === 0) return null;

  const visual = media.filter((m) => m.kind !== "document");
  const documents = media.filter((m) => m.kind === "document");

  return (
    <div className="flex flex-col gap-3">
      {visual.length > 0 && (
        <div
          className={`grid grid-cols-2 gap-2 sm:grid-cols-4 ${columns === 6 ? "lg:grid-cols-6" : ""}`}
        >
          {visual.map((asset) => (
            <MediaTile key={asset.url} asset={asset} />
          ))}
        </div>
      )}

      {documents.map((doc) => (
        <a
          key={doc.url}
          href={doc.url}
          target="_blank"
          rel="noreferrer"
          className="border-border hover:bg-muted/40 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition"
        >
          <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
          <span className="font-medium">{doc.caption ?? "Document"}</span>
          <span className="text-muted-foreground truncate text-xs">
            {doc.url.split("/").pop()}
          </span>
          <ArrowUpRight className="text-muted-foreground ml-auto h-3.5 w-3.5 shrink-0" />
        </a>
      ))}
    </div>
  );
}

/**
 * The thumbnail is what the page published for browsing; the link is the
 * original, which is what a curator needs to judge. Falls back to the full
 * asset when the source rendered no thumbnail — never to a constructed URL.
 */
function MediaTile({ asset }: { asset: MediaItem }) {
  return (
    <a
      href={asset.url}
      target="_blank"
      rel="noreferrer"
      title={asset.caption ?? asset.url}
      className="group/tile relative block"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset.thumbnailUrl ?? asset.url}
        alt={asset.caption ?? ""}
        loading="lazy"
        className={`border-border h-24 w-full rounded-lg border object-cover transition ${
          asset.state === "rejected"
            ? "opacity-30 grayscale"
            : "group-hover/tile:brightness-110"
        }`}
      />
      {asset.isHero && (
        <span className="absolute top-1 left-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
          Hero
        </span>
      )}
      {asset.state === "rejected" && (
        <span className="bg-background/80 absolute right-1 bottom-1 rounded px-1 py-0.5 text-[10px]">
          rejected
        </span>
      )}
      {asset.state === "approved" && !asset.isHero && (
        <span className="absolute top-1 right-1 rounded bg-emerald-600/80 px-1 py-0.5 text-[10px] text-white">
          ✓
        </span>
      )}
    </a>
  );
}
