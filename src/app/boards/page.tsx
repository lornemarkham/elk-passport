import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type Board } from "@/lib/data/boards-repo";
import { listBoardsFor } from "@/lib/data/boards-server";
import { currentUser } from "@/lib/auth/currentUser";

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

function SignedOutState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-20 text-center">
      <Compass className="text-muted-foreground h-8 w-8" />
      <p className="text-lg font-medium">Boards keep what you find</p>
      <p className="text-muted-foreground max-w-sm text-sm">
        Sign in and the places you save stay here — on any device, whenever you
        come back. Browsing needs no account.
      </p>
      <Link
        href="/auth?next=/boards"
        className="bg-primary text-primary-foreground mt-2 rounded-full px-4 py-2 text-sm font-medium"
      >
        Sign in
      </Link>
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
  // A visitor has no boards — that is a fact about them, not a failed request,
  // so it renders the sign-in invitation rather than the Atlas error state.
  const user = await currentUser();

  let boards: Board[] | null = [];

  if (user) {
    try {
      boards = await listBoardsFor(user.id);
    } catch {
      boards = null;
    }
  }

  return (
    <main className="bg-background min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="mb-8 text-3xl font-bold tracking-tight">Your Boards</h1>

        {!user ? (
          <SignedOutState />
        ) : boards === null ? (
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
