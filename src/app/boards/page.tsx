import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listBoards, type Board } from "@/lib/data/boards-repo";

export const metadata: Metadata = {
  title: "Your Boards — Passport",
};

function formatCreatedAt(createdAt: string): string | null {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-20 text-center">
      <Compass className="text-muted-foreground h-8 w-8" />
      <p className="text-lg font-medium">No boards yet</p>
      <p className="text-muted-foreground max-w-sm text-sm">
        Boards you create will show up here.
      </p>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-20 text-center">
      <p className="text-lg font-medium">Couldn&apos;t load your boards</p>
      <p className="text-muted-foreground max-w-sm text-sm">
        Something went wrong reaching Atlas. Please try again in a moment.
      </p>
    </div>
  );
}

function BoardGrid({ boards }: { boards: Board[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {boards.map((board) => {
        const createdAt = formatCreatedAt(board.createdAt);
        return (
          <Link key={board.id} href={`/boards/${board.id}`}>
            <Card className="hover:border-primary/40 transition-colors">
              <CardHeader>
                <CardTitle className="truncate">{board.name}</CardTitle>
                {createdAt && (
                  <CardDescription>Created {createdAt}</CardDescription>
                )}
              </CardHeader>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

export default async function BoardsPage() {
  let boards: Board[] | null = null;

  try {
    boards = await listBoards();
  } catch {
    boards = null;
  }

  return (
    <main className="bg-background min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="mb-8 text-3xl font-bold tracking-tight">Your Boards</h1>

        {boards === null ? (
          <ErrorState />
        ) : boards.length === 0 ? (
          <EmptyState />
        ) : (
          <BoardGrid boards={boards} />
        )}
      </div>
    </main>
  );
}
