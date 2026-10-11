import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { currentUser, type PassportUser } from "@/lib/auth/currentUser";
import { loadBoardWithExperiences } from "@/lib/data/loadBoardWithExperiences";
import {
  gatheringBoardId,
  gatheringBySlug,
  type Gathering,
} from "@/lib/data/boards-gatherings";
import {
  kindredColleagues,
  summariseInterest,
} from "@/lib/data/boards-interest";
import { readBoardInterest } from "@/lib/data/boards-interest-server";
import { PassportNav } from "@/components/shell/PassportNav";
import {
  GatheringBoard,
  type GatheringViewer,
} from "@/components/boards/GatheringBoard";
import type { InterestPicture } from "@/components/boards/GatheringInterest";

/**
 * **`/boards/conference/{slug}` — a gathering's activities board.**
 *
 * The gathering's own board, opened through the same access every board uses:
 * owner, or a member who joined with an invite link. This page adds the
 * organiser's declared activities on top and nothing underneath — no second
 * membership list, no second store of saved things.
 *
 * Kept out of search engines: a staff gathering is not a public listing, even
 * though the plan on it names nobody.
 */
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const gathering = gatheringBySlug((await params).slug);
  return {
    title: gathering ? `${gathering.title} — Passport` : "Passport",
    robots: { index: false, follow: false },
  };
}

async function interestFor(
  user: PassportUser,
  boardId: string,
): Promise<InterestPicture | null> {
  try {
    const { rows, memberIds } = await readBoardInterest(boardId);
    return {
      summaries: summariseInterest(rows, user.id, memberIds),
      kindred: kindredColleagues(rows, user.id, memberIds),
    };
  } catch {
    // Not "nobody is interested" — the board says it could not ask.
    return null;
  }
}

async function viewerOf(
  gathering: Gathering,
  user: PassportUser | null,
): Promise<GatheringViewer> {
  if (!user) return { kind: "signed-out" };
  const boardId = gatheringBoardId(gathering);
  if (!boardId) return { kind: "no-board" };

  const board = await loadBoardWithExperiences(boardId);
  switch (board.status) {
    case "signed-out":
      return { kind: "signed-out" };
    case "not-found":
      return { kind: "not-member" };
    case "error":
      return { kind: "board-error" };
    case "ok":
      return {
        kind: "member",
        boardId,
        role: board.role,
        yourName: user.displayName,
        interest: await interestFor(user, boardId),
        adventures: board.experiences,
        unresolved: board.unresolved.length,
      };
  }
}

export default async function GatheringPage({ params }: Props) {
  const gathering = gatheringBySlug((await params).slug);
  if (!gathering) notFound();

  // No session, no Supabase, or Supabase down: all of them are a visitor here,
  // who still gets the plan and none of the people.
  const user = await currentUser().catch(() => null);
  const viewer = await viewerOf(gathering, user);

  return (
    <>
      <PassportNav displayName={user?.displayName ?? null} />
      <main className="bg-background min-h-screen">
        <div className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
          <Link
            href="/boards"
            className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-1.5 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Boards
          </Link>
          <GatheringBoard gathering={gathering} viewer={viewer} />
        </div>
      </main>
    </>
  );
}
