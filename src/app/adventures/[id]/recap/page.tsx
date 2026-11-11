import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { ThemeProvider } from "@/components/ghad/theme";
import { RecapView } from "@/components/adventures/journey/RecapView";
import { adventureSession } from "@/lib/adventures/server";
import { adventureFor } from "@/lib/adventures/store";
import { atlasStopsFor, type AtlasStops } from "@/lib/adventures/atlas-names";
import { todayIn } from "@/lib/adventures/overview";
import { whenLabel } from "@/lib/adventures/present";
import { momentsOf, sharingOn } from "@/app/christmas/_server/together";

export const metadata: Metadata = {
  title: "Recap — Passport",
  robots: { index: false },
};

/**
 * **The recap of an adventure's day** — what was done, skipped, loved and
 * kept. Read as the signed-in person; "not found" covers missing and
 * not-yours identically. The person's own memories are read on their phone
 * (RecapView); only what someone chose to share with the group is read here.
 */
export default async function RecapPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const session = await adventureSession();
  if (!session) {
    return (
      <>
        <ThemeProvider className="block">
          <main className="mx-auto max-w-3xl px-4 py-16 text-center">
            <p className="ghad-display text-2xl font-extrabold">
              Sign in to open this
            </p>
            <Link
              href={`/auth?next=${encodeURIComponent(`/adventures/${id}/recap`)}`}
              className="mt-4 inline-flex min-h-12 items-center rounded-full bg-[var(--gh-ink)] px-6 font-semibold text-white"
            >
              Sign in
            </Link>
          </main>
        </ThemeProvider>
      </>
    );
  }
  const view = await adventureFor(session.db, id, session.user.id).catch(
    () => null,
  );
  if (!view) notFound();

  const today = todayIn(view.timeZone ?? null);
  const dayParam = (await searchParams)?.["day"];
  const days = [
    ...new Set(view.items.flatMap((i) => (i.onDay ? [i.onDay] : [])).sort()),
  ];
  // The day being recapped: asked for, else today if it is one of them, else
  // the most recent day that has begun, else the first.
  const onDay =
    (typeof dayParam === "string" && days.includes(dayParam)
      ? dayParam
      : undefined) ??
    (days.includes(today) ? today : undefined) ??
    [...days].reverse().find((d) => d <= today) ??
    days[0] ??
    today;
  const items = view.items
    .filter((i) => i.onDay === onDay)
    .sort((a, b) => a.position - b.position);
  const stops: AtlasStops = await atlasStopsFor(
    items.flatMap((i) => (i.atlasRef ? [i.atlasRef] : [])),
  ).catch((): AtlasStops => ({ names: {}, experiences: {} }));

  const sharing = await sharingOn(session.db, id).catch(() => false);
  const shared = sharing
    ? await momentsOf(session.db, id, session.user.id).catch(() => [])
    : [];

  const again = new URLSearchParams({
    with: view.items
      .flatMap((i) => (i.atlasRef ? [i.atlasRef] : []))
      .slice(0, 12)
      .join(","),
    ...(view.destinationTownId ? { at: view.destinationTownId } : {}),
    name: `${view.title} — again`,
  }).toString();

  return (
    <>
      <ThemeProvider className="block">
        <main className="min-h-screen bg-white">
          <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
            <Link
              href={`/adventures/${encodeURIComponent(id)}`}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[var(--gh-ink-soft)]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to the adventure
            </Link>
            <RecapView
              adventureId={view.id}
              title={view.title}
              when={whenLabel(onDay, null)}
              onDay={onDay}
              stops={items.map((i) => ({
                id: i.id,
                name:
                  i.label ??
                  (i.atlasRef
                    ? (stops.experiences[i.atlasRef]?.title ??
                      stops.names[i.atlasRef])
                    : undefined) ??
                  "A stop",
                experience: i.atlasRef
                  ? stops.experiences[i.atlasRef]
                  : undefined,
              }))}
              againHref={`/adventures/new?${again}`}
              members={Math.max(0, view.members.length - 1)}
              shared={shared.map((m) => ({
                id: m.id,
                by: m.by,
                text: m.text,
                hasPhoto: m.hasPhoto,
                mine: m.mine,
              }))}
              sharingOff={!sharing}
            />
          </div>
        </main>
      </ThemeProvider>
    </>
  );
}
