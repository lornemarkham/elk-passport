import Link from "next/link";
import { ArrowLeft, Compass, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loadBoardWithExperiences } from "@/lib/data/loadBoardWithExperiences";
import type { Experience } from "@/domain/experience/types";

type BoardPageProps = {
  params: Promise<{ id: string }>;
};

function StatePanel({
  icon: Icon,
  title,
  description,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-20 text-center">
      {Icon && <Icon className="text-muted-foreground h-8 w-8" />}
      <p className="text-lg font-medium">{title}</p>
      <p className="text-muted-foreground max-w-sm text-sm">{description}</p>
    </div>
  );
}

function ExperienceList({ experiences }: { experiences: Experience[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {experiences.map((experience) => (
        <Card key={experience.id}>
          <CardHeader>
            <CardTitle className="truncate">{experience.title}</CardTitle>
            <CardDescription className="line-clamp-2">
              {experience.shortDescription}
            </CardDescription>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

export default async function BoardPage({ params }: BoardPageProps) {
  const { id } = await params;
  const result = await loadBoardWithExperiences(id);

  return (
    <main className="bg-background min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <Link
          href="/boards"
          className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Boards
        </Link>

        {result.status === "signed-out" && (
          <StatePanel
            icon={Compass}
            title="Sign in to open this board"
            description="Boards belong to an account, so Passport needs to know who you are before it can open one."
          />
        )}

        {result.status === "error" && (
          <StatePanel
            title="Couldn't load this board"
            description="Something went wrong reaching Atlas. Please try again in a moment."
          />
        )}

        {result.status === "not-found" && (
          <StatePanel
            title="Board not found"
            description="This board may have been removed, or the link might be incorrect."
          />
        )}

        {result.status === "ok" && (
          <>
            <h1 className="mb-8 text-3xl font-bold tracking-tight">
              {result.board.name}
            </h1>
            {result.experiences.length === 0 ? (
              <StatePanel
                icon={Compass}
                title="Nothing saved yet"
                description="Experiences you save to this board will show up here."
              />
            ) : (
              <>
                <ExperienceList experiences={result.experiences} />

                {/* This used to offer "Start Passport", pointing at
                 * `/passport/{boardId}` — a route that takes an **entity** id
                 * and 404s on a board's. There is no board-level Passport:
                 * `buildPassportPage` composes one entity, and the passport
                 * layer has no concept of a board. Building one is real
                 * product work, recorded as debt in docs/product/discover.md.
                 *
                 * So the page offers the one true next step it already
                 * supports. Deliberately not a link back to this same page,
                 * and deliberately not a Passport for one arbitrarily chosen
                 * saved entity — picking which of five saved things "the
                 * Passport" is would be inventing the product rather than
                 * reporting it. */}
                <div className="mt-12 flex flex-col items-center gap-3 border-t pt-10 text-center">
                  <p className="text-muted-foreground text-sm">
                    Found what you were looking for?
                  </p>
                  <Button
                    size="lg"
                    nativeButton={false}
                    render={<Link href="/discovery" />}
                  >
                    Continue discovering
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
