import type { Metadata } from "next";
import { PassportNav } from "@/components/shell/PassportNav";
import { SnowPage } from "@/components/snow/kit";
import { NewDay } from "@/components/snow/NewDay";

export const metadata: Metadata = {
  title: "Start a snow day — Passport",
  robots: { index: false },
};

export default async function NewSnowDay({
  searchParams,
}: {
  searchParams: Promise<{ mountain?: string; again?: string; atlas?: string }>;
}) {
  const { mountain, again, atlas } = await searchParams;
  return (
    <>
      <PassportNav displayName={null} />
      <SnowPage>
        <main className="mx-auto max-w-xl px-5 pt-24 pb-24">
          <NewDay
            mountainId={mountain}
            again={again}
            atlasName={atlas?.slice(0, 80)}
          />
        </main>
      </SnowPage>
    </>
  );
}
