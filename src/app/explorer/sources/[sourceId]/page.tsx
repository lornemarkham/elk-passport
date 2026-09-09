import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import {
  ExplorerNotFoundError,
  getSourceRecord,
} from "@/lib/data/explorer-dossier-repo";
import {
  Chip,
  Empty,
  EntityLink,
  Field,
  Id,
  Panel,
} from "@/components/explorer/primitives";

export const metadata: Metadata = {
  title: "Source record — Atlas Explorer",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ sourceId: string }> };

/**
 * **One source record, in full, and what it taught Atlas.**
 *
 * The dossier carries an excerpt so it stays fast; this is the deliberate
 * act of reading the whole page Atlas read. It answers the question that
 * decides whether a thin entity is Atlas's fault or the publisher's: *the
 * page was 16,000 characters — did it actually say anything about this
 * museum, or is Atlas holding a listicle that mentions it once?*
 *
 * `describes` runs SourceRecord → Entity, so the entities below are
 * everything this one page produced. A page describing fourteen
 * organisations is a listicle; a page describing one is a subject's own site.
 * That count alone usually settles the question.
 */
export default async function SourceRecordPage({ params }: Props) {
  const { sourceId } = await params;

  let payload;
  try {
    payload = await getSourceRecord(sourceId);
  } catch (error) {
    if (error instanceof ExplorerNotFoundError) notFound();
    throw error;
  }

  const { record, describes } = payload;

  return (
    <>
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Chip>{record.sourceType}</Chip>
          <h1 className="text-xl font-semibold tracking-tight break-all">
            {record.source}
          </h1>
          <a
            href={record.source}
            target="_blank"
            rel="noreferrer noopener"
            className="text-muted-foreground hover:text-foreground"
            aria-label="Open the original page"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <div className="text-muted-foreground mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <Id value={record.id} />
          <span className="font-mono">
            {record.rawContent.length.toLocaleString()} chars
          </span>
          <span className="font-mono">
            {describes.length} entities described
          </span>
          <span>
            retrieved {new Date(record.retrievedAt).toISOString().slice(0, 10)}
          </span>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col gap-4">
          <Panel title="Record">
            <dl>
              <Field label="Source type">
                <code className="font-mono text-xs">{record.sourceType}</code>
              </Field>
              <Field label="Read under" empty={!record.interpretedUnder}>
                <code className="font-mono text-xs">
                  {record.interpretedUnder}
                </code>
              </Field>
              <Field label="Media subject" empty={!record.mediaSubject}>
                {record.mediaSubject}
              </Field>
              <Field label="Lead image" empty={!record.imageUrl}>
                <span className="break-all">{record.imageUrl}</span>
              </Field>
              <Field label="Media" empty={!record.media?.length}>
                <span className="font-mono text-xs">
                  {record.media?.length} assets
                </span>
              </Field>
            </dl>
          </Panel>

          <Panel
            title="What this page taught Atlas"
            count={describes.length}
            subtitle="describes edges"
          >
            {describes.length === 0 ? (
              <Empty>
                Atlas read this page and created nothing from it. That is a real
                outcome, not a missing row — the page may have refused to yield
                a content region, or produced only duplicates of records it
                already held.
              </Empty>
            ) : (
              <ul>
                {describes.map((entity) => (
                  <li key={entity.id}>
                    <EntityLink
                      entity={{
                        ...entity,
                        isRegion: false,
                        subtype: undefined,
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel
          title="Raw content"
          subtitle="exactly what Atlas stored"
          count={record.rawContent.length}
        >
          {record.rawContent.length === 0 ? (
            <Empty>This record stores no content at all.</Empty>
          ) : (
            <pre className="bg-muted/40 max-h-[70vh] overflow-auto rounded p-3 font-mono text-[11px] whitespace-pre-wrap">
              {record.rawContent}
            </pre>
          )}
        </Panel>
      </div>
    </>
  );
}
